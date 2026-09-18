//+_+// Phase F16A: License Validator SSOT
import { LicenseType } from "../schema/types.js";
import { validateLicense as checkLicenseCategory } from "../provenance/sourceSnapshot.js";

/**
 * Validates entity license suitability for production content materialization
 * @param {string} licenseId
 * @returns {{ valid: boolean, category: string, error?: string }}
 */
export function validateLicenseForMaterialization(licenseId) {
  const res = checkLicenseCategory(licenseId);

  if (!res.valid) {
    return {
      valid: false,
      category: res.category,
      error: `License "${licenseId}" is invalid: ${res.error || "rejected"}`
    };
  }

  // UNKNOWN and PROHIBITED cannot pass Production APPROVED materialization
  if (res.category === LicenseType.UNKNOWN || res.category === LicenseType.PROHIBITED) {
    return {
      valid: false,
      category: res.category,
      error: `Source with license "${licenseId}" (${res.category}) cannot pass Production APPROVED materialization`
    };
  }

  return {
    valid: true,
    category: res.category
  };
}
