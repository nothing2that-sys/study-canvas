import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { createSession, SessionState } from "../public/app/js/sessionEngine.js";
import { generateMathCandidate } from "../public/app/js/mathF16dGenerator.js";
import { getAllReviewItems, saveDraftSession, getDraftSession, clearDraftSession, getSubmission, getReviewItem, getRecentAttempts, _setRetryFailureInjectorForTesting } from "../public/app/js/storage.js";
import { submitLearningSession, startSubmissionGrading, finalizeSubmissionGrading, startReviewRetry, resumeReviewRetry } from "../public/app/js/data/learningCommands.js";
import { openReviewRetryResult } from "../public/app/js/reviewRetryPresentation.js";
import { getSessionHistoryLabel } from "../public/app/js/sessionHistoryLabel.js";
import { createResponseRecord } from "../public/app/js/responseEngine.js";
import fs from "node:fs";
import vm from "node:vm";

test("actual worksheet entry reserves storage before clearing previous submitted answers and unlocking controls", async () => {
  // Run the production entry function with browser collaborators replaced, not a copy of its logic.
  const source = fs.readFileSync(new URL("../public/app/js/app.js", import.meta.url), "utf8");
  const start = source.indexOf("async function startSessionWithQuestions(");
  const end = source.indexOf("//+_+// F16D", start);
  const context = vm.createContext({
    consumeActiveWorkbookContext: () => null, getCurrentRoute: () => "/home", getActiveWorkbookContext: () => null,
    createSession, SessionState, Date, questionTimer: {}, practiceView: {}, getActiveLearnerId:()=>null,
    flushDraftSave:async()=>{}, getDraft:async()=>null,
    saveDraft:async draft=>({...draft,revision:0,updatedAt:123,writeId:'reserved'}),
    draftCoordinator:{setBaseVersion(draft){context.base=draft;}}, alert:message=>assert.fail(message),
    currentSubmission: { responseSnapshots: { q: { value: "old answer" } } }, currentResultSummary: { old: true },
    questionStrokesMap: new Map(), questionResponseRecordsMap: new Map(), gradingStrokesMap: new Map(), gradingResultsMap: new Map(), activeCanvasInstances: new Map(),
    startSessionTimer() {}, switchView() {}, renderCurrentWorksheetPage() {}, triggerDraftSave() {}, updateGlobalLearningNav() {}, updateToolDockUI() {},
    setPracticeInteractionLocked(value) { context.locked = value; }
  });
  vm.runInContext(source.slice(start, end), context);
  context.questions = [{ id: "q", operation: "mul", expectedAnswer: 6 }];
  await vm.runInContext('startSessionWithQuestions(questions, { sessionId: "retry-ui-reset" });', context);
  assert.equal(context.currentSubmission, null);
  assert.equal(context.currentResultSummary, null);
  assert.equal(context.locked, false);
  assert.equal(context.currentSession.state, "PRACTICE_ACTIVE");
  assert.equal(context.base.sessionId, "retry-ui-reset");
  assert.equal(context.base.writeId, "reserved");
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
  openReviewRetryResult(result, { startSession:()=>assert.fail('Retry has an atomic initial Draft'), restoreDraft:draft=>{opened={questions:draft.questions,config:draft.config};return true;} });
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

test('protected writes reject a new worksheet and retain Retry strokes, timer, IDs and response', async () => {
  const learnerId='draft-retry-protection';
  const draft={learnerId,sessionId:'retry-protected',config:{sessionKind:'REVIEW_RETRY'},questions:[{id:'q'}],
    totalElapsedMs:26079,studentStrokesMap:{q:[{points:[{x:1,y:2}]}]},responseRecords:{}};
  await saveDraftSession(draft);
  const before=await getDraftSession({learnerId});
  await assert.rejects(saveDraftSession({...draft,sessionId:'normal-new',totalElapsedMs:0,studentStrokesMap:{}},{protectExisting:true}),/진행 중/);
  assert.deepEqual(await getDraftSession({learnerId}),before);
  await saveDraftSession({...draft,totalElapsedMs:27000},{protectExisting:true});
  assert.equal((await getDraftSession({learnerId})).totalElapsedMs,27000);
  const other='other-draft-learner';
  await saveDraftSession({...draft,learnerId:other,sessionId:'other-normal'},{protectExisting:true});
  assert.equal((await getDraftSession({learnerId})).sessionId,'retry-protected');
});

test('competing protected worksheet starts allow one reservation and preserve its content', async () => {
  const learnerId='draft-start-race';
  const results=await Promise.allSettled(['a','b'].map(sessionId=>saveDraftSession({learnerId,sessionId,questions:[{id:'q'}]},{protectExisting:true})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.filter(r=>r.status==='rejected').length,1);
  assert.equal((await getDraftSession({learnerId})).sessionId,results.find(r=>r.status==='fulfilled').value.sessionId);
});

test('production start leaves current answers and timer untouched while storage is pending, blocked or fails', async () => {
  const source=fs.readFileSync(new URL('../public/app/js/app.js',import.meta.url),'utf8');
  const start=source.indexOf('async function startSessionWithQuestions('),end=source.indexOf('//+_+// F16D',start);
  for (const mode of ['existing','saveFailure']) {
    let release;const messages=[];
    const old={id:'old-retry',state:'PRACTICE_ACTIVE'};
    const strokes=new Map([['q',[{points:[{x:1,y:2}]}]]]);
    const context=vm.createContext({ createSession,SessionState,Date,getActiveLearnerId:()=> 'qa-start',
      flushDraftSave:()=>new Promise(r=>release=r),getDraft:async()=>mode==='existing'?{sessionId:'old-retry'}:null,
      saveDraft:async()=>{throw new Error('disk unavailable');},alert:m=>messages.push(m),
      getActiveWorkbookContext:()=>null,getCurrentRoute:()=>'/home',currentSession:old,currentSubmission:{id:'source'},
      questionStrokesMap:strokes,startSessionTimer:()=>assert.fail('timer must not reset') });
    vm.runInContext(source.slice(start,end),context);
    const pending=vm.runInContext('startSessionWithQuestions([{id:"new"}],{pageSize:1})',context);
    assert.equal(context.currentSession,old);assert.equal(strokes.size,1);release();
    assert.equal(await pending,false);assert.equal(context.currentSession,old);
    assert.equal(strokes.size,1);assert.equal(context.currentSubmission.id,'source');assert.equal(messages.length,1);
    assert.match(messages[0], mode === 'existing' ? /진행 중/ : /disk unavailable/);
  }
});

test('Retry creation protects another Draft and missing saved Retry cannot silently reopen empty', async () => {
  const learnerId='retry-missing-draft';
  const question={id:'q-missing',operation:'mul',operandA:12,operandB:4,expectedAnswer:48};
  const session=createSession({learnerId,sessionId:'source-missing'},[question]);session.start();
  const sub=await submitLearningSession({session,learnerId});
  await startSubmissionGrading(sub.id,{learnerId});
  await finalizeSubmissionGrading(sub.id,{learnerId,gradingResults:{[question.id]:{decision:'WRONG'}}});
  const [review]=await getAllReviewItems({learnerId});
  await saveDraftSession({learnerId,sessionId:'normal-active',questions:[{id:'normal'}],totalElapsedMs:9000});
  await assert.rejects(startReviewRetry(review.id,{learnerId}),/진행 중/);
  assert.deepEqual((await getReviewItem(review.id,{learnerId})).retryAttemptIds,[]);
  assert.equal((await getDraftSession({learnerId})).totalElapsedMs,9000);
  await clearDraftSession({learnerId});
  const retry=await startReviewRetry(review.id,{learnerId});
  assert.equal(retry.draft.sessionId,retry.retrySession.id);
  assert.equal((await resumeReviewRetry(review.id,{learnerId})).draft.totalElapsedMs,0);
  await clearDraftSession({learnerId});
  await assert.rejects(resumeReviewRetry(review.id,{learnerId}),/저장된 재풀이/);
  assert.throws(()=>openReviewRetryResult({...retry,draft:null,resumed:true},{startSession:()=>assert.fail('must not start')}),/저장된 재풀이/);
  assert.deepEqual((await getReviewItem(review.id,{learnerId})).retryAttemptIds,[retry.retryAttempt.id]);
});

test('initial Retry Draft write failure rolls back Attempt and ReviewItem together', async () => {
  const learnerId='retry-initial-write-failure';
  const question={id:'q-failed-initial',operation:'mul',operandA:12,operandB:4,expectedAnswer:48};
  const session=createSession({learnerId,sessionId:'source-failed-initial'},[question]);session.start();
  const sub=await submitLearningSession({session,learnerId});
  await startSubmissionGrading(sub.id,{learnerId});
  await finalizeSubmissionGrading(sub.id,{learnerId,gradingResults:{[question.id]:{decision:'WRONG'}}});
  const [review]=await getAllReviewItems({learnerId});
  const before=await getRecentAttempts(100,{learnerId});
  _setRetryFailureInjectorForTesting(({phase})=>{if(phase==='during_draft_write')throw new Error('initial Draft failure');});
  try { await assert.rejects(startReviewRetry(review.id,{learnerId}),/initial Draft failure/); }
  finally { _setRetryFailureInjectorForTesting(null); }
  assert.deepEqual(await getRecentAttempts(100,{learnerId}),before);
  assert.deepEqual(await getReviewItem(review.id,{learnerId}),review);
  assert.equal(await getDraftSession({learnerId}),null);
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
