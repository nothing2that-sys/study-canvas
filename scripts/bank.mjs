import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const root=fileURLToPath(new URL('../',import.meta.url));
export const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
export function loadBank({subject='all',grade,skill}={}){
 if(!['all','korean','english','math'].includes(subject))throw Error('subject must be all, korean, english or math');
 if(grade!==undefined&&(!Number.isInteger(Number(grade))||Number(grade)<1||Number(grade)>6))throw Error('grade must be 1..6');
 const content=path.join(root,'app/content');
 const rows=[];
 for(const entry of readJson(path.join(content,'registry.json')).packages){
  if(!entry.enabled)continue;
  const manifestPath=path.resolve(content,entry.manifestPath);
  if(!manifestPath.startsWith(content+path.sep))throw Error('Manifest escaped content root');
  const manifest=readJson(manifestPath);
  const activitiesPath=path.resolve(path.dirname(manifestPath),manifest.files.activities);
  if(!activitiesPath.startsWith(content+path.sep))throw Error('Activities escaped content root');
  const data=readJson(activitiesPath);
  for(const activity of data.activities){
   if(subject!=='all'&&activity.subjectId!==subject)continue;
   if(grade!==undefined&&Number(activity.gradeLevel)!==Number(grade))continue;
   if(skill!==undefined&&activity.skillId!==skill)continue;
   rows.push(activity);
  }
 }
 return rows;
}
