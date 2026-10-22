// Compact exact-edition bindings. Every check hashes the current canonical value.
// There is intentionally no object-identity cache that could accept later mutation.
import {canonicalReviewedActivity,canonicalReviewedManifest} from './exactAiReviewPolicy.js';
const K=new Uint32Array([
 0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
 0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
 0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
 0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
 0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
 0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
 0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
 0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
const encoder=new TextEncoder(),rotate=(v,n)=>(v>>>n)|(v<<(32-n));
export function reviewSha256(text){
 if(typeof text!=='string')throw new TypeError('Canonical review text required');
 const input=encoder.encode(text),size=Math.ceil((input.length+9)/64)*64,bytes=new Uint8Array(size);
 bytes.set(input);bytes[input.length]=0x80;
 const view=new DataView(bytes.buffer),bits=input.length*8;
 view.setUint32(size-8,Math.floor(bits/0x100000000));view.setUint32(size-4,bits>>>0);
 const hash=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
 const words=new Uint32Array(64);
 for(let offset=0;offset<size;offset+=64){
  for(let i=0;i<16;i++)words[i]=view.getUint32(offset+i*4);
  for(let i=16;i<64;i++){
   const x=words[i-15],y=words[i-2],s0=rotate(x,7)^rotate(x,18)^(x>>>3),s1=rotate(y,17)^rotate(y,19)^(y>>>10);
   words[i]=(words[i-16]+s0+words[i-7]+s1)>>>0;
  }
  let [a,b,c,d,e,f,g,h]=hash;
  for(let i=0;i<64;i++){
   const s1=rotate(e,6)^rotate(e,11)^rotate(e,25),ch=(e&f)^(~e&g),t1=(h+s1+ch+K[i]+words[i])>>>0;
   const s0=rotate(a,2)^rotate(a,13)^rotate(a,22),maj=(a&b)^(a&c)^(b&c),t2=(s0+maj)>>>0;
   h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
  }
  for(const [i,value] of [a,b,c,d,e,f,g,h].entries())hash[i]=(hash[i]+value)>>>0;
 }
 return Array.from(hash,x=>x.toString(16).padStart(8,'0')).join('');
}
export function createCompactExactAiReviewPolicy(data,normalize){
 if(data?.bindingAlgorithm!=='SHA256_CANONICAL_REVIEW_JSON_V1'||!data.activityBindings||!data.manifestBindings)throw Error('Explicit compact review binding format required');
 const makeMap=entries=>new Map(Object.entries(entries).map(([key,value])=>{
  if(!/^[a-f0-9]{64}$/.test(value))throw Error('Exact SHA256 review binding required');
  return [key,value];
 }));
 const activities=makeMap(data.activityBindings),manifests=makeMap(data.manifestBindings);
 const aiPackage=id=>['korean-ai-reviewed-v1','english-ai-reviewed-v1'].includes(id);
 function isExactAiReviewedActivity(a){
  try{
   if(!aiPackage(a?.contentRef?.packageId)||a.reviewStatus!=='VERIFIED'||a.sourceMetadata?.reviewStatus!=='VERIFIED'
    ||a.metadata?.reviewKind!=='AI_EVIDENCE_REVIEW_V1'||a.metadata?.humanReviewed!==false||a.metadata?.publicationApproved!==false)return false;
   const key=[a.contentRef.packageId,a.contentRef.packageVersion,a.id,a.version].join('|'),expected=activities.get(key);
   return expected!==undefined&&expected===reviewSha256(canonicalReviewedActivity(a,normalize));
  }catch{return false;}
 }
 function isExactAiReviewedManifest(m){
  try{
   if(!aiPackage(m?.packageId)||m.status!=='VERIFIED'||m.reviewKind!=='AI_EVIDENCE_REVIEW_V1'||m.humanApprovalGranted!==false)return false;
   const expected=manifests.get(m.packageId+'|'+m.packageVersion);
   return expected!==undefined&&expected===reviewSha256(canonicalReviewedManifest(m));
  }catch{return false;}
 }
 return Object.freeze({isExactAiReviewedActivity,isExactAiReviewedManifest,
  isUsableReviewedActivity:a=>aiPackage(a?.contentRef?.packageId)?isExactAiReviewedActivity(a):(a?.sourceMetadata?.reviewStatus||a?.reviewStatus)==='APPROVED',
  isUsableEligibilityActivity:a=>aiPackage(a?.contentRef?.packageId)?isExactAiReviewedActivity(a):(a?.reviewStatus||a?.sourceMetadata?.reviewStatus)==='APPROVED',
  isUsableReviewedManifest:m=>aiPackage(m?.packageId)?isExactAiReviewedManifest(m):m?.status==='APPROVED'});
}
