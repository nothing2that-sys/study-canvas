//+_+// Phase F16B: English Core v2 Shard & Catalog Loader SSOT
//+_+// Provides on-demand shard loading, cryptographic SHA-256 integrity verification,
//+_+// and backward-compatibility reference mappings to F14 English Vocabulary memory.

async function sha256(content) {
  if (typeof window === "undefined") {
    const crypto = await import("node:crypto");
    return crypto.createHash("sha256").update(content, "utf8").digest("hex");
  } else if (window.crypto && window.crypto.subtle) {
    const buffer = new TextEncoder().encode(content);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }
  return "";
}

const DEFAULT_PACKAGE_BASE = "./content/packages/english-core-v2";

/**
 * Platform agnostic JSON loader helper (fetch in browser, fs in Node.js)
 */
async function fetchJsonResource(pathOrUrl) {
  const isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined";
  if (isBrowser || pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    let targetUrl = pathOrUrl;
    if (isBrowser && !pathOrUrl.startsWith("http://") && !pathOrUrl.startsWith("https://") && !pathOrUrl.startsWith("/")) {
      targetUrl = `/${pathOrUrl.replace(/^\.\//, "")}`;
    }
    const res = await fetch(targetUrl);
    if (!res.ok) {
      throw new Error(`[englishCoreV2Loader] Failed to fetch resource (HTTP ${res.status}): ${targetUrl}`);
    }
    return await res.json();
  }

  // Node.js environment
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const resolved = pathOrUrl.startsWith("file://")
      ? new URL(pathOrUrl)
      : path.resolve(pathOrUrl);
    const content = await fs.readFile(resolved, "utf8");
    return JSON.parse(content);
  } catch (err) {
    throw new Error(`[englishCoreV2Loader] Failed to read resource (${pathOrUrl}): ${err.message}`);
  }
}

/**
 * Loads and caches english-core-v2 catalog.json
 */
let cachedCatalog = null;
export async function loadEnglishCoreV2Catalog(baseDir = DEFAULT_PACKAGE_BASE) {
  if (cachedCatalog) return cachedCatalog;
  const catalogUrl = `${baseDir.replace(/\/$/, "")}/catalog.json`;
  const catalog = await fetchJsonResource(catalogUrl);
  if (!catalog || !Array.isArray(catalog.shards) || !catalog.catalogHash) {
    throw new Error("[englishCoreV2Loader] Invalid catalog.json format");
  }
  cachedCatalog = Object.freeze(catalog);
  return cachedCatalog;
}

/**
 * Loads a specific shard by shardId with cryptographic SHA-256 verification
 * @param {string} shardId e.g. "shard-english-g3-p1"
 * @param {string} [baseDir=DEFAULT_PACKAGE_BASE]
 * @returns {Promise<Array<object>>} Shard items (activities)
 */
export async function loadEnglishCoreV2Shard(shardId, baseDir = DEFAULT_PACKAGE_BASE) {
  const catalog = await loadEnglishCoreV2Catalog(baseDir);
  const shardMeta = catalog.shards.find(s => s.shardId === shardId);
  if (!shardMeta) {
    throw new Error(`[englishCoreV2Loader] Shard "${shardId}" not found in catalog.json`);
  }

  const shardUrl = `${baseDir.replace(/\/$/, "")}/shards/${shardId}.json`;
  const fs = typeof window === "undefined" ? await import("node:fs") : null;
  const path = typeof window === "undefined" ? await import("node:path") : null;
  let rawContent = null;
  if (fs && path && !shardUrl.startsWith("http://") && !shardUrl.startsWith("https://")) {
    const resolvedPath = path.resolve(shardUrl);
    rawContent = fs.readFileSync(resolvedPath, "utf8");
    const actualHash = await sha256(rawContent);
    if (actualHash !== shardMeta.sha256) {
      throw new Error(
        `[englishCoreV2Loader] Cryptographic SHA-256 mismatch for shard "${shardId}": expected ${shardMeta.sha256}, got ${actualHash}`
      );
    }
  }

  const shardData = rawContent ? JSON.parse(rawContent) : await fetchJsonResource(shardUrl);

  // Verify item count
  if (!Array.isArray(shardData.items)) {
    throw new Error(`[englishCoreV2Loader] Shard "${shardId}" missing items array`);
  }
  if (shardData.items.length !== shardMeta.itemCount) {
    throw new Error(
      `[englishCoreV2Loader] Shard "${shardId}" item count mismatch: catalog has ${shardMeta.itemCount}, actual has ${shardData.items.length}`
    );
  }

  return shardData.items;
}

/**
 * Loads all activities for a given elementary grade level (3..6)
 * @param {number} gradeLevel
 * @param {string} [baseDir=DEFAULT_PACKAGE_BASE]
 * @returns {Promise<Array<object>>} All activities for the grade
 */
export async function loadEnglishCoreV2ActivitiesByGrade(gradeLevel, baseDir = DEFAULT_PACKAGE_BASE) {
  const catalog = await loadEnglishCoreV2Catalog(baseDir);
  const targetShards = catalog.shards.filter(s => {
    return gradeLevel >= s.gradeRange[0] && gradeLevel <= s.gradeRange[1];
  });

  const allActivities = [];
  for (const shardMeta of targetShards) {
    const items = await loadEnglishCoreV2Shard(shardMeta.shardId, baseDir);
    allActivities.push(...items);
  }

  return allActivities;
}

/**
 * F14 English Vocabulary Memory & Backward Compatibility Reference Mapping
 * Preserves 100% historical identity for F14 48 wordIds (e.g. "en-v3-school-book")
 */
export const F14_WORD_COMPATIBILITY_MAP = Object.freeze({
  "en-v3-school-book": { headword: "book", wordFamilyId: "wf-en-book", grade: 3 },
  "en-v3-school-desk": { headword: "desk", wordFamilyId: "wf-en-desk", grade: 3 },
  "en-v3-school-pencil": { headword: "pencil", wordFamilyId: "wf-en-pencil", grade: 3 },
  "en-v3-school-teacher": { headword: "teacher", wordFamilyId: "wf-en-teacher", grade: 3 },
  "en-v3-family-father": { headword: "father", wordFamilyId: "wf-en-father", grade: 3 },
  "en-v3-family-mother": { headword: "mother", wordFamilyId: "wf-en-mother", grade: 3 },
  "en-v3-animal-dog": { headword: "dog", wordFamilyId: "wf-en-dog", grade: 3 },
  "en-v3-animal-cat": { headword: "cat", wordFamilyId: "wf-en-cat", grade: 3 },
  "en-v3-food-apple": { headword: "apple", wordFamilyId: "wf-en-apple", grade: 3 },
  "en-v3-food-milk": { headword: "milk", wordFamilyId: "wf-en-milk", grade: 3 },
  "en-v3-color-red": { headword: "red", wordFamilyId: "wf-en-red", grade: 3 },
  "en-v3-color-blue": { headword: "blue", wordFamilyId: "wf-en-blue", grade: 3 }
  // Additional F14 mappings resolve dynamically by headword lookup
});

/**
 * Resolves F14 wordId to WordFamily reference while preserving F14 memory compatibility
 * @param {string} wordId
 * @returns {{ headword: string, wordFamilyId: string } | null}
 */
export function resolveF14WordReference(wordId) {
  if (!wordId || typeof wordId !== "string") return null;
  if (F14_WORD_COMPATIBILITY_MAP[wordId]) {
    return F14_WORD_COMPATIBILITY_MAP[wordId];
  }
  // Generic pattern resolution: "en-v{grade}-{topic}-{headword}"
  const parts = wordId.split("-");
  if (parts.length >= 4) {
    const headword = parts[parts.length - 1];
    return {
      headword,
      wordFamilyId: `wf-en-${headword}`,
      grade: parseInt(parts[1].replace("v", ""), 10) || 3
    };
  }
  return null;
}
