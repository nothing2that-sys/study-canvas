import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';
import {loadBank,root,readJson} from '../scripts/bank.mjs';import {exportBank} from '../scripts/export-bank.mjs';import {scanPrivacy} from '../scripts/privacy-check.mjs';import {build} from '../scripts/build.mjs';
import {normalizeLearningActivity} from '../app/js/learningActivity.js';import {isExactAiReviewedActivity} from '../app/js/aiReviewPolicy.js';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('final bank has all three subjects, unique IDs and exact retained content/source bytes',()=>{
 const all=loadBank();assert.equal(all.length,6567);assert.equal(new Set(all.map(a=>a.id)).size,all.length);
 for(const [subject,count] of [['korean',5247],['english',1287],['math',33]])assert.equal(loadBank({subject}).length,count);
 for(const row of readJson(path.join(root,'content-snapshot.json')).files.filter(r=>r.path.startsWith('app/content/')||['app/review/items.json','app/review/source-evidence.json','app/review/source-bank-evidence.json','app/review/WORDNET-LICENSE.txt'].includes(r.path)))assert.equal(sha(fs.readFileSync(path.join(root,row.path))),row.sha256,row.path);
 assert.throws(()=>loadBank({subject:'unknown'}));assert.throws(()=>loadBank({grade:0}));
});
test('all language questions retain exact AI review bindings and reject altered answers or fake human approval',()=>{
 for(const subject of ['korean','english']){
  const rows=loadBank({subject});
  for(const row of rows){const a=normalizeLearningActivity(row);assert.ok(isExactAiReviewedActivity(a),row.id);assert.equal(a.metadata.humanReviewed,false);assert.equal(a.metadata.publicationApproved,false);assert.ok(row.sourceMetadata?.license);}
  const mutated=normalizeLearningActivity(structuredClone(rows[0]));mutated.prompt+=' altered';assert.equal(isExactAiReviewedActivity(mutated),false);
  const fake=normalizeLearningActivity(structuredClone(rows[0]));fake.metadata.humanReviewed=true;assert.equal(isExactAiReviewedActivity(fake),false);
 }
});
test('JSONL and filtered JSON exports preserve entire records, hash, notices and prevent overwrites',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'study-canvas-export-'));
 try{
  const out=path.join(temp,'english/questions.jsonl'),manifest=exportBank({subject:'english',out});
  const bytes=fs.readFileSync(out),rows=bytes.toString('utf8').trim().split('\n').map(s=>JSON.parse(s));
  assert.equal(rows.length,1287);assert.deepEqual(rows,loadBank({subject:'english'}));assert.equal(manifest.sha256,sha(bytes));
  for(const f of ['CODE-LICENSE.txt','DATA-LICENSES.md','WordNet-3.0.txt','SOURCE-NOTICES.txt','export-manifest.json'])assert.ok(fs.existsSync(path.join(path.dirname(out),f)));
  assert.equal(sha(fs.readFileSync(path.join(temp,'english/WordNet-3.0.txt'))),sha(fs.readFileSync(path.join(root,'LICENSES/WordNet-3.0.txt'))));
  assert.throws(()=>exportBank({subject:'english',out}));
  assert.throws(()=>exportBank({subject:'english',out:path.join(temp,'collision/export-manifest.json')}));
  const filtered=path.join(temp,'grade/questions.json');exportBank({subject:'korean',grade:6,format:'json',out:filtered});
  assert.deepEqual(readJson(filtered).activities,loadBank({subject:'korean',grade:6}));
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('privacy scan passes curated source and detects credential-shaped or private backup fixture files',()=>{
 assert.deepEqual(scanPrivacy(root),[]);
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'study-canvas-privacy-'));
 try{fs.writeFileSync(path.join(temp,'learner-backup.json'),'{}');fs.writeFileSync(path.join(temp,'.env'),'KEY='+'gh'+'p_'+'x'.repeat(30));const issues=scanPrivacy(temp);assert.ok(issues.some(i=>i.kind==='credential'));assert.ok(issues.some(i=>i.kind==='environment-file'));assert.ok(issues.some(i=>i.kind==='private-record-file'));}
 finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('repeat builds match, all precache files exist, and new cache/module IDs agree without changing bank bytes',()=>{
 const first=build(),manifest=fs.readFileSync(path.join(first.dist,'build-manifest.json')),second=build();
 assert.equal(first.buildId,second.buildId);assert.deepEqual(fs.readFileSync(path.join(second.dist,'build-manifest.json')),manifest);
 const sw=fs.readFileSync(path.join(second.dist,'service-worker.js'),'utf8');assert.ok(sw.includes('math-canvas-pro-v'+second.buildId));
 for(const match of sw.matchAll(/"(\.\/[^"\n]+)"/g)){const u=new URL(match[1],'https://example.invalid/');assert.ok(fs.existsSync(path.join(second.dist,decodeURIComponent(u.pathname.slice(1)))),match[1]);}
 const html=fs.readFileSync(path.join(second.dist,'index.html'),'utf8');const map=JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
 for(const ref of Object.values(map.imports)){assert.ok(ref.endsWith('?v='+second.buildId));assert.ok(fs.existsSync(path.join(second.dist,ref.slice(2).split('?')[0])));}
 for(const subject of ['korean','english']){const rel='content/packages/'+subject+'-ai-reviewed-v1/activities.json';assert.equal(sha(fs.readFileSync(path.join(root,'app',rel))),sha(fs.readFileSync(path.join(second.dist,rel))));}
 assert.ok(!fs.readFileSync(path.join(second.dist,'build-manifest.json'),'utf8').includes('gitSha'));
});
