import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveBuildId } from "./build-id.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..", "public", "app");

export const BUILD_ID = resolveBuildId();

export function buildSync() {
  console.log(`[build] Applying BUILD_ID: ${BUILD_ID}...`);

  // 1. service-worker.js 갱신
  const swPath = path.join(appDir, "service-worker.js");
  let swContent = fs.readFileSync(swPath, "utf8");
  swContent = swContent.replace(
    /const CACHE_NAME = "math-canvas-pro-v[^"]+";/,
    `const CACHE_NAME = "math-canvas-pro-v${BUILD_ID}";`
  );
  swContent = swContent.replace(/\.\/css\/app\.css\?v=[^"']+/g, `./css/app.css?v=${BUILD_ID}`);
  swContent = swContent.replace(/\.\/js\/app\.js\?v=[^"']+/g, `./js/app.js?v=${BUILD_ID}`);
  fs.writeFileSync(swPath, swContent, "utf8");

  // 2. index.html 버전 쿼리 갱신
  const htmlPath = path.join(appDir, "index.html");
  let htmlContent = fs.readFileSync(htmlPath, "utf8");
  htmlContent = htmlContent.replace(/css\/app\.css\?v=[^"]+/g, `css/app.css?v=${BUILD_ID}`);
  htmlContent = htmlContent.replace(/js\/app\.js\?v=[^"]+/g, `js/app.js?v=${BUILD_ID}`);
  fs.writeFileSync(htmlPath, htmlContent, "utf8");

  // 3. app.js 내부 BUILD_ID 갱신
  const appJsPath = path.join(appDir, "js", "app.js");
  let appJsContent = fs.readFileSync(appJsPath, "utf8");
  appJsContent = appJsContent.replace(/appBuildId: "[^"]+"/g, `appBuildId: "${BUILD_ID}"`);
  fs.writeFileSync(appJsPath, appJsContent, "utf8");

  //+_+// 원본 덮어쓰기는 BUILD_ID가 표시된 세 파일로 제한하고 manifest에 정책을 기록한다.
  const generatedAt = process.env.SOURCE_DATE_EPOCH
    ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
    : new Date().toISOString();
  const buildManifest = {
    buildId: BUILD_ID,
    generatedAt,
    gitSha: BUILD_ID.split("-").at(-1),
    sourceMutationPolicy: "service-worker.js, index.html, js/app.js의 version marker만 교체",
    reproducibilityPolicy: "BUILD_ID와 SOURCE_DATE_EPOCH를 고정하면 동일 source에서 동일 산출물 생성"
  };
  fs.writeFileSync(path.join(appDir, "build-manifest.json"), `${JSON.stringify(buildManifest, null, 2)}\n`, "utf8");

  console.log(`[build] All assets synchronized with BUILD_ID ${BUILD_ID}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  buildSync();
}
