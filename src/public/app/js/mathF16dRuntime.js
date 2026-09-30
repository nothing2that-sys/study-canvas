//+_+// A separate bounded math exposure database leaves historical learning DB schema and snapshots unchanged.
import { generateMathCandidates, selectMathCandidates, exposureOf } from "./mathF16dSelection.js";
const DB_NAME = "math_canvas_f16d_exposure";
export const EXPOSURE_SESSION_LIMIT = 100;
export function openMathExposureDB(factory = globalThis.indexedDB) {
  if (!factory) return Promise.reject(new Error("IndexedDB is required for math exposure persistence"));
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("learners", { keyPath: "learnerId" });
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Math exposure database upgrade blocked"));
    request.onsuccess = () => { const db = request.result; db.onversionchange = () => db.close(); resolve(db); };
  });
}
export async function startMathGeneratedSession({ generatorId, learnerId, sessionId, seed, count = 20, now = Date.now(), weakFeatures = [], factory } = {}) {
  if (typeof learnerId !== "string" || !learnerId || typeof sessionId !== "string" || !sessionId) throw new Error("Explicit learner/session identity required");
  const timings = {}; let t = performance.now();
  const candidates = generateMathCandidates(generatorId, { seed, count }); timings.candidateGenerationValidationFingerprintMs = performance.now() - t;
  t = performance.now(); const db = await openMathExposureDB(factory); timings.exposureInitializationMs = performance.now() - t;
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("learners", "readwrite"), store = tx.objectStore("learners");
      const queryStart = performance.now(), request = store.get(learnerId); let result; let failure;
      request.onsuccess = () => {
        try {
          timings.exposureQueryMs = performance.now() - queryStart;
          const history = request.result?.sessions || [];
          if (history.some(s => s.sessionId === sessionId)) throw new Error("Duplicate session identity; resume original snapshot instead");
          const selectionStart = performance.now();
          result = selectMathCandidates(candidates.items, { learnerId, history, count, now, weakFeatures });
          timings.selectionMaterializationMs = performance.now() - selectionStart;
          if (!result.activities.length) throw new Error("No valid math candidates");
          const record = { learnerId, sessionId, startedAt: now, items: result.activities.map(exposureOf) };
          store.put({ learnerId, sessions: [...history, record].sort((a, b) => a.startedAt - b.startedAt || a.sessionId.localeCompare(b.sessionId)).slice(-EXPOSURE_SESSION_LIMIT) });
          result = { ...result, candidates: candidates.metrics, timings };
        } catch (error) { failure = error; tx.abort(); }
      };
      request.onerror = () => { failure = request.error; };
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () => reject(failure || tx.error || new Error("Exposure transaction failed"));
    });
  } finally { db.close(); }
}
export async function getMathExposureHistory(learnerId, factory) {
  if (typeof learnerId !== "string" || !learnerId) throw new Error("Explicit learner required");
  const db = await openMathExposureDB(factory);
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction("learners", "readonly"), r = tx.objectStore("learners").get(learnerId);
    r.onsuccess = () => resolve(r.result?.sessions || []); r.onerror = () => reject(r.error);
  }); } finally { db.close(); }
}
