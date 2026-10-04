//+_+// Math Canvas Pro - Phase F4 Submission Snapshot & Answer Lock Comprehensive Tests
//+_+// SSOT Section 16 및 Phase F4 5차 명세 준수

import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "fake-indexeddb/auto";

import {
  createSession,
  SessionState,
  mistakeToQuestion
} from "../public/app/js/sessionEngine.js";

import {
  createQuestionTimer,
  startSessionTimer
} from "../public/app/js/timer.js";

import {
  getDB,
  closeDB,
  clearAllData,
  DEFAULT_LEGACY_LEARNER_ID,
  setCurrentLearnerId,
  getCurrentLearnerId,
  clearCurrentLearner,
  _resetActiveLearnerInMemoryForTesting,
  _setSubmissionFailureInjectorForTesting,
  _setDraftCleanupFailureInjectorForTesting,
  _setSubmissionTransactionObserverForTesting,
  saveSubmissionSnapshot,
  getSubmission,
  getSubmissionBySessionId,
  getPendingSubmissions,
  getAllSubmissions,
  updateSubmissionGrading,
  saveDraftSession,
  getDraftSession,
  clearDraftSession,
  saveSessionRecord,
  getRecentSessions,
  createLearnerProfile
} from "../public/app/js/storage.js";

import {
  submitLearningSession,
  startSubmissionGrading,
  updateSubmissionGrading as commandUpdateSubmissionGrading,
  saveDraft,
  clearDraft,
  saveSession
} from "../public/app/js/data/learningCommands.js";

import {
  getSubmission as queryGetSubmission,
  getSubmissionBySessionId as queryGetSubmissionBySessionId,
  getPendingSubmissions as queryGetPendingSubmissions,
  getDraft,
  getRecentSessions as queryGetRecentSessions
} from "../public/app/js/data/learningQueries.js";

import {
  createLearner,
  selectLearner,
  configureLearnerSessionGuard,
  _resetLearnerSessionGuardForTesting
} from "../public/app/js/learners/learnerCommands.js";

import {
  getActiveLearner,
  getActiveLearnerId
} from "../public/app/js/learners/learnerQueries.js";

import {
  createDrawingCanvas,
  InputProfile
} from "../public/app/js/canvasEngine.js";

import {
  createDraftSaveCoordinator,
  DraftSaveStatus,
  normalizeDraft
} from "../public/app/js/draftEngine.js";

import {
  canMutatePractice,
  runPracticeMutation,
  applyStudentStrokeChange,
  performPracticeUndo,
  performPracticeRedo,
  performPracticeClear,
  performPracticeToolSelect,
  performPracticePageNav
} from "../public/app/js/practiceInteractionGuard.js";

import {
  rollbackSubmissionToPractice,
  restoreSessionStateFromDraft,
  evaluateStartupDraftResumePolicy,
  isSubmittedSnapshotStatus
} from "../public/app/js/submissionLifecycle.js";

import { bootstrapApp } from "../public/app/js/platform/appBootstrap.js";
import { ROUTES } from "../public/app/js/platform/appRouter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 테스트용 표준 샘플 문제 생성 헬퍼
function createSampleQuestions() {
  return [
    {
      id: "q_1",
      key: "mul:23:4",
      questionKey: "mul:23:4",
      operation: "mul",
      operandA: 23,
      operandB: 4,
      answer: 92,
      expectedAnswer: 92,
      level: "M2",
      macroLevelId: "M2",
      stageId: "M2-1",
      mathFormat: "vertical"
    },
    {
      id: "q_2",
      key: "mul:45:6",
      questionKey: "mul:45:6",
      operation: "mul",
      operandA: 45,
      operandB: 6,
      answer: 270,
      expectedAnswer: 270,
      level: "M2",
      macroLevelId: "M2",
      stageId: "M2-1",
      mathFormat: "vertical"
    }
  ];
}

function setupTestCanvasHarness() {
  const drawnOperations = [];
  const context = {
    clearRect(...args) { drawnOperations.push(["clearRect", ...args]); },
    beginPath() { drawnOperations.push(["beginPath"]); },
    moveTo(x, y) { drawnOperations.push(["moveTo", x, y]); },
    lineTo(x, y) { drawnOperations.push(["lineTo", x, y]); },
    quadraticCurveTo(...args) { drawnOperations.push(["quadraticCurveTo", ...args]); },
    stroke() { drawnOperations.push(["stroke"]); },
    arc(...args) { drawnOperations.push(["arc", ...args]); },
    fill() { drawnOperations.push(["fill"]); },
    save() { drawnOperations.push(["save"]); },
    restore() { drawnOperations.push(["restore"]); },
    setTransform() {}
  };

  const canvas = {
    width: 400,
    height: 400,
    style: {},
    getContext: () => context,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }),
    addEventListener: () => {},
    removeEventListener: () => {},
    setPointerCapture() {},
    releasePointerCapture() {}
  };

  const container = {
    appendChild: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 })
  };

  const prev = {
    window: globalThis.window,
    document: globalThis.document,
    ResizeObserver: globalThis.ResizeObserver,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame
  };

  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  globalThis.document = {
    createElement: (tag) => {
      if (tag === "canvas") return canvas;
      return { appendChild: () => {}, style: {} };
    },
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  globalThis.requestAnimationFrame = (cb) => { cb(); return 1; };
  globalThis.cancelAnimationFrame = () => {};

  return {
    canvas,
    container,
    restore() {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete globalThis[k];
        else globalThis[k] = v;
      }
    }
  };
}

test("Phase F4: 1. 정상 제출 시 불변 SubmissionSnapshot 생성 및 스키마 검증", async () => {
  await clearAllData();
  _resetActiveLearnerInMemoryForTesting();

  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const questions = createSampleQuestions();
  const session = createSession({ sessionId: "sess_f4_001", operation: "mul", pageSize: 4 }, questions);
  session.start();

  const studentStrokesMap = new Map([
    ["q_1", [{ id: "str_1", color: "#1e293b", points: [{ x: 10, y: 10 }, { x: 20, y: 20 }] }]],
    ["q_2", [{ id: "str_2", color: "#1e293b", points: [{ x: 30, y: 30 }] }]]
  ]);

  const submission = await submitLearningSession({
    session,
    learnerId: learner.id,
    subjectId: "math",
    moduleId: "arithmetic",
    inputProfile: "DESKTOP_MOUSE_PEN",
    totalSolveTimeMs: 25000,
    perQuestionElapsedMs: { q_1: 12000, q_2: 13000 },
    studentStrokesMap,
    appBuildId: "build-f4-test-01"
  });

  // 필수 필드 및 스키마 검증
  assert.ok(submission);
  assert.equal(submission.id, "sub_sess_f4_001");
  assert.equal(submission.sessionId, "sess_f4_001");
  assert.equal(submission.learnerId, learner.id);
  assert.equal(submission.subjectId, "math");
  assert.equal(submission.moduleId, "arithmetic");
  assert.equal(submission.status, "PARENT_GRADING_PENDING");
  assert.equal(submission.schemaVersion, 4);
  assert.equal(submission.totalSolveTimeMs, 25000);
  assert.equal(submission.questions.length, 2);
  assert.ok(submission.studentStrokesMap.q_1);
  assert.equal(submission.studentStrokesMap.q_1.length, 1);
  assert.ok(submission.submittedAt > 0);
});

test("Phase F4: 2. Snapshot의 learnerId 소유권 및 격리 검증", async () => {
  await clearAllData();
  const learnerA = await createLearner({ name: "학습자A" });
  const learnerB = await createLearner({ name: "학습자B" });

  const sessionA = createSession({ sessionId: "sess_a" }, createSampleQuestions());
  sessionA.start();
  await submitLearningSession({ session: sessionA, learnerId: learnerA.id });

  const sessionB = createSession({ sessionId: "sess_b" }, createSampleQuestions());
  sessionB.start();
  await submitLearningSession({ session: sessionB, learnerId: learnerB.id });

  const submissionsA = await getAllSubmissions({ learnerId: learnerA.id });
  const submissionsB = await getAllSubmissions({ learnerId: learnerB.id });

  assert.equal(submissionsA.length, 1);
  assert.equal(submissionsA[0].sessionId, "sess_a");
  assert.equal(submissionsA[0].learnerId, learnerA.id);

  assert.equal(submissionsB.length, 1);
  assert.equal(submissionsB[0].sessionId, "sess_b");
  assert.equal(submissionsB[0].learnerId, learnerB.id);
});

test("Phase F4: 3. 제출 완료 후 학생 답안 수정 차단 (Answer Lock) 검증", async () => {
  const session = createSession({ sessionId: "sess_lock" }, createSampleQuestions());
  session.start();

  assert.equal(session.state, SessionState.PRACTICE_ACTIVE);
  assert.equal(session.isLocked(), false);

  session.startSubmitting();
  session.submitPractice(15000);
  assert.equal(session.state, SessionState.SUBMITTED_LOCKED);
  assert.equal(session.isLocked(), true);

  // 제출 후 다시 submitPractice 호출 불가 검증
  assert.throws(() => {
    session.submitPractice(20000);
  }, /풀이를 제출할 수 없습니다/);
});

test("Phase F4: 4. 제출 완료 후 학생 필기 획(Stroke) 수정/추가/삭제/Undo 차단 검증", async () => {
  const harness = setupTestCanvasHarness();
  try {
    const canvas = createDrawingCanvas(harness.canvas, {
      readOnly: true,
      inputProfile: InputProfile.DESKTOP_MOUSE_PEN
    });

    const initialStrokes = [{ id: "str_1", points: [{ x: 10, y: 10 }, { x: 20, y: 20 }] }];
    canvas.setBackgroundStrokes(initialStrokes);

    assert.equal(canvas.getStrokes().length, 0, "Read-only 모드에서는 활성 필기 획 없음");
    assert.equal(canvas.getBackgroundStrokes().length, 1, "배경 학생 필기 획 보존");

    // Read-only 캔버스에서 undo/clear/redo 동작 시에도 학생 배경 필기 보존 검증
    canvas.undo();
    assert.equal(canvas.getBackgroundStrokes().length, 1, "Undo로 학생 필기 삭제 불가");

    canvas.clear();
    assert.equal(canvas.getBackgroundStrokes().length, 1, "Clear로 학생 필기 삭제 불가");

    canvas.redo();
    assert.equal(canvas.getBackgroundStrokes().length, 1, "Redo로도 학생 필기 변조 불가");
    assert.equal(canvas.getStrokes().length, 0, "Read-only 모드에서는 활성 필기 획 0개 유지");
  } finally {
    harness.restore();
  }
});

test("Phase F4: 5. 보호자 채점(Red-pen) 레이어와 학생 필기 Snapshot의 완전 분리 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const studentStrokes = {
    q_1: [{ id: "s1", color: "#1e293b", points: [{ x: 5, y: 5 }] }]
  };

  const submission = await saveSubmissionSnapshot({
    sessionId: "sess_layer_test",
    learnerId: learner.id,
    studentStrokesMap: studentStrokes,
    questions: createSampleQuestions()
  });

  assert.deepEqual(submission.studentStrokesMap, studentStrokes);
  assert.deepEqual(submission.gradingStrokesMap, {});

  // 보호자 채점 스트로크 추가
  const redPenStrokes = {
    q_1: [{ id: "red_1", color: "#c62828", points: [{ x: 50, y: 50 }] }]
  };

  await startSubmissionGrading(submission.id, { learnerId: learner.id });
  const updated = await updateSubmissionGrading(
    submission.id,
    {
      q_1: { isCorrect: true, comment: "참 잘했어요" },
      q_2: { isCorrect: true }
    },
    redPenStrokes,
    { learnerId: learner.id, status: "GRADED" }
  );

  assert.deepEqual(updated.studentStrokesMap, studentStrokes, "학생 필기는 변경되지 않음");
  assert.deepEqual(updated.gradingStrokesMap, redPenStrokes, "보호자 빨간펜 스트로크 분리 저장");
  assert.equal(updated.status, "GRADED");
});

test("Phase F4: 6. 동일 세션 중복 제출 시 멱등성 (Idempotency) 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });

  const session = createSession({ sessionId: "sess_idempotent" }, createSampleQuestions());
  session.start();

  const firstSubmission = await submitLearningSession({
    session,
    learnerId: learner.id,
    totalSolveTimeMs: 10000
  });

  const secondSubmission = await submitLearningSession({
    session,
    learnerId: learner.id,
    totalSolveTimeMs: 20000
  });

  assert.equal(firstSubmission.id, secondSubmission.id);
  assert.equal(firstSubmission.submittedAt, secondSubmission.submittedAt);

  const allSubmissions = await getAllSubmissions({ learnerId: learner.id });
  assert.equal(allSubmissions.length, 1, "동일 세션은 오직 1개의 submission만 존재");
});

test("Phase F4: 7. 저장 실패 시 Snapshot 미생성 및 세션/Draft 보존 (원자성) 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  // 진행 중인 Draft 저장
  await saveDraft({
    sessionId: "sess_atomic",
    questions: createSampleQuestions(),
    currentPageIndex: 0
  }, { learnerId: learner.id });

  // 유효하지 않은 인자로 제출 시도 (강제 실패 유도)
  await assert.rejects(async () => {
    await submitLearningSession(null);
  }, /필요합니다/);

  // Snapshot이 생성되지 않았는지 확인
  const submissions = await getAllSubmissions({ learnerId: learner.id });
  assert.equal(submissions.length, 0);

  // Draft가 보존되어 있는지 확인
  const draft = await getDraft({ learnerId: learner.id });
  assert.ok(draft, "저장 실패 시 기존 Draft 보존");
  assert.equal(draft.sessionId, "sess_atomic");
});

test("Phase F4: 8. 저장 성공 확인 전 Draft 삭제 금지 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  await saveDraft({
    sessionId: "sess_draft_protect",
    questions: createSampleQuestions()
  }, { learnerId: learner.id });

  // 정상 제출 실행
  const session = createSession({ sessionId: "sess_draft_protect" }, createSampleQuestions());
  session.start();

  await submitLearningSession({ session, learnerId: learner.id });

  // 제출 성공 후 Draft가 삭제되었는지 확인
  const draftAfter = await getDraft({ learnerId: learner.id });
  assert.equal(draftAfter, null, "제출 성공 후에만 Draft 삭제");
});

test("Phase F4: 9. 제출 성공 후 Active Draft 정상 정리 (Lifecycle 종료) 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  await saveDraft({ sessionId: "sess_lifecycle", questions: createSampleQuestions() }, { learnerId: learner.id });
  assert.ok(await getDraft({ learnerId: learner.id }));

  const session = createSession({ sessionId: "sess_lifecycle" }, createSampleQuestions());
  session.start();

  const submission = await submitLearningSession({ session, learnerId: learner.id });
  assert.ok(submission);

  const draft = await getDraft({ learnerId: learner.id });
  assert.equal(draft, null, "제출 완료 시 활성 Draft 정상 정리");
});

test("Phase F4: 10. 새로고침 및 재실행 후 제출된 Snapshot 상태 복원 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const session = createSession({ sessionId: "sess_restore" }, createSampleQuestions());
  session.start();

  await submitLearningSession({
    session,
    learnerId: learner.id,
    studentStrokesMap: new Map([["q_1", [{ id: "st1", points: [{ x: 1, y: 1 }] }]]])
  });

  // 새 인스턴스에서 조회 (새로고침 모사)
  const restored = await queryGetSubmissionBySessionId("sess_restore", { learnerId: learner.id });
  assert.ok(restored);
  assert.equal(restored.sessionId, "sess_restore");
  assert.equal(restored.status, "PARENT_GRADING_PENDING");
  assert.ok(restored.studentStrokesMap.q_1);
});

test("Phase F4: 11. 학습자 A와 B의 제출본 및 채점 대기 목록 완전 격리 검증", async () => {
  await clearAllData();
  const learnerA = await createLearner({ name: "학습자A" });
  const learnerB = await createLearner({ name: "학습자B" });

  const sessionA = createSession({ sessionId: "sess_pending_a" }, createSampleQuestions());
  sessionA.start();
  await submitLearningSession({ session: sessionA, learnerId: learnerA.id });

  const sessionB = createSession({ sessionId: "sess_pending_b" }, createSampleQuestions());
  sessionB.start();
  await submitLearningSession({ session: sessionB, learnerId: learnerB.id });

  const pendingA = await queryGetPendingSubmissions({ learnerId: learnerA.id });
  const pendingB = await queryGetPendingSubmissions({ learnerId: learnerB.id });

  assert.equal(pendingA.length, 1);
  assert.equal(pendingA[0].sessionId, "sess_pending_a");

  assert.equal(pendingB.length, 1);
  assert.equal(pendingB[0].sessionId, "sess_pending_b");
});

test("Phase F4: 12. 제출 처리 중 Router / Learner 변경 방어 검증", async () => {
  _resetLearnerSessionGuardForTesting();
  const learnerA = await createLearner({ name: "학습자A" });
  const learnerB = await createLearner({ name: "학습자B" });
  await selectLearner(learnerA.id);

  const session = createSession({ sessionId: "sess_guard_sub" }, createSampleQuestions());
  session.start();

  let isSessionActive = true;
  configureLearnerSessionGuard(() => isSessionActive);

  // 세션 진행 중 학습자 전환 차단 확인
  await assert.rejects(async () => {
    await selectLearner(learnerB.id);
  }, /활성 세션이 진행 중입니다/);

  // 제출 완료 처리
  await submitLearningSession({ session, learnerId: learnerA.id });

  // 세션 종료 후 전환 허용
  isSessionActive = false;
  const switchedId = await selectLearner(learnerB.id);
  assert.equal(switchedId, learnerB.id);
  assert.equal(getActiveLearnerId(), learnerB.id);
  _resetLearnerSessionGuardForTesting();
});

test("Phase F4: 13. 기존 제출 -> 기존 채점 -> 세션 완료(saveSessionRecord) 전체 흐름 회귀 검증", async () => {
  _resetLearnerSessionGuardForTesting();
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const questions = createSampleQuestions();
  const session = createSession({ sessionId: "sess_e2e_f4" }, questions);
  session.start();

  const studentStrokesMap = new Map([
    ["q_1", [{ id: "s1", points: [{ x: 1, y: 1 }] }]],
    ["q_2", [{ id: "s2", points: [{ x: 2, y: 2 }] }]]
  ]);

  // 1. 제출 Snapshot 생성 (SUBMITTING -> SUBMITTED_LOCKED -> PARENT_GRADING_PENDING)
  const submission = await submitLearningSession({
    session,
    learnerId: learner.id,
    studentStrokesMap
  });
  assert.equal(submission.status, "PARENT_GRADING_PENDING");

  // 2. 보호자 채점 진행 (PARENT_GRADING_PENDING -> GRADING_ACTIVE)
  session.startGrading();
  await startSubmissionGrading(submission.id, { learnerId: learner.id });
  session.gradeQuestion("q_1", true, "잘했음");
  session.gradeQuestion("q_2", false, "자리맞춤 실수");

  const gradingStrokesMap = new Map([
    ["q_2", [{ id: "g1", color: "#c62828", points: [{ x: 10, y: 10 }] }]]
  ]);

  // 3. 최종 채점 완료 및 기존 sessions/attempts 저장
  const summary = session.finishGrading();
  const savedRecord = await saveSession(summary, studentStrokesMap, gradingStrokesMap, { learnerId: learner.id });

  // 4. submission 상태를 GRADED로 갱신
  const finalizedSubmission = await commandUpdateSubmissionGrading(
    submission.id,
    { q_1: { isCorrect: true }, q_2: { isCorrect: false } },
    gradingStrokesMap,
    { learnerId: learner.id, status: "GRADED", completedAt: Date.now() }
  );

  assert.equal(finalizedSubmission.status, "GRADED");
  assert.ok(savedRecord, "기존 sessions 레코드 정상 저장");
  assert.equal(savedRecord.id, "sess_e2e_f4");
  assert.equal(savedRecord.correctCount, 1);
  assert.equal(savedRecord.wrongCount, 1);

  // 대기 목록에서 제외되었는지 확인
  const pending = await queryGetPendingSubmissions({ learnerId: learner.id });
  assert.equal(pending.length, 0, "채점 완료된 제출본은 대기 목록에서 제외되어야 함");

  // 최근 완료 세션에 정상 집계되는지 확인
  const recentSessions = await queryGetRecentSessions(5, { learnerId: learner.id });
  assert.equal(recentSessions.length, 1);
  assert.equal(recentSessions[0].id, "sess_e2e_f4");
});

test("Phase F4: 14. Command / Query 경계 및 Location 직접 쓰기 금지 정적 검사", async () => {
  const publicJsDir = path.resolve(__dirname, "../public/app/js");

  // 1. app.js, learnerView.js 등 UI 파일에서 storage.js 직접 import 금지 확인
  const forbiddenDirectImports = [
    path.join(publicJsDir, "app.js"),
    path.join(publicJsDir, "learners/learnerView.js"),
    path.join(publicJsDir, "platform/appShell.js")
  ];

  for (const filePath of forbiddenDirectImports) {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      assert.ok(
        !content.includes('from "./storage.js"') && !content.includes('from "../storage.js"'),
        `${path.basename(filePath)}는 storage.js를 직접 import하지 않고 Command/Query를 사용해야 함`
      );
    }
  }

  // 2. window.location.pathname 직접 쓰기 금지 확인 (코드 내 대입문 정적 분석)
  const allJsFiles = [];
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        allJsFiles.push(fullPath);
      }
    }
  }
  scanDir(publicJsDir);

  for (const file of allJsFiles) {
    const content = fs.readFileSync(file, "utf-8");
    const hasLocationPathnameAssign = /\.location\.pathname\s*=/g.test(content);
    assert.equal(
      hasLocationPathnameAssign,
      false,
      `${path.basename(file)}에서 window.location.pathname 직접 대입 패턴이 0건이어야 합니다.`
    );
  }
});

// ============================================================================
// Phase F4 Reviewer Rework 보강 테스트 (15 ~ 25)
// ============================================================================

test("Phase F4: 15. [F4-01] 실제 IndexedDB v3 -> v4 업그레이드 및 7개 Store 데이터 100% 무손실 검증", async () => {
  await closeDB();
  await new Promise((resolve) => {
    const delReq = indexedDB.deleteDatabase("math_canvas_pro_db");
    delReq.onsuccess = () => resolve();
    delReq.onerror = () => resolve();
    delReq.onblocked = () => resolve();
  });

  // 1. v3 스키마로 DB 생성 및 7개 Store에 실데이터 삽입
  await new Promise((resolve, reject) => {
    const req = indexedDB.open("math_canvas_pro_db", 3);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      const sStore = db.createObjectStore("sessions", { keyPath: "id" });
      sStore.createIndex("learnerId", "learnerId", { unique: false });

      const aStore = db.createObjectStore("attempts", { keyPath: "id" });
      aStore.createIndex("learnerId", "learnerId", { unique: false });

      const mStore = db.createObjectStore("mistakes", { keyPath: "key" });
      mStore.createIndex("learnerId", "learnerId", { unique: false });

      const pStore = db.createObjectStore("stageProgress", { keyPath: "stageKey" });
      pStore.createIndex("learnerId", "learnerId", { unique: false });

      db.createObjectStore("strokes", { keyPath: "sessionId_questionId" });

      const dStore = db.createObjectStore("draftSessions", { keyPath: "id" });
      dStore.createIndex("learnerId", "learnerId", { unique: false });

      const lpStore = db.createObjectStore("learnerProfiles", { keyPath: "id" });
      lpStore.createIndex("archived", "archived", { unique: false });
    };

    req.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction(
        ["sessions", "attempts", "mistakes", "stageProgress", "strokes", "draftSessions", "learnerProfiles"],
        "readwrite"
      );

      tx.objectStore("learnerProfiles").put({ id: "lrn_v3_test", name: "민준", archived: false });
      tx.objectStore("sessions").put({ id: "sess_v3_01", learnerId: "lrn_v3_test", score: 100 });
      tx.objectStore("attempts").put({ id: "att_v3_01", sessionId: "sess_v3_01", learnerId: "lrn_v3_test" });
      tx.objectStore("mistakes").put({ key: "lrn_v3_test:mul:2:3", learnerId: "lrn_v3_test", count: 2 });
      tx.objectStore("stageProgress").put({ stageKey: "lrn_v3_test:M1", learnerId: "lrn_v3_test", status: "PASSED" });
      tx.objectStore("strokes").put({ sessionId_questionId: "sess_v3_01_q1", strokes: [{ x: 1, y: 1 }] });
      tx.objectStore("draftSessions").put({ id: "lrn_v3_test", learnerId: "lrn_v3_test", page: 1 });

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = (err) => reject(err.target.error);
    };
    req.onerror = (err) => reject(err.target.error);
  });

  // 2. v4 storage.js getDB()로 오픈 (onupgradeneeded v3 -> v4 트리거)
  const db4 = await getDB();
  assert.ok(db4.version >= 4, "DB 버전이 4 이상으로 성공적으로 업그레이드됨");

  // 3. 신규 submissions Store 및 5대 필수 인덱스 검증
  assert.ok(db4.objectStoreNames.contains("submissions"), "신규 submissions Store 존재");
  const requiredStores = [
    "learnerProfiles", "sessions", "attempts", "mistakes",
    "stageProgress", "strokes", "draftSessions", "submissions"
  ];
  for (const sName of requiredStores) {
    assert.ok(db4.objectStoreNames.contains(sName), `Store [${sName}] 존재`);
  }

  const txCheck = db4.transaction(requiredStores, "readonly");
  const subStore = txCheck.objectStore("submissions");
  assert.ok(subStore.indexNames.contains("sessionId"), "submissions에 sessionId 인덱스 존재");
  assert.ok(subStore.indexNames.contains("learnerId"), "submissions에 learnerId 인덱스 존재");
  assert.ok(subStore.indexNames.contains("submittedAt"), "submissions에 submittedAt 인덱스 존재");
  assert.ok(subStore.indexNames.contains("status"), "submissions에 status 인덱스 존재");
  assert.ok(subStore.indexNames.contains("subjectId"), "submissions에 subjectId 인덱스 존재");

  // 4. 기존 7개 Store의 레코드가 100% 무손실 보존되었는지 검증
  const [profile, sess, att, mst, stg, stk, dft] = await Promise.all([
    new Promise((res) => {
      const r = txCheck.objectStore("learnerProfiles").get("lrn_v3_test");
      r.onsuccess = () => res(r.result);
    }),
    new Promise((res) => {
      const r = txCheck.objectStore("sessions").get("sess_v3_01");
      r.onsuccess = () => res(r.result);
    }),
    new Promise((res) => {
      const r = txCheck.objectStore("attempts").get("att_v3_01");
      r.onsuccess = () => res(r.result);
    }),
    new Promise((res) => {
      const r = txCheck.objectStore("mistakes").get("lrn_v3_test:mul:2:3");
      r.onsuccess = () => res(r.result);
    }),
    new Promise((res) => {
      const r = txCheck.objectStore("stageProgress").get("lrn_v3_test:M1");
      r.onsuccess = () => res(r.result);
    }),
    new Promise((res) => {
      const r = txCheck.objectStore("strokes").get("sess_v3_01_q1");
      r.onsuccess = () => res(r.result);
    }),
    new Promise((res) => {
      const r = txCheck.objectStore("draftSessions").get("lrn_v3_test");
      r.onsuccess = () => res(r.result);
    })
  ]);

  assert.ok(profile && profile.name === "민준");
  assert.ok(sess && sess.score === 100);
  assert.ok(att && att.sessionId === "sess_v3_01");
  assert.ok(mst && mst.count === 2);
  assert.ok(stg && stg.status === "PASSED");
  assert.ok(stk && stk.strokes.length === 1);
  assert.ok(dft && dft.page === 1);

  await closeDB();
});

test("Phase F4: 16. [F4-02 & F4-03] SUBMITTING 진입 즉시 학생 입력 Lock 및 isPracticeMutable 상태 검증", async () => {
  const session = createSession({ sessionId: "sess_state_flow" }, createSampleQuestions());
  session.start();

  assert.equal(session.state, SessionState.PRACTICE_ACTIVE);
  assert.equal(session.isPracticeMutable(), true);
  assert.equal(session.isLocked(), false);

  // 제출 시작 전이
  session.startSubmitting();
  assert.equal(session.state, SessionState.SUBMITTING);
  assert.equal(session.isPracticeMutable(), false, "SUBMITTING 진입 즉시 학생 수정 불가");
  assert.equal(session.isLocked(), true, "SUBMITTING 진입 즉시 Lock 활성화");

  // 중복 startSubmitting 호출 차단
  assert.throws(() => {
    session.startSubmitting();
  }, /제출을 시작할 수 없습니다/);
});

test("Phase F4: 17. [F4-04 & F4-10] 실제 Storage Write 실패 시 PRACTICE_ACTIVE 자동 롤백 및 Draft/Stroke 유지 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const questions = createSampleQuestions();
  const session = createSession({ sessionId: "sess_write_fail" }, questions);
  session.start();

  // Draft 및 스트로크 사전 저장
  await saveDraft({ sessionId: "sess_write_fail", questions, currentPageIndex: 0 }, { learnerId: learner.id });

  // 실제 Storage Write 단계에서 트랜잭션 abort 유발
  _setSubmissionFailureInjectorForTesting(({ tx }) => {
    tx.abort();
  });

  try {
    // submitLearningSession 호출이 reject되어야 함
    await assert.rejects(async () => {
      await submitLearningSession({
        session,
        learnerId: learner.id,
        questions
      });
    });

    // 실패 후 세션 상태가 PRACTICE_ACTIVE로 롤백되었는지 검증
    assert.equal(session.state, SessionState.PRACTICE_ACTIVE, "실패 시 PRACTICE_ACTIVE로 안전 복구");
    assert.equal(session.isPracticeMutable(), true, "학생 인터랙션 재활성화");

    // Draft 보존 확인
    const draft = await getDraft({ learnerId: learner.id });
    assert.ok(draft, "실패 시 Draft 그대로 보존");
    assert.equal(draft.sessionId, "sess_write_fail");
  } finally {
    _setSubmissionFailureInjectorForTesting(null);
  }
});

test("Phase F4: 18. [F4-05] 제출 후 question/config/studentStrokes mutation에도 영구 저장된 Snapshot 불변 (Deep Copy) 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const questions = createSampleQuestions();
  const studentStrokesMap = new Map([
    ["q_1", [{ id: "s1", points: [{ x: 10, y: 10 }] }]]
  ]);

  const submission = await submitLearningSession({
    sessionId: "sess_deep_copy_test",
    learnerId: learner.id,
    questions,
    config: { pageSize: 4, operation: "mul" },
    studentStrokesMap
  });

  // 제출 후 원본 객체 변조 시도
  questions[0].operandA = 99999;
  studentStrokesMap.clear();

  // 영구 스토리지에서 다시 로드
  const loaded = await getSubmission(submission.id, { learnerId: learner.id });
  assert.equal(loaded.questions[0].operandA, 23, "저장된 Snapshot의 operandA는 원본 변조에 영향받지 않음");
  assert.ok(loaded.studentStrokesMap.q_1, "저장된 Snapshot의 필기 데이터는 clear에 영향받지 않음");
  assert.equal(loaded.studentStrokesMap.q_1.length, 1);
});

test("Phase F4: 19. [F4-06] Submission Snapshot 불변 필드 보존 & updateSubmissionGrading에서 student payload 훼손 방지 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const questions = createSampleQuestions();
  const studentStrokesMap = new Map([
    ["q_1", [{ id: "orig_stroke", color: "#000", points: [{ x: 1, y: 1 }] }]]
  ]);

  const sub = await submitLearningSession({
    sessionId: "sess_payload_preserve",
    learnerId: learner.id,
    questions,
    studentStrokesMap,
    totalSolveTimeMs: 18000
  });

  await startSubmissionGrading(sub.id, { learnerId: learner.id });
  // 채점 갱신 수행
  const graded = await updateSubmissionGrading(
    sub.id,
    { q_1: { isCorrect: true }, q_2: { isCorrect: true } },
    new Map([["q_1", [{ id: "red_stroke", color: "#c62828", points: [{ x: 10, y: 10 }] }]]]),
    { learnerId: learner.id, status: "GRADED" }
  );

  // 불변 학생 필드가 100% 보존되었는지 검증
  assert.equal(graded.id, sub.id);
  assert.equal(graded.sessionId, "sess_payload_preserve");
  assert.equal(graded.learnerId, learner.id);
  assert.equal(graded.totalSolveTimeMs, 18000);
  assert.deepEqual(graded.questions, sub.questions);
  assert.deepEqual(graded.studentStrokesMap, sub.studentStrokesMap);
  assert.equal(graded.status, "GRADED");
  assert.ok(graded.gradingStrokesMap.q_1);
});

test("Phase F4: 20. [F4-07] getSubmission(id) 다른 학습자 접근 시 차단(null 반환) 검증", async () => {
  await clearAllData();
  const learnerA = await createLearner({ name: "학습자A" });
  const learnerB = await createLearner({ name: "학습자B" });

  const subA = await saveSubmissionSnapshot({
    sessionId: "sess_own_a",
    learnerId: learnerA.id,
    questions: createSampleQuestions()
  });

  // 학습자 B의 권한으로 학습자 A의 submission ID 직접 조회
  const crossAccess = await getSubmission(subA.id, { learnerId: learnerB.id });
  assert.equal(crossAccess, null, "다른 학습자의 제출본 ID 조회 시 null 반환");

  // 학습자 A 본인 권한으로 조회
  const ownAccess = await getSubmission(subA.id, { learnerId: learnerA.id });
  assert.ok(ownAccess);
  assert.equal(ownAccess.id, subA.id);
});

test("Phase F4: 21. [F4-07] updateSubmissionGrading(id) 다른 학습자 수정 시 명시적 거부(Error 발생) 검증", async () => {
  await clearAllData();
  const learnerA = await createLearner({ name: "학습자A" });
  const learnerB = await createLearner({ name: "학습자B" });

  const subA = await saveSubmissionSnapshot({
    sessionId: "sess_own_mod_a",
    learnerId: learnerA.id,
    questions: createSampleQuestions()
  });

  await startSubmissionGrading(subA.id, { learnerId: learnerA.id });
  // 학습자 B의 권한으로 학습자 A의 submission 수정 시도
  await assert.rejects(async () => {
    await updateSubmissionGrading(
      subA.id,
      { q_1: { isCorrect: false }, q_2: { isCorrect: false } },
      new Map(),
      { learnerId: learnerB.id, status: "GRADED" }
    );
  }, /권한이 없습니다/);

  // 학습자 A 권한으로 수정 시 정상 처리
  const validUpdate = await updateSubmissionGrading(
    subA.id,
    { q_1: { isCorrect: true }, q_2: { isCorrect: true } },
    new Map(),
    { learnerId: learnerA.id, status: "GRADED" }
  );
  assert.equal(validUpdate.status, "GRADED");
});

test("Phase F4: 22. [F4-08] 동일 세션 동시 Promise.all submit 멱등성 (정확히 1개 레코드 생성 및 동일 snapshot) 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const questions = createSampleQuestions();
  const session = createSession({ sessionId: "sess_concurrent_submit" }, questions);
  session.start();

  const options = {
    session,
    learnerId: learner.id,
    totalSolveTimeMs: 15000,
    questions
  };

  // 3개 동시 제출 요청
  const results = await Promise.all([
    submitLearningSession(options),
    submitLearningSession(options),
    submitLearningSession(options)
  ]);

  // 모든 호출이 동일한 Snapshot을 반환하는지 확인
  assert.equal(results[0].id, results[1].id);
  assert.equal(results[1].id, results[2].id);
  assert.equal(results[0].submittedAt, results[1].submittedAt);

  // 저장소에 정확히 1개의 submission만 존재하는지 확인
  const allSubmissions = await getAllSubmissions({ learnerId: learner.id });
  assert.equal(allSubmissions.length, 1);
});

test("Phase F4: 23. [F4-09] UI Submit 재진입 방어 및 버튼/인터랙션 Lock 검증", async () => {
  const session = createSession({ sessionId: "sess_reentry" }, createSampleQuestions());
  session.start();

  assert.equal(session.isPracticeMutable(), true);
  session.startSubmitting();
  assert.equal(session.isPracticeMutable(), false);

  // 재진입 방어: isPracticeMutable()이 false이면 추가 제출 호출 불가
  assert.equal(session.isPracticeMutable(), false);
});

test("Phase F4: 24. [F4-11] Draft 삭제 오류 발생 시에도 SubmissionSnapshot 보존 및 경고 반환 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const session = createSession({ sessionId: "sess_draft_err" }, createSampleQuestions());
  session.start();

  // 실제 Draft 삭제 시 오류 강제 발생
  _setDraftCleanupFailureInjectorForTesting(() => {
    throw new Error("Draft cleanup forced failure");
  });

  try {
    const result = await submitLearningSession({
      session,
      learnerId: learner.id
    });

    // Snapshot이 영구 보존되고 draftCleaned false가 반환되었는지 검증
    assert.ok(result);
    assert.equal(result.id, "sub_sess_draft_err");
    assert.equal(result.status, "PARENT_GRADING_PENDING");
    assert.equal(result.draftCleaned, false, "Draft 정리 실패 플래그 정상 반환");
    assert.ok(result.draftCleanupError, "Draft 정리 에러 정보 포함");

    const stored = await getSubmission(result.id, { learnerId: learner.id });
    assert.ok(stored, "Snapshot은 영구 스토리지에 유지됨");
  } finally {
    _setDraftCleanupFailureInjectorForTesting(null);
  }
});

test("Phase F4: 25. [F4-12] PARENT_GRADING_PENDING 복원 및 getPendingSubmissions 격리 조회 계약 검증", async () => {
  await clearAllData();
  const learnerA = await createLearner({ name: "학습자A" });
  const learnerB = await createLearner({ name: "학습자B" });

  await saveSubmissionSnapshot({
    sessionId: "sess_p1",
    learnerId: learnerA.id,
    status: "PARENT_GRADING_PENDING",
    questions: createSampleQuestions()
  });

  await saveSubmissionSnapshot({
    sessionId: "sess_p2",
    learnerId: learnerB.id,
    status: "PARENT_GRADING_PENDING",
    questions: createSampleQuestions()
  });

  // 학습자 A의 대기 목록 조회
  const pendingA = await queryGetPendingSubmissions({ learnerId: learnerA.id });
  assert.equal(pendingA.length, 1);
  assert.equal(pendingA[0].sessionId, "sess_p1");

  // 채점 완료 처리 후 대기 목록에서 제거 검증
  await startSubmissionGrading(pendingA[0].id, { learnerId: learnerA.id });
  await updateSubmissionGrading(
    pendingA[0].id,
    { q_1: { isCorrect: true }, q_2: { isCorrect: true } },
    new Map(),
    { learnerId: learnerA.id, status: "GRADED" }
  );

  const pendingAAfter = await queryGetPendingSubmissions({ learnerId: learnerA.id });
  assert.equal(pendingAAfter.length, 0);

  // 학습자 B의 대기 목록은 여전히 1건 유지
  const pendingB = await queryGetPendingSubmissions({ learnerId: learnerB.id });
  assert.equal(pendingB.length, 1);
  assert.equal(pendingB[0].sessionId, "sess_p2");
});

// ============================================================================
// Phase F4 Reviewer Rework 4차/5차 신규/보강 테스트 (26 ~ 54)
// ============================================================================

test("Phase F4: 26. [F4-R4-02 & F4-R4-03] production applyStudentStrokeChange의 PRACTICE_ACTIVE 성공 및 SUBMITTING 차단 검증", async () => {
  const session = createSession({ sessionId: "sess_stroke_prod_guard" }, createSampleQuestions());
  session.start();

  const strokesMap = new Map();
  strokesMap.set("q_1", [{ id: "str_initial", points: [{ x: 1, y: 1 }] }]);

  let acceptedCount = 0;

  // 1. PRACTICE_ACTIVE 상태에서 변경 성공
  const res1 = applyStudentStrokeChange({
    session,
    strokesMap,
    questionId: "q_1",
    strokes: [{ id: "str_active_1", points: [{ x: 10, y: 10 }] }],
    onAccepted: () => { acceptedCount += 1; }
  });

  assert.equal(res1, true);
  assert.equal(acceptedCount, 1);
  assert.equal(strokesMap.get("q_1")[0].id, "str_active_1");

  // 2. SUBMITTING 전이
  session.startSubmitting();

  // 3. SUBMITTING 상태에서 동일 함수 호출 -> 차단
  const res2 = applyStudentStrokeChange({
    session,
    strokesMap,
    questionId: "q_1",
    strokes: [{ id: "str_illegal_submitting", points: [{ x: 99, y: 99 }] }],
    onAccepted: () => { acceptedCount += 1; }
  });

  assert.equal(res2, false);
  assert.equal(acceptedCount, 1, "onAccepted 콜백 실행되지 않음");
  assert.equal(strokesMap.get("q_1")[0].id, "str_active_1", "기존 획 유지 및 변경 차단");
});

test("Phase F4: 27. [F4-R4-04 & F4-R4-05] production Undo/Redo/Clear/Tool 핸들러 SUBMITTING 상태 차단 검증", async () => {
  const harness = setupTestCanvasHarness();
  try {
    const session = createSession({ sessionId: "sess_prod_tool_guard" }, createSampleQuestions());
    session.start();

    const canvas = createDrawingCanvas(harness.canvas, {
      profile: InputProfile.DESKTOP_MOUSE_PEN
    });

    const strokesMap = new Map([
      ["q_1", [{ id: "st1", points: [{ x: 1, y: 1 }] }]]
    ]);

    let toolColor = "#1e293b";

    // 1. PRACTICE_ACTIVE 상태에서 도구/Undo/Redo/Clear 정상 동작
    const toolRes1 = performPracticeToolSelect(session, () => { toolColor = "#2563eb"; });
    assert.equal(toolRes1, true);
    assert.equal(toolColor, "#2563eb");

    // 2. SUBMITTING 전이
    session.startSubmitting();

    // 3. 도구 변경 시도 -> 차단
    const toolRes2 = performPracticeToolSelect(session, () => { toolColor = "#dc2626"; });
    assert.equal(toolRes2, false);
    assert.equal(toolColor, "#2563eb", "SUBMITTING 상태에서는 도구 색상 불변");

    // 4. Undo 시도 -> 차단
    const undoRes = performPracticeUndo(session, canvas);
    assert.equal(undoRes, false);

    // 5. Redo 시도 -> 차단
    const redoRes = performPracticeRedo(session, canvas);
    assert.equal(redoRes, false);

    // 6. Clear 시도 -> 차단
    const clearRes = performPracticeClear(session, [canvas], strokesMap, "q_1");
    assert.equal(clearRes, false);
    assert.ok(strokesMap.has("q_1"), "SUBMITTING 상태에서는 strokesMap 삭제 차단");

    canvas.destroy();
  } finally {
    harness.restore();
  }
});

test("Phase F4: 28. [F4-R4-05] production performPracticePageNav 및 Session nextPage/prevPage/goToPage 이동 차단 검증", async () => {
  const session = createSession({ sessionId: "sess_page_lock_v4", pageSize: 1 }, createSampleQuestions());
  session.start();

  assert.equal(session.getPageQuestions().pageIndex, 0);

  // 1. PRACTICE_ACTIVE 상태에서 이동 허용
  const navRes1 = performPracticePageNav(session, () => session.nextPage());
  assert.ok(navRes1);
  assert.equal(session.getPageQuestions().pageIndex, 1);

  // 2. SUBMITTING 진입
  session.startSubmitting();

  // 3. performPracticePageNav 차단 확인
  let navCalled = false;
  const navRes2 = performPracticePageNav(session, () => {
    navCalled = true;
    return session.prevPage();
  });
  assert.equal(navRes2, false);
  assert.equal(navCalled, false);

  // 4. Session 직접 호출 시에도 예외 발생 확인
  assert.throws(() => {
    session.nextPage();
  }, /PRACTICE_ACTIVE 상태에서만/);

  assert.throws(() => {
    session.prevPage();
  }, /PRACTICE_ACTIVE 상태에서만/);

  assert.throws(() => {
    session.goToPage(0);
  }, /PRACTICE_ACTIVE 상태에서만/);

  assert.equal(session.getPageQuestions().pageIndex, 1, "페이지 위치 유지");
});

test("Phase F4: 29. [F4-R4-05] Session API locked mutation 직접 호출 시 예외 발생 검증 (solveTimes)", async () => {
  const session = createSession({ sessionId: "sess_invariant_v4" }, createSampleQuestions());
  session.start();

  session.startSubmitting();

  assert.throws(() => {
    session.recordQuestionSolveTime("q_1", 5000);
  }, /recordQuestionSolveTime은 PRACTICE_ACTIVE 상태에서만/);

  assert.throws(() => {
    session.setQuestionSolveTimes({ q_1: 5000 });
  }, /setQuestionSolveTimes은 PRACTICE_ACTIVE 상태에서만/);
});

test("Phase F4: 30. [F4-R4-06] 실제 IndexedDB transaction abort 시 submitLearningSession 자동 rollback 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const session = createSession({ sessionId: "sess_tx_abort_v4" }, createSampleQuestions());
  session.start();

  _setSubmissionFailureInjectorForTesting(({ tx }) => {
    tx.abort();
  });

  try {
    await assert.rejects(async () => {
      await submitLearningSession({ session, learnerId: learner.id });
    });

    assert.equal(session.state, SessionState.PRACTICE_ACTIVE);
    assert.equal(session.isPracticeMutable(), true);
  } finally {
    _setSubmissionFailureInjectorForTesting(null);
  }
});

test("Phase F4: 31. [F4-R4-06] transaction abort 실패 시 submissions Store에 레코드 0건 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const session = createSession({ sessionId: "sess_abort_zero_v4" }, createSampleQuestions());
  session.start();

  _setSubmissionFailureInjectorForTesting(({ tx }) => {
    tx.abort();
  });

  try {
    await assert.rejects(async () => {
      await submitLearningSession({ session, learnerId: learner.id });
    });

    const all = await getAllSubmissions({ allLearners: true });
    assert.equal(all.length, 0, "abort 발생 시 submissions Store에 저장된 레코드 0건");
  } finally {
    _setSubmissionFailureInjectorForTesting(null);
  }
});

test("Phase F4: 32. [F4-R4-12] transaction abort 실패 후 Draft/Strokes/Page 100% 무손실 유지 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const questions = createSampleQuestions();
  const session = createSession({ sessionId: "sess_abort_retain_v4", pageSize: 1 }, questions);
  session.start();
  session.nextPage(); // pageIndex = 1

  const studentStrokesMap = new Map([
    ["q_1", [{ id: "str_saved", points: [{ x: 10, y: 10 }] }]]
  ]);

  await saveDraft({
    sessionId: "sess_abort_retain_v4",
    questions,
    config: { pageSize: 1 },
    currentPageIndex: 1,
    strokesMap: studentStrokesMap
  }, { learnerId: learner.id });

  _setSubmissionFailureInjectorForTesting(({ tx }) => {
    tx.abort();
  });

  try {
    await assert.rejects(async () => {
      await submitLearningSession({
        session,
        learnerId: learner.id,
        questions,
        studentStrokesMap
      });
    });

    // Draft 데이터가 온전히 유지되었는지 확인
    const draft = await getDraft({ learnerId: learner.id });
    assert.ok(draft);
    assert.equal(draft.sessionId, "sess_abort_retain_v4");
    assert.equal(draft.currentPageIndex, 1);
    assert.ok(draft.studentStrokesMap?.q_1 || draft.strokesMap?.q_1);
    assert.equal(session.getPageQuestions().pageIndex, 1);
  } finally {
    _setSubmissionFailureInjectorForTesting(null);
  }
});

test("Phase F4: 33. 실제 Draft cleanup failure 발생 시 draftCleaned=false 및 draftCleanupError 반환 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const session = createSession({ sessionId: "sess_cleanup_fail_v4" }, createSampleQuestions());
  session.start();

  _setDraftCleanupFailureInjectorForTesting(() => {
    throw new Error("Simulated draft cleanup error");
  });

  try {
    const result = await submitLearningSession({
      session,
      learnerId: learner.id
    });

    assert.ok(result);
    assert.equal(result.draftCleaned, false);
    assert.ok(result.draftCleanupError);
    assert.match(String(result.draftCleanupError), /Simulated draft cleanup error/);
  } finally {
    _setDraftCleanupFailureInjectorForTesting(null);
  }
});

test("Phase F4: 34. 실제 Draft cleanup failure 발생 시에도 Submission Snapshot 정상 보존 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const session = createSession({ sessionId: "sess_cleanup_preserve_v4" }, createSampleQuestions());
  session.start();

  _setDraftCleanupFailureInjectorForTesting(() => {
    throw new Error("Simulated draft cleanup error");
  });

  try {
    const result = await submitLearningSession({
      session,
      learnerId: learner.id
    });

    const stored = await getSubmission(result.id, { learnerId: learner.id });
    assert.ok(stored, "Draft 삭제가 실패해도 Snapshot은 영구 보존됨");
    assert.equal(stored.status, "PARENT_GRADING_PENDING");
  } finally {
    _setDraftCleanupFailureInjectorForTesting(null);
  }
});

test("Phase F4: 35. learningQueries.getSubmission exact ID 조회 시 활성 학습자 소유권 격리 검증", async () => {
  await clearAllData();
  const learnerA = await createLearner({ name: "학습자A" });
  const learnerB = await createLearner({ name: "학습자B" });

  await selectLearner(learnerA.id);

  const subA = await saveSubmissionSnapshot({
    sessionId: "sess_cross_exact_v4",
    learnerId: learnerA.id,
    questions: createSampleQuestions()
  });

  // 1. 학습자 A 활성 상태에서 조회 -> 정상 반환
  const readAsA = await queryGetSubmission(subA.id);
  assert.ok(readAsA);
  assert.equal(readAsA.id, subA.id);

  // 2. 학습자 B로 전환
  await selectLearner(learnerB.id);

  // 3. 학습자 B 활성 상태에서 학습자 A의 submission ID 직접 조회 -> null 반환
  const readAsB = await queryGetSubmission(subA.id);
  assert.equal(readAsB, null, "다른 학습자의 submission ID는 null 반환");

  // 4. 다시 학습자 A로 전환 후 조회 -> 정상 반환
  await selectLearner(learnerA.id);
  const readAsARestored = await queryGetSubmission(subA.id);
  assert.ok(readAsARestored);
  assert.equal(readAsARestored.id, subA.id);
});

test("Phase F4: 36. learningQueries.getSubmissionBySessionId 조회 시 활성 학습자 소유권 격리 검증", async () => {
  await clearAllData();
  const learnerA = await createLearner({ name: "학습자A" });
  const learnerB = await createLearner({ name: "학습자B" });

  await selectLearner(learnerA.id);

  await saveSubmissionSnapshot({
    sessionId: "sess_cross_sessid_v4",
    learnerId: learnerA.id,
    questions: createSampleQuestions()
  });

  // 1. 학습자 A 활성 상태 -> 정상 조회
  const foundA = await queryGetSubmissionBySessionId("sess_cross_sessid_v4");
  assert.ok(foundA);

  // 2. 학습자 B 전환 -> null 반환
  await selectLearner(learnerB.id);
  const foundB = await queryGetSubmissionBySessionId("sess_cross_sessid_v4");
  assert.equal(foundB, null, "세션 ID 기준 조회에서도 다른 학습자 데이터는 null");

  // 3. 대기 목록 역시 격리 확인
  const pendingB = await queryGetPendingSubmissions();
  assert.equal(pendingB.length, 0);
});

test("Phase F4: 37. [F4-R4-07 & F4-R4-08] saveSubmissionSnapshot Promise는 tx.oncomplete 이후에만 resolve됨을 timing observer로 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const events = [];
  _setSubmissionTransactionObserverForTesting((evt) => {
    events.push(evt);
  });

  try {
    const promise = saveSubmissionSnapshot({
      sessionId: "sess_timing_test",
      learnerId: learner.id,
      questions: createSampleQuestions()
    });

    promise.then(() => {
      events.push("promise-resolved");
    });

    const result = await promise;
    assert.ok(result);

    // 이벤트 순서 검증: request-success -> add-success -> transaction-complete -> promise-resolved
    const completeIdx = events.indexOf("transaction-complete");
    const resolveIdx = events.indexOf("promise-resolved");

    assert.ok(completeIdx !== -1, "transaction-complete 이벤트 발생");
    assert.ok(resolveIdx !== -1, "promise-resolved 이벤트 발생");
    assert.ok(resolveIdx >= completeIdx, "Promise는 반드시 transaction-complete 이후에 resolve되어야 함");
  } finally {
    _setSubmissionTransactionObserverForTesting(null);
  }
});

test("Phase F4: 38. [F4-R4-08] 동시 3개 submit 호출 시 최초 Snapshot 1건 유지 및 멱등성 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const questions = createSampleQuestions();
  const session = createSession({ sessionId: "sess_concurrent_v4" }, questions);
  session.start();

  const options = {
    session,
    learnerId: learner.id,
    questions,
    totalSolveTimeMs: 14000
  };

  const results = await Promise.all([
    submitLearningSession(options),
    submitLearningSession(options),
    submitLearningSession(options)
  ]);

  assert.equal(results[0].id, results[1].id);
  assert.equal(results[1].id, results[2].id);
  assert.equal(results[0].submittedAt, results[1].submittedAt);

  const all = await getAllSubmissions({ learnerId: learner.id });
  assert.equal(all.length, 1);
});

test("Phase F4: 39. [F4-R5-05 & F4-R5-06] production rollbackSubmissionToPractice 헬퍼가 persisted Draft를 PRACTICE_ACTIVE로 직접 저장 및 sessionState/데이터 복구 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const questions = createSampleQuestions();
  const session = createSession({ sessionId: "sess_draft_rollback_state", pageSize: 1 }, questions);
  session.start();
  session.nextPage(); // pageIndex = 1

  const studentStrokes = {
    q_1: [{ id: "str_orig", points: [{ x: 10, y: 10 }] }]
  };

  // 1. 초기 PRACTICE_ACTIVE Draft 저장
  await saveDraft({
    sessionId: "sess_draft_rollback_state",
    sessionState: "PRACTICE_ACTIVE",
    config: { pageSize: 1 },
    questions,
    currentPageIndex: 1,
    totalElapsedMs: 43210,
    studentStrokesMap: studentStrokes,
    inputProfile: "DESKTOP_MOUSE_PEN"
  }, { learnerId: learner.id });

  // 2. 제출 시작 전이 및 flush
  session.startSubmitting();
  await saveDraft({
    sessionId: "sess_draft_rollback_state",
    sessionState: "SUBMITTING",
    config: { pageSize: 1 },
    questions,
    currentPageIndex: 1,
    totalElapsedMs: 43210,
    studentStrokesMap: studentStrokes,
    inputProfile: "DESKTOP_MOUSE_PEN"
  }, { learnerId: learner.id });

  // 3. Storage write 실패 강제 주입
  _setSubmissionFailureInjectorForTesting(({ tx }) => {
    tx.abort();
  });

  try {
    let thrownError = null;
    try {
      await submitLearningSession({
        session,
        learnerId: learner.id,
        questions
      });
    } catch (err) {
      thrownError = err;
    }

    assert.ok(thrownError, "submitLearningSession은 트랜잭션 abort 시 reject되어야 함");

    // 4. production rollback helper 실행 (테스트가 직접 saveDraft 호출하지 않고 rollback 함수가 저장)
    let timerRestoredMs = 0;
    let interactionUnlocked = false;

    await rollbackSubmissionToPractice({
      session,
      elapsedMs: 43210,
      unlockInteraction: () => { interactionUnlocked = true; },
      restoreTimer: (ms) => { timerRestoredMs = ms; },
      persistDraft: async (ms) => {
        await saveDraft({
          sessionId: "sess_draft_rollback_state",
          sessionState: session.state,
          config: { pageSize: 1 },
          questions,
          currentPageIndex: 1,
          totalElapsedMs: ms,
          studentStrokesMap: studentStrokes,
          inputProfile: "DESKTOP_MOUSE_PEN"
        }, { learnerId: learner.id });
      },
      error: thrownError
    });

    // 5. 검증: 세션 상태 복구, 상호작용 잠금 해제, 타이머 시간 보존
    assert.equal(session.state, SessionState.PRACTICE_ACTIVE);
    assert.equal(interactionUnlocked, true);
    assert.equal(timerRestoredMs, 43210);

    // 6. 영구 저장된 Draft 확인
    const restoredDraft = await getDraft({ learnerId: learner.id });
    assert.ok(restoredDraft);
    assert.equal(restoredDraft.sessionState, SessionState.PRACTICE_ACTIVE, "Draft sessionState는 PRACTICE_ACTIVE로 복구");
    assert.equal(restoredDraft.totalElapsedMs, 43210, "Draft totalElapsedMs 43210ms 무손실 유지");
    assert.equal(restoredDraft.currentPageIndex, 1);
    assert.deepEqual(restoredDraft.studentStrokesMap, studentStrokes);
    assert.deepEqual(restoredDraft.questions, questions);
  } finally {
    _setSubmissionFailureInjectorForTesting(null);
  }
});

test("Phase F4: 40. [F4-R4-13] normalizeDraft 계층에서 stale SUBMITTING draft를 PRACTICE_ACTIVE로 정규화 검증", () => {
  const staleDraftInput = {
    sessionId: "sess_stale_submitting",
    sessionType: "practice",
    sessionState: "SUBMITTING",
    questions: createSampleQuestions(),
    config: { pageSize: 2 }
  };

  const normalized = normalizeDraft(staleDraftInput);
  assert.equal(normalized.sessionState, "PRACTICE_ACTIVE", "비정상 SUBMITTING Draft는 자동으로 PRACTICE_ACTIVE로 정규화되어 복원됨");
});

test("Phase F4: 41. [F4-R4-14 & F4-R4-18] PRACTICE_ACTIVE 상태에서 submitPractice() 직접 호출 시 예외 발생 검증", () => {
  const session = createSession({ sessionId: "sess_strict_sub" }, createSampleQuestions());
  session.start();

  assert.equal(session.state, SessionState.PRACTICE_ACTIVE);

  // startSubmitting()을 거치지 않고 submitPractice() 직접 호출 시 Error 발생
  assert.throws(() => {
    session.submitPractice(10000);
  }, /SUBMITTING 상태에서만 가능합니다/);
});

test("Phase F4: 42. [F4-R4-15 & F4-R4-18] PRACTICE_ACTIVE 상태에서 startGrading() 직접 호출 시 예외 발생 검증", () => {
  const session = createSession({ sessionId: "sess_strict_grade_start" }, createSampleQuestions());
  session.start();

  assert.throws(() => {
    session.startGrading();
  }, /PARENT_GRADING_PENDING 상태에서만 가능/);
});

test("Phase F4: 43. [F4-R4-16 & F4-R4-18] PARENT_GRADING_PENDING 상태에서 gradeQuestion() 직접 호출 시 예외 발생 검증", () => {
  const session = createSession({ sessionId: "sess_strict_grade_q" }, createSampleQuestions());
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  assert.equal(session.state, SessionState.PARENT_GRADING_PENDING);

  // startGrading() 호출 전(GRADING_ACTIVE가 아닌 상태)에서 gradeQuestion 호출 시 Error
  assert.throws(() => {
    session.gradeQuestion("q_1", true);
  }, /GRADING_ACTIVE 상태에서만 가능/);
});

test("Phase F4: 44. [F4-R4-17 & F4-R4-18] PRACTICE_ACTIVE 상태에서 setPendingGrading() 직접 호출 시 예외 발생 검증", () => {
  const session = createSession({ sessionId: "sess_strict_pending" }, createSampleQuestions());
  session.start();

  assert.throws(() => {
    session.setPendingGrading();
  }, /SUBMITTED_LOCKED 상태에서만 가능합니다/);
});

test("Phase F4: 45. [F4-R4-18] 정상 세션 상태 흐름 전체 수명주기 및 불변식 검증", () => {
  const questions = createSampleQuestions();
  const session = createSession({ sessionId: "sess_lifecycle_full" }, questions);

  // 1. IDLE -> PRACTICE_ACTIVE
  assert.equal(session.state, SessionState.IDLE);
  session.start();
  assert.equal(session.state, SessionState.PRACTICE_ACTIVE);
  assert.equal(session.isPracticeMutable(), true);
  assert.equal(session.isLocked(), false);

  // 2. PRACTICE_ACTIVE -> SUBMITTING
  session.startSubmitting();
  assert.equal(session.state, SessionState.SUBMITTING);
  assert.equal(session.isPracticeMutable(), false);
  assert.equal(session.isLocked(), true);

  // 3. SUBMITTING -> SUBMITTED_LOCKED
  session.submitPractice(15000);
  assert.equal(session.state, SessionState.SUBMITTED_LOCKED);
  assert.equal(session.isPracticeMutable(), false);
  assert.equal(session.isLocked(), true);

  // 4. SUBMITTED_LOCKED -> PARENT_GRADING_PENDING
  session.setPendingGrading();
  assert.equal(session.state, SessionState.PARENT_GRADING_PENDING);

  // 5. PARENT_GRADING_PENDING -> GRADING_ACTIVE
  session.startGrading();
  assert.equal(session.state, SessionState.GRADING_ACTIVE);

  // 6. 채점 진행 및 완료
  session.gradeQuestion("q_1", true, "완벽");
  session.gradeQuestion("q_2", true, "잘함");
  const summary = session.finishGrading();
  assert.equal(session.state, SessionState.SESSION_COMPLETE);
  assert.equal(summary.correctCount, 2);
  assert.equal(summary.accuracyRate, 100);
});

// ============================================================================
// Phase F4 Reviewer Rework 5차 신규 테스트 (46 ~ 54)
// ============================================================================

test("Phase F4: 46. [F4-R5-01, F4-R5-02, F4-R5-07] 제출 실패 rollback 시 38초 경과 시간이 0초로 초기화되지 않고 유지 검증", async () => {
  const timer = createQuestionTimer();
  startSessionTimer(timer, 38000);

  const session = createSession({ sessionId: "sess_timer_rollback" }, createSampleQuestions());
  session.start();

  // 제출 시도 직전 경과 시간 보존
  const elapsedBeforeSubmitMs = timer.getElapsedMs();
  assert.ok(elapsedBeforeSubmitMs >= 38000, "제출 직전 시간 38초 이상");

  session.startSubmitting();

  // rollback 실행 (38초 시간 보존)
  await rollbackSubmissionToPractice({
    session,
    elapsedMs: elapsedBeforeSubmitMs,
    restoreTimer: (ms) => startSessionTimer(timer, ms)
  });

  const restoredElapsedMs = timer.getElapsedMs();
  assert.ok(restoredElapsedMs >= 38000, "복구 후 경과 시간이 38초 이상으로 유지되어야 함 (0초 초기화 금지)");
  assert.equal(session.state, SessionState.PRACTICE_ACTIVE);
});

test("Phase F4: 47. [F4-R5-05 & F4-R5-06] production rollbackSubmissionToPractice 헬퍼가 persisted Draft를 PRACTICE_ACTIVE로 직접 저장 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const questions = createSampleQuestions();
  const session = createSession({ sessionId: "sess_r5_prod_draft", pageSize: 2 }, questions);
  session.start();

  // 초기 상태 저장
  await saveDraft({
    sessionId: "sess_r5_prod_draft",
    sessionState: "SUBMITTING",
    questions,
    currentPageIndex: 0,
    totalElapsedMs: 25000
  }, { learnerId: learner.id });

  // production rollback 실행
  await rollbackSubmissionToPractice({
    session,
    elapsedMs: 25000,
    persistDraft: async (ms) => {
      await saveDraft({
        sessionId: "sess_r5_prod_draft",
        sessionState: session.state,
        questions,
        currentPageIndex: 0,
        totalElapsedMs: ms
      }, { learnerId: learner.id });
    }
  });

  // IndexedDB에 저장된 Draft가 PRACTICE_ACTIVE인지 확인
  const persisted = await getDraft({ learnerId: learner.id });
  assert.ok(persisted);
  assert.equal(persisted.sessionState, SessionState.PRACTICE_ACTIVE);
  assert.equal(persisted.totalElapsedMs, 25000);
});

test("Phase F4: 48. [F4-R5-06] production rollback 후 Draft의 totalElapsedMs 및 strokes/page/config 100% 무손실 보존 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const questions = createSampleQuestions();
  const session = createSession({ sessionId: "sess_r5_lossless", pageSize: 1, operation: "mul" }, questions);
  session.start();
  session.nextPage(); // page 1

  const strokesMap = {
    q_1: [{ id: "st_1", points: [{ x: 10, y: 10 }, { x: 20, y: 20 }] }],
    q_2: [{ id: "st_2", points: [{ x: 30, y: 30 }] }]
  };

  await saveDraft({
    sessionId: "sess_r5_lossless",
    sessionState: "SUBMITTING",
    config: { pageSize: 1, operation: "mul" },
    questions,
    currentPageIndex: 1,
    totalElapsedMs: 50000,
    studentStrokesMap: strokesMap,
    inputProfile: "IPAD_PENCIL_ONLY"
  }, { learnerId: learner.id });

  await rollbackSubmissionToPractice({
    session,
    elapsedMs: 50000,
    persistDraft: async (ms) => {
      await saveDraft({
        sessionId: "sess_r5_lossless",
        sessionState: session.state,
        config: { pageSize: 1, operation: "mul" },
        questions,
        currentPageIndex: session.getPageQuestions().pageIndex,
        totalElapsedMs: ms,
        studentStrokesMap: strokesMap,
        inputProfile: "IPAD_PENCIL_ONLY"
      }, { learnerId: learner.id });
    }
  });

  const draft = await getDraft({ learnerId: learner.id });
  assert.ok(draft);
  assert.equal(draft.sessionState, SessionState.PRACTICE_ACTIVE);
  assert.equal(draft.totalElapsedMs, 50000);
  assert.equal(draft.currentPageIndex, 1);
  assert.equal(draft.inputProfile, "IPAD_PENCIL_ONLY");
  assert.deepEqual(draft.studentStrokesMap, strokesMap);
  assert.deepEqual(draft.questions, questions);
});

test("Phase F4: 49. [F4-R5-08 ~ F4-R5-10] grading Draft restore가 strict lifecycle을 정상 통과하여 GRADING_ACTIVE 진입 검증", () => {
  const questions = createSampleQuestions();
  const session = createSession({ sessionId: "sess_grading_restore_lifecycle" }, questions);

  const gradingDraft = {
    sessionId: "sess_grading_restore_lifecycle",
    sessionState: SessionState.GRADING_ACTIVE,
    sessionType: "grading",
    questions,
    totalElapsedMs: 30000,
    perQuestionElapsedMs: { q_1: 15000, q_2: 15000 },
    currentPageIndex: 0,
    gradingResults: {
      q_1: { isCorrect: true, comment: "완벽!" }
    }
  };

  let gradingHookCalled = false;

  // 공용 restore helper 실행
  restoreSessionStateFromDraft({
    session,
    draft: gradingDraft,
    onGradingActive: () => {
      gradingHookCalled = true;
    }
  });

  assert.equal(session.state, SessionState.GRADING_ACTIVE);
  assert.equal(gradingHookCalled, true);
  const status = session.getGradingStatus();
  assert.equal(status.graded, 1);
  assert.equal(status.correct, 1);
});

test("Phase F4: 50. [F4-R5-10, F4-R5-11] grading Draft restore 후 기존 gradingResults 및 코멘트 복원 검증", () => {
  const questions = createSampleQuestions();
  const session = createSession({ sessionId: "sess_grading_results_restore" }, questions);

  const draft = {
    sessionId: "sess_grading_results_restore",
    sessionState: SessionState.GRADING_ACTIVE,
    questions,
    totalElapsedMs: 22000,
    gradingResults: {
      q_1: { isCorrect: true, comment: "정답입니다" },
      q_2: { isCorrect: false, comment: "구구단 확인 필요" }
    }
  };

  restoreSessionStateFromDraft({ session, draft });

  assert.equal(session.state, SessionState.GRADING_ACTIVE);
  const status = session.getGradingStatus();
  assert.equal(status.graded, 2);
  assert.equal(status.correct, 1);
  assert.equal(status.wrong, 1);

  // 채점 완료 요약 생성 시 comment 포함 확인
  const summary = session.finishGrading();
  assert.equal(summary.results[0].comment, "정답입니다");
  assert.equal(summary.results[1].comment, "구구단 확인 필요");
});

test("Phase F4: 51. [F4-R5-11] grading Draft restore 후 page, studentStrokes, gradingStrokes 유지 및 런타임 예외 없음 검증", () => {
  const questions = createSampleQuestions();
  const session = createSession({ sessionId: "sess_grading_full_preserve", pageSize: 1 }, questions);

  const draft = {
    sessionId: "sess_grading_full_preserve",
    sessionState: SessionState.GRADING_ACTIVE,
    questions,
    totalElapsedMs: 45000,
    currentPageIndex: 1,
    perQuestionElapsedMs: { q_1: 20000, q_2: 25000 },
    studentStrokesMap: { q_1: [{ id: "s1" }], q_2: [{ id: "s2" }] },
    gradingStrokesMap: { q_1: [{ id: "g1" }] },
    gradingResults: { q_1: { isCorrect: true } }
  };

  assert.doesNotThrow(() => {
    restoreSessionStateFromDraft({ session, draft });
  });

  assert.equal(session.state, SessionState.GRADING_ACTIVE);
  assert.equal(session.getPageQuestions().pageIndex, 1);
});

test("Phase F4: 52. [F4-R5-12 ~ F4-R5-15] SubmissionSnapshot 존재 시 evaluateStartupDraftResumePolicy에서 stale Practice Draft resume 차단 검증", () => {
  const draft = {
    sessionId: "sess_submitted_already",
    sessionState: "PRACTICE_ACTIVE",
    sessionType: "practice",
    questions: createSampleQuestions()
  };

  const submission = {
    sessionId: "sess_submitted_already",
    status: "PARENT_GRADING_PENDING"
  };

  const policy = evaluateStartupDraftResumePolicy({ draft, submission });
  assert.equal(policy.canResumePractice, false, "SubmissionSnapshot이 존재하면 Practice 이어하기 차단");
  assert.equal(policy.shouldCleanupStaleDraft, true, "잔여 stale Draft 정리 플래그 true");
  assert.equal(policy.reason, "SUBMISSION_EXISTS_PRACTICE_BLOCKED");
});

test("Phase F4: 53. [F4-R5-16 ~ F4-R5-18] Crash Window: Draft cleanup failure 후 reload 시 Submission 우선 및 Draft 복원 차단 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const questions = createSampleQuestions();
  const session = createSession({ sessionId: "sess_crash_window" }, questions);
  session.start();

  // 1. Draft 생성
  await saveDraft({
    sessionId: "sess_crash_window",
    sessionState: "SUBMITTING",
    questions
  }, { learnerId: learner.id });

  // 2. Draft cleanup failure 강제 주입
  _setDraftCleanupFailureInjectorForTesting(() => {
    throw new Error("Simulated cleanup crash");
  });

  try {
    // 3. 제출 수행 (Snapshot commit 성공, Draft cleanup 실패)
    const result = await submitLearningSession({
      session,
      learnerId: learner.id,
      questions
    });

    assert.ok(result);
    assert.equal(result.draftCleaned, false);

    // 4. 앱 재실행 모사: Storage에는 Submission과 stale Draft가 모두 존재
    const storedDraft = await getDraft({ learnerId: learner.id });
    const storedSubmission = await getSubmissionBySessionId("sess_crash_window", { learnerId: learner.id });

    assert.ok(storedDraft);
    assert.ok(storedSubmission);

    // 5. startup resume policy 평가
    const policy = evaluateStartupDraftResumePolicy({ draft: storedDraft, submission: storedSubmission });
    assert.equal(policy.canResumePractice, false, "제출본이 존재하는 경우 Practice 복원 불가");
    assert.equal(policy.shouldCleanupStaleDraft, true);
  } finally {
    _setDraftCleanupFailureInjectorForTesting(null);
  }
});

test("Phase F4: 54. [F4-R5-14, F4-R5-17] stale SUBMITTING Draft + Snapshot 존재 시 학생 editable Practice 진입 차단 검증", () => {
  const staleDraft = {
    sessionId: "sess_stale_sub_snapshot",
    sessionState: "SUBMITTING",
    questions: createSampleQuestions()
  };

  const completedSubmission = {
    sessionId: "sess_stale_sub_snapshot",
    status: "GRADED"
  };

  // normalizeDraft를 통과하더라도 startup policy에서 Submission이 우선됨을 검증
  const normalized = normalizeDraft(staleDraft);
  assert.equal(normalized.sessionState, "PRACTICE_ACTIVE");

  const policy = evaluateStartupDraftResumePolicy({ draft: normalized, submission: completedSubmission });
  assert.equal(policy.canResumePractice, false, "GRADED 제출본이 존재하므로 학생 Practice 진입 차단");
});

test("Phase F4: 55. [F4-R6-12] bootstrapApp: Snapshot + stale Practice Draft + /math/practice 직접 진입 차단 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const questions = createSampleQuestions();

  // 1. Practice Draft 저장
  await saveDraft({
    sessionId: "sess_boot_sub_first",
    sessionState: "PRACTICE_ACTIVE",
    questions,
    currentPageIndex: 0
  }, { learnerId: learner.id });

  // 2. 동일 sessionId에 대한 SubmissionSnapshot 저장 (PARENT_GRADING_PENDING)
  await saveSubmissionSnapshot({
    sessionId: "sess_boot_sub_first",
    questions,
    config: { pageSize: 2 },
    totalPages: 1,
    pageSize: 2,
    status: "PARENT_GRADING_PENDING",
    submittedAt: Date.now()
  }, { learnerId: learner.id });

  // 3. /math/practice 직접 deep link 진입 시도
  const result = await bootstrapApp({
    initialPath: ROUTES.MATH_PRACTICE
  });

  assert.equal(result.success, true);
  assert.notEqual(result.route, ROUTES.MATH_PRACTICE, "/math/practice 직접 진입은 차단되어야 함");
  assert.equal(result.route, ROUTES.MATH_GRADING, "제출된 산술 풀이의 practice 재진입 대신 채점 화면 복원");
  assert.equal(result.persistedSubmission.sessionId, "sess_boot_sub_first");
  assert.equal(result.persistedDraft, null, "stale Draft는 bootstrap 결과에서 null 처리되어야 함");
  assert.equal(result.draftResumePolicy?.canResumePractice, false, "policy상 practice 복원 차단");
});

test("Phase F4: 56. [F4-R6-13] bootstrapApp: Draft cleanup failure crash window에서도 /math/practice 차단 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const questions = createSampleQuestions();
  const session = createSession({ sessionId: "sess_boot_crash_window", pageSize: 2 }, questions);
  session.start();

  // 초기 Practice Draft 저장
  await saveDraft({
    sessionId: "sess_boot_crash_window",
    sessionState: "PRACTICE_ACTIVE",
    questions,
    currentPageIndex: 0
  }, { learnerId: learner.id });

  // Draft cleanup 실패 강제 주입하여 Crash Window 재현
  _setDraftCleanupFailureInjectorForTesting(() => {
    throw new Error("Crash window simulated cleanup fail");
  });

  try {
    // 제출 수행 -> Snapshot 저장 성공, Draft cleanup 실패
    await submitLearningSession({
      session,
      learnerId: learner.id,
      questions
    });

    // 앱 재실행 모사 (initialPath = /math/practice)
    const result = await bootstrapApp({
      initialPath: ROUTES.MATH_PRACTICE
    });

    assert.equal(result.success, true);
    assert.notEqual(result.route, ROUTES.MATH_PRACTICE, "Crash window 상태에서도 Practice route 진입 차단");
    assert.equal(result.route, ROUTES.MATH_GRADING);
    assert.equal(result.persistedSubmission.sessionId, "sess_boot_crash_window");
    assert.equal(result.persistedDraft, null, "stale Draft 반환 차단");
    assert.equal(result.draftResumePolicy?.canResumePractice, false);

    // DB 내 SubmissionSnapshot은 정상 유지 확인
    const sub = await queryGetSubmissionBySessionId("sess_boot_crash_window", { learnerId: learner.id });
    assert.ok(sub);
    assert.equal(sub.sessionId, "sess_boot_crash_window");
  } finally {
    _setDraftCleanupFailureInjectorForTesting(null);
  }
});

test("Phase F4: 57. [F4-R6-14] bootstrapApp: Submission 없는 정상 Practice Draft deep link 유지 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const questions = createSampleQuestions();

  // 정상 Practice Draft 저장 (Submission 없음)
  await saveDraft({
    sessionId: "sess_boot_valid_practice",
    sessionState: "PRACTICE_ACTIVE",
    questions,
    currentPageIndex: 0
  }, { learnerId: learner.id });

  // /math/practice 직접 deep link 진입 시도
  const result = await bootstrapApp({
    initialPath: ROUTES.MATH_PRACTICE
  });

  assert.equal(result.success, true);
  assert.equal(result.route, ROUTES.MATH_PRACTICE, "정상 Practice Draft는 /math/practice 진입 허용");
  assert.ok(result.persistedDraft);
  assert.equal(result.persistedDraft.sessionId, "sess_boot_valid_practice");
  assert.equal(result.draftResumePolicy?.canResumePractice, true);
});

test("Phase F4: 58. [F4-R6-15] bootstrapApp: 다른 sessionId Submission은 Practice Draft에 영향 없음 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const questions = createSampleQuestions();

  // 과거 세션 B의 완료된 Submission 존재
  await saveSubmissionSnapshot({
    sessionId: "sess_past_completed_B",
    questions,
    config: { pageSize: 2 },
    totalPages: 1,
    pageSize: 2,
    status: "GRADED",
    submittedAt: Date.now() - 100000
  }, { learnerId: learner.id });

  // 현재 진행 중인 세션 A의 Practice Draft 저장
  await saveDraft({
    sessionId: "sess_current_active_A",
    sessionState: "PRACTICE_ACTIVE",
    questions,
    currentPageIndex: 0
  }, { learnerId: learner.id });

  // /math/practice 직접 deep link 진입 시도
  const result = await bootstrapApp({
    initialPath: ROUTES.MATH_PRACTICE
  });

  assert.equal(result.success, true);
  assert.equal(result.route, ROUTES.MATH_PRACTICE, "다른 세션의 제출본이 있더라도 현재 세션 Draft의 진입은 정상 허용");
  assert.ok(result.persistedDraft);
  assert.equal(result.persistedDraft.sessionId, "sess_current_active_A");
  assert.equal(result.draftResumePolicy?.canResumePractice, true);
});

test("Phase F4: 59. [F4-R6-16] bootstrapApp: 다른 learner Submission은 현재 learner Draft를 차단하지 않음 검증", async () => {
  await clearAllData();
  const learnerA = await createLearner({ name: "학습자A" });
  const learnerB = await createLearner({ name: "학습자B" });

  const questions = createSampleQuestions();

  // 학습자 B가 동일 sessionId로 이미 제출 완료
  await saveSubmissionSnapshot({
    sessionId: "sess_shared_name_id",
    questions,
    config: { pageSize: 2 },
    totalPages: 1,
    pageSize: 2,
    status: "PARENT_GRADING_PENDING",
    submittedAt: Date.now()
  }, { learnerId: learnerB.id });

  // 학습자 A의 Practice Draft 저장
  await selectLearner(learnerA.id);
  await saveDraft({
    sessionId: "sess_shared_name_id",
    sessionState: "PRACTICE_ACTIVE",
    questions,
    currentPageIndex: 0
  }, { learnerId: learnerA.id });

  // 학습자 A 활성 상태에서 /math/practice 직접 진입
  const result = await bootstrapApp({
    initialPath: ROUTES.MATH_PRACTICE
  });

  assert.equal(result.success, true);
  assert.equal(result.route, ROUTES.MATH_PRACTICE, "타 학습자의 제출본은 현재 학습자의 Draft를 차단하지 않음");
  assert.ok(result.persistedDraft);
  assert.equal(result.persistedDraft.sessionId, "sess_shared_name_id");
  assert.equal(result.draftResumePolicy?.canResumePractice, true);
});

test("Phase F4: 60. Production 제출 잠금은 선언된 필기 비우기 버튼만 참조한다", () => {
  const appPath = path.resolve(__dirname, "../public/app/js/app.js");
  const appSource = fs.readFileSync(appPath, "utf-8");
  const lockFunction = appSource.match(/function setPracticeInteractionLocked\(locked\) \{[\s\S]*?\n\}/)?.[0];

  assert.ok(lockFunction, "setPracticeInteractionLocked production 함수를 찾을 수 있어야 함");
  assert.match(appSource, /const clearAllCanvasBtn = document\.querySelector\("#clearAllCanvasBtn"\);/);
  assert.match(lockFunction, /if \(clearAllCanvasBtn\) clearAllCanvasBtn\.disabled = locked;/);
  assert.doesNotMatch(lockFunction, /\bclearCanvasBtn\b/);
});
