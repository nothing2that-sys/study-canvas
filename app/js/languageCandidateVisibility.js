import {isUsableReviewedManifest} from './aiReviewPolicy.js';
// Pure helpers for the isolated candidate only. No authority or approval changes.
export function languageCandidateAvailability({manifest,activities,learner,skillId=null,evaluate}){
 const pending=!isUsableReviewedManifest(manifest);
 const eligibleCount=!pending&&learner&&Array.isArray(activities)
  ?activities.filter(a=>(!skillId||a.skillId===skillId)&&a.gradeLevel!=null&&evaluate({learner,content:a,placement:learner.learningPlacements?.[a.subjectId],requestedMode:'NEW'}).eligible).length:0;
 return {pending,eligibleCount,canStart:!pending&&eligibleCount>=20,showSkill:pending||eligibleCount>=20};
}
export function assertLanguageCandidateSelection({subjectId,count,items}){
 if(['korean','english'].includes(subjectId)&&(count!==20||items.length!==20)){
  throw Object.assign(new Error('현재 허용 범위에 서로 다른 언어 문항 20개가 준비되어야 학습을 시작할 수 있습니다.'),{code:'LANGUAGE_CAPACITY'});
 }
}
