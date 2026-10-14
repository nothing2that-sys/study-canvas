import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveBuildId, resolveGitSha } from "./build-id.mjs";
import { verifyCatalogIntegrity } from "../content-factory/shard/catalogCompiler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultAppDir = path.join(__dirname, "..", "public", "app");

export const BUILD_ID = resolveBuildId();

/**
 * registry.json 및 관련 manifest를 파싱하여 precache 대상 콘텐츠 파일 목록을 동적 수집 (Generic & Fail-Closed)
 */
export function collectContentPrecacheAssets({ contentDir = path.join(defaultAppDir, "content") } = {}) {
  const registryPath = path.join(contentDir, "registry.json");
  if (!fs.existsSync(registryPath)) {
    return [];
  }
  const assetSet = new Set();
  assetSet.add("./content/registry.json");

  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  if (!Array.isArray(registry.packages)) {
    throw new Error(`[build] registry.json의 packages는 배열이어야 합니다: ${registryPath}`);
  }

  for (const pkg of registry.packages) {
    if (!pkg.manifestPath) {
      throw new Error(`[build] 패키지 항목에 manifestPath가 누락되었습니다: ${JSON.stringify(pkg)}`);
    }
    const relManifest = pkg.manifestPath.startsWith("./") ? pkg.manifestPath.slice(2) : pkg.manifestPath;
    const manifestFullPath = path.resolve(contentDir, relManifest);
    if (!fs.existsSync(manifestFullPath)) {
      throw new Error(`[build] manifest 파일이 존재하지 않습니다: ${manifestFullPath}`);
    }
    const manifestAssetPath = `./content/${path.relative(contentDir, manifestFullPath).replace(/\\/g, "/")}`;
    assetSet.add(manifestAssetPath);

    const manifestDir = path.dirname(manifestFullPath);
    const manifest = JSON.parse(fs.readFileSync(manifestFullPath, "utf8"));
    if (manifest.files && typeof manifest.files === "object") {
      for (const fileRel of Object.values(manifest.files)) {
        if (typeof fileRel === "string" && fileRel.trim()) {
          const targetFull = path.resolve(manifestDir, fileRel.trim());
          if (!fs.existsSync(targetFull)) {
            throw new Error(`[build] Precache 대상 파일이 존재하지 않습니다: ${targetFull} (manifest: ${manifestFullPath})`);
          }
          const relToContent = path.relative(contentDir, targetFull).replace(/\\/g, "/");
          const assetPath = `./content/${relToContent}`;
          //+_+// Shard bodies are verified at build time, then cached on demand, never in the initial shell.
          if (!manifest.isSharded || !/^shards[\\/]/.test(fileRel.trim().replace(/^\.\//, ""))) assetSet.add(assetPath);
        }
      }
    }
    if (manifest.isSharded) {
      const catalogPath = path.join(manifestDir, "catalog.json");
      assetSet.add(`./content/${path.relative(contentDir, catalogPath).replace(/\\/g, "/")}`);
      const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
      if (!Array.isArray(catalog.shards) || !catalog.shards.length) {
        throw new Error(`[build] Sharded catalog is empty: ${catalogPath}`);
      }
      const shardContents = new Map();
      for (const shard of catalog.shards) {
        if (!/^shard-[a-z0-9-]+$/.test(shard.shardId)) {
          throw new Error(`[build] Invalid shard ID: ${shard.shardId}`);
        }
        const shardFile = path.join(manifestDir, "shards", `${shard.shardId}.json`);
        shardContents.set(shard.shardId, fs.readFileSync(shardFile, "utf8"));
      }
      const integrity = verifyCatalogIntegrity(catalog, shardContents);
      if (!integrity.valid) throw new Error(`[build] Sharded catalog integrity failed: ${integrity.errors.join("; ")}`);
    }
  }

  const assets = Array.from(assetSet);
  assets.sort((a, b) => {
    if (a === "./content/registry.json") return -1;
    if (b === "./content/registry.json") return 1;
    return a.localeCompare(b);
  });
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
  const modulePaths = [];
  function collectModules(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) collectModules(file);
      else if (entry.name.endsWith('.js')) modulePaths.push(`./${path.relative(appDir, file).replace(/\\/g, '/')}`);
    }
  }
  collectModules(path.join(appDir, 'js')); modulePaths.sort();
  const importMap = { imports: Object.fromEntries(modulePaths.map(file => [file, `${file}?v=${buildId}`])) };

  // 1. service-worker.js 갱신
  const swPath = path.join(appDir, "service-worker.js");
  let swContent = fs.readFileSync(swPath, "utf8");
  swContent = swContent.replace(
    /const CACHE_NAME = "math-canvas-pro-v[^"]+";/,
    `const CACHE_NAME = "math-canvas-pro-v${buildId}";`
  );
  swContent = swContent.replace(/\.\/css\/app\.css\?v=[^"']+/g, `./css/app.css?v=${buildId}`);
  swContent = swContent.replace(/\.\/js\/app\.js\?v=[^"']+/g, `./js/app.js?v=${buildId}`);
  const moduleMarker = /\/\* MODULES_PRECACHE_START \*\/[\s\S]*?\/\* MODULES_PRECACHE_END \*\//;
  const moduleCache = ['/* MODULES_PRECACHE_START */', ...modulePaths.filter(file => file !== './js/app.js').map(file => `  "${file}?v=${buildId}",`), '  /* MODULES_PRECACHE_END */'].join('\n');
  if (moduleMarker.test(swContent)) swContent = swContent.replace(moduleMarker, moduleCache);
  else swContent = swContent.replace('const APP_SHELL = [', `const APP_SHELL = [\n  ${moduleCache}`);

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
  const mapScript = `<script type="importmap">${JSON.stringify(importMap)}</script>`;
  if (/<script type="importmap">[\s\S]*?<\/script>/.test(htmlContent)) htmlContent = htmlContent.replace(/<script type="importmap">[\s\S]*?<\/script>/, mapScript);
  else htmlContent = htmlContent.replace('<script type="module"', `${mapScript}\n    <script type="module"`);
  fs.writeFileSync(htmlPath, htmlContent, "utf8");

  // QA uses the same pinned module graph; an old worker must not supply stale storage code.
  const qaPath = path.join(appDir, "qa.html");
  if (fs.existsSync(qaPath)) {
    let qa = fs.readFileSync(qaPath, "utf8").replace(/js\/f16dQaPage\.js(?:\?v=[^"]+)?/g, `js/f16dQaPage.js?v=${buildId}`);
    if (/<script type="importmap">[\s\S]*?<\/script>/.test(qa)) qa = qa.replace(/<script type="importmap">[\s\S]*?<\/script>/, mapScript);
    else qa = qa.replace('<script type="module"', `${mapScript}\n<script type="module"`);
    fs.writeFileSync(qaPath, qa, "utf8");
  }

  // 3. app.js 내부 BUILD_ID 갱신
  const appJsPath = path.join(appDir, "js", "app.js");
  let appJsContent = fs.readFileSync(appJsPath, "utf8");
  const appBuildMarker = /const APP_BUILD_ID = "[^"]+";/;
  if (!appBuildMarker.test(appJsContent)) throw new Error("app.js APP_BUILD_ID marker missing");
  appJsContent = appJsContent.replace(appBuildMarker, `const APP_BUILD_ID = "${buildId}";`);
  fs.writeFileSync(appJsPath, appJsContent, "utf8");

  //+_+// 원본 덮어쓰기는 BUILD_ID가 표시된 세 파일로 제한하고 manifest에 정책을 기록한다.
  const buildManifest = {
    buildId,
    generatedAt,
    gitSha,
    sourceMutationPolicy: "service-worker.js version/content/module precache, index.html and optional qa.html version/import map, js/app.js version marker; module source unchanged",
    reproducibilityPolicy: "BUILD_ID와 SOURCE_DATE_EPOCH를 고정하면 동일 source에서 동일 산출물 생성"
  };
  fs.writeFileSync(path.join(appDir, "build-manifest.json"), `${JSON.stringify(buildManifest, null, 2)}\n`, "utf8");

  console.log(`[build] All assets synchronized with BUILD_ID ${buildId}.`);
  return buildManifest;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  buildSync();
}

