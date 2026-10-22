// Same independent regression assertions, executed against the frozen release modules.
import test from "node:test";
import assert from "node:assert/strict";
import { divideDecimals, formatDecimal } from "../app/js/decimalDomain.js";
import { generateMathCandidate, validateMathCandidate, resolveMathGeneratedActivity } from "../app/js/mathF16dGenerator.js";

// Independent oracle: no production decimal parser, division or derivation.
function ratio(text) {
  const [whole, fraction = ""] = text.split(".");
  return [BigInt(whole + fraction), 10n ** BigInt(fraction.length)];
}
function exactDivision(a, b, answer) {
  const [an, ad] = ratio(a), [bn, bd] = ratio(b), [qn, qd] = ratio(answer);
  return an * bd * qd === qn * bn * ad;
}
for (const [a, b, expected] of [
  ["0.001", "0.1", "0.01"], ["998.001", "99.9", "9.99"], ["1", "20", "0.05"],
  ["1", "100", "0.01"], ["1", "200", "0.005"], ["1", "125", "0.008"],
  ["7.328", "22.9", "0.32"], ["0", "20", "0"], ["1", "1024", "0.0009765625"],
]) test(`exact division ${a} / ${b}`, () => {
  const answer = formatDecimal(divideDecimals(a, b));
  assert.equal(answer, expected);
  assert.ok(exactDivision(a, b, answer));
});
test("division rejects zero, recurring and unsupported precision", () => {
  assert.throws(() => divideDecimals("1", "0"));
  assert.throws(() => divideDecimals("1", "3"));
  assert.throws(() => divideDecimals("1", "2048"));
});
test("independent validator blocks the two original self-consistent wrong answers", () => {
  for (const index of [0, 999 * 999 - 1]) {
    const candidate = generateMathCandidate("f16d_decimal_div", index);
    const [a, b] = candidate.metadata.math.operands;
    const [qn, qd] = ratio(candidate.expectedAnswer);
    const correct = BigInt(a[0]) * BigInt(b[1]) * qd === qn * BigInt(b[0]) * BigInt(a[1]);
    if (!correct) assert.deepEqual(validateMathCandidate(candidate), { valid: false, reason: "DECIMAL_DIVISION_MATH" });
    else {
      assert.equal(validateMathCandidate(candidate).valid, true);
      candidate.expectedAnswer = index === 0 ? "1" : "999";
      assert.deepEqual(validateMathCandidate(candidate), { valid: false, reason: "DECIMAL_DIVISION_MATH" });
    }
  }
});
test("all 998001 decimal division parameter pairs match an independent exact oracle", () => {
  for (let a = 1; a <= 999; a++) for (let b = 1; b <= 999; b++) {
    const dividend = { unscaledValue: a * b, scale: 3 };
    const answer = divideDecimals(dividend, { unscaledValue: b, scale: 1 });
    assert.equal(BigInt(answer.unscaledValue) * 100n, BigInt(a) * 10n ** BigInt(answer.scale), `${a},${b}`);
  }
});
test("old incorrect snapshots remain immutable and are not regenerated", () => {
  const snapshot = generateMathCandidate("f16d_decimal_div", 0);
  snapshot.contentRef.packageVersion = "1.3.0";
  snapshot.metadata.math.version = "1.3.0";
  snapshot.expectedAnswer = "1";
  const restored = resolveMathGeneratedActivity(snapshot.contentRef, snapshot);
  assert.deepEqual(restored, snapshot);
  assert.notEqual(restored, snapshot);
  assert.equal(restored.expectedAnswer, "1");
});
