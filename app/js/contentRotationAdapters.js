import {isUsableReviewedActivity,isUsableReviewedManifest} from './aiReviewPolicy.js';
//+_+// Existing approved v1 routes and explicit math preview feed one policy; no publication status is promoted.
import {selectEnglishActivities} from './englishActivitySelector.js';
import {selectKoreanActivities} from './koreanActivitySelector.js';
import {validateMathCandidate,stableJson} from './mathF16dGenerator.js';
import {getMathSpec} from './mathF16dSpec.js';
import {evaluateContentEligibility} from './contentEligibility.js';
import {createExposureRecord} from './exposureSelector.js';
async function fingerprint(value) {
  const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(stableJson(value)));
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function createLanguageRotationCandidates({subjectId,skillId,activities,manifest,seed}) {
  if(!['english','korean'].includes(subjectId)||manifest?.packageId!==`${subjectId}-ai-reviewed-v1`
    ||!isUsableReviewedManifest(manifest)||!manifest.subjects?.includes(subjectId)||!Array.isArray(activities)) {
    throw new Error('Approved existing v1 package and explicit language scope required');
  }
  const selector=subjectId==='english'?selectEnglishActivities:selectKoreanActivities;
  const source=activities.filter(item=>item?.subjectId===subjectId&&item.skillId===skillId
    &&isUsableReviewedActivity(item));
  return Promise.all(source.map(async item=>{
    const ref=item.contentRef;
    if(ref?.packageId!==manifest.packageId||ref.packageVersion!==manifest.packageVersion||ref.contentId!==item.id
      ||ref.contentVersion==null||(item.version!=null&&Number(ref.contentVersion)!==Number(item.version))) throw new Error('Exact content edition reference is required');
    const payload=selector({skillId,activities:[item],count:1,seed:`${seed}:${item.id}`})[0];
    return {activityId:item.id,fingerprint:await fingerprint([subjectId,payload.courseId,payload.prompt,payload.responseType,
      [...(payload.choices||[])].sort((a,b)=>String(a.id).localeCompare(String(b.id))),payload.expectedAnswer]),
      subjectId,courseId:item.courseId,editionId:stableJson(ref),skillId,eligible:true,reviewStatus:item.reviewStatus,
      sourceKey:item.metadata?.wordFamilyId||item.metadata?.ruleId||item.sourceMetadata?.sourceId||item.knowledgeRef,
      contextKey:item.metadata?.contextSemanticId||item.metadata?.contextSentenceId||undefined,
      eligibilityContent:structuredClone(item),curriculumVersion:manifest.curriculumVersion,payload};
  }));
}
//+_+// A visible default mixed session reuses the entire existing APPROVED bank; focused skills remain separate.
export async function createLanguageMixedRotationRequest({subjectId,learnerId,sessionId,activities,manifest,curriculum,seed,now=Date.now()}) {
  if(curriculum?.packageId!==manifest?.packageId||!Array.isArray(curriculum?.skills)||!curriculum.skills.length)
    throw new Error('Exact existing curriculum is required for mixed practice');
  const skills=curriculum.skills.map(skill=>skill.skillId);
  if(skills.some(id=>typeof id!=='string'||!id.trim())||new Set(skills).size!==skills.length)throw new Error('Invalid mixed curriculum skills');
  const candidates=(await Promise.all(skills.map(skillId=>createLanguageRotationCandidates({subjectId,skillId,activities,manifest,seed})))).flat();
  return {learnerId,sessionId,subjectId,courseId:`${subjectId}-core`,candidates,count:20,seed,now,
    config:{learnerId,sessionId,subjectId,courseId:`${subjectId}-core`,moduleId:`${subjectId}-core`,unitId:'mixed',
      stageId:'all',macroLevelId:'all',skillTitle:`${subjectId==='korean'?'국어':'영어'} 종합 학습`,problemCount:20,pageSize:4,mathFormat:'horizontal',
      rotationPolicy:{kind:'approved-core-mixed-v1',version:1,packageId:manifest.packageId,packageVersion:manifest.packageVersion}}};
}
export function createMathRotationCandidates(items,{preview=false}={}) {
  if(preview!==true||!Array.isArray(items))throw new Error('Explicit validated math preview required');
  return items.map(item=>{
    if(!validateMathCandidate(item).valid)throw new Error('Invalid generated math candidate');
    const m=item.metadata.math,spec=getMathSpec(m.generatorId);
    return {activityId:item.id,fingerprint:m.fingerprint,subjectId:'math',courseId:spec.courseId,
      editionId:`${m.generatorId}@${m.version}`,skillId:spec.skillId,eligible:true,reviewStatus:'VALIDATED',
      sourceKey:m.generatorId,featureKey:stableJson(m.featureVector),operandKey:stableJson(m.operands),
      contextKey:m.contextSemanticId,representationKey:m.representationType,payload:structuredClone(item)};
  });
}
export function filterRotationEligibility(candidates,profile) {
  return candidates.map(item=>{
    if(!item.payload||item.payload.id!==item.activityId||item.payload.subjectId!==item.subjectId
      ||item.payload.courseId!==item.courseId||item.payload.skillId!==item.skillId)throw new Error('Candidate payload identity mismatch');
    if(item.subjectId==='math') {
      if(!validateMathCandidate(item.payload).valid||item.payload.metadata.math.fingerprint!==item.fingerprint)throw new Error('Invalid math descriptor');
      return item;
    }
    if(!item.eligibilityContent||(!isUsableReviewedActivity(item.payload)||!isUsableReviewedActivity(item.eligibilityContent)))throw new Error('Approved language descriptor required');
    const content=item.eligibilityContent;
    //+_+// Grade-band-only v1 content retains its existing approved route; explicit grade metadata uses the SSOT gate.
    const eligible=profile.curriculumVersion===item.curriculumVersion&&evaluateContentEligibility({learner:profile,content,placement:profile.learningPlacements?.[item.subjectId],requestedMode:"NEW"}).eligible;
    return {...item,eligible:item.eligible===true&&eligible};
  });
}
export function adaptLegacyMathExposure(history,learnerId,courseId) {
  return history.flatMap(row=>{
    if(row.learnerId!==learnerId)return [];
    const items=row.items.filter(item=>getMathSpec(item.generatorId).courseId===courseId).map(item=>{
      const spec=getMathSpec(item.generatorId);
      return {activityId:item.fingerprint,fingerprint:item.fingerprint,subjectId:'math',courseId,
        editionId:'legacy-f16d',skillId:spec.skillId,sourceKey:item.generatorId,featureKey:item.feature,
        contextKey:item.context,operandKey:item.operandKey,representationKey:item.representation};
    });
    return items.length?[createExposureRecord({learnerId,subjectId:'math',courseId,sessionId:row.sessionId,startedAt:row.startedAt,items})]:[];
  });
}
