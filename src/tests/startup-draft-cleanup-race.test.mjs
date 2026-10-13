import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import 'fake-indexeddb/auto';
import {saveDraftSession,getDraftSession,clearDraftSession} from '../public/app/js/storage.js';
import {submitLearningSession} from '../public/app/js/data/learningCommands.js';
import {getDraftVersion} from '../public/app/js/draftEngine.js';
import {evaluateStartupDraftResumePolicy} from '../public/app/js/submissionLifecycle.js';
const source=fs.readFileSync(new URL('../public/app/js/app.js',import.meta.url),'utf8');
const start=source.indexOf('async function checkDraftResumeOnStartup()');
const code=source.slice(start,source.indexOf('//+_+// PWA 업데이트',start));
for(const kind of ['different-session','same-session-newer'])test(`startup cleanup preserves ${kind} written while submission query is pending`,async()=>{
  const learnerId='startup-race-'+kind,questions=[{id:'startup-q',answer:4}];
  const base=await saveDraftSession({learnerId,sessionId:'submitted',questions,revision:1});let newer;
  const context=vm.createContext({document:{querySelector:()=>null},getDraft:()=>getDraftSession({learnerId}),getSubmissionBySessionId:async()=>{
    newer=await saveDraftSession({...base,sessionId:kind==='different-session'?'new-session':base.sessionId,revision:2,studentStrokesMap:{'startup-q':[{id:'new-ink',points:[{x:4,y:8}]}]}});
    return {sessionId:base.sessionId,status:'PARENT_GRADING_PENDING'};
  },evaluateStartupDraftResumePolicy,clearDraft:o=>clearDraftSession({learnerId,...o}),console,alert:m=>assert.fail(m)});
  vm.runInContext(code,context);await context.checkDraftResumeOnStartup();assert.deepEqual(await getDraftSession({learnerId}),newer);
});
test('startup cleanup deletes the unchanged acknowledged practice Draft',async()=>{
  const learnerId='startup-clean-original',base=await saveDraftSession({learnerId,sessionId:'submitted-original',questions:[{id:'q'}],revision:1});
  const context=vm.createContext({document:{querySelector:()=>null},getDraft:()=>getDraftSession({learnerId}),getSubmissionBySessionId:async()=>({sessionId:base.sessionId,status:'PARENT_GRADING_PENDING'}),evaluateStartupDraftResumePolicy,clearDraft:o=>clearDraftSession({learnerId,...o}),console,alert:m=>assert.fail(m)});
  vm.runInContext(code,context);await context.checkDraftResumeOnStartup();assert.equal(await getDraftSession({learnerId}),null);
});
test('startup cleanup stays with the captured learner when active learner changes during submission query',async()=>{
  const learnerId='startup-learner-A',otherLearnerId='startup-learner-B';let active=learnerId;
  const base=await saveDraftSession({learnerId,sessionId:'submitted-A',questions:[{id:'q-A'}],revision:1});
  const other=await saveDraftSession({learnerId:otherLearnerId,sessionId:'practice-B',questions:[{id:'q-B'}],studentStrokesMap:{'q-B':[{id:'B-ink'}]},revision:7});
  const context=vm.createContext({document:{querySelector:()=>null},getDraft:()=>getDraftSession({learnerId:active}),getSubmissionBySessionId:async()=>{active=otherLearnerId;return {sessionId:base.sessionId,status:'PARENT_GRADING_PENDING'};},evaluateStartupDraftResumePolicy,clearDraft:o=>clearDraftSession({learnerId:active,...o}),console,alert:m=>assert.fail(m)});
  vm.runInContext(code,context);await context.checkDraftResumeOnStartup();assert.deepEqual(await getDraftSession({learnerId:otherLearnerId}),other);assert.equal(await getDraftSession({learnerId}),null);
});
for(const hadDraft of [true,false])test(`startup retains post-commit same-session ink with ${hadDraft?'an older':'no'} acknowledged Draft`,async()=>{
  const learnerId='startup-post-commit-'+hadDraft,sessionId='post-commit-'+hadDraft,questions=[{id:'post-q',answer:4}];
  const base=hadDraft?await saveDraftSession({learnerId,sessionId,questions,revision:1}):null;
  const submission=await submitLearningSession({learnerId,sessionId,questions,expectedDraftVersion:getDraftVersion(base)});
  const newer=await saveDraftSession({learnerId,sessionId,questions,revision:2,studentStrokesMap:{'post-q':[{id:'after-commit-ink',points:[{x:8,y:9}]}]}});
  const duplicate=await submitLearningSession({learnerId,sessionId,questions});
  assert.equal(duplicate.id,submission.id);assert.deepEqual(await getDraftSession({learnerId}),newer);
  const context=vm.createContext({document:{querySelector:()=>null},getDraft:()=>getDraftSession({learnerId}),getSubmissionBySessionId:async()=>submission,evaluateStartupDraftResumePolicy,clearDraft:o=>clearDraftSession({learnerId,...o}),console,alert:m=>assert.fail(m)});
  vm.runInContext(code,context);await context.checkDraftResumeOnStartup();assert.deepEqual(await getDraftSession({learnerId}),newer);
});
