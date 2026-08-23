import test from "node:test";
import assert from "node:assert/strict";
import { createSession } from "../public/app/js/sessionEngine.js";
import { saveSessionRecord, getLearningStats, clearAllData, getMistakeQuestions, getAllSessions, getSessionStrokesMap } from "../public/app/js/storage.js";
import { exportAllData, validateBackupData, importBackupData } from "../public/app/js/backupEngine.js";

test("Milestone C: 50개 문제 및 필기 스트로크 생성 -> Export -> Clear -> Import 완전 복원 E2E", async () => {
  await clearAllData();

  // 1. 5개 세션 x 10문제 = 50문제 데이터 생성 (필기 스트로크 포함)
  for (let sIdx = 0; sIdx < 5; sIdx++) {
    const questions = Array.from({ length: 10 }, (_, qIdx) => ({
      id: `s${sIdx}_q${qIdx}`,
      key: `mul:${sIdx + 2}:${qIdx + 2}`,
      operation: "mul",
      macroLevelId: "M2",
      stageId: "M2-2",
      operandA: sIdx + 2,
      operandB: qIdx + 2,
      answer: (sIdx + 2) * (qIdx + 2),
      level: "M2"
    }));

    const session = createSession({ operation: "mul", pageSize: 5 }, questions);
    session.start();
    session.submitPractice(12000);
    session.startGrading();

    // 짝수 문제는 정답, 홀수 문제는 오답 처리
    questions.forEach((q, idx) => {
      session.gradeQuestion(q.id, idx % 2 === 0, idx % 2 === 0 ? "정답" : "다시 확인");
    });
    const summary = session.finishGrading();

    const strokesMap = new Map();
    questions.forEach((q) => {
      strokesMap.set(q.id, [
        { id: "st1", color: "#173f35", width: 2.5, points: [{ x: 10, y: 10 }, { x: 20, y: 20 }] }
      ]);
    });

    await saveSessionRecord(summary, strokesMap);
  }

  // 2. Export 전 통계 확인
  const beforeStats = await getLearningStats();
  assert.equal(beforeStats.totalSessions, 5);
  assert.equal(beforeStats.totalQuestions, 50);
  assert.equal(beforeStats.totalCorrect, 25);
  assert.ok(beforeStats.mistakeCount > 0);

  // 3. JSON Export 실행
  const exportedPayload = await exportAllData();
  assert.equal(exportedPayload.formatVersion, "1.0");
  assert.equal(exportedPayload.metadata.sessionCount, 5);
  assert.equal(exportedPayload.metadata.attemptCount, 50);

  // 4. 유효성 검사 (Validate)
  const validation = validateBackupData(exportedPayload);
  assert.equal(validation.isValid, true);
  assert.equal(validation.preview.sessionCount, 5);
  assert.equal(validation.preview.attemptCount, 50);

  // 5. 전체 데이터 삭제 (Clear)
  await clearAllData();
  const clearedStats = await getLearningStats();
  assert.equal(clearedStats.totalSessions, 0);
  assert.equal(clearedStats.totalQuestions, 0);

  // 6. JSON Import (Replace 모드)
  const importResult = await importBackupData(exportedPayload, { mode: "replace" });
  assert.equal(importResult.success, true);
  assert.equal(importResult.importedSessions, 5);
  assert.equal(importResult.importedAttempts, 50);

  // 7. 복원 후 데이터 완전성 검증
  const restoredStats = await getLearningStats();
  assert.equal(restoredStats.totalSessions, 5);
  assert.equal(restoredStats.totalQuestions, 50);
  assert.equal(restoredStats.totalCorrect, 25);

  const restoredSessions = await getAllSessions();
  assert.equal(restoredSessions.length, 5);

  // 필기 스트로크 복원 확인
  const firstSessionId = restoredSessions[0].id;
  const strokesMap = await getSessionStrokesMap(firstSessionId);
  assert.ok(strokesMap.size > 0, "스트로크 필기 데이터가 복원되어야 함");
});

test("Milestone C: 잘못된 백업 파일의 안전한 거부", () => {
  const invalidPayload1 = { foo: "bar" };
  const v1 = validateBackupData(invalidPayload1);
  assert.equal(v1.isValid, false);

  const invalidVersion = { formatVersion: "99.0", data: {} };
  const v2 = validateBackupData(invalidVersion);
  assert.equal(v2.isValid, false);
});
