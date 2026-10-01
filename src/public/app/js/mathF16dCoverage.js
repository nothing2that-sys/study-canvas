//+_+// Exact count proofs match parametersAt/validateParameters. No random samples enter supply counts.
import { MATH_SPECS, MATH_SOURCE, UNIT_PAIRS, F19_GATES } from "./mathF16dSpec.js";
import { FRACTION_POOL, rawSpace, parametersAt, validateParameters } from "./mathF16dGenerator.js";
const choose2 = n => n * (n - 1) / 2;
const choose3 = n => n * (n - 1) * (n - 2) / 6;
const choose4 = n => n * (n - 1) * (n - 2) * (n - 3) / 24;
export function countMathSpec(spec) {
  const raw = rawSpace(spec); let valid = raw, canonical = raw, effective = raw, proof;
  if (spec.domain === "multiplication" && spec.task === "compare_products") {
    valid = canonical = effective = choose4(90) + choose3(90);
    proof = "two canonical factor pairs from 10..99: raw C(91,2)^2; a<c<=d<b; four distinct factors C(90,4), repeated middle factor C(90,3). Each item calculates two products then answers <,=,>; factor swaps and side reversal excluded; no shared factor or componentwise domination";
  } else if (spec.domain === "multiplication") {
    canonical = ["multiply", "equation", "estimate"].includes(spec.task) ? raw - choose2(98) : raw;
    effective = spec.task === "equation" ? 0 : canonical;
    proof = "998×98; symmetric multiply/equation/estimate subtract C(98,2); equation contributes 0 because it repeats multiply response task";
  } else if (spec.domain === "division") {
    valid = 0;
    for (let i = 0; i < raw; i++) if (validateParameters(spec, parametersAt(spec, i))) valid++;
    canonical = valid; effective = spec.task === "missing_quotient" ? 0 : valid;
    proof = "bounded enumeration: 2≤dividend≤999, 2≤divisor≤99, dividend≥2×divisor; exact/missing divisor require a%b=0; remainder requires 0<a%b<b; missing quotient aliases exact";
  } else if (spec.domain === "measurement") {
    proof = "five disjoint dimension/unit-pairs × values 1..9999; compare/multistep add other 1..99; unit-sense tasks have only five fixed scenarios";
  } else if (spec.domain === "fraction_concept") {
    const n = FRACTION_POOL.length;
    if (spec.task === "identify") effective = n;
    if (["compare", "common"].includes(spec.task)) valid = choose2(n);
    if (spec.task === "order") valid = choose3(n);
    canonical = valid; if (spec.task !== "identify") effective = canonical;
    proof = "127 coprime proper fractions (2≤d≤20); identify has 5 representations but only127 mathematical values; strict canonical ordered pairs C(127,2), triples C(127,3); mixed whole1..9; equivalence scales2..4";
  } else if (spec.domain === "fraction_operation") {
    const n = FRACTION_POOL.length;
    const groups = new Map(); for (const f of FRACTION_POOL) groups.set(f.denominator, (groups.get(f.denominator) || 0) + 1);
    const same = [...groups.values()].reduce((sum, k) => sum + k * (k + 1) / 2, 0);
    const proper = n * (n + 1) / 2;
    valid = spec.task.startsWith("same") ? same : spec.task.startsWith("unlike") ? proper - same : (n * 10) * (n * 10 + 1) / 2 - proper;
    canonical = effective = valid;
    proof = "reduced proper pool127; same denominator Σ k_d(k_d+1)/2; unlike C(128,2)-same; mixed (whole0..9) C(1271,2)-C(128,2), excluding both proper; ADD keeps f1≤f2, SUB f1≥f2. Addition/subtraction are distinct response tasks";
  } else {
    if (["add", "sub", "mul", "compare"].includes(spec.task)) valid = 999 * 1000 / 2;
    if (spec.task === "order") valid = choose3(99);
    canonical = effective = valid;
    proof = "arithmetic/compare unscaled operands1..999 at scale2 (division uses scale2 quotient × scale1 divisor); commutative/add/compare retain a≤b, subtraction a≥b; triples C(99,3); concept scale3 values1..9999; place positions1..3; measurement three dimension-safe pairs";
  }
  return { generatorId: spec.generatorId, skillId: spec.skillId, domain: spec.domain, task: spec.task,
    rawCartesian: raw, validatedParameterSpace: valid, canonicalUniqueSpace: canonical, effectiveMathematicalContribution: effective,
    representationVariation: spec.task === "identify" ? canonical : 0, materializedPublicCount: 0,
    invalidParameterSpace: raw - valid, duplicateParameterSpace: valid - canonical, proof, calculation: spec.domain === "division" ? "BOUNDED_ENUMERATION" : "FORMULA" };
}
export function createMathCoverageReports() {
  const rows = MATH_SPECS.map(countMathSpec);
  const minimum = { multiplication: 1000000, division: 300000, measurement: 100000, fraction_concept: 20000, fraction_operation: 1000000, decimal: 1000000 };
  const stretch = { measurement: 300000, fraction_operation: 2000000, decimal: 2000000 };
  const domains = Object.keys(minimum).map(domain => {
    const all = rows.filter(x => x.domain === domain), effective = all.reduce((sum, x) => sum + x.effectiveMathematicalContribution, 0);
    return { domain, rawCartesian: all.reduce((sum, x) => sum + x.rawCartesian, 0), validatedParameterSpace: all.reduce((sum, x) => sum + x.validatedParameterSpace, 0),
      canonicalByTaskSum: all.reduce((sum, x) => sum + x.canonicalUniqueSpace, 0), effectiveUniqueSpace: effective,
      minimum: minimum[domain], minimumGate: effective >= minimum[domain] ? "PASS" : "NG", ...(stretch[domain] ? { stretch: stretch[domain], stretchGate: effective >= stretch[domain] ? "PASS" : "NG" } : {}),
      approvedPublicSupply: 0, expertReview: "PENDING", countingPolicy: "disjoint response tasks; alias equation/exact quotient excluded; identify representation variation excluded from effective count" };
  });
  const bySkill = MATH_SPECS.map(spec => ({ ...spec, status: "PARTIAL", implementedFamily: true, missingFamilies: [],
    achievementStandardIds: spec.domain === "measurement" ? UNIT_PAIRS.map(x => x.standard) : spec.achievementStandardIds,
    evidence: "phase-f16d-math-generator.test.mjs; generator parameters/count proof", unverified: ["individual grade/semester/difficulty", "expert educational suitability", "final reviewer approval"],
    count: rows.find(x => x.skillId === spec.skillId) }));
  const byGrade = Array.from({ length: 6 }, (_, i) => ({ gradeLevel: i + 1, status: "PARTIAL", approvedPlacementCount: 0,
    band: i < 2 ? "1_2" : i < 4 ? "3_4" : "5_6", relatedSkillIds: bySkill.filter(s => s.achievementStandardIds.some(id => id.startsWith(i < 2 ? "2수" : i < 4 ? "4수" : "6수"))).map(x => x.skillId),
    placementStatus: "PENDING_EXPERT_REVIEW", semester: null, difficulty: null,
    missing: i < 2 ? ["addition/subtraction in existing arithmetic extension", "individual curriculum placement"] : ["geometry/pattern/data/story PLANNED_F19", "individual curriculum placement"] }));
  const arithmetic = domains.filter(x => ["multiplication", "division"].includes(x.domain)).reduce((s, x) => s + x.effectiveUniqueSpace, 0);
  return { rows, domains, bySkill: [...bySkill, ...F19_GATES], byGrade, source: MATH_SOURCE,
    arithmeticStretch: { effective: arithmetic, minimum: 5000000, gate: arithmetic >= 5000000 ? "PASS" : "NG" },
    implementerStatus: domains.every(x => x.minimumGate === "PASS") ? "TECHNICAL_GATES_PASS_REVIEW_PENDING" : "IN_PROGRESS", reviewerDecision: "PENDING" };
}
