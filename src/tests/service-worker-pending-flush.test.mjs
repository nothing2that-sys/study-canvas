import test from 'node:test';
import assert from 'node:assert/strict';
import {createUpdateCoordinator} from '../public/app/js/updateEngine.js';
import {createDraftSaveCoordinator} from '../public/app/js/draftEngine.js';

test('SW update waits for both an in-flight Draft save and its queued flush before activation', async () => {
  const saves=[],posts=[];let reloads=0,resolveController;
  const draft=createDraftSaveCoordinator({captureSnapshot:()=>({sessionId:'pending-sw',questions:[{id:'q'}]}),
    save:()=>new Promise(resolve=>saves.push(resolve))});
  const inFlight=draft.flush();
  await new Promise(resolve=>setImmediate(resolve));
  const update=createUpdateCoordinator({flush:()=>draft.flush(),getController:()=>({id:'A'}),
    waitForControllerChange:()=>new Promise(resolve=>resolveController=resolve),reload:()=>reloads++});
  const applied=update.apply({postMessage:m=>posts.push(m)});
  assert.equal(update.isUpdating,true);
  assert.equal(posts.length,0);
  saves.shift()();await inFlight;
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(saves.length,1);
  assert.equal(posts.length,0);
  assert.equal(reloads,0);
  saves.shift()();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(posts,[{type:'SKIP_WAITING'}]);
  assert.equal(reloads,0);
  resolveController({id:'B'});await applied;
  assert.equal(reloads,1);
  assert.equal(update.isUpdating,false);
});

test('failed real Draft flush blocks SW activation and a later retry saves before activation', async () => {
  let fail=true,reloads=0,commits=0,waits=0;const posts=[];
  const draft=createDraftSaveCoordinator({captureSnapshot:()=>({sessionId:'failed-sw',questions:[{id:'q'}]}),save:async()=>{
    if(fail)throw new Error('storage unavailable');commits++;
  }});
  const update=createUpdateCoordinator({flush:()=>draft.flush(),getController:()=>({id:'A'}),
    waitForControllerChange:async()=>{waits++;return {id:'B'};},reload:()=>reloads++});
  const worker={postMessage:m=>{assert.equal(commits,1);posts.push(m);}};
  await assert.rejects(update.apply(worker),/storage unavailable/);
  assert.equal(posts.length,0);assert.equal(waits,0);assert.equal(reloads,0);assert.equal(update.isUpdating,false);
  fail=false;await update.apply(worker);
  assert.equal(posts.length,1);assert.equal(waits,1);assert.equal(reloads,1);
});
