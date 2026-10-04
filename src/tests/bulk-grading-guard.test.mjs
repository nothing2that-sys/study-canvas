import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {createSession,SessionState} from '../public/app/js/sessionEngine.js';
import {GradeDecision} from '../public/app/js/parentGrading.js';
const source=fs.readFileSync(new URL('../public/app/js/app.js',import.meta.url),'utf8');
const extract=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
function harness(){
  const dom=new JSDOM('<button id="all"></button><button id="finish"></button>');
  const calls={sound:0,draft:0,progress:0,render:0};
  const text=()=>({textContent:''});
  const context=vm.createContext({document:dom.window.document,SessionState,GradeDecision,currentSession:null,
    gradeAllCorrectBtn:dom.window.document.getElementById('all'),finishGradingBtn:dom.window.document.getElementById('finish'),
    gradedCountText:text(),gradedCorrectText:text(),gradedWrongText:text(),gradedRetryText:text(),gradingRemainingText:text(),gradingFinishHint:text(),
    gradingResultsMap:new Map([['q',{isCorrect:null,comment:'메모 보존'}]]),
    playCorrectSound(){calls.sound++;},triggerDraftSave(){calls.draft++;},persistCurrentGradingProgress(){calls.progress++;return Promise.resolve();},renderGradingView(){calls.render++;}});
  vm.runInContext(extract('function updateGradingStatusUI()','function handleGradeClick(')+extract('function handleGradeAllCorrect()','// 정답 보이기/숨기기'),context);
  return {context,calls,dom};
}
function pending(){
  const session=createSession({sessionId:'guard-test'},[{id:'q',operation:'mul',operandA:12,operandB:4,answer:48}]);
  session.start();session.startSubmitting();session.submitPractice(100);session.setPendingGrading();return session;
}
test('initial HTML disables bulk grading before any session restoration',()=>{
  const dom=new JSDOM(fs.readFileSync(new URL('../public/app/index.html',import.meta.url),'utf8'));
  try{const button=dom.window.document.getElementById('gradeAllCorrectBtn');assert.equal(button.disabled,true);assert.equal(button.getAttribute('aria-disabled'),'true');}finally{dom.window.close();}
});
test('pending and every non-grading state disable bulk grading and reject direct handler calls without effects',()=>{
  const {context:c,calls,dom}=harness();
  try{
    const real=pending();
    for(const session of [null,real,...Object.values(SessionState).filter(state=>state!==SessionState.GRADING_ACTIVE).map(state=>({state,getGradingStatus:()=>({total:1,graded:0,correct:0,wrong:0,retry:0,allGraded:false}),gradeQuestion(){assert.fail('Invalid state must not grade');}}))]){
      c.currentSession=session;c.gradeAllCorrectBtn.disabled=false;
      c.updateGradingStatusUI();assert.equal(c.gradeAllCorrectBtn.disabled,true);assert.equal(c.gradeAllCorrectBtn.getAttribute('aria-disabled'),'true');
      assert.doesNotThrow(()=>c.handleGradeAllCorrect());
    }
    assert.deepEqual(calls,{sound:0,draft:0,progress:0,render:0});
    assert.equal(real.state,SessionState.PARENT_GRADING_PENDING);assert.equal(real.getGradingStatus().graded,0);
    assert.equal(c.gradingResultsMap.get('q').comment,'메모 보존');
  }finally{dom.window.close();}
});
test('direct pending handler call cannot grade even if the UI button was enabled',()=>{
  const {context:c,calls,dom}=harness();
  try{
    c.currentSession=pending();c.gradeAllCorrectBtn.disabled=false;
    assert.doesNotThrow(()=>c.handleGradeAllCorrect());
    assert.equal(c.currentSession.getGradingStatus().graded,0);
    assert.deepEqual(calls,{sound:0,draft:0,progress:0,render:0});
  }finally{dom.window.close();}
});
test('starting grading enables bulk decision with notes; returning to pending disables it again',()=>{
  const {context:c,calls,dom}=harness();
  try{
    const session=pending();c.currentSession=session;c.updateGradingStatusUI();assert.equal(c.gradeAllCorrectBtn.disabled,true);
    session.startGrading();c.updateGradingStatusUI();assert.equal(c.gradeAllCorrectBtn.disabled,false);assert.equal(c.gradeAllCorrectBtn.getAttribute('aria-disabled'),'false');
    c.handleGradeAllCorrect();assert.equal(session.getGradingStatus().correct,1);assert.equal(c.gradingResultsMap.get('q').comment,'메모 보존');
    assert.deepEqual(calls,{sound:1,draft:1,progress:1,render:1});
    c.currentSession=pending();c.updateGradingStatusUI();assert.equal(c.gradeAllCorrectBtn.disabled,true);
  }finally{dom.window.close();}
});
