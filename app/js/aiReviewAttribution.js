const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(url,label)=>/^https:\/\//.test(url??'')?`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>`:escape(label);
export function renderAiReviewAttribution(activity){
 if(activity?.metadata?.reviewKind!=='AI_EVIDENCE_REVIEW_V1')return '';
 const source=activity.metadata.sourceConditions;
 const label=source?`${source.author} · ${source.sourceTitle}`:(activity.metadata.authoringLabel||'Study Canvas · 프로젝트 작성 문항');
 const reference=source?link(source.sourceUri,label):escape(label)+(activity.metadata.sourceUri?.startsWith('https:')?' · '+link(activity.metadata.sourceUri,'규칙 참고'):'' );
 const license=source?' · '+link(source.licenseUrl,source.licenseName||'CC BY-SA 2.0 KR')+' · '+escape(source.changes||'사전 뜻풀이를 인용하고 질문·보호자 채점 기준 구성'):'';
 return `<div class="ai-review-source" style="font-size:.82rem;line-height:1.5;padding:.6rem;color:#48555c;overflow-wrap:anywhere">출처: ${reference}${license}</div>`;
}
export function renderAiReviewedSurface(activity,rendered){
 if(activity?.metadata?.reviewKind!=='AI_EVIDENCE_REVIEW_V1')return rendered;
 return '<div class="ai-reviewed-surface" style="display:block;width:100%;min-width:0">'+rendered+renderAiReviewAttribution(activity)+'</div>';
}
