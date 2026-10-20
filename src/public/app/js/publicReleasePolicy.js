// Private canonical app: packaging a reviewed public edition supplies a narrower policy.
export const PUBLIC_RELEASE_SUBJECTS = null;
export function isReleaseSubjectAllowed(subjectId) {
  return PUBLIC_RELEASE_SUBJECTS === null || PUBLIC_RELEASE_SUBJECTS.includes(subjectId);
}
