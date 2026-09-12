import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "../public/app");

function read(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), "utf8");
}

test("Phase F0: 기존 저장소 이름과 DB 버전을 기준선으로 고정한다", () => {
  const source = read("js/storage.js");

  assert.match(source, /const DB_NAME = "math_canvas_pro_db"/);
  assert.match(source, /const DB_VERSION = [2-9]\d*/);

  for (const store of ["sessions", "attempts", "mistakes", "stageProgress", "strokes", "draftSessions"]) {
    assert.match(source, new RegExp(`objectStoreNames\\.contains\\("${store}"\\)`));
  }
});

test("Phase F0: 학습 플랫폼 확장 전 기존 수학 핵심 모듈을 보존한다", () => {
  for (const moduleName of [
    "mathGen.js",
    "curriculumRegistry.js",
    "sessionEngine.js",
    "canvasEngine.js",
    "storage.js",
    "masteryEngine.js",
    "adaptiveEngine.js"
  ]) {
    assert.equal(fs.existsSync(path.join(appRoot, "js", moduleName)), true, `${moduleName} 누락`);
  }
});

test("Phase F0: 제출과 보호자 채점의 기존 계약을 기준선으로 고정한다", () => {
  const sessionSource = read("js/sessionEngine.js");
  const appSource = read("js/app.js");

  assert.match(sessionSource, /function gradeQuestion\(/);
  assert.match(sessionSource, /function getGradingStatus\(/);
  assert.match(sessionSource, /allGraded:/);
  assert.match(sessionSource, /아직 채점되지 않은 문제가/);
  assert.match(appSource, /renderGradingQuestionNavigator/);
  assert.match(appSource, /finishGradingBtn\.disabled = !status\.allGraded/);
});

test("Phase F0: 학생 필기와 보호자 채점 필기 레이어를 분리한다", () => {
  const draftSource = read("js/draftEngine.js");
  const storageSource = read("js/storage.js");

  assert.match(draftSource, /studentStrokesMap/);
  assert.match(draftSource, /gradingStrokesMap/);
  assert.match(storageSource, /studentStrokes/);
  assert.match(storageSource, /gradingStrokes/);
});

test("Phase F0: 확장 구현은 공식 소스에서만 수행한다", () => {
  const packageSource = fs.readFileSync(path.resolve(here, "../package.json"), "utf8");
  const packageJson = JSON.parse(packageSource);

  assert.equal(packageJson.scripts.build, "node scripts/build.mjs");
  assert.equal(packageJson.scripts.verify, "node scripts/verify-dist-sync.mjs");
  assert.equal(fs.existsSync(path.join(appRoot, "index.html")), true);
});
