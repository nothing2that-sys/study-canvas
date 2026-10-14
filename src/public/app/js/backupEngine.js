//+_+// All-learner snapshots and atomic restore; optional schema metadata extends legacy format1.0.
import {getDB,DB_VERSION,DEFAULT_LEGACY_LEARNER_ID} from './storage.js';
import {normalizeWorkbookAssignment} from './workbookEngine.js';
import {normalizeVocabularyMemoryState} from './englishVocabularyStudy.js';
import {createExposureRecord} from './exposureSelector.js';
export const BACKUP_FORMAT_VERSION='1.0';
const stores={sessions:'id',attempts:'id',mistakes:'key',stageProgress:'stageKey',strokes:'sessionId_questionId',draftSessions:'id',learnerProfiles:'id',submissions:'id',progressAggregates:'id',reviewItems:'id',workbookAssignments:'assignmentId',vocabularyMemoryStates:'id'};
const field=name=>name==='draftSessions'?'drafts':name;
const countNames={sessions:'sessionCount',attempts:'attemptCount',mistakes:'mistakeCount',stageProgress:'stageProgressCount',strokes:'strokeCount',draftSessions:'draftCount',learnerProfiles:'learnerProfileCount',submissions:'submissionCount',progressAggregates:'progressAggregateCount',reviewItems:'reviewItemCount',workbookAssignments:'workbookAssignmentCount',vocabularyMemoryStates:'vocabularyMemoryStateCount'};
let observer=null;
export function _setBackupTransactionObserverForTesting(fn){observer=fn;}
const canonical=value=>value&&typeof value==='object'?Array.isArray(value)?`[${value.map(canonical)}]`:`{${Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')}}`:JSON.stringify(value);
function snapshotPayload(data){
  const now=Date.now();
  return {appName:'Math Canvas Pro',formatVersion:BACKUP_FORMAT_VERSION,storageSchemaVersion:DB_VERSION,scope:'all-learners',exportedAt:now,exportedAtISO:new Date(now).toISOString(),metadata:Object.fromEntries(Object.keys(stores).map(name=>[countNames[name],data[field(name)].length])),data};
}
export async function exportAllData(){
  const db=await getDB();
  if(db.isMemory)return snapshotPayload(Object.fromEntries(Object.keys(stores).map(name=>[field(name),structuredClone([...db[name].values()])])));
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(Object.keys(stores),'readonly'),data={};
    for(const name of Object.keys(stores)){const req=tx.objectStore(name).getAll();req.onsuccess=()=>data[field(name)]=req.result;}
    tx.oncomplete=()=>resolve(snapshotPayload(data));tx.onabort=tx.onerror=()=>reject(tx.error||new Error('백업 읽기가 중단되었습니다.'));
  });
}
function prepare(backup){
  if(!backup||typeof backup!=='object')throw new Error('올바른 JSON 데이터가 아닙니다.');
  if(backup.formatVersion!==BACKUP_FORMAT_VERSION)throw new Error(`지원하지 않는 백업 버전입니다: ${backup.formatVersion||'알 수 없음'}`);
  if(!backup.data||typeof backup.data!=='object'||Array.isArray(backup.data))throw new Error('백업 data 객체가 누락되었습니다.');
  const full=Object.hasOwn(backup,'storageSchemaVersion');
  if(full&&(backup.storageSchemaVersion!==DB_VERSION||backup.scope!=='all-learners'))throw new Error('지원하지 않는 저장소 schema/scope입니다.');
  const data={};
  for(const name of Object.keys(stores)){
    const rows=backup.data[field(name)];if(rows===undefined&&!full)continue;
    if(!Array.isArray(rows))throw new Error(`백업 ${field(name)} 배열이 누락되거나 올바르지 않습니다.`);
    data[name]=structuredClone(rows).map(row=>{
      if(!row||typeof row!=='object'||Array.isArray(row))throw new Error(`잘못된 ${name} 레코드입니다.`);
      if(name==='workbookAssignments')try{if(normalizeWorkbookAssignment(row).assignmentId!==row.assignmentId)throw new Error('Assignment ID mismatch');}catch(e){throw new Error(`문제집 Assignment 데이터가 올바르지 않습니다: ${e.message}`);}
      if(name==='vocabularyMemoryStates')try{if(normalizeVocabularyMemoryState(row).id!==row.id)throw new Error('Vocabulary owner/key mismatch');}catch(e){throw new Error(`영단어 기억 상태 데이터가 올바르지 않습니다: ${e.message}`);}
      if(name==='draftSessions'){
        const expected=!row.learnerId||row.learnerId===DEFAULT_LEGACY_LEARNER_ID?'current_draft':`current_draft_${row.learnerId}`;
        if(full&&row.id!==expected)throw new Error('Draft learner/key 소유권이 일치하지 않습니다.');
        return {...row,id:expected};
      }
      if(name==='strokes'&&!row.sessionId_questionId&&row.key)return row.strokes?.sessionId_questionId?structuredClone(row.strokes):{...row,sessionId_questionId:row.key};
      return row;
    });
    const keys=new Set();
    for(const row of data[name]){
      const key=row[stores[name]];
      if(typeof key!=='string'||!key.trim())throw new Error(`잘못된 ${name} 저장 키입니다.`);
      if(keys.has(key))throw new Error(name==='vocabularyMemoryStates'?'중복된 영단어 기억 상태 ID가 있습니다.':`중복된 ${name} ID가 있습니다.`);
      keys.add(key);
      if(name==='learnerProfiles'&&row.f16eExposure){
        const history=row.f16eExposure;
        if(history.schemaVersion!==1||!history.scopes||typeof history.scopes!=='object'||Array.isArray(history.scopes))throw new Error('Invalid exposure backup schema');
        for(const [scope,sessions] of Object.entries(history.scopes)){
          if(!Array.isArray(sessions)||sessions.length>100)throw new Error('Invalid exposure backup retention');
          const ids=new Set();for(const session of sessions){createExposureRecord(session);
            if(session.learnerId!==row.id||scope!==JSON.stringify([session.subjectId,session.courseId])||ids.has(session.sessionId))throw new Error('Exposure backup scope mismatch');ids.add(session.sessionId);}
        }
      }
    }
  }
  return data;
}
export function validateBackupData(backup){
  try{
    const data=prepare(backup),preview=Object.fromEntries(Object.keys(stores).map(name=>[countNames[name],data[name]?.length||0]));
    const times=(data.sessions||[]).map(row=>row.completedAt||row.startedAt).filter(Number.isFinite);
    const oldest=times.reduce((min,time)=>Math.min(min,time),Infinity),newest=times.reduce((max,time)=>Math.max(max,time),-Infinity);
    return {isValid:true,error:null,preview:{...preview,formatVersion:backup.formatVersion,exportedAt:backup.exportedAt?new Date(backup.exportedAt).toLocaleString('ko-KR'):'알 수 없음',dateRange:times.length?`${new Date(oldest).toLocaleDateString('ko-KR')} ~ ${new Date(newest).toLocaleDateString('ko-KR')}`:'기록 없음'}};
  }catch(error){return {isValid:false,error:error.message};}
}
export async function importBackupData(backup,options={mode:'replace'}){
  const data=prepare(backup),names=Object.keys(data),mode=options.mode==='merge'?'merge':'replace',db=await getDB();
  const result={success:true,mode,...Object.fromEntries(names.map(name=>['imported'+({draftSessions:'Drafts'}[name]||name[0].toUpperCase()+name.slice(1)),data[name].length]))};
  function checkMerge(name,existing){
    const byKey=new Map(existing.map(row=>[row[stores[name]],row]));
    for(const row of data[name])if(byKey.has(row[stores[name]])&&canonical(byKey.get(row[stores[name]]))!==canonical(row))throw Object.assign(new Error(`백업 병합 충돌: ${name}/${row[stores[name]]}. 기존 기록을 보존했습니다.`),{code:'BACKUP_MERGE_CONFLICT'});
  }
  if(!names.length)return result;
  if(db.isMemory){
    if(mode==='merge')for(const name of names)checkMerge(name,[...db[name].values()]);
    for(const name of names){if(mode==='replace')db[name].clear();for(const row of data[name])db[name].set(row[stores[name]],row);}return result;
  }
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(names,'readwrite');let error;
    const write=()=>{try{const writes=[];for(const name of names){const store=tx.objectStore(name);if(mode==='replace')store.clear();for(const row of data[name])writes.push(store.put(row));}observer?.({tx,writes});}catch(e){error=e;tx.abort();}};
    if(mode==='merge'){
      let pending=names.length;for(const name of names){const req=tx.objectStore(name).getAll();req.onsuccess=()=>{try{checkMerge(name,req.result);if(--pending===0)write();}catch(e){error=e;tx.abort();}};}
    }else write();
    tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(error||tx.error||new Error('백업 복원이 중단되었습니다. 기존 데이터는 보존됩니다.'));
  });
}
