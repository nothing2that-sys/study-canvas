import {assertLanguageCandidateSelection} from './languageCandidateVisibility.js';
//+_+// Initial Draft and learner-owned exposure history commit together; schema8 and its12 stores remain unchanged.
import {getDB,DEFAULT_LEGACY_LEARNER_ID} from './storage.js';
import {normalizeDraft,getDraftVersion} from './draftEngine.js';
import {createSession} from './sessionEngine.js';
import {selectExposureAware,createExposureRecord} from './exposureSelector.js';
import {filterRotationEligibility} from './contentRotationAdapters.js';
export const ROTATION_HISTORY_LIMIT=100;
const scopeKey=(subjectId,courseId)=>JSON.stringify([subjectId,courseId]);
const draftKey=id=>id===DEFAULT_LEGACY_LEARNER_ID?'current_draft':`current_draft_${id}`;
let observer=null;
export function _setRotationTransactionObserverForTesting(fn){observer=fn;}
const failure=(code,message)=>Object.assign(new Error(message),{code});
export async function startRotationSession({learnerId,sessionId,subjectId,courseId,candidates,config={},
  count=20,seed=1,now=Date.now(),weakSkills=[],legacyHistory=[],appBuildId='unknown'}={}) {
  if(![learnerId,sessionId,subjectId,courseId].every(value=>typeof value==='string'&&value.trim())
    ||!Array.isArray(candidates)||!Array.isArray(legacyHistory)
    ||(config.learnerId&&config.learnerId!==learnerId)||(config.sessionId&&config.sessionId!==sessionId)
    ||(config.subjectId&&config.subjectId!==subjectId)||(config.courseId&&config.courseId!==courseId)
    ||config.reviewItemId||config.sessionType==='retry')throw new Error('Explicit consistent NEW session identity required');
  //+_+// Freeze asynchronous caller input before opening storage; IDB callbacks only perform synchronous work.
  candidates=structuredClone(candidates);config=structuredClone(config);legacyHistory=structuredClone(legacyHistory);weakSkills=structuredClone(weakSkills);
  const initializationStarted=performance.now();
  const db=await getDB();
  const timings={exposureInitializationMs:performance.now()-initializationStarted};
  if(db.isMemory)throw new Error('Native IndexedDB is required for atomic exposure/Draft storage');
  return new Promise((resolve,reject)=>{
    const queryStarted=performance.now();
    const tx=db.transaction(['learnerProfiles','draftSessions','submissions'],'readwrite');
    const profiles=tx.objectStore('learnerProfiles'),drafts=tx.objectStore('draftSessions');
    const reads=[profiles.get(learnerId),drafts.get(draftKey(learnerId)),tx.objectStore('submissions').index('sessionId').get(sessionId)];
    let pending=reads.length,result,error;
    reads.forEach(request=>{request.onsuccess=()=>{if(--pending)return;
      try {
        const [profile,existing,submitted]=reads.map(request=>request.result),key=scopeKey(subjectId,courseId);
        if(!profile||profile.archived)throw failure('LEARNER_UNAVAILABLE','학습자를 찾을 수 없거나 보관된 학습자입니다.');
        const exposure=profile.f16eExposure;
        if(exposure&&(exposure.schemaVersion!==1||!exposure.scopes||typeof exposure.scopes!=='object'||Array.isArray(exposure.scopes)))throw new Error('Invalid stored exposure schema');
        const history=exposure&&Object.hasOwn(exposure.scopes,key)?exposure.scopes[key]:(exposure?.legacyMathReset?[]:legacyHistory);
        if(!Array.isArray(history)||history.length>ROTATION_HISTORY_LIMIT||history.some(row=>row.learnerId!==learnerId||row.subjectId!==subjectId||row.courseId!==courseId))throw new Error('Exposure history scope mismatch');
        const acknowledged=history.find(row=>row.sessionId===sessionId);
        if(submitted)throw failure('SESSION_ALREADY_SUBMITTED','이미 제출된 학습입니다. 저장된 제출 기록을 여세요.');
        if(existing?.questions?.length&&existing.sessionState!=='SESSION_COMPLETE'){
          if(existing.sessionId!==sessionId||!acknowledged)throw failure('DRAFT_EXISTS','진행 중인 풀이가 있습니다. 홈에서 이어풀기를 완료하세요.');
          if(existing.subjectId!==subjectId||existing.courseId!==courseId)throw new Error('Saved Draft scope mismatch');
          result={draft:normalizeDraft(existing),activities:structuredClone(existing.questions),selection:structuredClone(existing.config.f16e.selection),reused:true};return;
        }
        if(acknowledged)throw failure('SESSION_ALREADY_STARTED','이미 시작된 학습 ID입니다. 새 학습 ID를 사용하세요.');
        timings.exposureQueryMs=performance.now()-queryStarted;
        const selectionStarted=performance.now();
        const mixed=config.rotationPolicy?.kind==='approved-core-mixed-v1';
        if(mixed&&(count!==20||!['english','korean'].includes(subjectId)||courseId!==`${subjectId}-core`))throw new Error('Invalid default mixed session scope');
        const selected=selectExposureAware({candidates:filterRotationEligibility(candidates,profile),learnerId,subjectId,courseId,history,count,seed,now,weakSkills,balanceSkills:mixed});
        timings.selectionMaterializationMs=performance.now()-selectionStarted;
        if(!selected.items.length)throw failure('NO_ELIGIBLE_CONTENT','학습 가능한 승인된 문제가 없습니다.');
        if(mixed&&(selected.items.length!==20||selected.metrics.recentExactRepeatCount!==0))
          throw failure('ROTATION_CAPACITY','최근에 풀지 않은 승인된 문제가 부족합니다. 유형별 집중 학습을 선택해 주세요.');
        assertLanguageCandidateSelection({subjectId,count,items:selected.items});
        const activities=selected.items.map(item=>item.payload);
        const effectiveConfig={...config,learnerId,sessionId,subjectId,courseId,problemCount:activities.length,
          ...(config.mathGeneration?{mathGeneration:{...config.mathGeneration,selection:selected.metrics,timings:{...timings}}}:{}),
          f16e:{version:1,selection:selected.metrics,timings:{...timings}}};
        const session=createSession(effectiveConfig,activities);session.start();
        const draft={...normalizeDraft({learnerId,sessionId,config:effectiveConfig,questions:activities,appBuildId,sessionState:'PRACTICE_ACTIVE',totalElapsedMs:0}),
          id:draftKey(learnerId),updatedAt:now,writeId:globalThis.crypto.randomUUID(),
          //+_+// Transient raw Draft metadata is dropped by normal autosave after rendering succeeds.
          f16eStartRollback:{hadRoot:!!exposure,hadScope:!!exposure&&Object.hasOwn(exposure.scopes,key),
            evicted:structuredClone(history.slice(0,Math.max(0,history.length+1-ROTATION_HISTORY_LIMIT)))}};
        const record=createExposureRecord({learnerId,sessionId,subjectId,courseId,startedAt:now,items:selected.items});
        const updated=[...history,record].sort((a,b)=>a.startedAt-b.startedAt||a.sessionId.localeCompare(b.sessionId)).slice(-ROTATION_HISTORY_LIMIT);
        const nextProfile={...profile,f16eExposure:{...exposure,schemaVersion:1,scopes:{...(exposure?.scopes||{}),[key]:updated}}};
        const profileWrite=profiles.put(nextProfile),draftWrite=drafts.put(draft);
        result={draft,activities,selection:selected.metrics,session,reused:false};
        observer?.({tx,profileWrite,draftWrite,learnerId,sessionId});
      }catch(e){error=e;tx.abort();}
    };});
    tx.oncomplete=()=>resolve({...result,timings:{...timings,transactionMs:performance.now()-queryStarted}});
    tx.onabort=tx.onerror=()=>reject(error||tx.error||new Error('노출 및 초기 풀이 저장이 중단되었습니다.'));
  });
}
export async function rollbackRotationStart({learnerId,expectedVersion}){
  const db=await getDB();
  if(!learnerId||!expectedVersion||db.isMemory)throw new Error('Exact native Draft identity required');
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['learnerProfiles','draftSessions'],'readwrite'),profiles=tx.objectStore('learnerProfiles'),drafts=tx.objectStore('draftSessions');
    const requests=[profiles.get(learnerId),drafts.get(draftKey(learnerId))];let pending=2,removed=false;
    requests.forEach(request=>{request.onsuccess=()=>{if(--pending)return;
      const [profile,draft]=requests.map(request=>request.result),actual=getDraftVersion(draft);
      if(!actual||!['sessionId','revision','updatedAt','writeId'].every(key=>actual[key]===expectedVersion[key]))return;
      const key=scopeKey(draft.subjectId,draft.courseId),history=profile?.f16eExposure?.scopes?.[key];
      const rollback=draft.f16eStartRollback;
      if(!rollback||!Array.isArray(history)||!history.some(row=>row.sessionId===draft.sessionId))return;
      const scopes={...profile.f16eExposure.scopes};
      if(!rollback.hadScope)delete scopes[key];
      else scopes[key]=[...rollback.evicted,...history.filter(row=>row.sessionId!==draft.sessionId)];
      const nextProfile={...profile};
      if(!rollback.hadRoot&&Object.keys(scopes).length===0)delete nextProfile.f16eExposure;
      else nextProfile.f16eExposure={...profile.f16eExposure,scopes};
      profiles.put(nextProfile);
      drafts.delete(draftKey(learnerId));removed=true;
    };});
    tx.oncomplete=()=>resolve(removed);tx.onabort=tx.onerror=()=>reject(tx.error||new Error('Start rollback aborted'));
  });
}
