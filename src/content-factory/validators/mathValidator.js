//+_+// Phase F16A: Math Validator Framework SSOT
//+_+// Validates MathGeneratorSpec, MathFeatureVector, Exact Arithmetic (Fraction / Decimal), and Curriculum linkage
//+_+// STRICT PROHIBITION OF FLOAT EQUALITY: All arithmetic checks must use exact integer/rational representations

import { validateSchema } from "../schema/types.js";
import { gcd, lcm } from "../../public/app/js/fractionOperations.js";
import { safePowerOf10 } from "../../public/app/js/decimalDomain.js";

/**
 * Asserts that two fraction values (n1/d1 and n2/d2) are exactly equal using cross-multiplication
 * Float comparison (n1 / d1 === n2 / d2) is strictly forbidden.
 * @param {number} n1
 * @param {number} d1
 * @param {number} n2
 * @param {number} d2
 * @returns {boolean}
 */
export function assertFractionExactEqual(n1, d1, n2, d2) {
  if (!Number.isSafeInteger(n1) || !Number.isSafeInteger(d1) || !Number.isSafeInteger(n2) || !Number.isSafeInteger(d2)) {
    throw new Error("[MathValidator] All fraction operands must be safe integers");
  }
  if (d1 === 0 || d2 === 0) {
    throw new Error("[MathValidator] Fraction denominator cannot be zero");
  }
  // Cross-multiplication integer equality
  const prod1 = n1 * d2;
  const prod2 = n2 * d1;
  return prod1 === prod2;
}

/**
 * Asserts that two decimal values ({ unscaledValue: u1, scale: s1 } and { unscaledValue: u2, scale: s2 }) are exactly equal
 * Float comparison (0.1 + 0.2 === 0.3) is strictly forbidden.
 * @param {{ unscaledValue: number, scale: number }} dec1
 * @param {{ unscaledValue: number, scale: number }} dec2
 * @returns {boolean}
 */
export function assertDecimalExactEqual(dec1, dec2) {
  if (!Number.isSafeInteger(dec1.unscaledValue) || !Number.isSafeInteger(dec2.unscaledValue)) {
    throw new Error("[MathValidator] Decimal unscaledValue must be safe integers");
  }
  const maxScale = Math.max(dec1.scale, dec2.scale);
  const factor1 = safePowerOf10(maxScale - dec1.scale);
  const factor2 = safePowerOf10(maxScale - dec2.scale);
  return (dec1.unscaledValue * factor1) === (dec2.unscaledValue * factor2);
}

/**
 * Validates a MathGeneratorSpec entity
 * @param {object} spec
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateMathGeneratorSpec(spec) {
  const schemaRes = validateSchema("MathGeneratorSpec", spec);
  const errors = [...schemaRes.errors];

  if (!spec) return { valid: false, errors: ["MathGeneratorSpec entity is null or undefined"] };

  const validDomains = ["ARITHMETIC", "FRACTION", "DECIMAL", "MEASUREMENT"];
  if (spec.domain && !validDomains.includes(spec.domain)) {
    errors.push(`[MathValidator] Invalid domain: "${spec.domain}". Must be one of ${validDomains.join(", ")}`);
  }

  // Operand constraints
  if (spec.operandConstraints) {
    const { min, max } = spec.operandConstraints;
    if (min !== undefined && max !== undefined && min > max) {
      errors.push(`[MathValidator] Invalid operandConstraints: min (${min}) > max (${max})`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates a Math ActivityCandidate
 * @param {object} candidate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateMathCandidate(candidate) {
  const schemaRes = validateSchema("ActivityCandidate", candidate);
  const errors = [...schemaRes.errors];

  if (!candidate) return { valid: false, errors: ["Candidate is null or undefined"] };

  if (candidate.subject !== "math") {
    errors.push(`[MathValidator] Expected subject "math", got "${candidate.subject}"`);
  }

  // Check curriculum linkage
  if (!candidate.curriculumLinkage || typeof candidate.curriculumLinkage !== "object") {
    errors.push("[MathValidator] Missing curriculumLinkage object");
  } else {
    if (!candidate.curriculumLinkage.courseId) errors.push("[MathValidator] curriculumLinkage.courseId is required");
    if (!candidate.curriculumLinkage.unitId) errors.push("[MathValidator] curriculumLinkage.unitId is required");
    if (!candidate.curriculumLinkage.skillId) errors.push("[MathValidator] curriculumLinkage.skillId is required");
  }

  // Check seed determinism
  if (!candidate.provenance || candidate.provenance.seed === undefined || candidate.provenance.seed === null) {
    errors.push("[MathValidator] Deterministic seed is required in provenance");
  }

  // Exact arithmetic check for fraction if applicable
  if (candidate.mathMeta?.domain === "FRACTION" && candidate.mathMeta.fractionAnswer) {
    const { num, den, expectedNum, expectedDen } = candidate.mathMeta.fractionAnswer;
    try {
      const isEq = assertFractionExactEqual(num, den, expectedNum, expectedDen);
      if (!isEq) {
        errors.push(`[MathValidator] Fraction exact arithmetic mismatch: ${num}/${den} != ${expectedNum}/${expectedDen}`);
      }
    } catch (err) {
      errors.push(`[MathValidator] Fraction arithmetic error: ${err.message}`);
    }
  }

  // Exact arithmetic check for decimal if applicable
  if (candidate.mathMeta?.domain === "DECIMAL" && candidate.mathMeta.decimalAnswer) {
    const { actual, expected } = candidate.mathMeta.decimalAnswer;
    try {
      const isEq = assertDecimalExactEqual(actual, expected);
      if (!isEq) {
        errors.push(`[MathValidator] Decimal exact arithmetic mismatch: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
      }
    } catch (err) {
      errors.push(`[MathValidator] Decimal arithmetic error: ${err.message}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
