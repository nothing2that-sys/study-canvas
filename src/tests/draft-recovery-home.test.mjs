import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import 'fake-indexeddb/auto';
import {getDB,saveDraftSession,getDraftSession,clearAllData,setCurrentLearnerId,_setDraftCleanupFailureInjectorForTesting} from '../public/app/js/storage.js';
import {createLearner} from '../public/app/js/learners/learnerCommands.js';
import {getLearnerDashboard} from '../public/app/js/data/learningQueries.js';
import {initLearnerView,renderLearnerHomeView} from '../public/app/js/learners/learnerView.js';

async function fixture(state='GRADING_ACTIVE') {
  await clearAllData();
  const learner=await createLearner({name:'Recovery test'});
  const draft=await saveDraftSession({learnerId:learner.id,sessionId:'recovery-session',sessionState:state,
    sessionType:state==='GRADING_ACTIVE'?'grading':'practice',questions:[{id:'q1',operandA:2,operandB:3,operation:'mul',answer:6}],
    studentStrokesMap:{q1:[{points:[{x:1,y:2},{x:3,y:4}]}]}});
  return {learner,draft};
}

test('Every start-blocking Draft has a Home resume or recovery card, without modifying data',async()=>{
  for(const state of ['PRACTICE_ACTIVE','SUBMITTING','GRADING_ACTIVE','SESSION_COMPLETE','UNKNOWN_STATE']) {
    const {learner,draft}=await fixture(state);
    const dashboard=await getLearnerDashboard(learner.id);
    assert.equal(dashboard.actionCards.inProgress.length+dashboard.actionCards.recoveryDrafts.length,1,state);
    assert.deepEqual(await getDraftSession({learnerId:learner.id}),draft);
    if(state==='GRADING_ACTIVE') assert.equal(dashboard.actionCards.pendingGrading.length,0,'orphan must not masquerade as editable submission');
  }
});

async function withHome(fn) {
  const savedWindow=globalThis.window,savedDocument=globalThis.document;
  const dom=new JSDOM('<section id="learnerHomeView"><div id="homeActionCardsSection"></div></section>',{url:'https://local.test/home'});
  globalThis.window=dom.window;globalThis.document=dom.window.document;
  const alerts=[];window.alert=message=>alerts.push(message);window.confirm=()=>true;
  const {learner,draft}=await fixture();
  initLearnerView({documentRef:document,isSessionActive:()=>false});
  const tick=async()=>{for(let i=0;i<30;i++) await new Promise(r=>setImmediate(r));};
  try {await renderLearnerHomeView();await fn({learner,draft,alerts,tick});}
  finally {_setDraftCleanupFailureInjectorForTesting(null);dom.window.close();globalThis.window=savedWindow;globalThis.document=savedDocument;}
}

test('Home recovery discard requires confirmation and removes only the displayed version',async()=>withHome(async({learner,draft,tick})=>{
  assert.ok(document.querySelector('#draftRecoveryEntry'));
  window.confirm=()=>false;
  document.querySelector('#discardRecoveryDraftBtn').click();await tick();
  assert.deepEqual(await getDraftSession({learnerId:learner.id}),draft);
  window.confirm=()=>true;
  document.querySelector('#discardRecoveryDraftBtn').click();await tick();
  assert.equal(await getDraftSession({learnerId:learner.id}),null);
  assert.equal(document.querySelector('#draftRecoveryEntry'),null);
}));

test('A newer competing Draft survives a stale Home discard and is shown instead',async()=>withHome(async({learner,draft,alerts,tick})=>{
  const newer=await saveDraftSession({...draft,revision:draft.revision+1,studentStrokesMap:{q1:[{points:[{x:99,y:88}]}]}});
  document.querySelector('#discardRecoveryDraftBtn').click();await tick();
  assert.deepEqual(await getDraftSession({learnerId:learner.id}),newer);
  assert.ok(alerts.some(message=>message.includes('변경')));
  assert.ok(document.querySelector('#draftRecoveryEntry'));
}));

test('Failed discard retains data and a retry succeeds',async()=>withHome(async({learner,draft,alerts,tick})=>{
  _setDraftCleanupFailureInjectorForTesting(()=>{throw Error('injected failure');});
  document.querySelector('#discardRecoveryDraftBtn').click();await tick();
  assert.deepEqual(await getDraftSession({learnerId:learner.id}),draft);
  assert.equal(document.querySelector('#discardRecoveryDraftBtn').disabled,false);
  assert.ok(alerts.some(message=>message.includes('유지')));
  _setDraftCleanupFailureInjectorForTesting(null);
  document.querySelector('#discardRecoveryDraftBtn').click();await tick();
  assert.equal(await getDraftSession({learnerId:learner.id}),null);
}));

test('Learner switch and active session prevent stale Home deletion',async()=>withHome(async({learner,draft,tick})=>{
  initLearnerView({documentRef:document,isSessionActive:()=>true});
  document.querySelector('#discardRecoveryDraftBtn').click();await tick();
  assert.deepEqual(await getDraftSession({learnerId:learner.id}),draft);
  initLearnerView({documentRef:document,isSessionActive:()=>false});
  setCurrentLearnerId('other-learner');
  document.querySelector('#discardRecoveryDraftBtn').click();await tick();
  assert.deepEqual(await getDraftSession({learnerId:learner.id}),draft);
}));

async function putRawDraft(record) {
  const db=await getDB();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction('draftSessions','readwrite');tx.objectStore('draftSessions').put(record);
    tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
  });
}

test('Legacy orphan without version fields can be exported and explicitly discarded',async()=>withHome(async({learner,draft,tick})=>{
  const legacy={id:draft.id,learnerId:learner.id,questions:draft.questions,
    sessionState:'GRADING_ACTIVE',sessionType:'grading',studentStrokesMap:draft.studentStrokesMap};
  await putRawDraft(legacy);await renderLearnerHomeView();
  assert.ok(document.querySelector('#draftRecoveryEntry'));
  document.querySelector('#discardRecoveryDraftBtn').click();await tick();
  assert.equal(await getDraftSession({learnerId:learner.id}),null);
}));

test('Legacy concurrent change without version fields is protected by raw record comparison',async()=>withHome(async({learner,draft,tick,alerts})=>{
  const legacy={id:draft.id,learnerId:learner.id,questions:draft.questions,sessionState:'GRADING_ACTIVE',sessionType:'grading'};
  await putRawDraft(legacy);await renderLearnerHomeView();
  await putRawDraft({...legacy,studentStrokesMap:{q1:[{points:[{x:777,y:888}]}]}});
  document.querySelector('#discardRecoveryDraftBtn').click();await tick();
  assert.deepEqual((await getDraftSession({learnerId:learner.id})).studentStrokesMap,{q1:[{points:[{x:777,y:888}]}]});
  assert.ok(alerts.some(message=>message.includes('변경')));
}));
