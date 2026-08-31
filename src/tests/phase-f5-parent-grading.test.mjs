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

test.after(async () => {
  closeDB();
});
