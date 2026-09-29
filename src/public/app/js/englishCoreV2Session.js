// Runtime F16B learning-path selection. The returned IDs can be recorded from
// real app sessions; calling this selector alone is not runtime KPI evidence.
import { normalizeLearningActivity } from "./learningActivity.js";
import { createMulberry32, hashSeed } from "./englishActivitySelector.js";

/** Select a session without repeating any item from the immediately prior one. */
export function selectEnglishCoreV2PathSession({ path, activities, previousCandidateIds = [], seed = 42,
  cohortManifestHash }) {
  if (!path?.pathId || !Array.isArray(path.candidateIds)
    || !Number.isInteger(path.sessionSize) || path.sessionSize < 1
    || new Set(path.candidateIds).size !== path.candidateIds.length
    || path.candidateIds.length < path.sessionSize
    || !Array.isArray(activities) || !Array.isArray(previousCandidateIds)
    || (cohortManifestHash !== undefined && !/^[a-f0-9]{64}$/.test(cohortManifestHash))) {
    throw new Error("[F16B Session] Exact learning path, size, and activities are required");
  }
  const declared = new Set(path.candidateIds);
  const previous = new Set(previousCandidateIds);
  if (previous.size !== previousCandidateIds.length
    || [...previous].some(id => !declared.has(id))) {
    throw new Error("[F16B Session] Previous session IDs must be unique and in this path");
  }
  const byId = new Map();
  for (const item of activities) {
    const candidateId = item?.reviewCandidateId || item?.metadata?.reviewCandidateId;
    if (!declared.has(candidateId)) continue;
    if (byId.has(candidateId) || item?.sourceMetadata?.reviewStatus !== "APPROVED"
      || item?.contentRef?.packageId !== "english-core-v2"
      || item?.metadata?.reviewCandidateId !== candidateId
      || (path.gradeBand === "3_4" && ![3, 4].includes(item.gradeLevel))
      || (path.gradeBand === "5_6" && ![5, 6].includes(item.gradeLevel))
      || (cohortManifestHash && item?.metadata?.cohortManifestHash !== cohortManifestHash)) {
      throw new Error(`[F16B Session] Duplicate or unapproved path item: ${candidateId}`);
    }
    byId.set(candidateId, item);
  }
  if (byId.size !== declared.size) {
    throw new Error(`[F16B Session] Path candidate coverage is incomplete: ${path.pathId}`);
  }
  const pool = path.candidateIds.filter(id => !previous.has(id));
  if (pool.length < path.sessionSize) {
    throw new Error(`[F16B Session] Disjoint next session is impossible: ${path.pathId}`);
  }
  const random = createMulberry32(hashSeed(`${path.pathId}:${seed}`));
  for (let index = pool.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  const candidateIds = pool.slice(0, path.sessionSize);
  return { pathId: path.pathId, candidateIds,
    activities: candidateIds.map(id => normalizeLearningActivity(byId.get(id))) };
}
