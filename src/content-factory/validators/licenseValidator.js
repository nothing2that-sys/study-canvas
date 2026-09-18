//+_+// Phase F16A: License Validator SSOT
import { LicenseType } from "../schema/types.js";
import { validateLicense as checkLicenseCategory } from "../provenance/sourceSnapshot.js";

/**
 * Validates entity license suitability for production content materialization
 * @param {string} licenseId
 * @param {object} [provenance]
 * @returns {{ valid: boolean, category: string, error?: string }}
 */
export function validateLicenseForMaterialization(licenseId, provenance = null) {
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

  // ATTRIBUTION_REQUIRED must have attribution metadata (source attribution, author/provider, or reference uri)
  if (res.category === LicenseType.ATTRIBUTION_REQUIRED) {
    const hasAttribution = provenance && (
      Boolean(provenance.attribution) ||
      Boolean(provenance.author) ||
      Boolean(provenance.provider) ||
      (Boolean(provenance.sourceId) && Boolean(provenance.sourceUri))
    );
    if (!hasAttribution) {
      return {
        valid: false,
        category: res.category,
        error: `License ATTRIBUTION_REQUIRED requires explicit attribution metadata (attribution, author/provider, or sourceUri in provenance)`
      };
    }
  }

  // SHARE_ALIKE must retain license identity
  if (res.category === LicenseType.SHARE_ALIKE) {
    if (!licenseId || !licenseId.trim()) {
      return {
        valid: false,
        category: res.category,
        error: `License SHARE_ALIKE requires preserved license propagation metadata`
      };
    }
  }

  return {
    valid: true,
    category: res.category
  };
}
