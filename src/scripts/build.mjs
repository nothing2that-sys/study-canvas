import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveBuildId, resolveGitSha } from "./build-id.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultAppDir = path.join(__dirname, "..", "public", "app");

export const BUILD_ID = resolveBuildId();

/**
 * registry.json 및 관련 manifest를 파싱하여 precache 대상 콘텐츠 파일 목록을 동적 수집
 */
export function collectContentPrecacheAssets({ contentDir = path.join(defaultAppDir, "content") } = {}) {
  const assets = [];
  const registryPath = path.join(contentDir, "registry.json");
  if (!fs.existsSync(registryPath)) {
    return assets;
  }
  assets.push("./content/registry.json");

  try {
    const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    if (Array.isArray(registry.packages)) {
      for (const pkg of registry.packages) {
        if (!pkg.manifestPath) continue;
        const relManifest = pkg.manifestPath.startsWith("./") ? pkg.manifestPath.slice(2) : pkg.manifestPath;
        const manifestFullPath = path.resolve(contentDir, relManifest);
        const manifestAssetPath = `./content/${relManifest.replace(/\\/g, "/")}`;
        if (!assets.includes(manifestAssetPath)) {
          assets.push(manifestAssetPath);
        }
        if (fs.existsSync(manifestFullPath)) {
          const manifestDir = path.dirname(manifestFullPath);
          const manifest = JSON.parse(fs.readFileSync(manifestFullPath, "utf8"));
          if (manifest.files && typeof manifest.files === "object") {
            for (const key of ["curriculum", "activities"]) {
              const fileRel = manifest.files[key];
              if (fileRel) {
                const targetFull = path.resolve(manifestDir, fileRel);
                const relToContent = path.relative(contentDir, targetFull).replace(/\\/g, "/");
                const assetPath = `./content/${relToContent}`;
                if (!assets.includes(assetPath)) {
                  assets.push(assetPath);
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[build] Failed to collect content precache assets: ${err.message}`);
  }
  return assets;
}

export function buildSync({
  appDir = defaultAppDir,
  buildId = BUILD_ID,
  gitSha = resolveGitSha(),
  generatedAt = process.env.SOURCE_DATE_EPOCH
    ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
    : new Date().toISOString()
} = {}) {
  console.log(`[build] Applying BUILD_ID: ${buildId}...`);

  // 1. service-worker.js 갱신
  const swPath = path.join(appDir, "service-worker.js");
  let swContent = fs.readFileSync(swPath, "utf8");
  swContent = swContent.replace(
    /const CACHE_NAME = "math-canvas-pro-v[^"]+";/,
    `const CACHE_NAME = "math-canvas-pro-v${buildId}";`
  );
  swContent = swContent.replace(/\.\/css\/app\.css\?v=[^"']+/g, `./css/app.css?v=${buildId}`);
  swContent = swContent.replace(/\.\/js\/app\.js\?v=[^"']+/g, `./js/app.js?v=${buildId}`);

  //+_+// Phase F10B: Registry 기반 정적 콘텐츠 패키지 오프라인 프리캐시 동적 주입
  const contentAssets = collectContentPrecacheAssets({ contentDir: path.join(appDir, "content") });
  const precacheMarkerRegex = /\/\*\s*CONTENT_PACKAGES_PRECACHE_START\s*\*\/[\s\S]*?\/\*\s*CONTENT_PACKAGES_PRECACHE_END\s*\*\//;
  if (precacheMarkerRegex.test(swContent)) {
    const precacheLines = [
      "/* CONTENT_PACKAGES_PRECACHE_START */",
      ...contentAssets.map((a) => `  "${a}",`),
      "  /* CONTENT_PACKAGES_PRECACHE_END */"
    ];
    swContent = swContent.replace(precacheMarkerRegex, precacheLines.join("\n"));
  }
  fs.writeFileSync(swPath, swContent, "utf8");

  // 2. index.html 버전 쿼리 갱신
  const htmlPath = path.join(appDir, "index.html");
  let htmlContent = fs.readFileSync(htmlPath, "utf8");
  htmlContent = htmlContent.replace(/css\/app\.css\?v=[^"]+/g, `css/app.css?v=${buildId}`);
  htmlContent = htmlContent.replace(/js\/app\.js\?v=[^"]+/g, `js/app.js?v=${buildId}`);
  fs.writeFileSync(htmlPath, htmlContent, "utf8");

  // 3. app.js 내부 BUILD_ID 갱신
  const appJsPath = path.join(appDir, "js", "app.js");
  let appJsContent = fs.readFileSync(appJsPath, "utf8");
  appJsContent = appJsContent.replace(/appBuildId: "[^"]+"/g, `appBuildId: "${buildId}"`);
  fs.writeFileSync(appJsPath, appJsContent, "utf8");

  //+_+// 원본 덮어쓰기는 BUILD_ID가 표시된 세 파일로 제한하고 manifest에 정책을 기록한다.
  const buildManifest = {
    buildId,
    generatedAt,
    gitSha,
    sourceMutationPolicy: "service-worker.js (version & content precache marker), index.html, js/app.js의 version marker만 교체",
    reproducibilityPolicy: "BUILD_ID와 SOURCE_DATE_EPOCH를 고정하면 동일 source에서 동일 산출물 생성"
  };
  fs.writeFileSync(path.join(appDir, "build-manifest.json"), `${JSON.stringify(buildManifest, null, 2)}\n`, "utf8");

  console.log(`[build] All assets synchronized with BUILD_ID ${buildId}.`);
  return buildManifest;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  buildSync();
}
