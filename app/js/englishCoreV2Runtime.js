// Public release visibility and exact prior-session identity for F16B.
function assertLearningPaths(manifest) {
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

export function getReleasedEnglishCoreV2Paths(registryEntry, manifest) {
  if (!registryEntry || registryEntry.packageId !== "english-core-v2") return [];
  if (registryEntry.enabled !== true || registryEntry.status !== "APPROVED"
    || manifest?.packageId !== "english-core-v2" || manifest.releaseApproved !== true
    || manifest.reviewTrace?.runtimeAndDesignReviewComplete !== true
    || !/^[a-f0-9]{64}$/.test(manifest.reviewTrace?.cohortManifestHash || "")) return [];
  return assertLearningPaths(manifest);
}

export function getPreviewEnglishCoreV2Paths(registryEntry, manifest, localPreview) {
  if (localPreview !== true || registryEntry?.packageId !== "english-core-v2"
    || registryEntry.enabled !== true || registryEntry.status !== "STAGING"
    || manifest?.packageId !== "english-core-v2" || manifest.releaseApproved === true
    || !/^[a-f0-9]{64}$/.test(manifest.reviewTrace?.cohortManifestHash || "")
    || !/^[a-f0-9]{64}$/.test(manifest.reviewTrace?.candidateEvidenceHash || "")
    || !/^[a-f0-9]{64}$/.test(manifest.reviewTrace?.sourceEvidenceHash || "")) return [];
  return assertLearningPaths(manifest);
}

export function getPreviousEnglishCoreV2CandidateIds(submissions, path, cohortManifestHash) {
  if (!Array.isArray(submissions) || !path?.pathId || !Array.isArray(path.candidateIds)) {
    throw new Error("[F16B Runtime] Submission history and exact path are required");
  }
  const previous = submissions.find(row => row?.config?.f16b?.pathId === path.pathId
    && row.config.f16b.cohortManifestHash === cohortManifestHash);
  if (!previous) return [];
  return checkedSubmissionIds(previous, path, cohortManifestHash);
}

function checkedSubmissionIds(submission, path, cohortManifestHash) {
  const ids = submission.config.f16b.candidateIds;
  const actual = submission.questions?.map(question => question?.metadata?.reviewCandidateId);
  const declared = new Set(path.candidateIds);
  if (!Array.isArray(ids) || ids.length !== path.sessionSize
    || new Set(ids).size !== ids.length || ids.some(id => !declared.has(id))
    || !Array.isArray(actual) || actual.length !== ids.length
    || actual.some((id, index) => id !== ids[index]
      || submission.questions[index]?.metadata?.cohortManifestHash !== cohortManifestHash)) {
    throw new Error("[F16B Runtime] Prior submission candidate trace is invalid");
  }
  return ids;
}

/** Read-only, learner-free draft derived from persisted browser submissions. */
export function createEnglishCoreV2SessionTraceDraft(manifest, submissions, appBuildId, appBuildHash) {
  const hash = manifest?.reviewTrace?.cohortManifestHash;
  if (!/^[a-f0-9]{64}$/.test(hash || "") || !Array.isArray(manifest.learningPaths)
    || !Array.isArray(submissions) || !String(appBuildId || "").trim()
    || !/^[a-f0-9]{64}$/.test(appBuildHash || "")) {
    throw new Error("[F16B Runtime] Exact cohort, submissions, and app build are required");
  }
  const paths = manifest.learningPaths.map(path => {
    const selected = submissions.filter(row => row?.config?.f16b?.pathId === path.pathId
      && row.config.f16b.cohortManifestHash === hash).sort((a, b) => a.submittedAt - b.submittedAt);
    const sessions = selected.map(row => {
      if (!row.sessionId || !Number.isFinite(row.submittedAt)
        || row.appBuildId !== appBuildId || row.subjectId !== "english") {
        throw new Error(`[F16B Runtime] Submission origin is incomplete: ${path.pathId}`);
      }
      return { sessionId: row.sessionId, submittedAt: row.submittedAt,
        candidateIds: checkedSubmissionIds(row, path, hash) };
    });
    if (new Set(sessions.map(row => row.sessionId)).size !== sessions.length) {
      throw new Error(`[F16B Runtime] Duplicate session ID: ${path.pathId}`);
    }
    const disjoint = sessions.every((row, index) => index === 0
      || row.candidateIds.every(id => !sessions[index - 1].candidateIds.includes(id)));
    return { pathId: path.pathId, sessions, readyForKpiReview: sessions.length >= 2 && disjoint };
  });
  return { kind: "F16B_RUNTIME_TRACE_DRAFT_V1", manifestHash: hash,
    appBuildId, appBuildHash, captureSource: "BROWSER_SUBMISSION_EXPORT",
    readyForIndependentReview: paths.length > 0 && paths.every(path => path.readyForKpiReview),
    paths, evidenceHash: null };
}
