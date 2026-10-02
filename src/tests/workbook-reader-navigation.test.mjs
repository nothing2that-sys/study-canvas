import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import 'fake-indexeddb/auto';
import {createLearner} from '../public/app/js/learners/learnerCommands.js';
import {clearAllData,closeDB,getDB,getWorkbookAssignments,getWorkbookAssignment,saveWorkbookAssignment} from '../public/app/js/storage.js';
import {createWorkbookAssignment} from '../public/app/js/workbookEngine.js';
import {getWorkbookCatalog} from '../public/app/js/workbookCatalog.js';
import {initRouter,navigate,_resetRouterForTesting,ROUTES} from '../public/app/js/platform/appRouter.js';
import * as view from '../public/app/js/workbookView.js';

const key='math_canvas_workbook_selection';
let dom,learner,assignment,book,alerts,flush;
test.beforeEach(async()=>{
  await clearAllData({allLearners:true}); _resetRouterForTesting();
  learner=await createLearner({name:'Reader regression',schoolGrade:4});
  book=getWorkbookCatalog().find(x=>x.definition.title==='4학년 영단어 복습장');
  assert.ok(book); assert.equal(book.edition.pages.length,3);
  assignment=await saveWorkbookAssignment(createWorkbookAssignment({learnerId:learner.id,workbookId:book.definition.workbookId,editionVersion:book.edition.editionVersion}));
  dom=new JSDOM('<div id="workbookReaderContent"></div><div id="workbookPageNavigator"></div><div id="workbookDetailContent"></div>',{url:'https://test.invalid/workbooks/reader'});
  Object.defineProperty(dom.window,'innerWidth',{value:1200});
  alerts=[]; dom.window.alert=m=>alerts.push(m); flush=async()=>{};
  initRouter({initialPath:ROUTES.WORKBOOK_READER,windowRef:dom.window});
  view.initWorkbookView({documentRef:dom.window.document,windowRef:dom.window,beforePageChange:()=>flush()});
  dom.window.localStorage.setItem(key,JSON.stringify({assignmentId:assignment.assignmentId,workbookId:assignment.workbookId,pageIndex:0}));
  await view.renderWorkbookReaderView();
});
test.afterEach(async()=>{dom?.window.close();await clearAllData({allLearners:true});await closeDB();});
const select=()=>dom.window.document.querySelector('#workbookPageSelect');
const click=id=>dom.window.document.querySelector(id).click();
const stored=()=>JSON.parse(dom.window.localStorage.getItem(key));
async function settle(predicate) {
  for(let i=0;i<100;i++) {if(predicate()) return;await new Promise(r=>setTimeout(r,5));}
  assert.ok(predicate(),'reader event did not complete');
}
async function check(index) {
  assert.equal(select().value,String(index)); assert.equal(stored().pageIndex,index);
  assert.equal((await getWorkbookAssignment(assignment.assignmentId,{learnerId:learner.id})).lastPageId,book.edition.pages[index].pageId);
}
async function change(index) {select().value=String(index);select().dispatchEvent(new dom.window.Event('change'));await settle(()=>select().value===String(index)&&stored().pageIndex===index);}

test('real next/previous handlers keep destination, two-page spread and stored page synchronized',async()=>{
  click('#workbookNextPageBtn'); await settle(()=>select().value==='1'); await check(1);
  assert.deepEqual([...dom.window.document.querySelectorAll('.workbook-page')].map(x=>x.dataset.pageId),book.edition.pages.slice(1).map(x=>x.pageId));
  click('#workbookPrevPageBtn'); await settle(()=>select().value==='0'); await check(0);
  await change(2); await check(2); assert.equal(dom.window.document.querySelector('#workbookNextPageBtn').disabled,true);
  click('#workbookPrevPageBtn'); await settle(()=>select().value==='1'); await check(1);
  assert.equal(alerts.length,0);
});
test('dropdown, contents, continue and a fresh reader module preserve destination selection',async()=>{
  await change(2); await check(2);
  click('#workbookReaderExitBtn'); await settle(()=>dom.window.location.pathname===ROUTES.WORKBOOK_DETAIL);
  await view.renderWorkbookDetailView();
  click('[data-page-index="1"]'); await settle(()=>dom.window.location.pathname===ROUTES.WORKBOOK_READER);
  await view.renderWorkbookReaderView(); await check(1);
  const reload=await import(`../public/app/js/workbookView.js?readerReload=${Date.now()}`);
  reload.initWorkbookView({documentRef:dom.window.document,windowRef:dom.window,beforePageChange:()=>flush()});
  await reload.renderWorkbookReaderView();await check(1);
  await reload.renderWorkbookDetailView();click('#workbookContinueBtn');await reload.renderWorkbookReaderView();await check(1);
});
test('bookmark remains on its own page after moving and re-entering another page',async()=>{
  await change(1);const oldButton=dom.window.document.querySelector('#workbookBookmarkBtn');click('#workbookBookmarkBtn');
  await settle(()=>oldButton!==dom.window.document.querySelector('#workbookBookmarkBtn')||alerts.length>0);
  assert.equal(alerts.length,0);
  await change(2);await view.renderWorkbookReaderView();await check(2);
  assert.equal((await getWorkbookAssignment(assignment.assignmentId,{learnerId:learner.id})).bookmarkPageId,book.edition.pages[1].pageId);
});
test('draft flush must complete before movement; failure preserves page, assignment and selection',async()=>{
  let release;flush=()=>new Promise(r=>release=r);
  click('#workbookNextPageBtn');await settle(()=>typeof release==='function');
  assert.equal(select().value,'0');assert.equal(stored().pageIndex,0);
  release();await settle(()=>select().value==='1');await check(1);
  const before=await getWorkbookAssignment(assignment.assignmentId,{learnerId:learner.id});
  flush=async()=>{throw new Error('storage unavailable');};
  select().value='2';select().dispatchEvent(new dom.window.Event('change'));await settle(()=>alerts.length===1);
  assert.equal(select().value,'1');assert.equal(stored().pageIndex,1);
  assert.deepEqual(await getWorkbookAssignment(assignment.assignmentId,{learnerId:learner.id}),before);
});
test('another learner selection cannot restore the previous learner page index',async()=>{
  await change(2);
  const other=await createLearner({name:'Other reader',schoolGrade:4});
  const owned=await saveWorkbookAssignment(createWorkbookAssignment({learnerId:other.id,workbookId:book.definition.workbookId,editionVersion:book.edition.editionVersion,lastPageId:book.edition.pages[0].pageId}));
  await view.renderWorkbookReaderView();
  assert.equal(select().value,'0');assert.equal(stored().assignmentId,owned.assignmentId);
  assert.equal((await getWorkbookAssignments({learnerId:learner.id})).some(x=>x.assignmentId===assignment.assignmentId),true);
});
test('assignment write failure leaves destination uncommitted and blocks contents navigation',async()=>{
  await change(1);const before=await getWorkbookAssignment(assignment.assignmentId,{learnerId:learner.id});
  const db=await getDB();assert.notEqual(db.isMemory,true);
  const original=db.transaction;
  db.transaction=function(names,mode,...rest) {
    if(names==='workbookAssignments' && mode==='readwrite') throw new Error('forced assignment write failure');
    return original.call(this,names,mode,...rest);
  };
  try {
    click('#workbookNextPageBtn');await settle(()=>alerts.length===1);
    assert.equal(select().value,'1');assert.equal(stored().pageIndex,1);
    assert.deepEqual(await getWorkbookAssignment(assignment.assignmentId,{learnerId:learner.id}),before);
    navigate(ROUTES.WORKBOOK_DETAIL);await view.renderWorkbookDetailView();
    click('[data-page-index="2"]');await settle(()=>alerts.length===2);
    assert.equal(stored().pageIndex,1);assert.equal(dom.window.location.pathname,ROUTES.WORKBOOK_DETAIL);
    assert.deepEqual(await getWorkbookAssignment(assignment.assignmentId,{learnerId:learner.id}),before);
  } finally {db.transaction=original;}
});
