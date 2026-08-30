import test from "node:test";
import assert from "node:assert/strict";
import { createQuestionTimer, formatTime } from "../public/app/js/timer.js";
import { createSession, SessionState } from "../public/app/js/sessionEngine.js";
import { generateMultiplicationSet, generateDivisionSet } from "../public/app/js/mathGen.js";

test("타이머가 정상적으로 시작되고 정지하며 경과 시간을 측정한다", () => {
  let currentTime = 1000;
  const timer = createQuestionTimer({ getTime: () => currentTime });

  timer.start();
  assert.equal(timer.isRunning, true);
  assert.equal(timer.isPaused, false);

  currentTime += 2500;
  assert.equal(timer.getElapsedMs(), 2500);

  const stoppedTime = timer.stop();
  assert.equal(stoppedTime, 2500);
  assert.equal(timer.isRunning, false);
});

test("타이머 일시정지(pause) 중 흐른 시간은 총 풀이 시간에서 제외된다", () => {
  let currentTime = 1000;
  const timer = createQuestionTimer({ getTime: () => currentTime });

  timer.start(); // t = 1000
  currentTime += 3000; // t = 4000 (3초 풀이)

  timer.pause(); // t = 4000
  assert.equal(timer.isPaused, true);
  currentTime += 5000; // 백그라운드에서 5초 경과 (t = 9000)

  assert.equal(timer.getElapsedMs(), 3000); // 5초는 제외되어야 함

  timer.resume(); // t = 9000
  assert.equal(timer.isPaused, false);
  currentTime += 2000; // t = 11000 (추가 2초 풀이)

  const finalTime = timer.stop();
  assert.equal(finalTime, 5000); // 3초 + 2초 = 5초
});

test("formatTime이 디지털 포맷과 한국어 포맷을 올바르게 지원한다", () => {
  assert.equal(formatTime(0), "00:00.0");
  assert.equal(formatTime(5400), "00:05.4");
  assert.equal(formatTime(65200), "01:05.2");
  assert.equal(formatTime(5400, "korean"), "5.4초");
  assert.equal(formatTime(75000, "korean"), "1분 15.0초");
});

test("곱셈 및 나눗셈 자릿수 직접 선택(custom) 옵션이 정확한 자릿수 문제를 생성한다", () => {
  // 1. 곱셈 3자리 x 2자리
  const mulQuestions = generateMultiplicationSet({ count: 10, difficulty: "custom", aDigits: 3, bDigits: 2 });
  assert.equal(mulQuestions.length, 10);
  for (const q of mulQuestions) {
    assert.ok(q.operandA >= 100 && q.operandA <= 999, `operandA(${q.operandA})는 3자리여야 함`);
    assert.ok(q.operandB >= 10 && q.operandB <= 99, `operandB(${q.operandB})는 2자리여야 함`);
    assert.equal(q.level, "M6");
    assert.equal(q.answer, q.operandA * q.operandB);
  }

  // 2. 나눗셈 3자리 ÷ 2자리
  const divQuestions = generateDivisionSet({ count: 10, difficulty: "custom", dividendDigits: 3, divisorDigits: 2 });
  assert.equal(divQuestions.length, 10);
  for (const q of divQuestions) {
    assert.ok(q.operandA >= 100 && q.operandA <= 999, `dividend(${q.operandA})는 3자리여야 함`);
    assert.ok(q.operandB >= 10 && q.operandB <= 99, `divisor(${q.operandB})는 2자리여야 함`);
    assert.equal(q.operandA % q.operandB, 0, "나머지는 0이어야 함");
    assert.equal(q.level, "D5");
  }
});

test("워크시트 세션 페이지 분할 및 채점자 평가(정답 확인, 맞음/틀림) 전체 수명 주기 검증", () => {
  const sampleQuestions = [
    { id: "q1", key: "mul:12:3", operation: "mul", level: "M2", operandA: 12, operandB: 3, answer: 36 },
    { id: "q2", key: "mul:15:4", operation: "mul", level: "M2", operandA: 15, operandB: 4, answer: 60 },
    { id: "q3", key: "mul:24:2", operation: "mul", level: "M2", operandA: 24, operandB: 2, answer: 48 },
    { id: "q4", key: "mul:30:5", operation: "mul", level: "M2", operandA: 30, operandB: 5, answer: 150 },
    { id: "q5", key: "mul:42:2", operation: "mul", level: "M2", operandA: 42, operandB: 2, answer: 84 }
  ];

  // 페이지당 2문제 설정 (총 3페이지: 2개, 2개, 1개)
  const session = createSession({ operation: "mul", difficulty: "easy", pageSize: 2 }, sampleQuestions);
  assert.equal(session.state, SessionState.IDLE);
  assert.equal(session.totalPages, 3);

  // 1. 연습 시작
  const page1 = session.start();
  assert.equal(session.state, SessionState.PRACTICE_ACTIVE);
  assert.equal(page1.pageNumber, 1);
  assert.equal(page1.questions.length, 2);
  assert.equal(page1.questions[0].id, "q1");
  assert.equal(page1.questions[1].id, "q2");
  assert.equal(page1.isFirstPage, true);
  assert.equal(page1.isLastPage, false);

  // 2. 페이지 이동
  const page2 = session.nextPage();
  assert.equal(page2.pageNumber, 2);
  assert.equal(page2.questions.length, 2);
  assert.equal(page2.questions[0].id, "q3");

  const page3 = session.nextPage();
  assert.equal(page3.pageNumber, 3);
  assert.equal(page3.questions.length, 1);
  assert.equal(page3.questions[0].id, "q5");
  assert.equal(page3.isLastPage, true);

  // 3. 풀이 완료 및 제출
  session.submitPractice(45000); // 45초 풀이
  assert.ok(session.state === SessionState.SUBMITTED || session.state === SessionState.SUBMITTED_LOCKED);

  // 4. 채점자 모드 시작
  session.startGrading();
  assert.equal(session.state, SessionState.GRADING_ACTIVE);

  // 5. 문제별 채점 (4개 정답, 1개 오답)
  session.gradeQuestion("q1", true);
  session.gradeQuestion("q2", true);
  session.gradeQuestion("q3", false);
  session.gradeQuestion("q4", true);
  session.gradeQuestion("q5", true);

  const gradingStatus = session.getGradingStatus();
  assert.equal(gradingStatus.total, 5);
  assert.equal(gradingStatus.graded, 5);
  assert.equal(gradingStatus.correct, 4);
  assert.equal(gradingStatus.wrong, 1);
  assert.equal(gradingStatus.allGraded, true);

  // 6. 채점 완료 및 최종 통계 확인
  const summary = session.finishGrading();
  assert.equal(session.state, SessionState.SESSION_COMPLETE);
  assert.equal(summary.totalQuestions, 5);
  assert.equal(summary.correctCount, 4);
  assert.equal(summary.wrongCount, 1);
  assert.equal(summary.accuracyRate, 80);
  assert.equal(summary.totalSolveTimeMs, 45000);
  assert.equal(summary.averageSolveTimeMs, 9000);
});
