import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { saveDraftSession, getDraftSession, getDB, saveSubmissionSnapshot, _setSubmissionTransactionObserverForTesting } from '../public/app/js/storage.js';
import { createDraftSaveCoordinator } from '../public/app/js/draftEngine.js';
import { createSession } from '../public/app/js/sessionEngine.js';
import { submitLearningSession, startSubmissionGrading, finalizeSubmissionGrading } from '../public/app/js/data/learningCommands.js';

const questions = [{ id:'q:12:4', key:'mul:12:4', operation:'mul', operandA:12, operandB:4, answer:48, expectedAnswer:48 }];
const version = d => d && ({ sessionId:d.sessionId, revision:d.revision, updatedAt:d.updatedAt, writeId:d.writeId || null });
const draft = (learnerId, sessionId='same', extra={}) => ({ learnerId, sessionId, questions, config:{ pageSize:1 }, revision:5, ...extra });

test('same-session stale BASE cannot overwrite ink, even after repeated higher-revision retries', async () => {
  const learnerId='cas-stale';
  const base=await saveDraftSession(draft(learnerId));
  const a=await saveDraftSession(draft(learnerId,'same',{revision:6,studentStrokesMap:{[questions[0].id]:[{id:'A'}]}}),{expectedBaseVersion:version(base),protectExisting:true});
  for (const revision of [6,7,100]) await assert.rejects(saveDraftSession(draft(learnerId,'same',{revision,studentStrokesMap:{[questions[0].id]:[{id:'B'}]}}),{expectedBaseVersion:version(base),protectExisting:true}), e=>e.code==='DRAFT_CONFLICT');
  assert.deepEqual(await getDraftSession({learnerId}),a);
});

test('two writers with the same BASE have exactly one winner; missing and recreated records conflict', async () => {
  const learnerId='cas-parallel',base=await saveDraftSession(draft(learnerId));
  const results=await Promise.allSettled(['A','B'].map(id=>saveDraftSession(draft(learnerId,'same',{revision:6,responseRecords:{},studentStrokesMap:{[questions[0].id]:[{id}]}}),{expectedBaseVersion:version(base)})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const db=await getDB();await new Promise((resolve,reject)=>{const tx=db.transaction('draftSessions','readwrite');tx.objectStore('draftSessions').delete('current_draft_'+learnerId);tx.oncomplete=resolve;tx.onerror=reject;});
  await assert.rejects(saveDraftSession(draft(learnerId),{expectedBaseVersion:version(base)}),e=>e.code==='DRAFT_CONFLICT');
  await saveDraftSession(draft(learnerId),{expectedBaseVersion:null});
  await assert.rejects(saveDraftSession(draft(learnerId),{expectedBaseVersion:null}),e=>e.code==='DRAFT_CONFLICT');
});

test('coordinator keeps stale local ink/time and conflict status through retry, while winner can save serially', async () => {
  const learnerId='cas-coordinators',base=await saveDraftSession(draft(learnerId));
  const localA=draft(learnerId,'same',{totalElapsedMs:100,studentStrokesMap:{[questions[0].id]:[{id:'A'}]}});
  const localB=draft(learnerId,'same',{totalElapsedMs:200,studentStrokesMap:{[questions[0].id]:[{id:'B'}]}});
  const make=local=>createDraftSaveCoordinator({captureSnapshot:()=>local,save:(d,o)=>saveDraftSession(d,o),requireBaseVersion:true,initialBaseVersion:version(base),initialRevision:5});
  const a=make(localA),b=make(localB);await a.flush();
  await assert.rejects(b.flush(),e=>e.code==='DRAFT_CONFLICT');assert.equal(b.status,'conflict');
  await assert.rejects(b.retry(),e=>e.code==='DRAFT_CONFLICT');assert.equal(b.status,'conflict');
  assert.equal(localB.totalElapsedMs,200);assert.equal(localB.studentStrokesMap[questions[0].id][0].id,'B');
  await Promise.all([a.flush(),a.flush()]);assert.equal(a.status,'saved');
  assert.deepEqual(a.baseVersion,version(await getDraftSession({learnerId})));
});

test('completed duplicate submission restores completed lifecycle without rewriting snapshot or review state', async () => {
  const learnerId='cas-completed',session=createSession({learnerId,sessionId:'completed'},questions);session.start();
  const sub=await submitLearningSession({session,learnerId});await startSubmissionGrading(sub.id,{learnerId});
  const completed=await finalizeSubmissionGrading(sub.id,{learnerId,gradingResults:{[questions[0].id]:{decision:'CORRECT',comment:'saved'}},gradingStrokesMap:{[questions[0].id]:[{id:'red'}]}});
  const stale=createSession({learnerId,sessionId:'completed'},questions);stale.start();
  const result=await submitLearningSession({session:stale,learnerId});assert.equal(stale.state,'SESSION_COMPLETE');assert.equal(result.status,'GRADED');
  const persisted=await saveSubmissionSnapshot({sessionId:'completed',learnerId,questions});assert.deepEqual(persisted,completed.submission);
});

test('submit cleanup preserves a different session or newer same-session BASE', async () => {
  for(const otherSession of ['other','cleanup']){
    const learnerId='cas-cleanup-'+otherSession,base=await saveDraftSession(draft(learnerId,'cleanup'));
    const newer=await saveDraftSession(draft(learnerId,otherSession,{revision:6,totalElapsedMs:321}));
    const session=createSession({learnerId,sessionId:'cleanup'},questions);session.start();
    const result=await submitLearningSession({session,learnerId,expectedDraftVersion:version(base)});
    assert.equal(result.draftCleaned,false);assert.deepEqual(await getDraftSession({learnerId}),newer);
  }
});

test('submit commit interleaving cannot delete the Draft written by another writer', async () => {
  const learnerId='cas-commit-window',base=await saveDraftSession(draft(learnerId,'commit-window'));
  let write;
  _setSubmissionTransactionObserverForTesting(event=>{if(event==='add-success') write=saveDraftSession(draft(learnerId,'next-session',{revision:9,totalElapsedMs:777}));});
  try {
    const session=createSession({learnerId,sessionId:'commit-window'},questions);session.start();
    await submitLearningSession({session,learnerId,expectedDraftVersion:version(base)});
    await write;const remaining=await getDraftSession({learnerId});assert.equal(remaining.sessionId,'next-session');assert.equal(remaining.totalElapsedMs,777);
  } finally { _setSubmissionTransactionObserverForTesting(null); }
});

test('legacy Draft without writeId can be read and conditionally saved without changing student data', async () => {
  const learnerId='cas-legacy',db=await getDB(),legacy={...draft(learnerId),id:'current_draft_'+learnerId,updatedAt:123,totalElapsedMs:432,studentStrokesMap:{[questions[0].id]:[{id:'legacy'}]}};
  await new Promise((resolve,reject)=>{const tx=db.transaction('draftSessions','readwrite');tx.objectStore('draftSessions').put(legacy);tx.oncomplete=resolve;tx.onerror=reject;});
  const read=await getDraftSession({learnerId});assert.equal(read.writeId,null);
  const saved=await saveDraftSession(read,{expectedBaseVersion:version(read)});assert.ok(saved.writeId);assert.deepEqual(saved.studentStrokesMap,legacy.studentStrokesMap);assert.equal(saved.totalElapsedMs,432);
});
