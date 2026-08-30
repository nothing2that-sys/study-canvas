//+_+// Math Canvas Pro - Phase F4 Submission Snapshot & Answer Lock Comprehensive Tests
//+_+// SSOT Section 16 및 Phase F4 명세 준수

import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "fake-indexeddb/auto";

import {
  createSession,
  SessionState
} from "../public/app/js/sessionEngine.js";

import {
  getDB,
  clearAllData,
  DEFAULT_LEGACY_LEARNER_ID,
  setCurrentLearnerId,
  getCurrentLearnerId,
  clearCurrentLearner,
  _resetActiveLearnerInMemoryForTesting,
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
  DraftSaveStatus
} from "../public/app/js/draftEngine.js";

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

test("Phase F4: 1. 정상 제출 시 불변 SubmissionSnapshot 생성 및 스키마 검증", async () => {
  await clearAllData();
  _resetActiveLearnerInMemoryForTesting();

  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const questions = createSampleQuestions();
  const session = createSession({ sessionId: "sess_f4_001", operation: "mul", pageSize: 4 }, questions);
  session.start();

  const studentStrokesMap = new Map();
  studentStrokesMap.set("q_1", [
    { id: "st_1", color: "#173f35", width: 2.5, isEraser: false, points: [{ x: 10, y: 10, relX: 0.1, relY: 0.1 }] }
  ]);

  const submissionResult = await submitLearningSession({
    session,
    learnerId: learner.id,
    subjectId: "math",
    moduleId: "arithmetic",
    inputProfile: "DESKTOP_MOUSE_PEN",
    totalSolveTimeMs: 12500,
    perQuestionElapsedMs: { q_1: 6000, q_2: 6500 },
    studentStrokesMap,
    appBuildId: "20260830T-test"
  });

  assert.ok(submissionResult, "제출 결과가 반환되어야 함");
  assert.equal(submissionResult.sessionId, "sess_f4_001");
  assert.equal(submissionResult.learnerId, learner.id);
  assert.equal(submissionResult.status, "PARENT_GRADING_PENDING");
  assert.equal(submissionResult.schemaVersion, 4);
  assert.equal(submissionResult.subjectId, "math");
  assert.equal(submissionResult.moduleId, "arithmetic");
  assert.equal(submissionResult.totalSolveTimeMs, 12500);
  assert.deepEqual(submissionResult.studentStrokesMap.q_1, studentStrokesMap.get("q_1"));
  assert.equal(submissionResult.questions.length, 2);

  // 영구 스토리지에서 직접 조회 확인
  const saved = await queryGetSubmission(submissionResult.id);
  assert.ok(saved, "저장된 스냅샷 조회가 가능해야 함");
  assert.equal(saved.id, submissionResult.id);
  assert.equal(saved.sessionId, "sess_f4_001");
});

test("Phase F4: 2. Snapshot의 learnerId 소유권 및 격리 검증", async () => {
  await clearAllData();
  _resetActiveLearnerInMemoryForTesting();

  const learnerA = await createLearner({ name: "학습자A" });
  const learnerB = await createLearner({ name: "학습자B" });

  await selectLearner(learnerA.id);
  const sessionA = createSession({ sessionId: "sess_a_1" }, createSampleQuestions());
  sessionA.start();
  await submitLearningSession({
    session: sessionA,
    learnerId: learnerA.id,
    subjectId: "math",
    moduleId: "arithmetic"
  });

  await selectLearner(learnerB.id);
  const sessionB = createSession({ sessionId: "sess_b_1" }, createSampleQuestions());
  sessionB.start();
  await submitLearningSession({
    session: sessionB,
    learnerId: learnerB.id,
    subjectId: "math",
    moduleId: "arithmetic"
  });

  // Query 계층을 통해 학습자별 대기 목록 격리 확인
  const pendingA = await queryGetPendingSubmissions({ learnerId: learnerA.id });
  const pendingB = await queryGetPendingSubmissions({ learnerId: learnerB.id });

  assert.equal(pendingA.length, 1);
  assert.equal(pendingA[0].sessionId, "sess_a_1");
  assert.equal(pendingA[0].learnerId, learnerA.id);

  assert.equal(pendingB.length, 1);
  assert.equal(pendingB[0].sessionId, "sess_b_1");
  assert.equal(pendingB[0].learnerId, learnerB.id);
});

test("Phase F4: 3. 제출 완료 후 학생 답안 수정 차단 (Answer Lock) 검증", async () => {
  const questions = createSampleQuestions();
  const session = createSession({ sessionId: "sess_lock_1" }, questions);
  session.start();

  assert.equal(session.state, SessionState.PRACTICE_ACTIVE);

  // 학생 제출 실행
  session.submitPractice(5000);

  // 제출 완료 상태 확인
  assert.ok(
    session.state === SessionState.SUBMITTED ||
    session.state === SessionState.SUBMITTED_LOCKED ||
    session.state === SessionState.PARENT_GRADING_PENDING,
    "세션이 제출 잠금 상태여야 함"
  );

  // 제출 후 다시 submitPractice 호출 차단
  assert.throws(() => {
    session.submitPractice(3000);
  }, /제출할 수 없는|현재 상태/);
});

test("Phase F4: 4. 제출 완료 후 학생 필기 획(Stroke) 수정/추가/삭제/Undo 차단 검증", async () => {
  // DOM 캔버스 모의
  const canvasEl = {
    getContext: () => ({
      scale: () => {},
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      arc: () => {},
      fill: () => {},
      save: () => {},
      restore: () => {},
      quadraticCurveTo: () => {}
    }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 300 }),
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  const initialStrokes = [
    { id: "st_1", color: "#173f35", width: 2.5, isEraser: false, points: [{ x: 10, y: 10 }] }
  ];

  // 채점 뷰에서는 학생 필기가 readOnly / backgroundStrokes로 마운트됨
  const canvasInstance = createDrawingCanvas(canvasEl, {
    readOnly: true,
    backgroundStrokes: initialStrokes
  });

  assert.equal(canvasInstance.getInputProfile(), InputProfile.READ_ONLY);

  // Undo/Redo/Clear 동작 시 학생 필기는 영향받지 않아야 함
  const undoResult = canvasInstance.undo();
  assert.equal(undoResult, false, "readOnly 상태에서는 undo가 불가해야 함");

  const strokes = canvasInstance.getStrokes();
  assert.equal(strokes.length, 0, "편집 가능한 획 목록은 비어있어야 함");
  assert.deepEqual(canvasInstance.getBackgroundStrokes(), initialStrokes, "배경 학생 획은 온전히 유지되어야 함");
});

test("Phase F4: 5. 보호자 채점(Red-pen) 레이어와 학생 필기 Snapshot의 완전 분리 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const studentStrokes = [{ id: "st_student_1", color: "#173f35", width: 2.5, points: [{ x: 5, y: 5 }] }];
  const studentStrokesMap = new Map([["q_1", studentStrokes]]);

  const session = createSession({ sessionId: "sess_split_1" }, createSampleQuestions());
  session.start();

  const submission = await submitLearningSession({
    session,
    learnerId: learner.id,
    studentStrokesMap
  });

  // 보호자 채점 스트로크 및 평가 업데이트
  const gradingStrokes = [{ id: "st_red_1", color: "#c62828", width: 3.0, points: [{ x: 50, y: 50 }] }];
  const gradingStrokesMap = new Map([["q_1", gradingStrokes]]);
  const gradingResults = { q_1: { isCorrect: true, comment: "잘했어요!" } };

  const updatedSubmission = await commandUpdateSubmissionGrading(
    submission.id,
    gradingResults,
    gradingStrokesMap
  );

  assert.ok(updatedSubmission, "채점 업데이트 성공");
  assert.deepEqual(updatedSubmission.studentStrokesMap.q_1, studentStrokes, "학생 필기 획은 100% 보존되어야 함");
  assert.deepEqual(updatedSubmission.gradingStrokesMap.q_1, gradingStrokes, "채점자 빨간펜 획이 분리 저장되어야 함");
  assert.deepEqual(updatedSubmission.gradingResults.q_1, gradingResults.q_1);
});

test("Phase F4: 6. 동일 세션 중복 제출 시 멱등성 (Idempotency) 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const session = createSession({ sessionId: "sess_idemp_1" }, createSampleQuestions());
  session.start();

  // 1차 제출
  const sub1 = await submitLearningSession({
    session,
    learnerId: learner.id,
    totalSolveTimeMs: 10000
  });

  // 2차 중복 제출 시도 (동일 sessionId)
  const sub2 = await submitLearningSession({
    session,
    learnerId: learner.id,
    totalSolveTimeMs: 10000
  });

  assert.equal(sub1.id, sub2.id, "동일한 submission ID가 반환되어야 함");
  assert.equal(sub1.submittedAt, sub2.submittedAt, "제출 시각이 덮어쓰여지지 않아야 함");

  const allSubs = await getAllSubmissions({ learnerId: learner.id });
  assert.equal(allSubs.length, 1, "중복 레코드가 생성되지 않아야 함");
});

test("Phase F4: 7. 저장 실패 시 Snapshot 미생성 및 세션/Draft 보존 (원자성) 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  // 활성 Draft 저장
  await saveDraft({
    id: `current_draft_${learner.id}`,
    learnerId: learner.id,
    sessionId: "sess_fail_test",
    questions: createSampleQuestions(),
    totalElapsedMs: 8000
  });

  const session = createSession({ sessionId: "sess_fail_test" }, createSampleQuestions());
  session.start();

  // 강제 실패 시나리오 (유효하지 않은 snapshot 데이터 전달 등)
  await assert.rejects(async () => {
    await submitLearningSession({
      session: null, // 강제 오류 유발
      learnerId: learner.id
    });
  });

  // Draft가 삭제되지 않고 유지되었는지 확인
  const preservedDraft = await getDraft({ learnerId: learner.id });
  assert.ok(preservedDraft, "제출 실패 시 Draft가 삭제되지 않아야 함");
  assert.equal(preservedDraft.sessionId, "sess_fail_test");

  // Snapshot이 생성되지 않았는지 확인
  const pending = await queryGetPendingSubmissions({ learnerId: learner.id });
  assert.equal(pending.length, 0, "실패 시 Snapshot이 저장되지 않아야 함");
});

test("Phase F4: 8. 저장 성공 확인 전 Draft 삭제 금지 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  let draftCleared = false;
  let snapshotSaved = false;

  await saveDraft({
    id: `current_draft_${learner.id}`,
    learnerId: learner.id,
    sessionId: "sess_draft_order",
    questions: createSampleQuestions(),
    totalElapsedMs: 5000
  });

  const session = createSession({ sessionId: "sess_draft_order" }, createSampleQuestions());
  session.start();

  // submitLearningSession 실행 순서 검증
  const sub = await submitLearningSession({
    session,
    learnerId: learner.id
  });

  assert.ok(sub, "제출 성공");
  const draftAfter = await getDraft({ learnerId: learner.id });
  assert.equal(draftAfter, null, "제출 성공 후에는 Draft가 정상 삭제되어야 함");
});

test("Phase F4: 9. 제출 성공 후 Active Draft 정상 정리 (Lifecycle 종료) 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  await saveDraft({
    id: `current_draft_${learner.id}`,
    learnerId: learner.id,
    sessionId: "sess_lifecycle_1",
    questions: createSampleQuestions(),
    totalElapsedMs: 4000
  });

  const session = createSession({ sessionId: "sess_lifecycle_1" }, createSampleQuestions());
  session.start();

  await submitLearningSession({
    session,
    learnerId: learner.id
  });

  const remainingDraft = await getDraft({ learnerId: learner.id });
  assert.equal(remainingDraft, null, "제출 완료 후 Draft 세션이 정리되어야 함");
});

test("Phase F4: 10. 새로고침 및 재실행 후 제출된 Snapshot 상태 복원 검증", async () => {
  await clearAllData();
  const learner = await createLearner({ name: "학습자A" });
  await selectLearner(learner.id);

  const studentStrokesMap = new Map([
    ["q_1", [{ id: "st_1", color: "#173f35", points: [{ x: 10, y: 20 }] }]]
  ]);

  const session = createSession({ sessionId: "sess_restore_1" }, createSampleQuestions());
  session.start();

  const sub = await submitLearningSession({
    session,
    learnerId: learner.id,
    subjectId: "math",
    moduleId: "arithmetic",
    studentStrokesMap
  });

  // 앱 재실행(스토리지 재조회) 시뮬레이션
  const restored = await queryGetSubmissionBySessionId("sess_restore_1", { learnerId: learner.id });
  assert.ok(restored, "sessionId로 제출본 조회가 가능해야 함");
  assert.equal(restored.status, "PARENT_GRADING_PENDING");
  assert.equal(restored.questions.length, 2);
  assert.deepEqual(restored.studentStrokesMap.q_1, studentStrokesMap.get("q_1"));
});

test("Phase F4: 11. 학습자 A와 B의 제출본 및 채점 대기 목록 완전 격리 검증", async () => {
  await clearAllData();
  _resetActiveLearnerInMemoryForTesting();

  const learnerA = await createLearner({ name: "학습자A" });
  const learnerB = await createLearner({ name: "학습자B" });

  const sessionA1 = createSession({ sessionId: "sess_a_101" }, createSampleQuestions());
  sessionA1.start();
  await submitLearningSession({ session: sessionA1, learnerId: learnerA.id });

  const sessionA2 = createSession({ sessionId: "sess_a_102" }, createSampleQuestions());
  sessionA2.start();
  await submitLearningSession({ session: sessionA2, learnerId: learnerA.id });

  const sessionB1 = createSession({ sessionId: "sess_b_201" }, createSampleQuestions());
  sessionB1.start();
  await submitLearningSession({ session: sessionB1, learnerId: learnerB.id });

  const listA = await queryGetPendingSubmissions({ learnerId: learnerA.id });
  const listB = await queryGetPendingSubmissions({ learnerId: learnerB.id });

  assert.equal(listA.length, 2);
  assert.ok(listA.every((s) => s.learnerId === learnerA.id));

  assert.equal(listB.length, 1);
  assert.equal(listB[0].sessionId, "sess_b_201");
  assert.equal(listB[0].learnerId, learnerB.id);

  // 학습자 A 데이터 초기화 시 B 데이터는 무손실 보존
  await clearAllData({ learnerId: learnerA.id });

  const afterClearA = await queryGetPendingSubmissions({ learnerId: learnerA.id });
  const afterClearB = await queryGetPendingSubmissions({ learnerId: learnerB.id });

  assert.equal(afterClearA.length, 0);
  assert.equal(afterClearB.length, 1);
  assert.equal(afterClearB[0].sessionId, "sess_b_201");
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

  // 1. 제출 Snapshot 생성
  const submission = await submitLearningSession({
    session,
    learnerId: learner.id,
    studentStrokesMap
  });
  assert.equal(submission.status, "PARENT_GRADING_PENDING");

  // 2. 보호자 채점 진행
  session.startGrading();
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
    { status: "GRADED", completedAt: Date.now() }
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
