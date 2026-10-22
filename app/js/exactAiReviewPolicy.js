// Exact new-edition AI review. This is not a HUMAN signature or a legal guarantee.
export function stableReviewJson(value){
 if(Array.isArray(value))return '['+value.map(stableReviewJson).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>JSON.stringify(k)+':'+stableReviewJson(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
export function canonicalReviewedActivity(value,normalize){
 const a=normalize(value);
 if(a.choices)a.choices.sort((x,y)=>x.id.localeCompare(y.id));
 return stableReviewJson(a);
}
export function canonicalReviewedManifest(value){
 const {_manifestDir,...manifest}=value;return stableReviewJson(manifest);
}
const aiPackage=id=>['korean-ai-reviewed-v1','english-ai-reviewed-v1'].includes(id);
const key=a=>[a.contentRef?.packageId,a.contentRef?.packageVersion,a.id,a.version].join('|');
export function createExactAiReviewPolicy({activityBindings,manifestBindings},normalize){
 const activities=new Map(Object.entries(activityBindings)),manifests=new Map(Object.entries(manifestBindings));
 function isExactAiReviewedActivity(a){
  try{return aiPackage(a?.contentRef?.packageId)&&a.reviewStatus==='VERIFIED'&&a.sourceMetadata?.reviewStatus==='VERIFIED'
   &&a.metadata?.reviewKind==='AI_EVIDENCE_REVIEW_V1'&&a.metadata?.humanReviewed===false
   &&a.metadata?.publicationApproved===false&&activities.get(key(a))===canonicalReviewedActivity(a,normalize);}catch{return false;}
 }
 function isExactAiReviewedManifest(m){
  try{return aiPackage(m?.packageId)&&m.status==='VERIFIED'&&m.reviewKind==='AI_EVIDENCE_REVIEW_V1'
   &&m.humanApprovalGranted===false&&manifests.get(m.packageId+'|'+m.packageVersion)===canonicalReviewedManifest(m);}catch{return false;}
 }
 return Object.freeze({isExactAiReviewedActivity,isExactAiReviewedManifest,
  isUsableReviewedActivity:a=>aiPackage(a?.contentRef?.packageId)?isExactAiReviewedActivity(a):(a?.sourceMetadata?.reviewStatus||a?.reviewStatus)==='APPROVED',
  isUsableEligibilityActivity:a=>aiPackage(a?.contentRef?.packageId)?isExactAiReviewedActivity(a):(a?.reviewStatus||a?.sourceMetadata?.reviewStatus)==='APPROVED',
  isUsableReviewedManifest:m=>aiPackage(m?.packageId)?isExactAiReviewedManifest(m):m?.status==='APPROVED'});
}
