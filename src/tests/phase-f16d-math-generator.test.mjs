//+_+// F16D regression evidence is synthetic; it does not approve educational placement.
import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { MATH_SPECS, UNIT_PAIRS } from "../public/app/js/mathF16dSpec.js";
import { generateMathCandidate, validateMathCandidate, parametersAt, rawSpace, FRACTION_POOL, resolveMathGeneratedActivity } from "../public/app/js/mathF16dGenerator.js";
import { generateMathCandidates, selectMathCandidates, exposureOf } from "../public/app/js/mathF16dSelection.js";
import { startMathGeneratedSession, getMathExposureHistory } from "../public/app/js/mathF16dRuntime.js";
import { renderFractionRepresentation } from "../public/app/js/fractionRepresentationView.js";
import { renderMathF16dRepresentation } from "../public/app/js/mathF16dRepresentation.js";
import { countMathSpec, createMathCoverageReports } from "../public/app/js/mathF16dCoverage.js";
import { validateParameters, mathNearDuplicateKey } from "../public/app/js/mathF16dGenerator.js";
import { createSession } from "../public/app/js/sessionEngine.js";
import { saveDraftSession, getDraftSession, getSubmission, setCurrentLearnerId, getAllReviewItems, getAllProgressAggregates } from "../public/app/js/storage.js";
import { submitLearningSession, startSubmissionGrading, saveSubmissionGradingProgress, finalizeSubmissionGrading, startReviewRetry } from "../public/app/js/data/learningCommands.js";
import { createResponseRecord } from "../public/app/js/responseEngine.js";
import { JSDOM } from "jsdom";
import { initAppShell, renderRouteView } from "../public/app/js/platform/appShell.js";
import { ROUTES } from "../public/app/js/platform/appRouter.js";
const id = (domain, task) => `f16d_${domain}_${task}`;
test("decimal practice route makes its root and worksheet visible", () => {
  const dom = new JSDOM('<main id="mathAppRoot"><section id="practiceView"></section></main>');
  initAppShell({ documentRef: dom.window.document, windowRef: dom.window }); renderRouteView(ROUTES.MATH_DECIMAL_PRACTICE);
  assert.equal(dom.window.document.querySelector("#mathAppRoot").hidden, false);
  assert.equal(dom.window.document.querySelector("#practiceView").hidden, false);
  dom.window.close();
});
function first(domain, task) { return generateMathCandidates(id(domain, task), { seed: 123, count: 20 }).items[0]; }
test("decimal integer boundary reads naturally and trailing zero preserves value", () => {
  const read = generateMathCandidate(id("decimal", "read"), 999);
  assert.equal(read.expectedAnswer, "일");
  const zero = generateMathCandidate(id("decimal", "zero"), 999);
  assert.ok(zero.prompt.includes("1와 1.0"));
});
test("every declared family generates a validated bounded pool deterministically", () => {
  for (const spec of MATH_SPECS) {
    const a = generateMathCandidates(spec.generatorId, { seed: "test", count: 20 });
    const b = generateMathCandidates(spec.generatorId, { seed: "test", count: 20 });
    assert.deepEqual(a, b, spec.generatorId); assert.ok(a.items.length > 0, spec.generatorId);
    for (const item of a.items) assert.equal(validateMathCandidate(item).valid, true, spec.generatorId);
    assert.ok(a.metrics.attempted <= 1600); assert.equal(new Set(a.items.map(x => x.metadata.math.fingerprint)).size, a.items.length);
  }
});
test("all five fraction representations render and grid/meaning are consistent", () => {
  for (let index = 0; index < 5; index++) {
    const a = generateMathCandidate(id("fraction_concept", "identify"), index);
    assert.equal(a.expectedAnswer, "1/2"); assert.ok(renderFractionRepresentation(a));
  }
});
test("operation representation must not draw only fractional parts of mixed/unlike operands", () => {
  const a = first("fraction_operation", "mixed_sub");
  assert.equal(a.metadata.fractionRepresentation, undefined, "Use exact symbolic operand list instead of legacy single-bar subtraction");
  assert.ok(renderMathF16dRepresentation(a).includes("SYMBOLIC") === false);
  assert.ok(renderMathF16dRepresentation(a).includes("fraction-whole"));
});
test("exact arithmetic derivation covers remainder and uniquely solvable missing operands", () => {
  const a = generateMathCandidate(id("division", "remainder"), (17 - 2) * 98 + (5 - 2));
  assert.equal(a.expectedAnswer, "3, 2");
  const b = generateMathCandidate(id("division", "missing_dividend"), (17 - 2) * 98 + (5 - 2));
  assert.equal(b.expectedAnswer, "17");
  assert.equal(generateMathCandidate(id("division", "missing_divisor"), (17 - 2) * 98 + (5 - 2)), null);
  const c = generateMathCandidate(id("division", "missing_divisor"), (18 - 2) * 98 + (3 - 2));
  assert.equal(c.expectedAnswer, "3");
});
test("bad answers, multiple choices, zero divisor, precision, denominator, dimension and presentation fail closed", () => {
  const good = first("measurement", "composite");
  for (const change of [a => a.expectedAnswer = "incorrect", a => a.prompt += "改", a => a.metadata.math.parameters.pair = 5,
    a => a.metadata.math.featureVector.dimension = "time", a => a.contentRef.packageVersion = "0.0.0"]) {
    const a = structuredClone(good); change(a); assert.equal(validateMathCandidate(a).valid, false);
  }
  const badDivision = first("division", "remainder"); badDivision.metadata.math.parameters.b = 0; assert.equal(validateMathCandidate(badDivision).valid, false);
  const badFraction = first("fraction_operation", "mixed_add"); badFraction.metadata.math.parameters.f1.denominator = 0; assert.equal(validateMathCandidate(badFraction).valid, false);
  const badDecimal = first("decimal", "add"); badDecimal.metadata.math.parameters.a = 1.5; assert.equal(validateMathCandidate(badDecimal).valid, false);
  const choice = first("decimal", "compare"); choice.choices.push(choice.choices[0]); assert.equal(validateMathCandidate(choice).valid, false);
  assert.equal(UNIT_PAIRS.some(x => x.big === "km" && x.small === "cm"), false);
});
test("canonical multiplication swaps have identical fingerprints and identity", () => {
  const a = generateMathCandidate(id("multiplication", "multiply"), (12 - 2) * 98 + (23 - 2));
  const b = generateMathCandidate(id("multiplication", "multiply"), (23 - 2) * 98 + (12 - 2));
  assert.equal(a.metadata.math.fingerprint, b.metadata.math.fingerprint); assert.equal(a.id, b.id);
});
test("decimal answers use integer scale rather than float equality", () => {
  const a = generateMathCandidate(id("decimal", "add"), (10 - 1) * 999 + (20 - 1));
  assert.equal(a.expectedAnswer, "0.3");
  assert.equal(generateMathCandidate(id("decimal", "sub"), (30 - 1) * 999 + (10 - 1)).expectedAnswer, "0.2");
});
test("parameters reject boundaries, stochastic seeds never alter mathematical identity", () => {
  for (const spec of MATH_SPECS) { assert.throws(() => parametersAt(spec, -1)); assert.throws(() => parametersAt(spec, rawSpace(spec))); }
  assert.throws(() => generateMathCandidates(id("decimal", "add"), { count: 0 }));
  assert.equal(FRACTION_POOL.length, 127);
});
test("selection excludes five recent sessions and isolates exact learner IDs", () => {
  const candidates = generateMathCandidates(id("decimal", "add"), { seed: 12 }).items;
  const history = [{ learnerId: "alice", sessionId: "prior", startedAt: 1, items: candidates.slice(0, 20).map(exposureOf) }];
  const a = selectMathCandidates(candidates, { learnerId: "alice", history, now: 10 });
  const recent = new Set(history[0].items.map(x => x.fingerprint));
  assert.equal(a.activities.some(x => recent.has(x.metadata.math.fingerprint)), false); assert.equal(a.selection.exactRelaxed, 0);
  const b = selectMathCandidates(candidates, { learnerId: "alice-other", history, now: 10 });
  assert.equal(b.selection.historySessions, 0);
  assert.deepEqual(a, selectMathCandidates(candidates, { learnerId: "alice", history, now: 10 }));
});
test("shortage fallback relaxes exact only then returns short session, never duplicates", () => {
  const pool = generateMathCandidates(id("measurement", "unit_choice")).items;
  const history = [{ learnerId: "short", sessionId: "old", startedAt: 1, items: pool.map(exposureOf) }];
  const a = selectMathCandidates([...pool, ...pool], { learnerId: "short", history, count: 20, now: 2 });
  assert.equal(a.selection.exactRelaxed, 5); assert.equal(a.selection.shortage, 15); assert.equal(a.selection.fallback, "SHORT_SESSION");
  assert.equal(new Set(a.activities.map(x => x.id)).size, 5);
  const empty = selectMathCandidates([], { learnerId: "empty" }); assert.equal(empty.activities.length, 0);
});
test("exposure persistence survives reopen and serializes simultaneous sessions", async () => {
  const params = { generatorId: id("decimal", "add"), learnerId: "atomic-test", count: 20, seed: 123, now: 100 };
  const [a, b] = await Promise.all([startMathGeneratedSession({ ...params, sessionId: "a" }), startMathGeneratedSession({ ...params, sessionId: "b" })]);
  const first = new Set(a.activities.map(x => x.id)); assert.equal(b.activities.some(x => first.has(x.id)), false);
  assert.equal((await getMathExposureHistory("atomic-test")).length, 2); assert.deepEqual(await getMathExposureHistory("atomic-test-other"), []);
  await assert.rejects(startMathGeneratedSession({ ...params, sessionId: "a" }), /Duplicate session/);
});
test("stale version fails new validation while immutable historical snapshot resolves unchanged", () => {
  const a = first("decimal", "add"); a.metadata.math.version = "0.9.0"; a.contentRef.packageVersion = "0.9.0";
  assert.equal(validateMathCandidate(a).valid, false);
  const resolved = resolveMathGeneratedActivity(a.contentRef, a); assert.deepEqual(resolved, a); resolved.prompt = "changed"; assert.notEqual(resolved.prompt, a.prompt);
  assert.throws(() => resolveMathGeneratedActivity(a.contentRef, null));
});
test("all count formulas match full bounded parameter enumeration (no materialized fixtures counted)", () => {
  for (const spec of MATH_SPECS) {
    let valid = 0;
    for (let i = 0; i < rawSpace(spec); i++) if (validateParameters(spec, parametersAt(spec, i))) valid++;
    assert.equal(countMathSpec(spec).validatedParameterSpace, valid, spec.generatorId);
  }
  const report = createMathCoverageReports();
  assert.equal(report.domains.find(x => x.domain === "multiplication").minimumGate, "NG");
  assert.equal(report.domains.find(x => x.domain === "multiplication").minimum, 1000000);
  assert.equal(report.implementerStatus, "IN_PROGRESS");
  for (const x of report.bySkill.filter(x => x.status === "PLANNED_F19")) assert.ok(x.minimum === 20000 || x.minimum === 50000);
});
test("near duplicate policy ignores names, IDs and seed while preserving semantic structure", () => {
  const a = first("measurement", "context"), b = structuredClone(a);
  b.id += "other"; b.prompt = b.prompt.replace("리본", "끈"); b.metadata.seed = 987;
  assert.equal(mathNearDuplicateKey(a), mathNearDuplicateKey(b));
  b.metadata.math.contextSemanticId = "different-purpose"; assert.notEqual(mathNearDuplicateKey(a), mathNearDuplicateKey(b));
});
test("weak and long-unexposed feature boosts and recent operand penalties are active", () => {
  const mixed = [first("decimal", "add"), first("decimal", "sub")];
  const weak = selectMathCandidates(mixed, { learnerId: "boost", count: 1, now: 100, weakFeatures: ["sub"] });
  assert.equal(weak.activities[0].metadata.math.featureVector.family, "sub");
  const history = [{ learnerId: "boost", sessionId: "old", startedAt: 99, items: [exposureOf(mixed[0])] }];
  assert.equal(selectMathCandidates(mixed, { learnerId: "boost", count: 1, now: 100, history }).activities[0].id, mixed[1].id);
});
test("generated TEXT and CHOICE use Draft→Submission→Guardian→Review/Retry→Progress with original identity", async () => {
  const learnerId = "f16d-life"; setCurrentLearnerId(learnerId);
  const generated = await startMathGeneratedSession({ generatorId: id("decimal", "add"), learnerId, sessionId: "life-gen", seed: 123, count: 1, now: 10 });
  const questions = [generated.activities[0], first("decimal", "compare")];
  const session = createSession({ sessionId: "life-session", learnerId, subjectId: "math", courseId: "decimal", skillId: questions[0].skillId }, questions);
  session.start();
  const responses = new Map(questions.map(q => [q.id, createResponseRecord(q.id, q.responseType, q.expectedAnswer)]));
  await saveDraftSession({ sessionId: session.id, learnerId, questions, config: session.config, responseRecords: responses });
  const draft = await getDraftSession({ learnerId }); assert.deepEqual(draft.questions, questions);
  assert.equal(draft.responseRecords[questions[1].id].value, questions[1].expectedAnswer);
  const submitted = await submitLearningSession({ session, learnerId, responseSnapshots: responses });
  const original = await getSubmission(submitted.id, { learnerId });
  assert.deepEqual(original.questions.map(q => q.contentRef), questions.map(q => q.contentRef));
  await startSubmissionGrading(submitted.id, { learnerId });
  await saveSubmissionGradingProgress(submitted.id, { [questions[0].id]: { decision: "WRONG" }, [questions[1].id]: { decision: "CORRECT" } }, new Map(), { learnerId });
  await finalizeSubmissionGrading(submitted.id, { learnerId });
  const reviews = await getAllReviewItems({ learnerId }); assert.equal(reviews.length, 1);
  const { retrySession } = await startReviewRetry(reviews[0].id, { learnerId });
  assert.equal(retrySession.questions[0].id, questions[0].id);
  assert.deepEqual(retrySession.questions[0].contentRef, questions[0].contentRef);
  assert.deepEqual(retrySession.questions[0].metadata.math, questions[0].metadata.math);
  assert.equal((await getMathExposureHistory(learnerId)).length, 1, "Retry does not record a new exposure session");
  assert.ok((await getAllProgressAggregates({ learnerId })).some(x => x.courseId === "decimal"));
  assert.equal((await getSubmission(submitted.id, { learnerId })).responseSnapshots[questions[0].id].value, questions[0].expectedAnswer);
});
