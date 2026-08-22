import test from "node:test";
import assert from "node:assert/strict";
import { saveSessionRecord, getRecentSessions, getMistakeQuestions, getLearningStats, clearAllData } from "../public/app/js/storage.js";

test("storage: 세션 완료 기록 및 오답 큐 저장/복원 검증", async () => {
  await clearAllData();

  // 1. 첫 번째 세션 (2문제: 1정답, 1오답)
  const session1 = {
    sessionId: "sess_001",
    totalQuestions: 2,
    correctCount: 1,
    wrongCount: 1,
    accuracyRate: 50,
    totalSolveTimeMs: 20000,
    averageSolveTimeMs: 10000,
    results: [
      { questionId: "q1", questionKey: "mul:12:3", operation: "mul", level: "M2", operandA: 12, operandB: 3, answer: 36, isCorrect: true, comment: "잘했어요" },
      { questionId: "q2", questionKey: "mul:15:4", operation: "mul", level: "M2", operandA: 15, operandB: 4, answer: 60, isCorrect: false, comment: "올림 확인" }
    ]
  };

  const strokesMap = new Map([
    ["q1", [{ points: [{ x: 10, y: 10 }], color: "#173f35", width: 2.5 }]],
    ["q2", [{ points: [{ x: 20, y: 20 }], color: "#173f35", width: 2.5 }]]
  ]);

  await saveSessionRecord(session1, strokesMap);

  // 2. 세션 목록 확인
  const recent = await getRecentSessions(10);
  assert.equal(recent.length, 1);
  assert.equal(recent[0].id, "sess_001");
  assert.equal(recent[0].accuracyRate, 50);

  // 3. 오답 큐 확인 (q2가 오답으로 등록되어 있어야 함)
  const mistakes = await getMistakeQuestions();
  assert.equal(mistakes.length, 1);
  assert.equal(mistakes[0].key, "mul:15:4");
  assert.equal(mistakes[0].wrongCount, 1);

  // 4. 통계 집계 확인
  const stats = await getLearningStats();
  assert.equal(stats.totalSessions, 1);
  assert.equal(stats.totalQuestions, 2);
  assert.equal(stats.totalCorrect, 1);
  assert.equal(stats.averageAccuracy, 50);
  assert.equal(stats.mistakeCount, 1);

  // 5. 두 번째 세션에서 오답(mul:15:4)을 정답으로 맞춤 -> 오답 큐에서 제거되는지 검증
  const session2 = {
    sessionId: "sess_002",
    totalQuestions: 1,
    correctCount: 1,
    wrongCount: 0,
    accuracyRate: 100,
    totalSolveTimeMs: 8000,
    averageSolveTimeMs: 8000,
    results: [
      { questionId: "q2_retry", questionKey: "mul:15:4", operation: "mul", level: "M2", operandA: 15, operandB: 4, answer: 60, isCorrect: true, comment: "완벽!" }
    ]
  };

  await saveSessionRecord(session2);

  const mistakesAfter = await getMistakeQuestions();
  assert.equal(mistakesAfter.length, 0, "맞춘 오답 문제는 오답 큐에서 해제되어야 함");

  const statsAfter = await getLearningStats();
  assert.equal(statsAfter.totalSessions, 2);
  assert.equal(statsAfter.totalQuestions, 3);
  assert.equal(statsAfter.totalCorrect, 2);
  assert.equal(statsAfter.averageAccuracy, 67); // 2/3 = 67%
  assert.equal(statsAfter.mistakeCount, 0);

  // 6. 데이터 초기화 검증
  await clearAllData();
  const emptyStats = await getLearningStats();
  assert.equal(emptyStats.totalSessions, 0);
  assert.equal(emptyStats.totalQuestions, 0);
});
