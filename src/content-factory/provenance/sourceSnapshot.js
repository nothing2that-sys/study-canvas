//+_+// Phase F16A: Source Snapshot & Provenance Integrity SSOT
import crypto from "node:crypto";
import { LicenseType, SCHEMA_VERSION } from "../schema/types.js";

/**
 * Calculates SHA-256 hex digest of a string or Buffer
 * @param {string|Buffer} content
 * @returns {string}
 */
export function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Creates a deterministic canonical JSON string (keys sorted)
 * @param {any} val
 * @returns {string}
 */
export function canonicalJson(val) {
  if (val === null || typeof val !== "object") {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return "[" + val.map(canonicalJson).join(",") + "]";
  }
  const keys = Object.keys(val).filter(k => val[k] !== undefined).sort();
  return "{" + keys.map(k => `${JSON.stringify(k)}:${canonicalJson(val[k])}`).join(",") + "}";
}

/**
 * Validates a license string and categorizes it
 * @param {string} licenseId
 * @returns {{ valid: boolean, category: string, error?: string }}
 */
export function validateLicense(licenseId) {
  if (!licenseId || typeof licenseId !== "string") {
    return { valid: false, category: LicenseType.UNKNOWN, error: "License ID is required" };
  }

  const upper = licenseId.trim().toUpperCase();

  if (upper === "PROHIBITED" || upper.includes("COPYRIGHT_ALL_RIGHTS_RESERVED")) {
    return { valid: false, category: LicenseType.PROHIBITED, error: "Prohibited license: copyrighted commercial material" };
  }

  if (upper === "PROJECT_OWNED") {
    return { valid: true, category: LicenseType.PROJECT_OWNED };
  }

  if (upper === "PUBLIC_DOMAIN" || upper === "CC0") {
    return { valid: true, category: LicenseType.PUBLIC_DOMAIN };
  }

  if (upper === "KOGL_TYPE_1" || upper === "CC_BY_4_0" || upper === "MIT" || upper === "APACHE_2_0") {
    return { valid: true, category: LicenseType.OPEN_LICENSE };
  }

  if (upper === "KOGL_TYPE_2") return { valid: true, category: LicenseType.NON_COMMERCIAL };
  if (upper === "KOGL_TYPE_3") return { valid: true, category: LicenseType.NO_DERIVATIVES };
  if (upper === "KOGL_TYPE_4") return { valid: true, category: LicenseType.NON_COMMERCIAL_NO_DERIVATIVES };

  if (upper === "CC_BY_SA_2_0_KR" || upper === "CC_BY_SA_4_0") {
    return { valid: true, category: LicenseType.SHARE_ALIKE };
  }

  if (upper === "ATTRIBUTION_REQUIRED") {
    return { valid: true, category: LicenseType.ATTRIBUTION_REQUIRED };
  }

  return { valid: false, category: LicenseType.UNKNOWN, error: `Unrecognized license: "${licenseId}"` };
}

/**
 * Creates an immutable source snapshot with hash verification
 * @param {object} params
 * @param {string} params.sourceId
 * @param {string} params.sourceVersion
 * @param {string} params.sourceUri
 * @param {string} params.retrievedAt
 * @param {string} params.licenseId
 * @param {string|object} params.content
 * @returns {object} SourceSnapshot
 */
export function createSourceSnapshot({ sourceId, sourceVersion, sourceUri, retrievedAt, licenseId, content }) {
  if (!sourceId || typeof sourceId !== "string") throw new Error("sourceId is required");
  if (!sourceVersion || typeof sourceVersion !== "string") throw new Error("sourceVersion is required");
  if (!sourceUri || typeof sourceUri !== "string") throw new Error("sourceUri is required");
  if (!retrievedAt || typeof retrievedAt !== "string") throw new Error("retrievedAt is required");

  const licenseResult = validateLicense(licenseId);
  if (!licenseResult.valid && licenseResult.category === LicenseType.PROHIBITED) {
    throw new Error(`Cannot snapshot prohibited license: ${licenseId}`);
  }

  const contentRaw = typeof content === "string" ? content : canonicalJson(content);
  const contentHash = sha256(contentRaw);

  const snapshotCore = {
    schemaVersion: SCHEMA_VERSION,
    sourceId,
    sourceVersion,
    sourceUri,
    retrievedAt,
    licenseId: licenseId.trim().toUpperCase(),
    ...(licenseId.trim().toUpperCase() !== licenseResult.category ? { licenseCategory: licenseResult.category } : {}),
    contentHash
  };

  const sourceSnapshotHash = sha256(canonicalJson(snapshotCore));

  return Object.freeze({
    ...snapshotCore,
    sourceSnapshotHash,
    content: typeof content === "object" ? content : JSON.parse(contentRaw)
  });
}

/**
 * Validates candidate provenance to prevent origin falsification
 * @param {object} provenance
 * @param {boolean} [isProjectOwnedCandidate=false]
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateProvenance(provenance, isProjectOwnedCandidate = false) {
  const errors = [];
  if (!provenance || typeof provenance !== "object") {
    return { valid: false, errors: ["Missing provenance record"] };
  }

  const requiredFields = ["sourceId", "sourceVersion", "generationRuleId", "generatorVersion"];
  for (const f of requiredFields) {
    if (!provenance[f] || typeof provenance[f] !== "string" || !provenance[f].trim()) {
      errors.push(`provenance.${f} is required`);
    }
  }

  // Ensure external content is not falsely marked as Project Owned without origin
  if (isProjectOwnedCandidate && provenance.sourceId !== "PROJECT_ORIGINAL" && !provenance.sourceRecordId) {
    errors.push("External content cannot be impersonated as PROJECT_OWNED without sourceRecordId");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Fully validates the end-to-end provenance chain for a MaterializedActivity or Candidate:
 * MaterializedActivity -> Candidate -> GenerationRule -> Source Record -> Source Snapshot
 * @param {object} entity
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateProvenanceChain(entity) {
  const errors = [];
  if (!entity || !entity.provenance) {
    return { valid: false, errors: ["Missing entity or entity.provenance"] };
  }
  const p = entity.provenance;
  if (!p.sourceId) errors.push("Missing provenance.sourceId in chain");
  if (!p.sourceVersion) errors.push("Missing provenance.sourceVersion in chain");
  if (!p.generationRuleId) errors.push("Missing provenance.generationRuleId in chain");
  if (!p.generatorVersion) errors.push("Missing provenance.generatorVersion in chain");
  if (!p.sourceHash) errors.push("Missing provenance.sourceHash in chain");
  if (!p.sourceRecordId) errors.push("Missing provenance.sourceRecordId in chain");

  return {
    valid: errors.length === 0,
    errors
  };
}
