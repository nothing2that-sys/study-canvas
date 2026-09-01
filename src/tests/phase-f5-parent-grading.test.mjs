//+_+// Math Canvas Pro Phase F5 보호자 채점 계약 회귀 테스트

import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "fake-indexeddb/auto";

import { createSession, SessionState } from "../public/app/js/sessionEngine.js";
import {
  GradeDecision,
  assertSubmissionGradingOwnership,
  createGradeDecision,
  getGradingProgress,
  normalizeGradeDecision
} from "../public/app/js/parentGrading.js";
import {
  closeDB,
  createLearnerProfile,
  getSubmission,
  saveSubmissionSnapshot,
  setCurrentLearnerId,
  updateSubmissionGrading
} from "../public/app/js/storage.js";
import {
  startSubmissionGrading
} from "../public/app/js/data/learningCommands.js";
import { bootstrapApp } from "../public/app/js/platform/appBootstrap.js";
import { ROUTES } from "../public/app/js/platform/appRouter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function questions() {
  return [
    { id: "f5_q1", key: "mul:12:3", operation: "mul", operandA: 12, operandB: 3, answer: 36, level: "M2" },
    { id: "f5_q2", key: "mul:14:4", operation: "mul", operandA: 14, operandB: 4, answer: 56, level: "M2" },
    { id: "f5_q3", key: "mul:17:5", operation: "mul", operandA: 17, operandB: 5, answer: 85, level: "M2" }
  ];
}

function pendingSession() {
  const session = createSession({ sessionId: `f5_${Date.now()}_${Math.random()}`, pageSize: 1 }, questions());
  session.start();
  session.startSubmitting();
  session.submitPractice(1200);
  session.setPendingGrading();
  return session;
}

test("Phase F5: 1. legacy boolean과 명시적 3상태 판정을 정규화한다", () => {
  assert.equal(normalizeGradeDecision(true), GradeDecision.CORRECT);
  assert.equal(normalizeGradeDecision(false), GradeDecision.WRONG);
  assert.equal(normalizeGradeDecision("retry_requested"), GradeDecision.RETRY);
  assert.equal(normalizeGradeDecision("unknown"), null);
});

test("Phase F5: 2. 판정 데이터는 응답과 분리된 decision/gradingState를 가진다", () => {
  const decision = createGradeDecision(questions()[0], GradeDecision.RETRY, "다시 확인", null, 100);
  assert.equal(decision.decision, GradeDecision.RETRY);
  assert.equal(decision.gradingState, "GRADED");
  assert.equal(decision.retryRequested, true);
  assert.equal(decision.isCorrect, false);
});

test("Phase F5: 3. 보호자 시작 전에는 판정할 수 없고 시작 후 GRADING_ACTIVE가 된다", () => {
  const session = pendingSession();
  assert.equal(session.state, SessionState.PARENT_GRADING_PENDING);
  assert.throws(() => session.gradeQuestion("f5_q1", GradeDecision.CORRECT), /GRADING_ACTIVE/);
  session.startGrading();
  assert.equal(session.state, SessionState.GRADING_ACTIVE);
});

test("Phase F5: 4. 정답/오답/다시 풀기는 모두 채점 진행률에 포함된다", () => {
  const session = pendingSession();
  session.startGrading();
  session.gradeQuestion("f5_q1", GradeDecision.CORRECT);
  session.gradeQuestion("f5_q2", GradeDecision.WRONG);
  session.gradeQuestion("f5_q3", GradeDecision.RETRY);
  assert.deepEqual(session.getGradingStatus(), {
    total: 3, graded: 3, correct: 1, wrong: 1, retry: 1,
    remaining: 0, allGraded: true, progressPercent: 100
  });
});

test("Phase F5: 5. 미채점 문제가 남으면 최종 완료를 차단한다", () => {
  const session = pendingSession();
  session.startGrading();
  session.gradeQuestion("f5_q1", GradeDecision.CORRECT);
  assert.throws(() => session.finishGrading(), /채점되지 않은 문제가 2개/);
  assert.equal(session.state, SessionState.GRADING_ACTIVE);
});

test("Phase F5: 6. 학생 payload는 grading 저장 전후 deepEqual로 보존된다", async () => {
  const learnerId = "f5_immutable_learner";
  setCurrentLearnerId(learnerId);
  const id = `sub_f5_immutable_${Date.now()}`;
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions(), studentStrokesMap: { f5_q1: [{ x: 1, y: 2 }] } });
  const before = await getSubmission(id, { learnerId });
  const immutableBefore = JSON.parse(JSON.stringify({ questions: before.questions, studentStrokesMap: before.studentStrokesMap, config: before.config }));
  await updateSubmissionGrading(id, {
    f5_q1: createGradeDecision(questions()[0], GradeDecision.CORRECT)
  }, new Map([["f5_q1", [{ x: 9, y: 9 }]]]), { learnerId, status: "GRADING_ACTIVE" });
  const after = await getSubmission(id, { learnerId });
  assert.deepEqual({ questions: after.questions, studentStrokesMap: after.studentStrokesMap, config: after.config }, immutableBefore);
  assert.deepEqual(after.gradingStrokesMap.f5_q1, [{ x: 9, y: 9 }]);
});

test("Phase F5: 7. 타 학습자 exact-ID 채점 접근을 거부한다", async () => {
  const ownerId = "f5_owner";
  const id = `sub_f5_owner_${Date.now()}`;
  setCurrentLearnerId(ownerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId: ownerId, questions: questions() });
  setCurrentLearnerId("f5_intruder");
  await assert.rejects(() => updateSubmissionGrading(id, {}, new Map(), { learnerId: "f5_intruder" }), /권한/);
  assert.throws(() => assertSubmissionGradingOwnership({ id, learnerId: ownerId }, "f5_intruder"), /권한/);
});

test("Phase F5: 8. Storage도 미채점 상태의 GRADED 확정을 거부한다", async () => {
  const learnerId = "f5_completion_guard";
  const id = `sub_f5_guard_${Date.now()}`;
  setCurrentLearnerId(learnerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });
  await assert.rejects(() => updateSubmissionGrading(id, {
    f5_q1: createGradeDecision(questions()[0], GradeDecision.CORRECT)
  }, new Map(), { learnerId, status: "GRADED", requireAllGraded: true }), /미채점 2문제/);
  assert.equal((await getSubmission(id, { learnerId })).status, "PARENT_GRADING_PENDING");
});

test("Phase F5: 9. 빠른/상세 보기 위치와 진행 상태를 Submission에 저장한다", async () => {
  const learnerId = "f5_view_state";
  const id = `sub_f5_view_${Date.now()}`;
  setCurrentLearnerId(learnerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });
  await updateSubmissionGrading(id, {}, new Map(), {
    learnerId,
    status: "GRADING_ACTIVE",
    gradingViewMode: "detail",
    currentGradingQuestionId: "f5_q2",
    answersHidden: true
  });
  const restored = await getSubmission(id, { learnerId });
  assert.equal(restored.gradingViewMode, "detail");
  assert.equal(restored.currentGradingQuestionId, "f5_q2");
  assert.equal(restored.answersHidden, true);
});

test("Phase F5: 10. Draft가 없어도 pending Submission으로 grading deep link를 복원한다", async () => {
  const learner = await createLearnerProfile({ name: "F5 복원 학습자", avatar: "🌱" });
  setCurrentLearnerId(learner.id);
  const id = `sub_f5_bootstrap_${Date.now()}`;
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId: learner.id, questions: questions() });
  const result = await bootstrapApp({
    initialPath: ROUTES.MATH_GRADING,
    documentRef: null,
    windowRef: null,
    detectLegacyData: async () => ({ hasLegacyData: false })
  });
  assert.equal(result.route, ROUTES.MATH_GRADING);
  assert.equal(result.persistedSubmission.id, id);
  assert.equal(result.persistedSubmission.status, "PARENT_GRADING_PENDING");
});

test("Phase F5: 11. 전체 판정 후에만 GRADED 상태와 100% 진행률을 저장한다", async () => {
  const learnerId = "f5_complete";
  const id = `sub_f5_complete_${Date.now()}`;
  setCurrentLearnerId(learnerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });
  await startSubmissionGrading(id, { learnerId });
  const gradingResults = Object.fromEntries(questions().map((question, index) => [
    question.id,
    createGradeDecision(question, index === 2 ? GradeDecision.RETRY : GradeDecision.CORRECT)
  ]));
  const completed = await updateSubmissionGrading(id, gradingResults, new Map(), {
    learnerId,
    status: "GRADED",
    requireAllGraded: true,
    completedAt: 200
  });
  assert.equal(completed.status, "GRADED");
  assert.equal(completed.gradingProgress.progressPercent, 100);
  assert.equal(completed.gradingProgress.retry, 1);
});

test("Phase F5: 12. Production UI에 시작 확인·빠른/상세·3상태 판정이 연결된다", () => {
  const html = fs.readFileSync(path.resolve(__dirname, "../public/app/index.html"), "utf8");
  const app = fs.readFileSync(path.resolve(__dirname, "../public/app/js/app.js"), "utf8");
  assert.match(html, /id="parentGradingStartPanel"/);
  assert.match(html, /id="gradingQuickViewBtn"/);
  assert.match(html, /id="gradingDetailViewBtn"/);
  assert.match(app, /data-decision="CORRECT"/);
  assert.match(app, /data-decision="WRONG"/);
  assert.match(app, /data-decision="RETRY"/);
});

// ============================================================================
// Phase F5 Reviewer Rework 추가 회귀 테스트 (F5-R1 ~ F5-R8)
// ============================================================================

test("Phase F5: 13. [F5-R1] 일부 문제만 채점한 상태에서 requireAllGraded 생략 및 status=GRADED 호출 시 반드시 reject 및 status 유지", async () => {
  const learnerId = "f5_r1_guard";
  const id = `sub_f5_r1_${Date.now()}`;
  setCurrentLearnerId(learnerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });
  
  // 1) PARENT_GRADING_PENDING 상태에서 일부 채점 + status: "GRADED" (requireAllGraded 생략) -> reject
  await assert.rejects(async () => {
    await updateSubmissionGrading(id, {
      f5_q1: createGradeDecision(questions()[0], GradeDecision.CORRECT)
    }, new Map(), { learnerId, status: "GRADED" });
  }, /미채점|채점/);
  let sub = await getSubmission(id, { learnerId });
  assert.equal(sub.status, "PARENT_GRADING_PENDING");

  // 2) GRADING_ACTIVE 진입 후 일부 채점 + status: "GRADED" (requireAllGraded 생략) -> reject
  await startSubmissionGrading(id, { learnerId });
  sub = await getSubmission(id, { learnerId });
  assert.equal(sub.status, "GRADING_ACTIVE");

  await assert.rejects(async () => {
    await updateSubmissionGrading(id, {
      f5_q1: createGradeDecision(questions()[0], GradeDecision.CORRECT)
    }, new Map(), { learnerId, status: "GRADED" });
  }, /미채점 2문제/);

  sub = await getSubmission(id, { learnerId });
  assert.equal(sub.status, "GRADING_ACTIVE");
});

test("Phase F5: 14. [F5-R2] 일부 문제만 채점한 상태에서 requireAllGraded 생략 및 status=SESSION_COMPLETE 호출 시 반드시 reject", async () => {
  const learnerId = "f5_r2_guard";
  const id = `sub_f5_r2_${Date.now()}`;
  setCurrentLearnerId(learnerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });
  await startSubmissionGrading(id, { learnerId });

  await assert.rejects(async () => {
    await updateSubmissionGrading(id, {
      f5_q1: createGradeDecision(questions()[0], GradeDecision.CORRECT),
      f5_q2: createGradeDecision(questions()[1], GradeDecision.WRONG)
    }, new Map(), { learnerId, status: "SESSION_COMPLETE" });
  }, /미채점 1문제/);

  const sub = await getSubmission(id, { learnerId });
  assert.equal(sub.status, "GRADING_ACTIVE");
});

test("Phase F5: 15. [F5-R3] 모든 문제 판정 완료 후 status=GRADED 정상 성공 및 진행률 100% 검증", async () => {
  const learnerId = "f5_r3_success";
  const id = `sub_f5_r3_${Date.now()}`;
  setCurrentLearnerId(learnerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });
  await startSubmissionGrading(id, { learnerId });

  const gradingResults = {
    f5_q1: createGradeDecision(questions()[0], GradeDecision.CORRECT),
    f5_q2: createGradeDecision(questions()[1], GradeDecision.WRONG),
    f5_q3: createGradeDecision(questions()[2], GradeDecision.RETRY)
  };

  const graded = await updateSubmissionGrading(id, gradingResults, new Map(), {
    learnerId,
    status: "GRADED"
  });

  assert.equal(graded.status, "GRADED");
  assert.equal(graded.gradingProgress.remaining, 0);
  assert.equal(graded.gradingProgress.allGraded, true);
  assert.equal(graded.gradingProgress.progressPercent, 100);
  assert.equal(graded.gradingProgress.graded, 3);
  assert.equal(graded.gradingProgress.correct, 1);
  assert.equal(graded.gradingProgress.wrong, 1);
  assert.equal(graded.gradingProgress.retry, 1);
});

test("Phase F5: 16. [F5-R4] PARENT_GRADING_PENDING 제출본에 대한 startSubmissionGrading 호출로 GRADING_ACTIVE 성공 전이 검증", async () => {
  const learnerId = "f5_r4_start";
  const id = `sub_f5_r4_${Date.now()}`;
  setCurrentLearnerId(learnerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });
  
  const before = await getSubmission(id, { learnerId });
  assert.equal(before.status, "PARENT_GRADING_PENDING");

  const started = await startSubmissionGrading(id, { learnerId });
  assert.equal(started.status, "GRADING_ACTIVE");

  const after = await getSubmission(id, { learnerId });
  assert.equal(after.status, "GRADING_ACTIVE");
});

test("Phase F5: 17. [F5-R5] 이미 GRADED인 Submission에 대해 startSubmissionGrading 호출 시 reject 및 GRADED 유지 검증", async () => {
  const learnerId = "f5_r5_reopen_block";
  const id = `sub_f5_r5_${Date.now()}`;
  setCurrentLearnerId(learnerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });
  await startSubmissionGrading(id, { learnerId });

  const gradingResults = {
    f5_q1: createGradeDecision(questions()[0], GradeDecision.CORRECT),
    f5_q2: createGradeDecision(questions()[1], GradeDecision.CORRECT),
    f5_q3: createGradeDecision(questions()[2], GradeDecision.CORRECT)
  };
  await updateSubmissionGrading(id, gradingResults, new Map(), { learnerId, status: "GRADED" });

  const graded = await getSubmission(id, { learnerId });
  assert.equal(graded.status, "GRADED");

  // startSubmissionGrading 재호출 시 reject
  await assert.rejects(async () => {
    await startSubmissionGrading(id, { learnerId });
  }, /PARENT_GRADING_PENDING/);

  // updateSubmissionGrading으로 GRADING_ACTIVE 역방향 전이 시도 시에도 reject
  await assert.rejects(async () => {
    await updateSubmissionGrading(id, {}, new Map(), { learnerId, status: "GRADING_ACTIVE" });
  }, /되돌릴 수 없습니다/);

  const after = await getSubmission(id, { learnerId });
  assert.equal(after.status, "GRADED");
});

test("Phase F5: 18. [F5-R6] SESSION_COMPLETE Submission에 대해 채점 시작 시도 시 reject 검증", async () => {
  const learnerId = "f5_r6_complete_block";
  const id = `sub_f5_r6_${Date.now()}`;
  setCurrentLearnerId(learnerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });
  await startSubmissionGrading(id, { learnerId });

  const gradingResults = {
    f5_q1: createGradeDecision(questions()[0], GradeDecision.CORRECT),
    f5_q2: createGradeDecision(questions()[1], GradeDecision.CORRECT),
    f5_q3: createGradeDecision(questions()[2], GradeDecision.CORRECT)
  };
  await updateSubmissionGrading(id, gradingResults, new Map(), { learnerId, status: "SESSION_COMPLETE" });

  const completed = await getSubmission(id, { learnerId });
  assert.equal(completed.status, "SESSION_COMPLETE");

  await assert.rejects(async () => {
    await startSubmissionGrading(id, { learnerId });
  }, /PARENT_GRADING_PENDING/);

  await assert.rejects(async () => {
    await updateSubmissionGrading(id, {}, new Map(), { learnerId, status: "GRADING_ACTIVE" });
  }, /되돌릴 수 없습니다/);

  const after = await getSubmission(id, { learnerId });
  assert.equal(after.status, "SESSION_COMPLETE");
});

test("Phase F5: 19. [F5-R7] 타 learner의 submissionId로 시작 / 판정 / 완료 시도 시 모두 reject 및 ownership 격리 검증", async () => {
  const ownerId = "f5_r7_owner";
  const intruderId = "f5_r7_intruder";
  const id = `sub_f5_r7_${Date.now()}`;
  
  setCurrentLearnerId(ownerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId: ownerId, questions: questions() });

  // 1. 타 학습자의 시작(startSubmissionGrading) 시도 -> reject
  setCurrentLearnerId(intruderId);
  await assert.rejects(async () => {
    await startSubmissionGrading(id, { learnerId: intruderId });
  }, /권한/);

  // 2. 타 학습자의 판정(updateSubmissionGrading) 시도 -> reject
  await assert.rejects(async () => {
    await updateSubmissionGrading(id, {
      f5_q1: createGradeDecision(questions()[0], GradeDecision.CORRECT)
    }, new Map(), { learnerId: intruderId, status: "GRADING_ACTIVE" });
  }, /권한/);

  // 3. 타 학습자의 완료(updateSubmissionGrading GRADED) 시도 -> reject
  const fullGrades = {
    f5_q1: createGradeDecision(questions()[0], GradeDecision.CORRECT),
    f5_q2: createGradeDecision(questions()[1], GradeDecision.CORRECT),
    f5_q3: createGradeDecision(questions()[2], GradeDecision.CORRECT)
  };
  await assert.rejects(async () => {
    await updateSubmissionGrading(id, fullGrades, new Map(), { learnerId: intruderId, status: "GRADED" });
  }, /권한/);

  // 소유자 본인 조회 시 상태 및 데이터 온전성 유지 확인
  setCurrentLearnerId(ownerId);
  const ownerSub = await getSubmission(id, { learnerId: ownerId });
  assert.ok(ownerSub);
  assert.equal(ownerSub.learnerId, ownerId);
  assert.equal(ownerSub.status, "PARENT_GRADING_PENDING");
});

test("Phase F5: 20. [F5-R8] grading 저장 전후 학생 payload (questions, config, studentStrokesMap, learnerId, sessionId) deepEqual 불변 검증", async () => {
  const learnerId = "f5_r8_deep_equal";
  const id = `sub_f5_r8_${Date.now()}`;
  const sessionId = `sess_${Date.now()}`;
  setCurrentLearnerId(learnerId);

  const initialQuestions = questions();
  const initialConfig = { pageSize: 3, operation: "mul", cols: 3, rows: 1 };
  const initialStudentStrokes = {
    f5_q1: [{ id: "st1", x: 10, y: 20 }, { id: "st2", x: 15, y: 25 }],
    f5_q2: [{ id: "st3", x: 30, y: 40 }]
  };

  await saveSubmissionSnapshot({
    id,
    sessionId,
    learnerId,
    questions: initialQuestions,
    config: initialConfig,
    studentStrokesMap: initialStudentStrokes,
    totalSolveTimeMs: 25000
  });

  const before = await getSubmission(id, { learnerId });
  const studentPayloadBefore = {
    questions: JSON.parse(JSON.stringify(before.questions)),
    config: JSON.parse(JSON.stringify(before.config)),
    studentStrokesMap: JSON.parse(JSON.stringify(before.studentStrokesMap)),
    learnerId: before.learnerId,
    sessionId: before.sessionId,
    totalSolveTimeMs: before.totalSolveTimeMs
  };

  // 1) startSubmissionGrading 수행
  await startSubmissionGrading(id, { learnerId });

  // 2) updateSubmissionGrading 수행 (판정 + 빨간펜 스트로크 추가)
  const redPenStrokes = new Map([
    ["f5_q1", [{ id: "red_1", color: "#c62828", points: [{ x: 50, y: 50 }] }]]
  ]);
  const gradingResults = {
    f5_q1: createGradeDecision(initialQuestions[0], GradeDecision.CORRECT, "좋아요"),
    f5_q2: createGradeDecision(initialQuestions[1], GradeDecision.WRONG, "다시 확인"),
    f5_q3: createGradeDecision(initialQuestions[2], GradeDecision.RETRY, "다시 풀어보자")
  };

  const after = await updateSubmissionGrading(id, gradingResults, redPenStrokes, {
    learnerId,
    status: "GRADED",
    gradingViewMode: "detail",
    currentGradingQuestionId: "f5_q2"
  });

  const studentPayloadAfter = {
    questions: JSON.parse(JSON.stringify(after.questions)),
    config: JSON.parse(JSON.stringify(after.config)),
    studentStrokesMap: JSON.parse(JSON.stringify(after.studentStrokesMap)),
    learnerId: after.learnerId,
    sessionId: after.sessionId,
    totalSolveTimeMs: after.totalSolveTimeMs
  };

  // 학생 payload 100% deepEqual 불변 검증
  assert.deepEqual(studentPayloadAfter, studentPayloadBefore);

  // 채점 영역만 정상 갱신되었는지 검증
  assert.equal(after.status, "GRADED");
  assert.equal(after.gradingViewMode, "detail");
  assert.equal(after.currentGradingQuestionId, "f5_q2");
  assert.ok(after.gradingStrokesMap.f5_q1);
});

test.after(async () => {
  closeDB();
});
