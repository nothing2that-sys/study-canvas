import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('actual workbook bootstrap callback awaits the existing draft flush and propagates storage failures', async () => {
  const source=fs.readFileSync(new URL('../public/app/js/app.js',import.meta.url),'utf8');
  const flush=source.match(/export async function flushDraftSave\(\) \{[\s\S]*?\n\}/)?.[0];
  const binding=source.match(/initWorkbookView\(\{[\s\S]*?\}\);/)?.[0];
  assert.ok(flush && binding);
  let options, release, fail=false, calls=0;
  const context=vm.createContext({document:{},window:{},initWorkbookView:value=>options=value,
    draftCoordinator:{flush:()=>{calls++; return fail ? Promise.reject(new Error('storage failure')) : new Promise(resolve=>release=resolve);}}});
  vm.runInContext(flush.replace('export ','')+'\n'+binding,context);
  let completed=false;
  const pending=options.beforePageChange().then(()=>completed=true);
  await Promise.resolve();
  assert.equal(calls,1); assert.equal(completed,false);
  release(); await pending; assert.equal(completed,true);
  fail=true;
  await assert.rejects(options.beforePageChange(),/storage failure/);
  assert.equal(calls,2);
});
