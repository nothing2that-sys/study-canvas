import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';import {loadBank,root} from './bank.mjs';
export function exportBank({subject='all',grade,skill,format='jsonl',out}={}){
 if(!out)throw Error('--out is required');if(!['json','jsonl'].includes(format))throw Error('format must be json or jsonl');
 const output=path.resolve(out),destination=path.dirname(output);
 if(['CODE-LICENSE.txt','DATA-LICENSES.md','WordNet-3.0.txt','SOURCE-NOTICES.txt','export-manifest.json'].includes(path.basename(output)))throw Error('Output filename is reserved for export notices');
 // Each export lives in a new directory so its records and notices stay together.
 if(fs.existsSync(destination))throw Error('Use a new export directory; existing exports will not be overwritten');
 const rows=loadBank({subject,grade,skill});if(!rows.length)throw Error('No matching questions');
 fs.mkdirSync(destination,{recursive:true});
 const bytes=format==='json'?JSON.stringify({schemaVersion:1,activities:rows},null,2)+'\n':rows.map(r=>JSON.stringify(r)).join('\n')+'\n';
 fs.writeFileSync(output,bytes,{flag:'wx'});
 fs.copyFileSync(path.join(root,'LICENSE'),path.join(destination,'CODE-LICENSE.txt'));
 fs.copyFileSync(path.join(root,'LICENSES/README.md'),path.join(destination,'DATA-LICENSES.md'));
 fs.copyFileSync(path.join(root,'LICENSES/WordNet-3.0.txt'),path.join(destination,'WordNet-3.0.txt'));
 fs.copyFileSync(path.join(root,'app/review/NOTICES.txt'),path.join(destination,'SOURCE-NOTICES.txt'));
 const manifest={schemaVersion:1,subject,grade:grade??null,skill:skill??null,format,count:rows.length,file:path.basename(output),sha256:crypto.createHash('sha256').update(bytes).digest('hex'),licensePolicy:'PER_ITEM_NOTICES; preserve full sourceMetadata, metadata, gradingReference and third-party license files',humanApprovalGranted:false};
 fs.writeFileSync(path.join(destination,'export-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const options={},allowed=new Set(['subject','grade','skill','format','out']);
  for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i].slice(2);if(!process.argv[i].startsWith('--')||!allowed.has(key)||!process.argv[i+1])throw Error('Use --subject/--grade/--skill/--format/--out value pairs');options[key]=process.argv[i+1];}
  console.log(JSON.stringify(exportBank(options),null,2));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
