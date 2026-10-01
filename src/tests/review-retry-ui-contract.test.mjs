import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { createSession } from "../public/app/js/sessionEngine.js";
import { generateMathCandidate } from "../public/app/js/mathF16dGenerator.js";
import { getAllReviewItems, saveDraftSession, getSubmission, getReviewItem } from "../public/app/js/storage.js";
import { submitLearningSession, startSubmissionGrading, finalizeSubmissionGrading, startReviewRetry, resumeReviewRetry } from "../public/app/js/data/learningCommands.js";
import { openReviewRetryResult } from "../public/app/js/reviewRetryPresentation.js";
import { getSessionHistoryLabel } from "../public/app/js/sessionHistoryLabel.js";
import { createResponseRecord } from "../public/app/js/responseEngine.js";
import fs from "node:fs";
import vm from "node:vm";

test("actual worksheet entry clears previous submitted answers and unlocks Retry controls", () => {
  // Run the production entry function with browser collaborators replaced, not a copy of its logic.
  const source = fs.readFileSync(new URL("../public/app/js/app.js", import.meta.url), "utf8");
  const start = source.indexOf("function startSessionWithQuestions(");
  const end = source.indexOf("//+_+// F16D", start);
  const context = vm.createContext({
    consumeActiveWorkbookContext: () => null, getCurrentRoute: () => "/home", getActiveWorkbookContext: () => null,
    createSession, Date, questionTimer: {}, practiceView: {},
    currentSubmission: { responseSnapshots: { q: { value: "old answer" } } }, currentResultSummary: { old: true },
    questionStrokesMap: new Map(), questionResponseRecordsMap: new Map(), gradingStrokesMap: new Map(), gradingResultsMap: new Map(), activeCanvasInstances: new Map(),
    startSessionTimer() {}, switchView() {}, renderCurrentWorksheetPage() {}, triggerDraftSave() {}, updateGlobalLearningNav() {}, updateToolDockUI() {},
    setPracticeInteractionLocked(value) { context.locked = value; }
  });
  vm.runInContext(source.slice(start, end), context);
  context.questions = [{ id: "q", operation: "mul", expectedAnswer: 6 }];
  vm.runInContext('startSessionWithQuestions(questions, { sessionId: "retry-ui-reset" });', context);
  assert.equal(context.currentSubmission, null);
  assert.equal(context.currentResultSummary, null);
  assert.equal(context.locked, false);
  assert.equal(context.currentSession.state, "PRACTICE_ACTIVE");
});

test("UI Retry adapter opens actual command result; retrying recovery reuses identity and original snapshot", async () => {
  const learnerId = "retry-ui-contract";
  const question = generateMathCandidate("f16d_decimal_add", 9);
  const session = createSession({ sessionId: "retry-ui-source", learnerId, subjectId: "math", courseId: "decimal", skillTitle: "소수 덧셈" }, [question]);
  session.start();
  const sub = await submitLearningSession({ session, learnerId });
  await startSubmissionGrading(sub.id, { learnerId });
  await finalizeSubmissionGrading(sub.id, { learnerId, gradingResults: { [question.id]: { decision: "WRONG" } } });
  const [review] = await getAllReviewItems({ learnerId });
  const result = await startReviewRetry(review.id, { learnerId });
  let opened;
  openReviewRetryResult(result, { startSession: (questions, config) => opened = { questions, config } });
  assert.equal(opened.questions[0].id, question.id);
  assert.equal(opened.config.reviewItemId, review.id);
  assert.equal(getSessionHistoryLabel({ config: opened.config }), "소수 덧셈");
  const recovered = await resumeReviewRetry(review.id, { learnerId });
  assert.equal(recovered.retryAttempt.id, result.retryAttempt.id);
  assert.equal(recovered.retrySession.id, result.retrySession.id);
  assert.deepEqual(recovered.retrySession.questions[0].metadata.math, question.metadata.math);
  assert.deepEqual((await getReviewItem(review.id, { learnerId })).retryAttemptIds, [result.retryAttempt.id]);
  await assert.rejects(resumeReviewRetry(review.id, { learnerId: "other-learner" }));

  const response = createResponseRecord(question.id, "TEXT", "12.34");
  await saveDraftSession({ learnerId, sessionId: result.retrySession.id, config: result.retrySession.config,
    questions: result.retrySession.questions, responseRecords: { [question.id]: response },
    studentStrokesMap: { [question.id]: [{ x: 1, y: 2 }] }, totalElapsedMs: 3210 });
  const resumed = await resumeReviewRetry(review.id, { learnerId });
  let restored;
  openReviewRetryResult(resumed, { startSession: () => assert.fail("Must restore existing answers"), restoreDraft: draft => { restored = draft; return true; } });
  assert.equal(restored.responseRecords[question.id].value, "12.34");
  assert.equal(restored.totalElapsedMs, 3210);
  assert.deepEqual(restored.studentStrokesMap[question.id], [{ x: 1, y: 2 }]);
  assert.equal((await getSubmission(sub.id, { learnerId })).questions[0].id, question.id);
  await saveDraftSession({ ...resumed.draft, sessionState: "GRADING_ACTIVE" });
  await assert.rejects(resumeReviewRetry(review.id, { learnerId }), /상태/);
});

test("history labels prioritize approved display text and domain while preserving legacy multiplication/division", () => {
  assert.equal(getSessionHistoryLabel({ operation: "mul", config: { courseId: "decimal", skillTitle: "소수 덧셈" } }), "소수 덧셈");
  for (const [courseId, label] of [["decimal", "소수"], ["fraction", "분수"], ["measurement", "측정"]]) {
    assert.equal(getSessionHistoryLabel({ operation: "mul", config: { courseId } }), label);
  }
  assert.equal(getSessionHistoryLabel({ operation: "mul" }), "곱셈");
  assert.equal(getSessionHistoryLabel({ operation: "div" }), "나눗셈");
  assert.equal(getSessionHistoryLabel({ config: { subjectId: "korean", courseId: "korean-core", skillTitle: "KO_INTERNAL" } }), "국어 학습");
  assert.throws(() => openReviewRetryResult({ session: {} }), /세션/);
});
