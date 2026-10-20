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

  // General public materialization cannot establish NC/ND use compatibility.
  if ([LicenseType.NON_COMMERCIAL, LicenseType.NO_DERIVATIVES,
    LicenseType.NON_COMMERCIAL_NO_DERIVATIVES].includes(res.category)) {
    return { valid: false, category: res.category,
      error: `License "${licenseId}" requires separate use/permission review; public materialization is blocked` };
  }

  // These are evidence requirements, not an automated legal clearance.
  if ([LicenseType.SHARE_ALIKE, LicenseType.OPEN_LICENSE].includes(res.category)) {
    const fields = ["attribution", "sourceUri", "sourceTitle", "licenseUrl", "noticePath", "changeDescription"];
    const missing = fields.filter(key => typeof provenance?.[key] !== "string" || !provenance[key].trim());
    if (provenance?.licenseReview !== "HUMAN_APPROVED" || missing.length
      || (res.category === LicenseType.SHARE_ALIKE && provenance?.appliedLicense !== licenseId.trim().toUpperCase())) {
      return { valid: false, category: res.category,
        error: `License "${licenseId}" requires HUMAN_APPROVED license review, attribution/source/title/license/notice/change metadata and applicable license propagation` };
    }
  }

  return {
    valid: true,
    category: res.category
  };
}
