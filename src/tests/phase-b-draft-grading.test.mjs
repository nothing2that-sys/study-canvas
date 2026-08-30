import test from "node:test";
import assert from "node:assert/strict";
import {
  DRAFT_SCHEMA_VERSION,
  createDraftSaveCoordinator,
  normalizeDraft,
  navigateWithDraftFlush
} from "../public/app/js/draftEngine.js";
import { createDrawingCanvas, InputProfile } from "../public/app/js/canvasEngine.js";
import { createSession } from "../public/app/js/sessionEngine.js";
import { saveSessionRecord, saveDraftSession, getDraftSession, clearAllData } from "../public/app/js/storage.js";
import { exportAllData, importBackupData } from "../public/app/js/backupEngine.js";

test("Phase B: schema 2 strokesMap과 pencilOnly를 분리 layer schema로 이관한다", () => {
  const legacy = {
    schemaVersion: 2,
    config: { pageSize: 4 },
    questions: [{ id: "q1" }],
    currentPageIndex: 0,
    strokesMap: { q1: [{ id: "student-1", points: [{ x: 1, y: 1 }] }] },
    elapsedMs: 1200,
    pencilOnly: true
  };

  const migrated = normalizeDraft(legacy);
  assert.equal(migrated.schemaVersion, DRAFT_SCHEMA_VERSION);
  assert.deepEqual(migrated.studentStrokesMap, legacy.strokesMap);
  assert.deepEqual(migrated.gradingStrokesMap, {});
  assert.deepEqual(migrated.gradingResults, {});
  assert.equal(migrated.totalElapsedMs, 1200);
  assert.equal(migrated.inputProfile, "IPAD_PEN_ONLY");
  assert.equal("strokesMap" in migrated, false);
  assert.throws(() => normalizeDraft({ config: {} }), /문제 데이터/);
});

test("Phase B: 페이지 이동은 이전 상태 저장 후 이동하고 변경된 page index를 다시 저장한다", async () => {
  const order = [];
  await navigateWithDraftFlush({
    flush: async () => order.push("flush"),
    navigate: () => order.push("navigate"),
    render: () => order.push("render")
  });
  assert.deepEqual(order, ["flush", "navigate", "render", "flush"]);

  const failedOrder = [];
  await assert.rejects(navigateWithDraftFlush({
    flush: async () => { failedOrder.push("flush"); throw new Error("save failed"); },
    navigate: () => failedOrder.push("navigate"),
    render: () => failedOrder.push("render")
  }), /save failed/);
  assert.deepEqual(failedOrder, ["flush"]);
});

test("Phase B: coordinator는 snapshot을 복제하고 저장을 직렬화해 최신 revision을 마지막에 남긴다", async () => {
  const source = { questions: [{ id: "q1" }], studentStrokesMap: { q1: [{ id: "s1" }] } };
  const saved = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  let callCount = 0;

  const coordinator = createDraftSaveCoordinator({
    captureSnapshot: () => source,
    save: async (snapshot) => {
      callCount += 1;
      if (callCount === 1) await firstGate;
      saved.push(snapshot);
    }
  });

  const first = coordinator.flush();
  source.studentStrokesMap.q1[0].id = "mutated-after-snapshot";
  const second = coordinator.flush();
  releaseFirst();
  await Promise.all([first, second]);

  assert.equal(saved.length, 2);
  assert.equal(saved[0].revision, 1);
  assert.equal(saved[0].studentStrokesMap.q1[0].id, "s1");
  assert.equal(saved[1].revision, 2);
  assert.equal(saved[1].studentStrokesMap.q1[0].id, "mutated-after-snapshot");
  assert.equal(coordinator.status, "saved");
});

test("Phase B: 저장 실패를 숨기지 않고 failed 상태와 재시도 성공을 제공한다", async () => {
  const statuses = [];
  let fail = true;
  const coordinator = createDraftSaveCoordinator({
    captureSnapshot: () => ({ questions: [{ id: "q1" }] }),
    save: async () => {
      if (fail) throw new Error("quota");
    },
    onStatusChange: (status) => statuses.push(status)
  });

  await assert.rejects(coordinator.flush(), /quota/);
  assert.equal(coordinator.status, "failed");
  fail = false;
  await coordinator.retry();
  assert.equal(coordinator.status, "saved");
  assert.equal(statuses.includes("failed"), true);
  coordinator.destroy();
});

test("Phase B: 학생 필기는 읽기 전용 background layer이고 채점 필기만 편집 layer로 반환한다", () => {
  const listeners = new Map();
  const student = [{ id: "student", color: "#173f35", width: 2, points: [{ x: 1, y: 1 }] }];
  const canvas = {
    width: 300,
    height: 260,
    style: {},
    getContext: () => ({ clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, stroke() {}, arc() {}, fill() {}, save() {}, restore() {}, setTransform() {} }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 260 }),
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: (type) => listeners.delete(type),
    setPointerCapture() {},
    releasePointerCapture() {}
  };
  const instance = createDrawingCanvas(canvas, { profile: InputProfile.IPAD_PEN_ONLY, backgroundStrokes: student });
  listeners.get("pointerdown")({ pointerType: "pen", pointerId: 1, clientX: 10, clientY: 10 });
  listeners.get("pointerup")({ pointerType: "pen", pointerId: 1, clientX: 10, clientY: 10 });
  assert.equal(instance.getBackgroundStrokes()[0].id, "student");
  assert.equal(instance.getStrokes().length, 1);
  assert.notEqual(instance.getStrokes()[0].id, "student");
  instance.clear();
  assert.equal(instance.getBackgroundStrokes()[0].id, "student");
  instance.destroy();
});

test("Phase B: 완료 기록과 백업에서 학생 필기, 채점 필기, 진행 Draft를 함께 보존한다", async () => {
  await clearAllData();
  const questions = [{ id: "q-layer", operation: "mul", operandA: 2, operandB: 3, answer: 6, level: "M1" }];
  const session = createSession({ operation: "mul", pageSize: 1 }, questions);
  session.start();
  session.startSubmitting();
  session.submitPractice(1000);
  session.setPendingGrading();
  session.startGrading();
  session.gradeQuestion("q-layer", true, "좋아요");
  const record = await saveSessionRecord(
    session.finishGrading(),
    new Map([["q-layer", [{ id: "student" }]]]),
    new Map([["q-layer", [{ id: "grading" }]]])
  );
  assert.equal(record.results[0].studentStrokes[0].id, "student");
  assert.equal(record.results[0].gradingStrokes[0].id, "grading");

  await saveDraftSession({
    questions,
    config: { pageSize: 1 },
    studentStrokesMap: { "q-layer": [{ id: "student-draft" }] },
    gradingStrokesMap: { "q-layer": [{ id: "grading-draft" }] },
    gradingResults: { "q-layer": { isCorrect: null, comment: "검토 중" } }
  });
  const backup = await exportAllData();
  assert.equal(backup.data.drafts.length, 1);
  assert.equal(backup.data.drafts[0].gradingStrokesMap["q-layer"][0].id, "grading-draft");

  await clearAllData();
  await importBackupData(backup, { mode: "replace" });
  const restoredDraft = await getDraftSession();
  assert.equal(restoredDraft.studentStrokesMap["q-layer"][0].id, "student-draft");
  assert.equal(restoredDraft.gradingResults["q-layer"].comment, "검토 중");
});
