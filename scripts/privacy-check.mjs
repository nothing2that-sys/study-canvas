import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {root} from './bank.mjs';
export function scanPrivacy(base=root){
 const findings=[],ignored=new Set(['.git','node_modules','dist','exports','backups']);
 const personal=new RegExp('\\b(?:'+[['jh','lim'].join(''),['muzik','1014'].join('')].join('|')+')\\b','i');
 const patterns=[['credential',/(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{24,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/],['personal-local-path',/[A-Z]:[\\/](?:Users|personal|envy)|\/Users\/[^/]+\//i],['private-identity',personal]];
 function visit(dir,rel=''){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(ignored.has(entry.name))continue;const r=rel?rel+'/'+entry.name:entry.name,p=path.join(dir,entry.name);
  if(entry.isSymbolicLink()){findings.push({path:r,kind:'symlink'});continue;}
  if(entry.isDirectory()){visit(p,r);continue;}
  if(/^\.env(?:\.|$)/.test(entry.name)&&entry.name!=='.env.example')findings.push({path:r,kind:'environment-file'});
  if(/(?:learner-backup|student-backup|auth\.json|hosts\.yml)/i.test(entry.name))findings.push({path:r,kind:'private-record-file'});
  const text=fs.readFileSync(p).toString('utf8');for(const [kind,re] of patterns)if(re.test(text))findings.push({path:r,kind});
 }}visit(base);return findings;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const findings=scanPrivacy();console.log(JSON.stringify({status:findings.length?'FAIL':'PASS',scope:'Working source, excluding generated/local ignored directories and Git metadata; heuristic scan plus curated inclusion',findings},null,2));if(findings.length)process.exitCode=1;
}
