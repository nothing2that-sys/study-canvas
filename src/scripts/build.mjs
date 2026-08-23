import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..", "public", "app");

export const BUILD_ID = "20260823_3";

export function buildSync() {
  console.log(`[build] Applying BUILD_ID: ${BUILD_ID}...`);

  // 1. service-worker.js 갱신
  const swPath = path.join(appDir, "service-worker.js");
  let swContent = fs.readFileSync(swPath, "utf8");
  swContent = swContent.replace(
    /const CACHE_NAME = "math-canvas-pro-v[^"]+";/,
    `const CACHE_NAME = "math-canvas-pro-v${BUILD_ID}";`
  );
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

  console.log(`[build] All assets synchronized with BUILD_ID ${BUILD_ID}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  buildSync();
}
