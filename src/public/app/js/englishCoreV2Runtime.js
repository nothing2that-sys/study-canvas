// Public release visibility and exact prior-session identity for F16B.
export function getReleasedEnglishCoreV2Paths(registryEntry, manifest) {
  if (!registryEntry || registryEntry.packageId !== "english-core-v2") return [];
  if (registryEntry.enabled !== true || registryEntry.status !== "APPROVED"
    || manifest?.packageId !== "english-core-v2" || manifest.releaseApproved !== true
    || manifest.reviewTrace?.runtimeAndDesignReviewComplete !== true
    || !/^[a-f0-9]{64}$/.test(manifest.reviewTrace?.cohortManifestHash || "")) return [];
  if (!Array.isArray(manifest.learningPaths) || manifest.learningPaths.length === 0
    || new Set(manifest.learningPaths.map(path => path.pathId)).size !== manifest.learningPaths.length
    || manifest.learningPaths.some(path => !path.pathId || !["3_4", "5_6"].includes(path.gradeBand)
      || !Number.isInteger(path.sessionSize) || path.sessionSize < 1
      || !Array.isArray(path.candidateIds) || path.candidateIds.length < path.sessionSize * 2
      || new Set(path.candidateIds).size !== path.candidateIds.length)) {
    throw new Error("[F16B Runtime] Released learning paths are invalid");
  }
  return manifest.learningPaths;
}

export function getPreviousEnglishCoreV2CandidateIds(submissions, path, cohortManifestHash) {
  if (!Array.isArray(submissions) || !path?.pathId || !Array.isArray(path.candidateIds)) {
    throw new Error("[F16B Runtime] Submission history and exact path are required");
  }
  const previous = submissions.find(row => row?.config?.f16b?.pathId === path.pathId
    && row.config.f16b.cohortManifestHash === cohortManifestHash);
  if (!previous) return [];
  const ids = previous.config.f16b.candidateIds;
  const actual = previous.questions?.map(question => question?.metadata?.reviewCandidateId);
  const declared = new Set(path.candidateIds);
  if (!Array.isArray(ids) || ids.length !== path.sessionSize
    || new Set(ids).size !== ids.length || ids.some(id => !declared.has(id))
    || !Array.isArray(actual) || actual.length !== ids.length
    || actual.some((id, index) => id !== ids[index]
      || previous.questions[index]?.metadata?.cohortManifestHash !== cohortManifestHash)) {
    throw new Error("[F16B Runtime] Prior submission candidate trace is invalid");
  }
  return ids;
}
