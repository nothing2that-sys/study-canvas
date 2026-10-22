import {isExactAiReviewedActivity} from './aiReviewPolicy.js';
//+_+// F16E pure selection kernel. Callers supply verified eligibility; this module grants no approval or placement.
const required = ['activityId', 'fingerprint', 'subjectId', 'courseId', 'editionId', 'skillId'];
const dimensions = ['sourceKey', 'contextKey', 'operandKey', 'featureKey', 'representationKey'];
const nonblank = value => typeof value === 'string' && value.trim().length > 0;
const identity = item => JSON.stringify([item.subjectId, item.courseId, item.editionId, item.activityId]);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function descriptor(item) {
  if (!item || required.some(key => !nonblank(item[key]))
    || dimensions.some(key => item[key] != null && !nonblank(item[key]))) {
    throw new TypeError('Complete immutable identity and string dimension descriptor required');
  }
  return item;
}
function scope(learnerId, subjectId, courseId) {
  if (![learnerId, subjectId, courseId].every(nonblank)
    || !['english', 'korean', 'math'].includes(subjectId)) throw new TypeError('Explicit learner/subject/course scope required');
}
function hash(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619) >>> 0;
  return h;
}
const increment = (map, key) => { if (key) map.set(key, (map.get(key) || 0) + 1); };

//+_+// Exposure records contain selection metadata only, never answers, strokes or approval decisions.
export function createExposureRecord({ learnerId, sessionId, subjectId, courseId, startedAt, items } = {}) {
  scope(learnerId, subjectId, courseId);
  if (!nonblank(sessionId) || !Number.isFinite(startedAt) || !Array.isArray(items)
    || items.length < 1 || items.length > 100) throw new TypeError('Valid nonempty bounded session history required');
  const ids = new Set(), fingerprints = new Set();
  const exposures = items.map(item => {
    descriptor(item);
    if (item.subjectId !== subjectId || item.courseId !== courseId
      || ids.has(identity(item)) || fingerprints.has(item.fingerprint)) throw new Error('Duplicate or wrong-scope exposure descriptor');
    ids.add(identity(item)); fingerprints.add(item.fingerprint);
    return Object.fromEntries([...required, ...dimensions].filter(key => item[key] != null).map(key => [key, item[key]]));
  });
  return { learnerId, sessionId, subjectId, courseId, startedAt, items: exposures };
}

export function selectExposureAware({ candidates, learnerId, subjectId, courseId, history = [],
  count = 20, seed = 1, now, weakSkills = [], mode = 'new', balanceSkills = false } = {}) {
  scope(learnerId, subjectId, courseId);
  if (mode !== 'new') throw new Error('Retry must reuse its saved original snapshot, never reselect');
  if (!Number.isFinite(now)) throw new TypeError('Explicit finite selection time required');
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new RangeError('Bounded session count 1..100 required');
  if (!Array.isArray(candidates) || !Array.isArray(history) || !Array.isArray(weakSkills)
    || weakSkills.some(key => !nonblank(key))
    || !(typeof seed === 'string' || (typeof seed === 'number' && Number.isFinite(seed)))) throw new TypeError('Invalid selection input');

  //+_+// Ignore foreign scopes before inspecting their private items; validate every applicable session.
  const own = history.filter(row => row?.learnerId === learnerId && row.subjectId === subjectId && row.courseId === courseId);
  const sessions = new Set();
  for (const row of own) {
    if (sessions.has(row.sessionId)) throw new Error('Duplicate session history identity');
    if (row.startedAt > now) throw new Error('Future session history is invalid');
    createExposureRecord(row); sessions.add(row.sessionId);
  }
  own.sort((a, b) => b.startedAt - a.startedAt || compare(b.sessionId, a.sessionId));
  const retained = own.slice(0, 100);
  const latest = retained.flatMap(row => row.items).slice(0, 100);
  const counts = Object.fromEntries(dimensions.map(key => [key, new Map()]));
  for (const item of latest) for (const key of dimensions) increment(counts[key], item[key]);
  const coverage = new Map(), lastSource = new Map();
  for (const row of retained) for (const item of row.items) {
    increment(coverage, item.sourceKey);
    if (item.sourceKey && !lastSource.has(item.sourceKey)) lastSource.set(item.sourceKey, row.startedAt);
  }
  let ineligibleRejected = 0, duplicatesRejected = 0;
  const identities = new Map(), fingerprints = new Map();
  for (const item of candidates) {
    if (!item || item.subjectId !== subjectId || item.courseId !== courseId || item.eligible !== true
      || !((item.reviewStatus === 'APPROVED' && !['korean-ai-reviewed-v1','english-ai-reviewed-v1'].includes(item.payload?.contentRef?.packageId)) || (item.reviewStatus === 'VERIFIED' && isExactAiReviewedActivity(item.payload)) || (subjectId === 'math' && item.reviewStatus === 'VALIDATED'))) {
      ineligibleRejected++; continue;
    }
    descriptor(item);
    const key = identity(item), serialized = stable(item);
    if (identities.has(key)) {
      if (identities.get(key) !== serialized) throw new Error(`Conflicting candidate identity: ${key}`);
      duplicatesRejected++; continue;
    }
    identities.set(key, serialized);
    const prior = fingerprints.get(item.fingerprint);
    if (prior) {
      duplicatesRejected++;
      if (compare(key, identity(prior)) < 0) fingerprints.set(item.fingerprint, item);
    } else fingerprints.set(item.fingerprint, item);
  }
  const valid = [...fingerprints.values()];
  function exclusions(window) {
    const ids = new Set(), fps = new Set();
    for (const row of retained.slice(0, window)) for (const item of row.items) { ids.add(identity(item)); fps.add(item.fingerprint); }
    return { ids, fps };
  }
  const original = exclusions(5);
  let exactWindow = 5, contextWindow = 3;
  function allowed() {
    const excluded = exclusions(exactWindow);
    const contexts = new Set(retained.slice(0, contextWindow).flatMap(row => row.items.map(item => item.contextKey).filter(Boolean)));
    return valid.filter(item => !excluded.ids.has(identity(item)) && !excluded.fps.has(item.fingerprint)
      && (!item.contextKey || !contexts.has(item.contextKey)));
  }
  let pool = allowed();
  //+_+// First relax old context exclusions, then old exact exclusions; never relax eligibility or same-session uniqueness.
  while (pool.length < count && contextWindow > 0) { contextWindow--; pool = allowed(); }
  while (pool.length < count && exactWindow > 0) { exactWindow--; pool = allowed(); }
  const penalties = {sourceKey: 4, contextKey: 4, operandKey: 8, featureKey: 2, representationKey: 1};
  const localPenalties = {sourceKey: 6, contextKey: 6, operandKey: 8, featureKey: 4, representationKey: 2};
  const local = Object.fromEntries(dimensions.map(key => [key, new Map()]));
  const weak = new Set(weakSkills);
  const ranked = pool.map(item => {
    const seenAt = lastSource.get(item.sourceKey);
    let base = (weak.has(item.skillId) ? 20 : 0) + (item.sourceKey ? 12 / (1 + (coverage.get(item.sourceKey) || 0)) : 0)
      + (seenAt === undefined ? 8 : Math.min(8, Math.max(0, (now - seenAt) / 86400000)));
    for (const key of dimensions) if (item[key]) base -= penalties[key] * (counts[key].get(item[key]) || 0);
    const id = identity(item);
    return { item, base, id, tie: hash(JSON.stringify([seed, id])) };
  });
  const used = new Set(), selected = [], skillCounts = new Map(); let rankEvaluations = 0;
  while (selected.length < count && selected.length < ranked.length) {
    let best, bestScore;
    // Mixed practice covers each available eligible skill before allocating its next question.
    let minimumSkillCount=Infinity;
    if(balanceSkills)for(const entry of ranked)if(!used.has(entry.id))minimumSkillCount=Math.min(minimumSkillCount,skillCounts.get(entry.item.skillId)||0);
    for (const entry of ranked) {
      if (used.has(entry.id)) continue;
      if(balanceSkills&&(skillCounts.get(entry.item.skillId)||0)!==minimumSkillCount)continue;
      rankEvaluations++;
      let score = entry.base;
      for (const key of dimensions) if (entry.item[key]) score -= localPenalties[key] * (local[key].get(entry.item[key]) || 0);
      if (!best || score > bestScore || (score === bestScore && (entry.tie < best.tie
        || (entry.tie === best.tie && compare(entry.id, best.id) < 0)))) { best = entry; bestScore = score; }
    }
    used.add(best.id); selected.push(best.item);
    increment(skillCounts,best.item.skillId);
    for (const key of dimensions) increment(local[key], best.item[key]);
  }
  const repeated = selected.filter(item => original.ids.has(identity(item)) || original.fps.has(item.fingerprint)).length;
  return { items: structuredClone(selected), metrics: { requested: count, selected: selected.length,
    shortage: count - selected.length, uniqueCandidates: valid.length, ineligibleRejected, duplicatesRejected,
    historySessions: retained.length, recentWindowItems: latest.length, exactWindow, contextWindow,
    recentExactRepeatCount: repeated, recentExactRepeatRate: selected.length ? repeated / selected.length : 0,
    fallback: selected.length < count ? 'SHORT_SESSION' : exactWindow < 5 ? 'RELAX_RECENT_EXACT'
      : contextWindow < 3 ? 'RELAX_RECENT_CONTEXT' : 'NONE', rankEvaluations,
    ...(balanceSkills?{skillCounts:Object.fromEntries(skillCounts),balancedSkills:true}:{}) } };
}
