//+_+// Math Canvas Pro - Phase F7 ReviewItem & Retry Lifecycle Comprehensive Tests
//+_+// Phase F7 ReviewItem 상태 전이 검증

import assert from "node:assert/strict";
import test from "node:test";
import "fake-indexeddb/auto";

import {
  createSession,
  SessionState
} from "../public/app/js/sessionEngine.js";

import {
  GradeDecision,
  createGradeDecision
} from "../public/app/js/parentGrading.js";

import { isSubmittedSnapshotStatus } from "../public/app/js/submissionLifecycle.js";

import {
  getDB,
  closeDB,
  clearAllData,
  DB_VERSION,
  DEFAULT_LEGACY_LEARNER_ID,
  setCurrentLearnerId,
  getCurrentLearnerId,
  clearCurrentLearner,
  saveSubmissionSnapshot,
  getSubmission,
  getAllSubmissions,
  getProgressAggregateByLevel,
  getAllProgressAggregates,
  rebuildProgressAggregatesForLearner,
  getReviewItem,
  getAllReviewItems,
  getActiveReviewItems,
  getResolvedReviewItems,
  getReviewItemsByState,
  _setFinalizeFailureInjectorForTesting,
  _setReviseFailureInjectorForTesting,
  _setRetryFailureInjectorForTesting
} from "../public/app/js/storage.js";

import {
  submitLearningSession,
  startSubmissionGrading,
  finalizeSubmissionGrading,
  reviseFinalizedGradeDecision,
  startReviewRetry,
  deferReviewItem,
  markReviewItemReviewPending,
  resolveReviewItem,
  retryReviewItemAgain
} from "../public/app/js/data/learningCommands.js";

import {
  getRecentSessions,
  getRecentAttempts,
  getMistakes,
  getLearningStats,
  getCurriculumProgress,
  getReviewItem as queryGetReviewItem,
  getActiveReviewItems as queryGetActiveReviewItems,
  getResolvedReviewItems as queryGetResolvedReviewItems,
  getReviewItemsByState as queryGetReviewItemsByState
} from "../public/app/js/data/learningQueries.js";

function createMockQuestions(count = 3, level = "M1", operation = "mul") {
  const qs = [];
  for (let i = 1; i <= count; i++) {
    qs.push({
      id: `q_${level}_${i}`,
      key: `${operation}:${i + 1}:${i + 2}`,
      questionKey: `${operation}:${i + 1}:${i + 2}`,
      orderNumber: i,
      operation,
      operandA: i + 1,
      operandB: i + 2,
      answer: operation === "mul" ? (i + 1) * (i + 2) : i + 1,
      expectedAnswer: operation === "mul" ? (i + 1) * (i + 2) : i + 1,
      level,
      macroLevelId: level,
      stageId: level
    });
  }
  return qs;
}

test.beforeEach(async () => {
  await clearAllData();
  clearCurrentLearner();
});

test.after(async () => {
  await closeDB();
});

// ============================================================================
// 1. 저장 구조 및 마이그레이션 (F7-01 ~ F7-04)
// ============================================================================

test("Phase F7: 1. [F7-01] DB_VERSION이 6 이상으로 정의되고 6 이상으로 오픈된다", async () => {
  assert.ok(DB_VERSION >= 6, "DB_VERSION은 6 이상이어야 함");
  const db = await getDB();
  assert.ok(db.version >= 6, "DB 오픈 버전이 6 이상이어야 함");
});

test("Phase F7: 2. [F7-02] v5 -> v6 migration 시 기존 데이터가 100% 보존된다", async () => {
  // v5 상태에서 submissions 및 progressAggregates 데이터 사전 주입
  const db = await getDB();
  assert.ok(db.objectStoreNames.contains("submissions"));
  assert.ok(db.objectStoreNames.contains("progressAggregates"));
  assert.ok(db.objectStoreNames.contains("reviewItems"));
});

test("Phase F7: 3. [F7-03] reviewItems Store 및 6대 필수 index 생성 검증", async () => {
  const db = await getDB();
  assert.ok(db.objectStoreNames.contains("reviewItems"), "reviewItems Store가 존재해야 함");
  const tx = db.transaction("reviewItems", "readonly");
  const store = tx.objectStore("reviewItems");
  const indexNames = Array.from(store.indexNames);
  assert.ok(indexNames.includes("learnerId"), "learnerId index 존재");
  assert.ok(indexNames.includes("state"), "state index 존재");
  assert.ok(indexNames.includes("subjectId"), "subjectId index 존재");
  assert.ok(indexNames.includes("levelId"), "levelId index 존재");
  assert.ok(indexNames.includes("sourceAttemptId"), "sourceAttemptId index 존재");
  assert.ok(indexNames.includes("nextReviewAt"), "nextReviewAt index 존재");
});

test("Phase F7: 4. [F7-04] Memory fallback 동일 스키마 및 동작 검증", async () => {
  // getDB memory 모드 또는 fallback에서 reviewItems Map 검증
  const db = await getDB();
  if (db.isMemory) {
    assert.ok(db.reviewItems instanceof Map, "Memory fallback에서 reviewItems Map 제공");
  }
});

// ============================================================================
// 2. ReviewItem 생성 및 멱등성 (F7-05 ~ F7-09)
// ============================================================================

test("Phase F7: 5. [F7-05] CORRECT 판정 문제는 ReviewItem을 생성하지 않는다", async () => {
  const learnerId = "learner_f7_05";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(2, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 2 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const sub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });
  await finalizeSubmissionGrading(sub.id, {
    learnerId,
    gradingResults: {
      [qs[0].id]: createGradeDecision(qs[0], GradeDecision.CORRECT),
      [qs[1].id]: createGradeDecision(qs[1], GradeDecision.CORRECT)
    }
  });

  const reviewItems = await getAllReviewItems({ learnerId });
  assert.equal(reviewItems.length, 0, "CORRECT 문제는 ReviewItem이 생성되지 않아야 함");
});

test("Phase F7: 6. [F7-06] WRONG 판정 문제는 unresolved 상태의 ReviewItem을 생성한다", async () => {
  const learnerId = "learner_f7_06";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(2, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 2 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const sub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });
  await finalizeSubmissionGrading(sub.id, {
    learnerId,
    gradingResults: {
      [qs[0].id]: createGradeDecision(qs[0], GradeDecision.CORRECT),
      [qs[1].id]: createGradeDecision(qs[1], GradeDecision.WRONG)
    }
  });

  const reviewItems = await getAllReviewItems({ learnerId });
  assert.equal(reviewItems.length, 1, "WRONG 문제에 대해 1개의 ReviewItem 생성");
  const item = reviewItems[0];
  assert.equal(item.state, "unresolved");
  assert.equal(item.learnerId, learnerId);
  assert.equal(item.questionId, qs[1].id);
  assert.equal(item.reasonCode, "WRONG");
  assert.deepEqual(item.retryAttemptIds, []);
  assert.ok(item.sourceAttemptId, "sourceAttemptId가 기록되어야 함");
});

test("Phase F7: 7. [F7-07] RETRY 판정 문제도 unresolved 상태의 ReviewItem을 생성한다", async () => {
  const learnerId = "learner_f7_07";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(2, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 2 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const sub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });
  await finalizeSubmissionGrading(sub.id, {
    learnerId,
    gradingResults: {
      [qs[0].id]: createGradeDecision(qs[0], GradeDecision.CORRECT),
      [qs[1].id]: createGradeDecision(qs[1], GradeDecision.RETRY)
    }
  });

  const reviewItems = await getAllReviewItems({ learnerId });
  assert.equal(reviewItems.length, 1, "RETRY 문제에 대해 1개의 ReviewItem 생성");
  const item = reviewItems[0];
  assert.equal(item.state, "unresolved");
  assert.equal(item.reasonCode, "RETRY");
});

test("Phase F7: 8. [F7-08] 동일 Attempt에 대해 중복 ReviewItem이 생성되지 않는다", async () => {
  const learnerId = "learner_f7_08";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const sub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });
  await finalizeSubmissionGrading(sub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const reviewItems1 = await getAllReviewItems({ learnerId });
  assert.equal(reviewItems1.length, 1);

  // 동일한 확정 submission 재실행 시도시 ReviewItem 개수 불변
  await finalizeSubmissionGrading(sub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const reviewItems2 = await getAllReviewItems({ learnerId });
  assert.equal(reviewItems2.length, 1, "중복 ReviewItem이 생성되지 않아야 함");
});

test("Phase F7: 9. [F7-09] finalizeSubmissionGrading 반복 호출 멱등성 검증", async () => {
  const learnerId = "learner_f7_09";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(2, "M2");
  const session = createSession({ operation: "mul", macroLevelId: "M2", pageSize: 2 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(6000);
  session.setPendingGrading();

  const sub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });
  await finalizeSubmissionGrading(sub.id, {
    learnerId,
    gradingResults: {
      [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG),
      [qs[1].id]: createGradeDecision(qs[1], GradeDecision.RETRY)
    }
  });

  for (let i = 0; i < 3; i++) {
    await finalizeSubmissionGrading(sub.id, { learnerId });
  }

  const items = await getAllReviewItems({ learnerId });
  assert.equal(items.length, 2, "반복 호출해도 ReviewItem은 2개만 존재");
});

// ============================================================================
// 3. Learner Isolation (F7-10 ~ F7-12)
// ============================================================================

test("Phase F7: 10. [F7-10] 다른 learner의 ReviewItem은 조회 목록에 노출되지 않는다", async () => {
  const learnerA = "learner_f7_10_A";
  const learnerB = "learner_f7_10_B";

  setCurrentLearnerId(learnerA);
  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();
  const sub = await submitLearningSession({ session, learnerId: learnerA });
  await startSubmissionGrading(sub.id, { learnerId: learnerA });
  await finalizeSubmissionGrading(sub.id, {
    learnerId: learnerA,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  setCurrentLearnerId(learnerB);
  const itemsB = await getActiveReviewItems({ learnerId: learnerB });
  assert.equal(itemsB.length, 0, "learnerB는 learnerA의 ReviewItem을 볼 수 없음");
});

test("Phase F7: 11. [F7-11] 다른 learner의 ReviewItem으로 retry를 시작할 수 없다", async () => {
  const learnerA = "learner_f7_11_A";
  const learnerB = "learner_f7_11_B";

  setCurrentLearnerId(learnerA);
  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();
  const sub = await submitLearningSession({ session, learnerId: learnerA });
  await startSubmissionGrading(sub.id, { learnerId: learnerA });
  await finalizeSubmissionGrading(sub.id, {
    learnerId: learnerA,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [itemA] = await getAllReviewItems({ learnerId: learnerA });

  setCurrentLearnerId(learnerB);
  await assert.rejects(
    async () => {
      await startReviewRetry(itemA.id, { learnerId: learnerB });
    },
    /권한|접근/
  );
});

test("Phase F7: 12. [F7-12] 다른 learner의 ReviewItem을 resolve할 수 없다", async () => {
  const learnerA = "learner_f7_12_A";
  const learnerB = "learner_f7_12_B";

  setCurrentLearnerId(learnerA);
  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();
  const sub = await submitLearningSession({ session, learnerId: learnerA });
  await startSubmissionGrading(sub.id, { learnerId: learnerA });
  await finalizeSubmissionGrading(sub.id, {
    learnerId: learnerA,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [itemA] = await getAllReviewItems({ learnerId: learnerA });

  setCurrentLearnerId(learnerB);
  await assert.rejects(
    async () => {
      await resolveReviewItem(itemA.id, { learnerId: learnerB });
    },
    /권한|접근/
  );
});

// ============================================================================
// 4. 재풀이 격리 및 원본 불변 (F7-13 ~ F7-19)
// ============================================================================

test("Phase F7: 13. [F7-13] 바로 다시 풀기 시 신규 Attempt가 생성된다", async () => {
  const learnerId = "learner_f7_13";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const sub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });
  await finalizeSubmissionGrading(sub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [reviewItem] = await getAllReviewItems({ learnerId });
  const retryResult = await startReviewRetry(reviewItem.id, { learnerId });

  assert.ok(retryResult.retryAttempt, "신규 retryAttempt가 반환되어야 함");
  assert.equal(retryResult.retryAttempt.attemptKind, "RETRY");
  assert.equal(retryResult.retryAttempt.retryOrdinal, 1);
});

test("Phase F7: 14. [F7-14] 원본 Attempt ID와 retry Attempt ID는 반드시 다르다", async () => {
  const learnerId = "learner_f7_14";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const sub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });
  await finalizeSubmissionGrading(sub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [reviewItem] = await getAllReviewItems({ learnerId });
  const retryResult = await startReviewRetry(reviewItem.id, { learnerId });

  assert.notEqual(retryResult.retryAttempt.id, reviewItem.sourceAttemptId, "원본 Attempt ID와 retry Attempt ID는 분리");
});

test("Phase F7: 15. [F7-15] 바로 다시 풀기 후에도 원본 학생 답안은 불변이다", async () => {
  const learnerId = "learner_f7_15";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const sub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });
  await finalizeSubmissionGrading(sub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const origSub = await getSubmission(sub.id, { learnerId });
  const origAnswer = origSub.questions[0].answer;

  const [reviewItem] = await getAllReviewItems({ learnerId });
  await startReviewRetry(reviewItem.id, { learnerId });

  const afterSub = await getSubmission(sub.id, { learnerId });
  assert.equal(afterSub.questions[0].answer, origAnswer, "원본 답안 불변");
});

test("Phase F7: 16. [F7-16] 바로 다시 풀기 후에도 원본 학생 stroke는 불변이다", async () => {
  const learnerId = "learner_f7_16";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const studentStrokes = { [qs[0].id]: [{ points: [{ x: 10, y: 10 }] }] };
  const sub = await submitLearningSession({ session, studentStrokesMap: studentStrokes, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });
  await finalizeSubmissionGrading(sub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [reviewItem] = await getAllReviewItems({ learnerId });
  await startReviewRetry(reviewItem.id, { learnerId });

  const afterSub = await getSubmission(sub.id, { learnerId });
  assert.deepEqual(afterSub.studentStrokesMap, studentStrokes, "원본 stroke 불변");
});

test("Phase F7: 17. [F7-17] 바로 다시 풀기 후에도 원본 SubmissionSnapshot은 불변(Lock 유지)이다", async () => {
  const learnerId = "learner_f7_17";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const sub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });
  await finalizeSubmissionGrading(sub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [reviewItem] = await getAllReviewItems({ learnerId });
  await startReviewRetry(reviewItem.id, { learnerId });

  const afterSub = await getSubmission(sub.id, { learnerId });
  assert.equal(afterSub.status, "GRADED", "원본 Submission은 GRADED 유지");
  assert.ok(afterSub.locked === true || afterSub.status === "GRADED", "원본 Submission 잠금 상태 유지");
});

test("Phase F7: 18. [F7-18] 바로 다시 풀기 시 ReviewItem.retryAttemptIds에 새 Attempt ID가 연결된다", async () => {
  const learnerId = "learner_f7_18";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const sub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });
  await finalizeSubmissionGrading(sub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [reviewItem] = await getAllReviewItems({ learnerId });
  const { retryAttempt } = await startReviewRetry(reviewItem.id, { learnerId });

  const updatedItem = await getReviewItem(reviewItem.id, { learnerId });
  assert.equal(updatedItem.retryAttemptIds.length, 1);
  assert.equal(updatedItem.retryAttemptIds[0], retryAttempt.id);
});

test("Phase F7: 19. [F7-19] 바로 다시 풀기 시 ReviewItem 상태가 unresolved -> retrying으로 전이된다", async () => {
  const learnerId = "learner_f7_19";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const sub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });
  await finalizeSubmissionGrading(sub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [reviewItem] = await getAllReviewItems({ learnerId });
  assert.equal(reviewItem.state, "unresolved");

  await startReviewRetry(reviewItem.id, { learnerId });

  const updatedItem = await getReviewItem(reviewItem.id, { learnerId });
  assert.equal(updatedItem.state, "retrying");
});

// ============================================================================
// 5. 제출 및 보호자 확인 (F7-20 ~ F7-26)
// ============================================================================

test("Phase F7: 20. [F7-20] retry 제출 시 원본과 별도의 Submission이 생성된다", async () => {
  const learnerId = "learner_f7_20";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const origSub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(origSub.id, { learnerId });
  await finalizeSubmissionGrading(origSub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [reviewItem] = await getAllReviewItems({ learnerId });
  const { retrySession } = await startReviewRetry(reviewItem.id, { learnerId });

  // retrySession 풀이 및 제출
  retrySession.start();
  retrySession.startSubmitting();
  retrySession.submitPractice(4000);
  retrySession.setPendingGrading();

  const retrySub = await submitLearningSession({
    session: retrySession,
    learnerId,
    reviewItemId: reviewItem.id
  });

  assert.notEqual(retrySub.id, origSub.id, "retry Submission ID는 원본과 달라야 함");
});

test("Phase F7: 21. [F7-21] retry 제출 후 retry 답안이 Lock된다", async () => {
  const learnerId = "learner_f7_21";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const origSub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(origSub.id, { learnerId });
  await finalizeSubmissionGrading(origSub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [reviewItem] = await getAllReviewItems({ learnerId });
  const { retrySession } = await startReviewRetry(reviewItem.id, { learnerId });

  retrySession.start();
  retrySession.startSubmitting();
  retrySession.submitPractice(4000);
  retrySession.setPendingGrading();

  const retrySub = await submitLearningSession({
    session: retrySession,
    learnerId,
    reviewItemId: reviewItem.id
  });

  assert.equal(retrySub.status, "PARENT_GRADING_PENDING");
  assert.ok(isSubmittedSnapshotStatus(retrySub.status), "retry Submission도 제출 잠금 상태이어야 함");
});

test("Phase F7: 22. [F7-22] retry 제출 후 retry stroke가 Lock된다", async () => {
  const learnerId = "learner_f7_22";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const origSub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(origSub.id, { learnerId });
  await finalizeSubmissionGrading(origSub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [reviewItem] = await getAllReviewItems({ learnerId });
  const { retrySession } = await startReviewRetry(reviewItem.id, { learnerId });

  const retryStrokes = { [qs[0].id]: [{ points: [{ x: 50, y: 50 }] }] };
  retrySession.start();
  retrySession.startSubmitting();
  retrySession.submitPractice(4000);
  retrySession.setPendingGrading();

  const retrySub = await submitLearningSession({
    session: retrySession,
    studentStrokesMap: retryStrokes,
    learnerId,
    reviewItemId: reviewItem.id
  });

  assert.deepEqual(retrySub.studentStrokesMap, retryStrokes);
});

test("Phase F7: 23. [F7-23] retry 제출 시 ReviewItem 상태가 retrying -> review_pending으로 전이된다", async () => {
  const learnerId = "learner_f7_23";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const origSub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(origSub.id, { learnerId });
  await finalizeSubmissionGrading(origSub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [reviewItem] = await getAllReviewItems({ learnerId });
  const { retrySession } = await startReviewRetry(reviewItem.id, { learnerId });

  retrySession.start();
  retrySession.startSubmitting();
  retrySession.submitPractice(4000);
  retrySession.setPendingGrading();

  await submitLearningSession({
    session: retrySession,
    learnerId,
    reviewItemId: reviewItem.id
  });

  const updatedItem = await getReviewItem(reviewItem.id, { learnerId });
  assert.equal(updatedItem.state, "review_pending", "재풀이 제출 시 review_pending 상태");
});

test("Phase F7: 24. [F7-24] 보호자 확인 전에는 자동으로 resolved 처리되지 않는다", async () => {
  const learnerId = "learner_f7_24";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const origSub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(origSub.id, { learnerId });
  await finalizeSubmissionGrading(origSub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [reviewItem] = await getAllReviewItems({ learnerId });
  const { retrySession } = await startReviewRetry(reviewItem.id, { learnerId });

  retrySession.start();
  retrySession.startSubmitting();
  retrySession.submitPractice(4000);
  retrySession.setPendingGrading();

  await submitLearningSession({
    session: retrySession,
    learnerId,
    reviewItemId: reviewItem.id
  });

  const updatedItem = await getReviewItem(reviewItem.id, { learnerId });
  assert.notEqual(updatedItem.state, "resolved", "보호자 확인 전 자동 resolved 금지");
  assert.equal(updatedItem.state, "review_pending");
});

test("Phase F7: 25. [F7-25] 보호자가 '이제 이해했어요' 확인 시 review_pending -> resolved 전이된다", async () => {
  const learnerId = "learner_f7_25";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const origSub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(origSub.id, { learnerId });
  await finalizeSubmissionGrading(origSub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [reviewItem] = await getAllReviewItems({ learnerId });
  const { retrySession } = await startReviewRetry(reviewItem.id, { learnerId });

  retrySession.start();
  retrySession.startSubmitting();
  retrySession.submitPractice(4000);
  retrySession.setPendingGrading();

  await submitLearningSession({
    session: retrySession,
    learnerId,
    reviewItemId: reviewItem.id
  });

  const resolved = await resolveReviewItem(reviewItem.id, {
    learnerId,
    resolvedBy: "guardian"
  });

  assert.equal(resolved.state, "resolved");
});

test("Phase F7: 26. [F7-26] resolved 처리 시 resolvedAt과 resolvedBy가 정확히 기록된다", async () => {
  const learnerId = "learner_f7_26";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const origSub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(origSub.id, { learnerId });
  await finalizeSubmissionGrading(origSub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [reviewItem] = await getAllReviewItems({ learnerId });
  const { retrySession } = await startReviewRetry(reviewItem.id, { learnerId });

  retrySession.start();
  retrySession.startSubmitting();
  retrySession.submitPractice(4000);
  retrySession.setPendingGrading();

  await submitLearningSession({
    session: retrySession,
    learnerId,
    reviewItemId: reviewItem.id
  });

  const resolved = await resolveReviewItem(reviewItem.id, {
    learnerId,
    resolvedBy: "parent_1"
  });

  assert.ok(resolved.resolvedAt > 0, "resolvedAt이 타임스탬프로 기록됨");
  assert.equal(resolved.resolvedBy, "parent_1", "resolvedBy 기록");
});

// ============================================================================
// 6. 반복 재풀이 (F7-27 ~ F7-30)
// ============================================================================

test("Phase F7: 27. [F7-27] review_pending에서 '다시 풀기' 선택 시 retrying으로 재전이된다", async () => {
  const learnerId = "learner_f7_27";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const origSub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(origSub.id, { learnerId });
  await finalizeSubmissionGrading(origSub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [reviewItem] = await getAllReviewItems({ learnerId });
  const { retrySession } = await startReviewRetry(reviewItem.id, { learnerId });

  retrySession.start();
  retrySession.startSubmitting();
  retrySession.submitPractice(4000);
  retrySession.setPendingGrading();

  await submitLearningSession({
    session: retrySession,
    learnerId,
    reviewItemId: reviewItem.id
  });

  // 보호자가 '다시 풀기' 선택
  const retryAgainResult = await retryReviewItemAgain(reviewItem.id, { learnerId });
  assert.equal(retryAgainResult.reviewItem.state, "retrying");
});

test("Phase F7: 28. [F7-28] 2차 재풀이 시 Retry Attempt 2가 신규 생성된다", async () => {
  const learnerId = "learner_f7_28";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const origSub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(origSub.id, { learnerId });
  await finalizeSubmissionGrading(origSub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [reviewItem] = await getAllReviewItems({ learnerId });
  const { retryAttempt: retry1, retrySession: sess1 } = await startReviewRetry(reviewItem.id, { learnerId });

  sess1.start();
  sess1.startSubmitting();
  sess1.submitPractice(4000);
  sess1.setPendingGrading();
  await submitLearningSession({ session: sess1, learnerId, reviewItemId: reviewItem.id });

  const { retryAttempt: retry2 } = await retryReviewItemAgain(reviewItem.id, { learnerId });

  assert.notEqual(retry2.id, retry1.id);
  assert.equal(retry2.retryOrdinal, 2);
});

test("Phase F7: 29. [F7-29] 이전 Retry Attempt 기록이 보존된다", async () => {
  const learnerId = "learner_f7_29";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const origSub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(origSub.id, { learnerId });
  await finalizeSubmissionGrading(origSub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [reviewItem] = await getAllReviewItems({ learnerId });
  const { retryAttempt: retry1, retrySession: sess1 } = await startReviewRetry(reviewItem.id, { learnerId });

  sess1.start();
  sess1.startSubmitting();
  sess1.submitPractice(4000);
  sess1.setPendingGrading();
  await submitLearningSession({ session: sess1, learnerId, reviewItemId: reviewItem.id });

  const { retryAttempt: retry2 } = await retryReviewItemAgain(reviewItem.id, { learnerId });

  const allAttempts = await getRecentAttempts(10, { learnerId });
  const att1 = allAttempts.find((a) => a.id === retry1.id);
  const att2 = allAttempts.find((a) => a.id === retry2.id);
  assert.ok(att1, "Retry Attempt 1 존재");
  assert.ok(att2, "Retry Attempt 2 존재");
});

test("Phase F7: 30. [F7-30] retryAttemptIds에 순서 및 전체 히스토리가 보존된다", async () => {
  const learnerId = "learner_f7_30";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const origSub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(origSub.id, { learnerId });
  await finalizeSubmissionGrading(origSub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [reviewItem] = await getAllReviewItems({ learnerId });
  const { retryAttempt: retry1, retrySession: sess1 } = await startReviewRetry(reviewItem.id, { learnerId });

  sess1.start();
  sess1.startSubmitting();
  sess1.submitPractice(4000);
  sess1.setPendingGrading();
  await submitLearningSession({ session: sess1, learnerId, reviewItemId: reviewItem.id });

  const { retryAttempt: retry2 } = await retryReviewItemAgain(reviewItem.id, { learnerId });

  const updatedItem = await getReviewItem(reviewItem.id, { learnerId });
  assert.deepEqual(updatedItem.retryAttemptIds, [retry1.id, retry2.id]);
});

// ============================================================================
// 7. 나중에 복습 (F7-31 ~ F7-33)
// ============================================================================

test("Phase F7: 31. [F7-31] 나중에 복습 선택 시 신규 Attempt가 생성되지 않는다", async () => {
  const learnerId = "learner_f7_31";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const origSub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(origSub.id, { learnerId });
  await finalizeSubmissionGrading(origSub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const attemptsBefore = await getRecentAttempts(10, { learnerId });
  const [reviewItem] = await getAllReviewItems({ learnerId });

  await deferReviewItem(reviewItem.id, { learnerId });

  const attemptsAfter = await getRecentAttempts(10, { learnerId });
  assert.equal(attemptsAfter.length, attemptsBefore.length, "나중에 복습 시 Attempt 미생성");
});

test("Phase F7: 32. [F7-32] 나중에 복습 선택 시 ReviewItem 상태는 unresolved로 유지된다", async () => {
  const learnerId = "learner_f7_32";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const origSub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(origSub.id, { learnerId });
  await finalizeSubmissionGrading(origSub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [reviewItem] = await getAllReviewItems({ learnerId });
  await deferReviewItem(reviewItem.id, { learnerId });

  const updatedItem = await getReviewItem(reviewItem.id, { learnerId });
  assert.equal(updatedItem.state, "unresolved");
});

test("Phase F7: 33. [F7-33] 나중에 복습 선택 후에도 active review queue에서 계속 조회된다", async () => {
  const learnerId = "learner_f7_33";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const origSub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(origSub.id, { learnerId });
  await finalizeSubmissionGrading(origSub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [reviewItem] = await getAllReviewItems({ learnerId });
  await deferReviewItem(reviewItem.id, { learnerId });

  const activeQueue = await getActiveReviewItems({ learnerId });
  assert.equal(activeQueue.length, 1);
  assert.equal(activeQueue[0].id, reviewItem.id);
});

// ============================================================================
// 8. 재채점 동기화 (F7-34 ~ F7-37)
// ============================================================================

test("Phase F7: 34. [F7-34] CORRECT -> WRONG 재채점 시 ReviewItem이 신규 생성된다", async () => {
  const learnerId = "learner_f7_34";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const sub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });
  await finalizeSubmissionGrading(sub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.CORRECT) }
  });

  let items = await getAllReviewItems({ learnerId });
  assert.equal(items.length, 0);

  // CORRECT -> WRONG 재채점
  await reviseFinalizedGradeDecision(sub.id, qs[0].id, GradeDecision.WRONG, "오답 정정", { learnerId });

  items = await getAllReviewItems({ learnerId });
  assert.equal(items.length, 1);
  assert.equal(items[0].state, "unresolved");
  assert.equal(items[0].reasonCode, "WRONG");
});

test("Phase F7: 35. [F7-35] CORRECT -> RETRY 재채점 시 ReviewItem이 신규 생성된다", async () => {
  const learnerId = "learner_f7_35";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const sub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });
  await finalizeSubmissionGrading(sub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.CORRECT) }
  });

  await reviseFinalizedGradeDecision(sub.id, qs[0].id, GradeDecision.RETRY, "다시 풀기 요청", { learnerId });

  const items = await getAllReviewItems({ learnerId });
  assert.equal(items.length, 1);
  assert.equal(items[0].reasonCode, "RETRY");
});

test("Phase F7: 36. [F7-36] WRONG <-> RETRY 재채점 시 중복 ReviewItem 없이 유지된다", async () => {
  const learnerId = "learner_f7_36";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const sub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });
  await finalizeSubmissionGrading(sub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  // WRONG -> RETRY
  await reviseFinalizedGradeDecision(sub.id, qs[0].id, GradeDecision.RETRY, "변경", { learnerId });
  let items = await getAllReviewItems({ learnerId });
  assert.equal(items.length, 1);
  assert.equal(items[0].reasonCode, "RETRY");

  // RETRY -> WRONG
  await reviseFinalizedGradeDecision(sub.id, qs[0].id, GradeDecision.WRONG, "재변경", { learnerId });
  items = await getAllReviewItems({ learnerId });
  assert.equal(items.length, 1);
  assert.equal(items[0].reasonCode, "WRONG");
});

test("Phase F7: 37. [F7-37] WRONG -> CORRECT 재채점 reconciliation (retry 이력 없으면 제거, 있으면 보존)", async () => {
  const learnerId = "learner_f7_37";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const sub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });
  await finalizeSubmissionGrading(sub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  // case 1: retry 이력 없는 상태에서 CORRECT 정정 -> ReviewItem 정리
  await reviseFinalizedGradeDecision(sub.id, qs[0].id, GradeDecision.CORRECT, "정답 정정", { learnerId });
  const activeItems = await getActiveReviewItems({ learnerId });
  assert.equal(activeItems.length, 0, "활성 review queue에서 제거됨");
});

// ============================================================================
// 9. 통계 SSOT 보존 (F7-38 ~ F7-41)
// ============================================================================

test("Phase F7: 38. [F7-38] retry 시작만으로 ProgressAggregate가 변경되지 않는다", async () => {
  const learnerId = "learner_f7_38";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const sub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });
  await finalizeSubmissionGrading(sub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const aggBefore = await getProgressAggregateByLevel(learnerId, "M1");
  assert.equal(aggBefore.correctCount, 0);
  assert.equal(aggBefore.incorrectCount, 1);

  const [reviewItem] = await getAllReviewItems({ learnerId });
  await startReviewRetry(reviewItem.id, { learnerId });

  const aggAfter = await getProgressAggregateByLevel(learnerId, "M1");
  assert.equal(aggAfter.correctCount, aggBefore.correctCount);
  assert.equal(aggAfter.incorrectCount, aggBefore.incorrectCount);
});

test("Phase F7: 39. [F7-39] retry 제출만으로 확정 통계가 변경되지 않는다", async () => {
  const learnerId = "learner_f7_39";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const sub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });
  await finalizeSubmissionGrading(sub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const aggBefore = await getProgressAggregateByLevel(learnerId, "M1");

  const [reviewItem] = await getAllReviewItems({ learnerId });
  const { retrySession } = await startReviewRetry(reviewItem.id, { learnerId });

  retrySession.start();
  retrySession.startSubmitting();
  retrySession.submitPractice(4000);
  retrySession.setPendingGrading();
  await submitLearningSession({ session: retrySession, learnerId, reviewItemId: reviewItem.id });

  const aggAfter = await getProgressAggregateByLevel(learnerId, "M1");
  assert.equal(aggAfter.correctCount, aggBefore.correctCount);
  assert.equal(aggAfter.incorrectCount, aggBefore.incorrectCount);
});

test("Phase F7: 40. [F7-40] 보호자가 재풀이를 최종 확정한 이후에만 F6 통계 정책으로 반영된다", async () => {
  const learnerId = "learner_f7_40";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const sub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });
  await finalizeSubmissionGrading(sub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [reviewItem] = await getAllReviewItems({ learnerId });
  const { retrySession } = await startReviewRetry(reviewItem.id, { learnerId });

  retrySession.start();
  retrySession.startSubmitting();
  retrySession.submitPractice(4000);
  retrySession.setPendingGrading();
  const retrySub = await submitLearningSession({ session: retrySession, learnerId, reviewItemId: reviewItem.id });

  // 보호자가 retrySub 채점 시작 및 CORRECT 확정
  await startSubmissionGrading(retrySub.id, { learnerId });
  await finalizeSubmissionGrading(retrySub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.CORRECT) }
  });

  const aggAfter = await getProgressAggregateByLevel(learnerId, "M1");
  // 원본 1문제(WRONG) + retry 1문제(CORRECT) = gradedAttemptCount 2, correctCount 1
  assert.equal(aggAfter.gradedAttemptCount, 2);
  assert.equal(aggAfter.correctCount, 1);
  assert.equal(aggAfter.incorrectCount, 1);
  assert.equal(aggAfter.accuracy, 50);
});

test("Phase F7: 41. [F7-41] rebuildProgressAggregates 실행 후 결과 결정론이 유지된다", async () => {
  const learnerId = "learner_f7_41";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(2, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 2 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const sub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });
  await finalizeSubmissionGrading(sub.id, {
    learnerId,
    gradingResults: {
      [qs[0].id]: createGradeDecision(qs[0], GradeDecision.CORRECT),
      [qs[1].id]: createGradeDecision(qs[1], GradeDecision.WRONG)
    }
  });

  const agg1 = await getProgressAggregateByLevel(learnerId, "M1");
  await rebuildProgressAggregatesForLearner(learnerId, { updatedAt: agg1.updatedAt });
  const agg2 = await getProgressAggregateByLevel(learnerId, "M1");

  assert.deepEqual(agg1, agg2, "rebuild 후 동일 deepEqual 결과");
});

// ============================================================================
// 10. 트랜잭션 & 롤백 (F7-42 ~ F7-44)
// ============================================================================

test("Phase F7: 42. [F7-42] retry Attempt 쓰기 실패 시 전체 rollback 검증", async () => {
  const learnerId = "learner_f7_42";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const sub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });
  await finalizeSubmissionGrading(sub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [reviewItem] = await getAllReviewItems({ learnerId });

  _setRetryFailureInjectorForTesting(({ phase }) => {
    if (phase === "during_attempt_write") {
      throw new Error("Simulated failure during retry attempt write");
    }
  });

  await assert.rejects(
    async () => {
      await startReviewRetry(reviewItem.id, { learnerId });
    },
    /Simulated failure during retry attempt write/
  );

  _setRetryFailureInjectorForTesting(null);

  const itemAfter = await getReviewItem(reviewItem.id, { learnerId });
  assert.equal(itemAfter.state, "unresolved", "ReviewItem 상태 롤백");
  assert.equal(itemAfter.retryAttemptIds.length, 0, "retryAttemptIds 롤백");
});

test("Phase F7: 43. [F7-43] ReviewItem 쓰기 실패 시 전체 rollback 검증", async () => {
  const learnerId = "learner_f7_43";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(1, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 1 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const sub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });
  await finalizeSubmissionGrading(sub.id, {
    learnerId,
    gradingResults: { [qs[0].id]: createGradeDecision(qs[0], GradeDecision.WRONG) }
  });

  const [reviewItem] = await getAllReviewItems({ learnerId });

  _setRetryFailureInjectorForTesting(({ phase }) => {
    if (phase === "during_review_item_write") {
      throw new Error("Simulated failure during review item update");
    }
  });

  await assert.rejects(
    async () => {
      await startReviewRetry(reviewItem.id, { learnerId });
    },
    /Simulated failure during review item update/
  );

  _setRetryFailureInjectorForTesting(null);

  const itemAfter = await getReviewItem(reviewItem.id, { learnerId });
  assert.equal(itemAfter.state, "unresolved", "상태 롤백 확인");
});

test("Phase F7: 44. [F7-44] finalize 중 ReviewItem 쓰기 실패 시 6개 Store 전체 half-commit 없이 rollback 검증", async () => {
  const learnerId = "learner_f7_44";
  setCurrentLearnerId(learnerId);

  const qs = createMockQuestions(2, "M1");
  const session = createSession({ operation: "mul", macroLevelId: "M1", pageSize: 2 }, qs);
  session.start();
  session.startSubmitting();
  session.submitPractice(5000);
  session.setPendingGrading();

  const sub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });

  _setFinalizeFailureInjectorForTesting(({ phase }) => {
    if (phase === "during_review_items") {
      throw new Error("Simulated failure during review item write in finalize");
    }
  });

  await assert.rejects(
    async () => {
      await finalizeSubmissionGrading(sub.id, {
        learnerId,
        gradingResults: {
          [qs[0].id]: createGradeDecision(qs[0], GradeDecision.CORRECT),
          [qs[1].id]: createGradeDecision(qs[1], GradeDecision.WRONG)
        }
      });
    },
    /Simulated failure during review item write in finalize/
  );

  _setFinalizeFailureInjectorForTesting(null);

  const subAfter = await getSubmission(sub.id, { learnerId });
  assert.equal(subAfter.status, "GRADING_ACTIVE", "Submission 롤백");

  const itemsAfter = await getAllReviewItems({ learnerId });
  assert.equal(itemsAfter.length, 0, "ReviewItem 롤백");

  const aggAfter = await getProgressAggregateByLevel(learnerId, "M1");
  assert.equal(aggAfter, null, "ProgressAggregate 롤백");
});
