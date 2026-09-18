//+_+// Phase F16A: Unified Content Validator Dispatcher
import { validateEnglishCandidate } from "./englishValidator.js";
import { validateKoreanCandidate } from "./koreanValidator.js";
import { validateMathCandidate } from "./mathValidator.js";
import { validateLicenseForMaterialization } from "./licenseValidator.js";
import { validateProvenance } from "../provenance/sourceSnapshot.js";
import { LifecycleStatus } from "../schema/types.js";

/**
 * Validates an ActivityCandidate across all subjects, licenses, and provenance
 * @param {object} candidate
 * @param {object} [context]
 * @returns {{ valid: boolean, errors: string[], validatedCandidate: object }}
 */
export function validateCandidate(candidate, context = {}) {
  const errors = [];

  if (!candidate || typeof candidate !== "object") {
    return { valid: false, errors: ["Candidate must be a non-null object"], validatedCandidate: null };
  }

  // 1. Provenance check
  const provRes = validateProvenance(candidate.provenance);
  if (!provRes.valid) {
    errors.push(...provRes.errors);
  }

  // 2. License check
  if (candidate.license) {
    const licRes = validateLicenseForMaterialization(candidate.license, candidate.provenance);
    if (!licRes.valid) {
      errors.push(licRes.error);
    }
  } else {
    errors.push("Candidate license is required");
  }

  // 3. Subject-specific validator
  switch (candidate.subject) {
    case "english": {
      const engRes = validateEnglishCandidate(candidate);
      if (!engRes.valid) errors.push(...engRes.errors);
      break;
    }
    case "korean": {
      const korRes = validateKoreanCandidate(candidate, context.koreanRules);
      if (!korRes.valid) errors.push(...korRes.errors);
      break;
    }
    case "math": {
      const mathRes = validateMathCandidate(candidate);
      if (!mathRes.valid) errors.push(...mathRes.errors);
      break;
    }
    default:
      errors.push(`Unsupported candidate subject: "${candidate.subject}"`);
  }

  const isValid = errors.length === 0;

  const validatedCandidate = {
    ...candidate,
    status: isValid ? LifecycleStatus.VALIDATED : LifecycleStatus.REJECTED,
    validationErrors: errors
  };

  return {
    valid: isValid,
    errors,
    validatedCandidate
  };
}
