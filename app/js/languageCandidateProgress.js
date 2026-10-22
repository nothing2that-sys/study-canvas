// History remains intact; only the displayed current skill coverage is scoped.
export function currentEditionSkillProgress(aggregates,skillIds){
 const allowed=new Set(skillIds),seen=new Set(aggregates.map(a=>a.levelId).filter(id=>allowed.has(id)));
 return {totalSkills:allowed.size,attemptedSkills:seen.size,learningSkills:seen.size,unstartedSkills:allowed.size-seen.size};
}
