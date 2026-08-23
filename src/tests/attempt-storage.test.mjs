import test from "node:test";
import assert from "node:assert/strict";
import { createSession } from "../public/app/js/sessionEngine.js";
import { saveSessionRecord, getRecentAttempts, getLearningStats, getRecentStats, saveDraftSession, getDraftSession, clearDraftSession, clearAllData } from "../public/app/js/storage.js";

test("Milestone B: 개별 Attempt 저장 및 최근 통계 / 전체 통계 분리 검증", async () => {
  await clearAllData();

  // 1. 3문제짜리 세션 생성 (문제별 시간 지정)
  const questions = [
    { id: "q1", key: "mul:12:3", operation: "mul", macroLevelId: "M2", stageId: "M2-1", operandA: 12, operandB: 3, answer: 36, level: "M2" },
    { id: "q2", key: "mul:15:4", operation: "mul", macroLevelId: "M2", stageId: "M2-2", operandA: 15, operandB: 4, answer: 60, level: "M2" },
    { id: "q3", key: "mul:24:5", operation: "mul", macroLevelId: "M2", stageId: "M2-3", operandA: 24, operandB: 5, answer: 120, level: "M2" }
  ];

  const session = createSession({ operation: "mul", macroLevelId: "M2", stageId: "M2-1", pageSize: 3 }, questions);
  session.start();
  
  // 문제별 풀이 시간 기록 (q1: 4초, q2: 6초, q3: 10초)
  session.recordQuestionSolveTime("q1", 4000);
  session.recordQuestionSolveTime("q2", 6000);
  session.recordQuestionSolveTime("q3", 10000);
  session.submitPractice(20000);

  session.startGrading();
  session.gradeQuestion("q1", true);
  session.gradeQuestion("q2", false, "올림수 오류");
  session.gradeQuestion("q3", true);
  const summary = session.finishGrading();

  // 문제별 풀이 시간이 서로 다르게 요약에 반영되었는지 확인
  assert.equal(summary.results[0].solveTimeMs, 4000);
  assert.equal(summary.results[1].solveTimeMs, 6000);
  assert.equal(summary.results[2].solveTimeMs, 10000);

  // 저장 실행
  await saveSessionRecord(summary);

  // 2. Attempt 단위 조회 검증
  const attempts = await getRecentAttempts(10);
  assert.equal(attempts.length, 3);
  assert.equal(attempts[0].operation, "mul");
  assert.equal(attempts.find(a => a.questionId === "q2").isCorrect, false);
  assert.equal(attempts.find(a => a.questionId === "q2").solveTimeMs, 6000);

  // 3. 최근 통계 vs 전체 통계 검증
  const recentStats = await getRecentStats(20);
  assert.equal(recentStats.recentAttemptsCount, 3);
  assert.equal(recentStats.recentCorrect, 2);
  assert.equal(recentStats.recentAccuracy, 67);

  const fullStats = await getLearningStats();
  assert.equal(fullStats.totalSessions, 1);
  assert.equal(fullStats.totalQuestions, 3);
  assert.equal(fullStats.totalCorrect, 2);
  assert.equal(fullStats.mistakeCount, 1);
});

test("Milestone B: Draft Session (임시 저장 및 이어하기) 검증", async () => {
  await clearDraftSession();

  const draft = {
    config: { operation: "div", count: 10 },
    currentPageIndex: 1,
    questions: [{ id: "dq1", operandA: 24, operandB: 6, answer: 4 }],
    elapsedMs: 15000
  };

  await saveDraftSession(draft);
  const loaded = await getDraftSession();
  assert.ok(loaded);
  assert.equal(loaded.config.operation, "div");
  assert.equal(loaded.currentPageIndex, 1);
  assert.equal(loaded.elapsedMs, 15000);

  await clearDraftSession();
  const cleared = await getDraftSession();
  assert.equal(cleared, null);
});
