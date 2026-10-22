//+_+// F16D math-only selection. History is explicit, bounded and never shared between learners.
import { generateMathCandidate, rawSpace, stableJson, validateMathCandidate } from "./mathF16dGenerator.js";
import { hashSeed } from "./measurementUnitGenerator.js";
function random(seed) {
  let s = hashSeed(seed);
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function generateMathCandidates(generatorId, { seed = 1, count = 20, budget = count * 80 } = {}) {
  if (!Number.isInteger(count) || count < 1 || count > 100 || !Number.isInteger(budget) || budget < count || budget > 16000) throw new RangeError("Invalid bounded candidate budget");
  const rng = random(seed), capacity = rawSpace(generatorId), seen = new Set(), items = [];
  let invalid = 0; let duplicate = 0; let attempted = 0;
  //+_+// Small spaces enumerate once; large spaces are sampled without any unbounded retry.
  const limit = Math.min(capacity, budget);
  const indices = capacity <= budget ? Array.from({ length: capacity }, (_, i) => i) : Array.from({ length: limit }, () => Math.floor(rng() * capacity));
  for (const index of indices) {
    attempted++;
    const item = generateMathCandidate(generatorId, index);
    if (!item || !validateMathCandidate(item).valid) { invalid++; continue; }
    const fp = item.metadata.math.fingerprint;
    if (seen.has(fp)) { duplicate++; continue; }
    seen.add(fp); items.push(item);
    if (items.length >= count * 6) break;
  }
  return { items, metrics: { budget, attempted, validCandidates: items.length, invalid, duplicate, rawCapacity: capacity } };
}
export function exposureOf(item) {
  const m = item.metadata.math;
  return { fingerprint: m.fingerprint, operandKey: stableJson(m.operands), feature: stableJson(m.featureVector),
    representation: m.representationType, context: m.contextSemanticId, generatorId: m.generatorId };
}
export function selectMathCandidates(candidates, { learnerId, history = [], count = 20, weakFeatures = [], now = Date.now() } = {}) {
  if (typeof learnerId !== "string" || !learnerId || !Number.isInteger(count) || count < 1 || count > 100 || !Number.isFinite(now)) throw new Error("Explicit learner and bounded count required");
  const own = history.filter(s => s.learnerId === learnerId).sort((a, b) => b.startedAt - a.startedAt || b.sessionId.localeCompare(a.sessionId));
  const exact = new Set(own.slice(0, 5).flatMap(s => s.items.map(x => x.fingerprint)));
  const recent = own.flatMap(s => s.items).slice(0, 100);
  const lastFeature = new Map();
  for (const session of own) for (const x of session.items) if (!lastFeature.has(x.feature)) lastFeature.set(x.feature, session.startedAt);
  const used = new Set(), selected = [], seen = new Set();
  const valid = candidates.filter(item => {
    if (!validateMathCandidate(item).valid) return false;
    const key = item.metadata.math.fingerprint;
    if (seen.has(key)) return false; seen.add(key); return true;
  });
  const cached = new Map();
  for (const item of valid) {
    const e = exposureOf(item);
    const hits = key => recent.filter(x => x[key] === e[key]).length;
    const weak = weakFeatures.includes(e.feature) || weakFeatures.includes(item.metadata.math.featureVector.family);
    const last = lastFeature.get(e.feature);
    const boost = last === undefined ? 8 : Math.min(8, Math.max(0, (now - last) / 86400000));
    cached.set(item, { e, base: (weak ? 12 : 0) + boost - hits("operandKey") * 8 - hits("feature") * 2 - hits("representation") - hits("context") });
  }
  const local = { feature: new Map(), representation: new Map(), context: new Map() };
  function score(item) {
    const { e, base } = cached.get(item);
    return base - (local.feature.get(e.feature) || 0) * 4 - (local.representation.get(e.representation) || 0) * 3 - (local.context.get(e.context) || 0) * 3;
  }
  let exactRelaxed = 0;
  for (const relax of [false, true]) {
    while (selected.length < count) {
      const pool = valid.filter(x => !used.has(x.metadata.math.fingerprint) && (relax || !exact.has(x.metadata.math.fingerprint)));
      if (!pool.length) break;
      pool.sort((a, b) => score(b) - score(a) || a.metadata.math.fingerprint.localeCompare(b.metadata.math.fingerprint));
      const item = pool[0]; selected.push(item); used.add(item.metadata.math.fingerprint);
      const e = cached.get(item).e;
      for (const key of Object.keys(local)) local[key].set(e[key], (local[key].get(e[key]) || 0) + 1);
      if (exact.has(item.metadata.math.fingerprint)) exactRelaxed++;
    }
    if (selected.length === count) break;
  }
  return { activities: selected.map(x => structuredClone(x)), selection: { requested: count, selected: selected.length, exactRelaxed,
    shortage: count - selected.length, fallback: selected.length < count ? "SHORT_SESSION" : exactRelaxed ? "RELAX_RECENT_EXACT" : "NONE",
    recentOperandOverlap: selected.filter(x => recent.some(h => h.operandKey === exposureOf(x).operandKey)).length,
    historySessions: own.length, recentWindowItems: recent.length } };
}
