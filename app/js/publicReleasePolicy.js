// PRIVATE LOCAL INTEGRATION ONLY; not a public edition.
export const PUBLIC_RELEASE_SUBJECTS = Object.freeze(["math","english","korean"]);
export function isReleaseSubjectAllowed(id) { return PUBLIC_RELEASE_SUBJECTS.includes(id); }
