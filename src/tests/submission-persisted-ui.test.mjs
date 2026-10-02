import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createSession, SessionState } from '../public/app/js/sessionEngine.js';
import { restoreSessionStateFromSubmission } from '../public/app/js/submissionLifecycle.js';

const source=fs.readFileSync(new URL('../public/app/js/app.js',import.meta.url),'utf8');
function extract(name,end){const start=source.indexOf('function '+name+'(');return source.slice(source.slice(start-6,start)==='async '?start-6:start,source.indexOf(end,start));}
const q={id:'q:12:4',operation:'mul',operandA:12,operandB:4,answer:48,expectedAnswer:48};
const record=status=>({id:'sub_same',sessionId:'same',learnerId:'ui',status,config:{pageSize:1},questions:[q],totalSolveTimeMs:4321,submittedAt:123,completedAt:456,studentStrokesMap:{[q.id]:[{id:'student'}]},responseSnapshots:{},gradingStrokesMap:{[q.id]:[{id:'red'}]},gradingResults:{[q.id]:{decision:'CORRECT',comment:'persisted'}}});
function harness(submission){const state={Date,Map,createSession,SessionState,restoreSessionStateFromSubmission,resolveSessionQuestionId:id=>id,questionStrokesMap:new Map(),questionResponseRecordsMap:new Map(),gradingStrokesMap:new Map(),gradingResultsMap:new Map(),draftCoordinator:{setBaseVersion(){}},questionTimer:{getElapsedMs:()=>5,stop(){}},parentGradingStartPanel:{hidden:true},gradingGrid:{hidden:false},finishGradingBtn:{parentElement:{hidden:false}},gradingView:{},setPracticeInteractionLocked(){},switchView(){},renderGradingView(){state.rendered=true},updateGradingStatusUI(){state.pending=true},showSessionResult(summary){state.summary=summary},getActiveLearnerId:()=> 'ui',getSubmissionBySessionId:async()=>submission,canMutatePractice:s=>s.state==='PRACTICE_ACTIVE',flushDraftSave:async()=>{state.flushes++},flushes:0,alert:m=>{throw Error(m)},currentSession:createSession({sessionId:'same'},[q])};state.currentSession.start();const c=vm.createContext(state);vm.runInContext(extract('restoreSessionFromSubmission','//+_+// 🌟')+extract('handleSubmitPractice','async function handleStartParentGrading'),c);return c;}

test('real app restore renders completed persisted payload instead of ungraded 0/1',()=>{
  const sub=record('GRADED'),before=structuredClone(sub),c=harness(sub);
  assert.equal(c.restoreSessionFromSubmission(sub),true);assert.equal(c.currentSession.state,'SESSION_COMPLETE');
  assert.equal(c.summary.correctCount,1);assert.equal(c.summary.totalSolveTimeMs,4321);assert.equal(c.summary.completedAt,456);
  assert.equal(c.pending,undefined);assert.equal(c.gradingResultsMap.get(q.id).comment,'persisted');assert.deepEqual(sub,before);
});
test('real stale submit reads existing completion without Draft flush or any submit write',async()=>{
  const c=harness(record('GRADED'));await c.handleSubmitPractice();assert.equal(c.flushes,0);assert.equal(c.currentSession.state,'SESSION_COMPLETE');assert.equal(c.pending,undefined);
});
test('existing active and pending submissions restore their own grading lifecycle',()=>{
  for(const status of ['PARENT_GRADING_PENDING','GRADING_ACTIVE']){const c=harness(record(status));c.restoreSessionFromSubmission(record(status));assert.equal(c.currentSession.state,status);assert.equal(status==='GRADING_ACTIVE'?c.rendered:c.pending,true);}
});

test('global navigation after a conflict leaves local session, ink, answers and time intact',async()=>{
  for(const state of ['PRACTICE_ACTIVE','GRADING_ACTIVE']){
    const session={state},ink=new Map([['q',[{id:'local'}]]]),answers=new Map([['q',{value:'typed'}]]),messages=[];
    const c=vm.createContext({SessionState,ROUTES:{MATH_GRADING:'/grading'},getCurrentRoute:()=>'/practice',currentSession:session,questionStrokesMap:ink,questionResponseRecordsMap:answers,
      persistCurrentGradingProgress:async()=>{},flushDraftSave:async()=>{throw Object.assign(new Error('conflict'),{code:'DRAFT_CONFLICT'})},console:{error(){}},alert:m=>messages.push(m)});
    vm.runInContext(extract('handleSafeLearningNavigation','if (typeof document'),c);
    await c.handleSafeLearningNavigation('/home');assert.equal(c.currentSession,session);assert.equal(ink.get('q')[0].id,'local');assert.equal(answers.get('q').value,'typed');assert.deepEqual(messages,['conflict']);
  }
});
