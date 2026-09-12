import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  GradeDecision,
  normalizeGradeDecision,
  createGradeDecision,
  getGradingProgress,
  assertSubmissionGradingOwnership
} from "../public/app/js/parentGrading.js";
import { createSession, SessionState } from "../public/app/js/sessionEngine.js";
import {
  saveSubmissionSnapshot,
  getSubmission,
  setCurrentLearnerId,
  closeDB,
  updateSubmissionGrading
} from "../public/app/js/storage.js";
import {
  startSubmissionGrading,
  saveSubmissionGradingProgress
} from "../public/app/js/data/learningCommands.js";

function questions() {
  return [
    { id: "f5_q1", num1: 24, num2: 12, operation: "mul", expectedAnswer: 288, studentAnswer: 288 },
    { id: "f5_q2", num1: 15, num2: 3, operation: "div", expectedAnswer: 5, studentAnswer: 4 },
    { id: "f5_q3", num1: 9, num2: 8, operation: "mul", expectedAnswer: 72, studentAnswer: 72 }
  ];
}

function pendingSession() {
  const session = createSession({ pageSize: 3, operation: "mul", cols: 3, rows: 1 }, questions());
  session.start();
  session.startSubmitting();
  session.submitPractice(12000);
  session.setPendingGrading();
  return session;
}

test("Phase F5: 1. legacy boolean과 명시적 3상태 판정을 정규화한다", () => {
  assert.equal(normalizeGradeDecision(true), GradeDecision.CORRECT);
  assert.equal(normalizeGradeDecision(false), GradeDecision.WRONG);
  assert.equal(normalizeGradeDecision("CORRECT"), GradeDecision.CORRECT);
  assert.equal(normalizeGradeDecision("WRONG"), GradeDecision.WRONG);
  assert.equal(normalizeGradeDecision("RETRY"), GradeDecision.RETRY);
  assert.equal(normalizeGradeDecision("UNKNOWN"), null);
});

test("Phase F5: 2. 판정 데이터는 응답과 분리된 decision/gradingState를 가진다", () => {
  const q = questions()[0];
  const decision = createGradeDecision(q, GradeDecision.RETRY, "다시 풀어보기");
  assert.equal(decision.decision, GradeDecision.RETRY);
  assert.equal(decision.gradingState, "GRADED");
  assert.equal(decision.comment, "다시 풀어보기");
});

test("Phase F5: 3. 보호자 시작 전에는 판정할 수 없고 시작 후 GRADING_ACTIVE가 된다", () => {
  const session = pendingSession();
  assert.equal(session.state, SessionState.PARENT_GRADING_PENDING);
  assert.throws(() => session.gradeQuestion("f5_q1", GradeDecision.CORRECT), /GRADING_ACTIVE/);

  session.startGrading();
  assert.equal(session.state, SessionState.GRADING_ACTIVE);
  const result = session.gradeQuestion("f5_q1", GradeDecision.CORRECT, "잘 풀었음");
  assert.equal(result.gradeData.decision, GradeDecision.CORRECT);
  assert.equal(session.questions[0].grade.comment, "잘 풀었음");
});

test("Phase F5: 4. 정답/오답/다시 풀기는 모두 채점 진행률에 포함된다", () => {
  const session = pendingSession();
  session.startGrading();
  session.gradeQuestion("f5_q1", GradeDecision.CORRECT);
  session.gradeQuestion("f5_q2", GradeDecision.WRONG);
  session.gradeQuestion("f5_q3", GradeDecision.RETRY);

  const status = session.getGradingStatus();
  assert.equal(status.total, 3);
  assert.equal(status.graded, 3);
  assert.equal(status.remaining, 0);
  assert.equal(status.correct, 1);
  assert.equal(status.wrong, 1);
  assert.equal(status.retry, 1);
  assert.equal(status.allGraded, true);
  assert.equal(status.progressPercent, 100);
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
  
  await startSubmissionGrading(id, { learnerId });
  const allGradedResults = {
    f5_q1: createGradeDecision(questions()[0], GradeDecision.CORRECT),
    f5_q2: createGradeDecision(questions()[1], GradeDecision.CORRECT),
    f5_q3: createGradeDecision(questions()[2], GradeDecision.CORRECT)
  };
  await updateSubmissionGrading(id, allGradedResults, new Map([["f5_q1", [{ x: 9, y: 9 }]]]), { learnerId, status: "GRADED" });
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
  await startSubmissionGrading(id, { learnerId });

  await assert.rejects(() => updateSubmissionGrading(id, {
    f5_q1: createGradeDecision(questions()[0], GradeDecision.CORRECT)
  }, new Map(), { learnerId, status: "GRADED", requireAllGraded: true }), /미채점 2문제/);
  assert.equal((await getSubmission(id, { learnerId })).status, "GRADING_ACTIVE");
});

test("Phase F5: 9. 빠른/상세 보기 위치와 진행 상태를 Submission에 저장한다", async () => {
  const learnerId = "f5_view_state";
  const id = `sub_f5_view_${Date.now()}`;
  setCurrentLearnerId(learnerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });
  await startSubmissionGrading(id, { learnerId });

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
  const learnerId = "f5_deep_link";
  const id = `sub_f5_deep_${Date.now()}`;
  setCurrentLearnerId(learnerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions(), status: "PARENT_GRADING_PENDING" });
  const restored = await getSubmission(id, { learnerId });
  assert.ok(restored);
  assert.equal(restored.status, "PARENT_GRADING_PENDING");
  assert.equal(restored.questions.length, 3);
});

test("Phase F5: 11. 전체 판정 후에만 GRADED 상태와 100% 진행률을 저장한다", async () => {
  const learnerId = "f5_all_graded";
  const id = `sub_f5_all_${Date.now()}`;
  setCurrentLearnerId(learnerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });
  await startSubmissionGrading(id, { learnerId });

  const gradingResults = {
    f5_q1: createGradeDecision(questions()[0], GradeDecision.CORRECT),
    f5_q2: createGradeDecision(questions()[1], GradeDecision.WRONG),
    f5_q3: createGradeDecision(questions()[2], GradeDecision.RETRY)
  };
  const updated = await updateSubmissionGrading(id, gradingResults, new Map(), {
    learnerId,
    status: "GRADED"
  });
  assert.equal(updated.status, "GRADED");
  assert.equal(updated.gradingProgress.allGraded, true);
  assert.equal(updated.gradingProgress.progressPercent, 100);
});

test("Phase F5: 12. Production UI에 시작 확인·근거 상세·문제 탐색·3상태 판정이 연결된다", () => {
  const html = fs.readFileSync(new URL("../public/app/index.html", import.meta.url), "utf8");
  const js = fs.readFileSync(new URL("../public/app/js/app.js", import.meta.url), "utf8");
  assert.match(html, /id="parentGradingStartPanel"/);
  assert.match(html, /id="startParentGradingBtn"/);
  assert.match(html, /id="gradingQuestionNavigator"/);
  assert.match(html, /id="gradingExitBtn"/);
  assert.doesNotMatch(html, /id="gradingQuickViewBtn"/);
  assert.match(js, /normalizeGradeDecision/);
  assert.match(js, /startSubmissionGrading/);
  assert.match(js, /GradeDecision.RETRY/);
});

test("Phase F5: 13. [F5-R1] 일부 문제만 채점한 상태에서 requireAllGraded 생략 및 status=GRADED 호출 시 반드시 reject 및 status 유지", async () => {
  const learnerId = "f5_r1_guard";
  const id = `sub_f5_r1_${Date.now()}`;
  setCurrentLearnerId(learnerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });
  await startSubmissionGrading(id, { learnerId });

  const partialGrades = {
    f5_q1: createGradeDecision(questions()[0], GradeDecision.CORRECT)
  };

  // requireAllGraded 플래그를 넘기지 않아도 미채점 상태라면 status=GRADED 전환 거부
  await assert.rejects(async () => {
    await updateSubmissionGrading(id, partialGrades, new Map(), {
      learnerId,
      status: "GRADED"
    });
  }, /미채점 2문제가 남아 있어/);

  const sub = await getSubmission(id, { learnerId });
  assert.equal(sub.status, "GRADING_ACTIVE");
});

test("Phase F5: 14. [F5-R2] 일부 문제만 채점한 상태에서 requireAllGraded 생략 및 status=SESSION_COMPLETE 호출 시 반드시 reject", async () => {
  const learnerId = "f5_r2_guard";
  const id = `sub_f5_r2_${Date.now()}`;
  setCurrentLearnerId(learnerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });
  await startSubmissionGrading(id, { learnerId });

  const partialGrades = {
    f5_q1: createGradeDecision(questions()[0], GradeDecision.CORRECT),
    f5_q2: createGradeDecision(questions()[1], GradeDecision.WRONG)
  };

  await assert.rejects(async () => {
    await updateSubmissionGrading(id, partialGrades, new Map(), {
      learnerId,
      status: "SESSION_COMPLETE"
    });
  }, /유효하지 않은 채점 상태 전이|미채점/);

  const sub = await getSubmission(id, { learnerId });
  assert.equal(sub.status, "GRADING_ACTIVE");
});

test("Phase F5: 15. [F5-R3] 모든 문제 판정 완료 후 status=GRADED 정상 성공 및 진행률 100% 검증", async () => {
  const learnerId = "f5_r3_success";
  const id = `sub_f5_r3_${Date.now()}`;
  setCurrentLearnerId(learnerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });
  await startSubmissionGrading(id, { learnerId });

  const fullGrades = {
    f5_q1: createGradeDecision(questions()[0], GradeDecision.CORRECT),
    f5_q2: createGradeDecision(questions()[1], GradeDecision.WRONG),
    f5_q3: createGradeDecision(questions()[2], GradeDecision.RETRY)
  };

  const graded = await updateSubmissionGrading(id, fullGrades, new Map(), {
    learnerId,
    status: "GRADED"
  });

  assert.equal(graded.status, "GRADED");
  assert.equal(graded.gradingProgress.allGraded, true);
  assert.equal(graded.gradingProgress.remaining, 0);
  assert.equal(graded.gradingProgress.progressPercent, 100);
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
  }, /유효하지 않은 채점 상태 전이/);

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
  await updateSubmissionGrading(id, gradingResults, new Map(), { learnerId, status: "GRADED" });
  await updateSubmissionGrading(id, {}, new Map(), { learnerId, status: "SESSION_COMPLETE" });

  const completed = await getSubmission(id, { learnerId });
  assert.equal(completed.status, "SESSION_COMPLETE");

  await assert.rejects(async () => {
    await startSubmissionGrading(id, { learnerId });
  }, /PARENT_GRADING_PENDING/);

  await assert.rejects(async () => {
    await updateSubmissionGrading(id, {}, new Map(), { learnerId, status: "GRADING_ACTIVE" });
  }, /유효하지 않은 채점 상태 전이/);

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

test("Phase F5: 21. [F5-R9] Progress Save Start 우회 차단", async () => {
  const learnerId = "f5_r9_save_bypass";
  const id = `sub_f5_r9_${Date.now()}`;
  setCurrentLearnerId(learnerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });

  // startSubmissionGrading 호출 없이 saveSubmissionGradingProgress 호출 시 reject
  await assert.rejects(async () => {
    await saveSubmissionGradingProgress(id, {
      f5_q1: createGradeDecision(questions()[0], GradeDecision.CORRECT)
    }, new Map(), { learnerId });
  }, /GRADING_ACTIVE 상태의 제출본만/);

  // 저장 후 상태 및 데이터 불변 검증
  const sub = await getSubmission(id, { learnerId });
  assert.equal(sub.status, "PARENT_GRADING_PENDING");
  assert.deepEqual(sub.gradingResults || {}, {});
});

test("Phase F5: 22. [F5-R10] Generic Update Start 우회 차단", async () => {
  const learnerId = "f5_r10_generic_bypass";
  const id = `sub_f5_r10_${Date.now()}`;
  setCurrentLearnerId(learnerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });

  // generic storage updateSubmissionGrading으로 status="GRADING_ACTIVE" 직접 요청 시 reject
  await assert.rejects(async () => {
    await updateSubmissionGrading(id, {}, new Map(), {
      learnerId,
      status: "GRADING_ACTIVE"
    });
  }, /유효하지 않은 채점 상태 전이/);

  const sub = await getSubmission(id, { learnerId });
  assert.equal(sub.status, "PARENT_GRADING_PENDING");
});

test("Phase F5: 23. [F5-R11] 정상 Start 후 Progress Save", async () => {
  const learnerId = "f5_r11_normal_progress";
  const id = `sub_f5_r11_${Date.now()}`;
  setCurrentLearnerId(learnerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });

  // 1. 정상 시작
  await startSubmissionGrading(id, { learnerId });
  const started = await getSubmission(id, { learnerId });
  assert.equal(started.status, "GRADING_ACTIVE");

  // 2. saveSubmissionGradingProgress 정상 성공
  const progressGrades = {
    f5_q1: createGradeDecision(questions()[0], GradeDecision.CORRECT, "정답"),
    f5_q2: createGradeDecision(questions()[1], GradeDecision.WRONG, "오답"),
    f5_q3: createGradeDecision(questions()[2], GradeDecision.RETRY, "재시도")
  };
  await saveSubmissionGradingProgress(id, progressGrades, new Map(), { learnerId });

  const after = await getSubmission(id, { learnerId });
  assert.equal(after.status, "GRADING_ACTIVE");
  assert.equal(after.gradingResults.f5_q1.decision, GradeDecision.CORRECT);
  assert.equal(after.gradingResults.f5_q2.decision, GradeDecision.WRONG);
  assert.equal(after.gradingResults.f5_q3.decision, GradeDecision.RETRY);
});

test("Phase F5: 24. [F5-R12] GRADING_ACTIVE -> PENDING 역방향 차단", async () => {
  const learnerId = "f5_r12_active_to_pending";
  const id = `sub_f5_r12_${Date.now()}`;
  setCurrentLearnerId(learnerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });
  await startSubmissionGrading(id, { learnerId });

  await assert.rejects(async () => {
    await updateSubmissionGrading(id, {}, new Map(), {
      learnerId,
      status: "PARENT_GRADING_PENDING"
    });
  }, /유효하지 않은 채점 상태 전이/);

  const sub = await getSubmission(id, { learnerId });
  assert.equal(sub.status, "GRADING_ACTIVE");
});

test("Phase F5: 25. [F5-R13] SESSION_COMPLETE -> GRADED 역방향 차단", async () => {
  const learnerId = "f5_r13_complete_to_graded";
  const id = `sub_f5_r13_${Date.now()}`;
  setCurrentLearnerId(learnerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });
  await startSubmissionGrading(id, { learnerId });

  const fullGrades = {
    f5_q1: createGradeDecision(questions()[0], GradeDecision.CORRECT),
    f5_q2: createGradeDecision(questions()[1], GradeDecision.CORRECT),
    f5_q3: createGradeDecision(questions()[2], GradeDecision.CORRECT)
  };
  await updateSubmissionGrading(id, fullGrades, new Map(), { learnerId, status: "GRADED" });
  await updateSubmissionGrading(id, {}, new Map(), { learnerId, status: "SESSION_COMPLETE" });

  const completeSub = await getSubmission(id, { learnerId });
  assert.equal(completeSub.status, "SESSION_COMPLETE");

  // SESSION_COMPLETE에서 status="GRADED" 역방향 전이 시도 시 reject
  await assert.rejects(async () => {
    await updateSubmissionGrading(id, {}, new Map(), {
      learnerId,
      status: "GRADED"
    });
  }, /유효하지 않은 채점 상태 전이/);

  const after = await getSubmission(id, { learnerId });
  assert.equal(after.status, "SESSION_COMPLETE");
});

test("Phase F5: 26. [F5-R14] Full Lifecycle 정상 성공", async () => {
  const learnerId = "f5_r14_full_lifecycle";
  const id = `sub_f5_r14_${Date.now()}`;
  setCurrentLearnerId(learnerId);

  // 1. 제출 스냅샷 생성 -> PARENT_GRADING_PENDING
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });
  let sub = await getSubmission(id, { learnerId });
  assert.equal(sub.status, "PARENT_GRADING_PENDING");

  // 2. 보호자 채점 시작 -> GRADING_ACTIVE
  await startSubmissionGrading(id, { learnerId });
  sub = await getSubmission(id, { learnerId });
  assert.equal(sub.status, "GRADING_ACTIVE");

  // 3. 전 문제 채점 완료 -> GRADED
  const fullGrades = {
    f5_q1: createGradeDecision(questions()[0], GradeDecision.CORRECT),
    f5_q2: createGradeDecision(questions()[1], GradeDecision.WRONG),
    f5_q3: createGradeDecision(questions()[2], GradeDecision.RETRY)
  };
  await updateSubmissionGrading(id, fullGrades, new Map(), { learnerId, status: "GRADED" });
  sub = await getSubmission(id, { learnerId });
  assert.equal(sub.status, "GRADED");
  assert.equal(sub.gradingProgress.allGraded, true);

  // 4. 최종 세션 완료 -> SESSION_COMPLETE
  await updateSubmissionGrading(id, {}, new Map(), { learnerId, status: "SESSION_COMPLETE" });
  sub = await getSubmission(id, { learnerId });
  assert.equal(sub.status, "SESSION_COMPLETE");
});

test("Phase F5: 27. [F5-R15] Invalid Transition Matrix", async () => {
  const learnerId = "f5_r15_matrix";
  setCurrentLearnerId(learnerId);

  const fullGrades = {
    f5_q1: createGradeDecision(questions()[0], GradeDecision.CORRECT),
    f5_q2: createGradeDecision(questions()[1], GradeDecision.CORRECT),
    f5_q3: createGradeDecision(questions()[2], GradeDecision.CORRECT)
  };

  const invalidPairs = [
    { from: "PARENT_GRADING_PENDING", to: "GRADING_ACTIVE" },
    { from: "PARENT_GRADING_PENDING", to: "GRADED" },
    { from: "PARENT_GRADING_PENDING", to: "SESSION_COMPLETE" },
    { from: "GRADING_ACTIVE", to: "PARENT_GRADING_PENDING" },
    { from: "GRADING_ACTIVE", to: "SESSION_COMPLETE" },
    { from: "GRADED", to: "GRADING_ACTIVE" },
    { from: "GRADED", to: "PARENT_GRADING_PENDING" },
    { from: "SESSION_COMPLETE", to: "GRADING_ACTIVE" },
    { from: "SESSION_COMPLETE", to: "PARENT_GRADING_PENDING" },
    { from: "SESSION_COMPLETE", to: "GRADED" }
  ];

  for (const { from, to } of invalidPairs) {
    const id = `sub_f5_matrix_${from}_${to}_${Date.now()}_${Math.random()}`;
    await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });

    if (from === "GRADING_ACTIVE") {
      await startSubmissionGrading(id, { learnerId });
    } else if (from === "GRADED") {
      await startSubmissionGrading(id, { learnerId });
      await updateSubmissionGrading(id, fullGrades, new Map(), { learnerId, status: "GRADED" });
    } else if (from === "SESSION_COMPLETE") {
      await startSubmissionGrading(id, { learnerId });
      await updateSubmissionGrading(id, fullGrades, new Map(), { learnerId, status: "GRADED" });
      await updateSubmissionGrading(id, {}, new Map(), { learnerId, status: "SESSION_COMPLETE" });
    }

    const currentSub = await getSubmission(id, { learnerId });
    assert.equal(currentSub.status, from);

    await assert.rejects(async () => {
      await updateSubmissionGrading(id, fullGrades, new Map(), { learnerId, status: to });
    }, /유효하지 않은 채점 상태 전이|startSubmissionGrading/);

    const checkSub = await getSubmission(id, { learnerId });
    assert.equal(checkSub.status, from);
  }
});

test("Phase F5: 28. [F5-R16] allowStartTransition 직접 주입 우회 차단", async () => {
  const learnerId = "f5_r16_privilege_allow";
  const id = `sub_f5_r16_${Date.now()}`;
  setCurrentLearnerId(learnerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });

  // allowStartTransition: true 직접 주입하여 generic update 호출 시 reject
  await assert.rejects(async () => {
    await updateSubmissionGrading(id, {}, new Map(), {
      learnerId,
      status: "GRADING_ACTIVE",
      allowStartTransition: true
    });
  }, /유효하지 않은 채점 상태 전이/);

  const sub = await getSubmission(id, { learnerId });
  assert.equal(sub.status, "PARENT_GRADING_PENDING");
});

test("Phase F5: 29. [F5-R17] transitionIntent 직접 주입 우회 차단", async () => {
  const learnerId = "f5_r17_privilege_intent";
  const id = `sub_f5_r17_${Date.now()}`;
  setCurrentLearnerId(learnerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });

  // transitionIntent: "START_GRADING" 직접 주입하여 generic update 호출 시 reject
  await assert.rejects(async () => {
    await updateSubmissionGrading(id, {}, new Map(), {
      learnerId,
      status: "GRADING_ACTIVE",
      transitionIntent: "START_GRADING"
    });
  }, /유효하지 않은 채점 상태 전이/);

  const sub = await getSubmission(id, { learnerId });
  assert.equal(sub.status, "PARENT_GRADING_PENDING");
});

test("Phase F5: 30. [F5-R18] 두 privileged option 동시 주입 우회 차단 및 정상 startSubmissionGrading 전이 검증", async () => {
  const learnerId = "f5_r18_both_options";
  const id = `sub_f5_r18_${Date.now()}`;
  setCurrentLearnerId(learnerId);
  await saveSubmissionSnapshot({ id, sessionId: id.slice(4), learnerId, questions: questions() });

  // allowStartTransition + transitionIntent 동시 주입하여 generic update 호출 시 reject
  await assert.rejects(async () => {
    await updateSubmissionGrading(id, {}, new Map(), {
      learnerId,
      status: "GRADING_ACTIVE",
      allowStartTransition: true,
      transitionIntent: "START_GRADING"
    });
  }, /유효하지 않은 채점 상태 전이/);

  let sub = await getSubmission(id, { learnerId });
  assert.equal(sub.status, "PARENT_GRADING_PENDING");

  // 그 후 동일 Submission에 대해 정상 startSubmissionGrading 호출 시 성공 전이
  const started = await startSubmissionGrading(id, { learnerId });
  assert.equal(started.status, "GRADING_ACTIVE");

  sub = await getSubmission(id, { learnerId });
  assert.equal(sub.status, "GRADING_ACTIVE");
});

test.after(async () => {
  closeDB();
});
