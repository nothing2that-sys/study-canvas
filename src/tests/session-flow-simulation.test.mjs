import test from "node:test";
import assert from "node:assert/strict";
import { generateQuestionSet } from "../public/app/js/mathGen.js";
import { createSession, SessionState } from "../public/app/js/sessionEngine.js";
import { createQuestionTimer, formatTime } from "../public/app/js/timer.js";

test("E2E 시뮬레이션: 워크시트 10문제 (페이지당 4개) 풀이 제출 및 채점자 평가 전체 흐름 검증", () => {
  // 1. 자릿수 직접 선택 설정: 곱해지는 수 3자리 × 곱하는 수 2자리, 10문제, 페이지당 4문제
  const formConfig = {
    operation: "mul",
    difficulty: "custom",
    aDigits: 3,
    bDigits: 2,
    count: 10,
    pageSize: 4,
    multiplierMode: "random"
  };

  // 2. 문제 세트 일괄 생성
  const questions = generateQuestionSet(formConfig);
  assert.equal(questions.length, 10);
  assert.ok(questions.every((q) => q.level === "M6"));

  // 3. 세션 및 타이머 초기화
  let virtualTime = 1000;
  const session = createSession(formConfig, questions);
  const timer = createQuestionTimer({ getTime: () => virtualTime });

  // 4. 워크시트 시작
  const page1 = session.start();
  timer.start();
  assert.equal(session.state, SessionState.PRACTICE_ACTIVE);
  assert.equal(session.totalPages, 3); // 4 + 4 + 2
  assert.equal(page1.pageNumber, 1);
  assert.equal(page1.questions.length, 4);

  // 1페이지 풀이 시뮬레이션 (15초 소요)
  virtualTime += 15000;

  // 2페이지로 이동
  const page2 = session.nextPage();
  assert.equal(page2.pageNumber, 2);
  assert.equal(page2.questions.length, 4);
  virtualTime += 20000; // 20초 소요

  // 3페이지로 이동 (마지막 페이지)
  const page3 = session.nextPage();
  assert.equal(page3.pageNumber, 3);
  assert.equal(page3.questions.length, 2);
  assert.equal(page3.isLastPage, true);
  virtualTime += 10000; // 10초 소요

  // 5. 풀이 완료 및 제출 (총 45초)
  const totalElapsed = timer.stop();
  assert.equal(totalElapsed, 45000);
  session.submitPractice(totalElapsed);
  assert.equal(session.state, SessionState.SUBMITTED);

  // 6. 채점자 평가 모드 진입
  session.startGrading();
  assert.equal(session.state, SessionState.GRADING_ACTIVE);

  // 채점 진행: 10문제 중 8문제 정답, 2문제 오답 (3번, 7번 오답)
  questions.forEach((q, idx) => {
    const isCorrect = idx !== 2 && idx !== 6;
    session.gradeQuestion(q.id, isCorrect);
  });

  const gradingStatus = session.getGradingStatus();
  assert.equal(gradingStatus.total, 10);
  assert.equal(gradingStatus.graded, 10);
  assert.equal(gradingStatus.correct, 8);
  assert.equal(gradingStatus.wrong, 2);
  assert.equal(gradingStatus.allGraded, true);

  // 7. 채점 완료 및 최종 성적표 집계
  const summary = session.finishGrading();
  assert.equal(session.state, SessionState.SESSION_COMPLETE);
  assert.equal(summary.totalQuestions, 10);
  assert.equal(summary.correctCount, 8);
  assert.equal(summary.wrongCount, 2);
  assert.equal(summary.accuracyRate, 80);
  assert.equal(summary.totalSolveTimeMs, 45000);
  assert.equal(summary.averageSolveTimeMs, 4500);

  assert.equal(formatTime(summary.totalSolveTimeMs, "korean"), "45.0초");
  assert.equal(formatTime(summary.averageSolveTimeMs, "korean"), "4.5초");
});

test("E2E 시뮬레이션: 나눗셈 20문제 일괄 채점(gradeAll) 기능 검증", () => {
  const formConfig = {
    operation: "div",
    difficulty: "custom",
    dividendDigits: 3,
    divisorDigits: 2,
    count: 20,
    pageSize: 6
  };

  const questions = generateQuestionSet(formConfig);
  assert.equal(questions.length, 20);

  const session = createSession(formConfig, questions);
  session.start();
  session.submitPractice(60000);
  session.startGrading();

  // 모든 문제 일괄 정답 처리
  session.gradeAll(true);
  const status = session.getGradingStatus();
  assert.equal(status.allGraded, true);
  assert.equal(status.correct, 20);
  assert.equal(status.wrong, 0);

  const summary = session.finishGrading();
  assert.equal(summary.accuracyRate, 100);
});
