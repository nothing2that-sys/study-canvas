import {isUsableEligibilityActivity} from './aiReviewPolicy.js';
//+_+// Phase F13-R2 학년 기반 콘텐츠 노출 판정 SSOT

export const Semester = Object.freeze({ FIRST: "1", SECOND: "2", ALL: "ALL" });
export const Difficulty = Object.freeze({
  FOUNDATION: "FOUNDATION",
  STANDARD: "STANDARD",
  ADVANCED: "ADVANCED"
});
export const StudyDirection = Object.freeze({
  REVIEW: "REVIEW",
  ON_GRADE: "ON_GRADE",
  PREVIEW: "PREVIEW"
});
export const PlacementSource = Object.freeze({
  GUARDIAN: "GUARDIAN",
  OBSERVED: "OBSERVED",
  DIAGNOSTIC: "DIAGNOSTIC",
  DEFAULT: "DEFAULT"
});
export const EligibilityReason = Object.freeze({
  ELIGIBLE: "ELIGIBLE",
  EXISTING_SCOPE_PRESERVED: "EXISTING_SCOPE_PRESERVED",
  LEARNER_GRADE_UNSET: "LEARNER_GRADE_UNSET",
  LEARNER_MISMATCH: "LEARNER_MISMATCH",
  MISSING_GRADE_METADATA: "MISSING_GRADE_METADATA",
  CONTENT_NOT_APPROVED: "CONTENT_NOT_APPROVED",
  SUBJECT_DISABLED: "SUBJECT_DISABLED",
  PREVIEW_NOT_ALLOWED: "PREVIEW_NOT_ALLOWED",
  PREVIEW_RANGE_EXCEEDED: "PREVIEW_RANGE_EXCEEDED",
  REVIEW_NOT_ALLOWED: "REVIEW_NOT_ALLOWED",
  REVIEW_RANGE_EXCEEDED: "REVIEW_RANGE_EXCEEDED",
  DIFFICULTY_NOT_ALLOWED: "DIFFICULTY_NOT_ALLOWED",
  PREREQUISITE_NOT_MET: "PREREQUISITE_NOT_MET",
  CURRICULUM_VERSION_MISMATCH: "CURRICULUM_VERSION_MISMATCH",
  SEMESTER_MISMATCH: "SEMESTER_MISMATCH"
});

const VALID_DIFFICULTIES = new Set(Object.values(Difficulty));
const VALID_SEMESTERS = new Set(Object.values(Semester));
const VALID_PLACEMENT_SOURCES = new Set(Object.values(PlacementSource));
const PRESERVED_MODES = new Set(["RESUME", "REVIEW", "RETRY"]);

export function normalizeSchoolGrade(value, { allowUnset = true } = {}) {
  if (value === null || value === undefined || value === "") {
    if (allowUnset) return null;
    throw new Error("초등학교 학년(1~6학년)이 필요합니다.");
  }
  const grade = Number(value);
  if (!Number.isInteger(grade) || grade < 1 || grade > 6) {
    throw new Error(`학년은 1 이상 6 이하의 정수여야 합니다 (입력값: ${value}).`);
  }
  return grade;
}

export function normalizeSemester(value, { allowUnset = true } = {}) {
  if (value === null || value === undefined || value === "") {
    if (allowUnset) return null;
    throw new Error("학기(1, 2, ALL)가 필요합니다.");
  }
  const semester = String(value).trim().toUpperCase();
  if (!VALID_SEMESTERS.has(semester)) {
    throw new Error(`유효하지 않은 학기입니다: ${value}`);
  }
  return semester;
}

export function normalizeDifficulty(value, { allowUnset = true } = {}) {
  if (value === null || value === undefined || value === "") {
    if (allowUnset) return null;
    throw new Error("난이도(FOUNDATION, STANDARD, ADVANCED)가 필요합니다.");
  }
  const difficulty = String(value).trim().toUpperCase();
  if (!VALID_DIFFICULTIES.has(difficulty)) {
    throw new Error(`유효하지 않은 난이도입니다: ${value}`);
  }
  return difficulty;
}

export function createDefaultGuardianPolicy(learnerId = null) {
  return {
    id: learnerId ? `policy_${String(learnerId)}` : null,
    learnerId: learnerId ? String(learnerId) : null,
    allowReviewBelowGrade: true,
    maxReviewGradeDelta: 2,
    allowPreviewAboveGrade: false,
    maxPreviewGradeDelta: 0,
    allowedDifficulties: [Difficulty.FOUNDATION, Difficulty.STANDARD],
    requireGuardianForLockedRange: true
  };
}

export function normalizeGuardianLearningPolicy(input = {}, learnerId = null) {
  const defaults = createDefaultGuardianPolicy(learnerId);
  const rawDifficulties = Array.isArray(input.allowedDifficulties)
    ? input.allowedDifficulties
    : defaults.allowedDifficulties;
  const allowedDifficulties = [...new Set(rawDifficulties.map((value) => normalizeDifficulty(value, { allowUnset: false })))];
  const maxReviewGradeDelta = Number(input.maxReviewGradeDelta ?? defaults.maxReviewGradeDelta);
  const maxPreviewGradeDelta = Number(input.maxPreviewGradeDelta ?? defaults.maxPreviewGradeDelta);

  if (!Number.isInteger(maxReviewGradeDelta) || maxReviewGradeDelta < 0 || maxReviewGradeDelta > 5) {
    throw new Error("복습 허용 학년 범위는 0~5여야 합니다.");
  }
  if (!Number.isInteger(maxPreviewGradeDelta) || maxPreviewGradeDelta < 0 || maxPreviewGradeDelta > 5) {
    throw new Error("예습 허용 학년 범위는 0~5여야 합니다.");
  }

  return {
    id: defaults.id || (input.id ? String(input.id) : null),
    learnerId: defaults.learnerId || (input.learnerId ? String(input.learnerId) : null),
    allowReviewBelowGrade: input.allowReviewBelowGrade !== undefined
      ? Boolean(input.allowReviewBelowGrade)
      : defaults.allowReviewBelowGrade,
    maxReviewGradeDelta,
    allowPreviewAboveGrade: input.allowPreviewAboveGrade !== undefined
      ? Boolean(input.allowPreviewAboveGrade)
      : defaults.allowPreviewAboveGrade,
    maxPreviewGradeDelta,
    allowedDifficulties,
    requireGuardianForLockedRange: input.requireGuardianForLockedRange !== undefined
      ? Boolean(input.requireGuardianForLockedRange)
      : defaults.requireGuardianForLockedRange
  };
}

export function normalizeLearningPlacement(input = {}) {
  const source = String(input.placementSource || input.source || PlacementSource.DEFAULT).trim().toUpperCase();
  if (!VALID_PLACEMENT_SOURCES.has(source)) {
    throw new Error(`유효하지 않은 배치 출처입니다: ${input.source}`);
  }
  return {
    learnerId: input.learnerId ? String(input.learnerId) : null,
    subjectId: String(input.subjectId || "").trim().toLowerCase(),
    courseId: input.courseId ? String(input.courseId).trim().toLowerCase() : null,
    unitId: input.unitId ? String(input.unitId).trim().toLowerCase() : null,
    gradeLevel: normalizeSchoolGrade(input.gradeLevel, { allowUnset: false }),
    semester: normalizeSemester(input.semester || Semester.ALL, { allowUnset: false }),
    difficulty: normalizeDifficulty(input.difficulty || Difficulty.STANDARD, { allowUnset: false }),
    placementSource: source
  };
}

export function resolveStudyDirection(learnerGrade, contentGrade) {
  const learner = normalizeSchoolGrade(learnerGrade, { allowUnset: false });
  const content = normalizeSchoolGrade(contentGrade, { allowUnset: false });
  if (content < learner) return StudyDirection.REVIEW;
  if (content > learner) return StudyDirection.PREVIEW;
  return StudyDirection.ON_GRADE;
}

function result(eligible, reasonCode, studyDirection = null, requiresGuardianUnlock = false) {
  return { eligible, reasonCode, studyDirection, requiresGuardianUnlock };
}

export function evaluateContentEligibility({
  learner,
  content,
  policy = null,
  placement = null,
  requestedMode = "NEW",
  completedSkillIds = [],
  subjectEnabled = true,
  packageEnabled = true
} = {}) {
  const mode = String(requestedMode || "NEW").trim().toUpperCase();
  if (content?.learnerId && learner?.id && content.learnerId !== learner.id) {
    return result(false, EligibilityReason.LEARNER_MISMATCH);
  }
  if (placement?.learnerId && learner?.id && String(placement.learnerId) !== String(learner.id)) {
    return result(false, EligibilityReason.LEARNER_MISMATCH);
  }
  if (PRESERVED_MODES.has(mode)) {
    return result(true, EligibilityReason.EXISTING_SCOPE_PRESERVED);
  }

  const learnerGrade = normalizeSchoolGrade(learner?.schoolGrade, { allowUnset: true });
  if (learnerGrade === null) return result(false, EligibilityReason.LEARNER_GRADE_UNSET);
  if (!subjectEnabled || !packageEnabled || content?.status === "INACTIVE") {
    return result(false, EligibilityReason.SUBJECT_DISABLED);
  }

  let contentGrade;
  let semester;
  let difficulty;
  try {
    contentGrade = normalizeSchoolGrade(content?.gradeLevel, { allowUnset: false });
    semester = normalizeSemester(content?.semester, { allowUnset: false });
    difficulty = normalizeDifficulty(content?.difficulty, { allowUnset: false });
  } catch {
    return result(false, EligibilityReason.MISSING_GRADE_METADATA);
  }
  if (!semester || !Array.isArray(content?.achievementStandardIds) || content.achievementStandardIds.length === 0) {
    return result(false, EligibilityReason.MISSING_GRADE_METADATA);
  }

  const reviewStatus = String(content?.reviewStatus || content?.sourceMetadata?.reviewStatus || "").toUpperCase();
  if (String(content?.status || "ACTIVE").toUpperCase() !== "ACTIVE" || !isUsableEligibilityActivity(content)) {
    return result(false, EligibilityReason.CONTENT_NOT_APPROVED);
  }

  const learnerCurriculum = String(learner?.curriculumVersion || "").trim();
  const contentCurriculum = String(content?.curriculumVersion || "").trim();
  if (!learnerCurriculum || !contentCurriculum || learnerCurriculum !== contentCurriculum) {
    return result(false, EligibilityReason.CURRICULUM_VERSION_MISMATCH);
  }

  const effectivePolicy = normalizeGuardianLearningPolicy(policy || learner?.guardianPolicy || {}, learner?.id || null);
  //+_+// Placement는 추천 중심값이며 학교 학년 기준의 보호자 허용 범위를 변경하지 않는다
  const placementSemester = placement?.semester
    ? normalizeSemester(placement.semester, { allowUnset: false })
    : Semester.ALL;
  if (placementSemester !== Semester.ALL && semester !== Semester.ALL && placementSemester !== semester) {
    return result(false, EligibilityReason.SEMESTER_MISMATCH);
  }
  const direction = resolveStudyDirection(learnerGrade, contentGrade);
  const gradeDelta = Math.abs(contentGrade - learnerGrade);

  if (direction === StudyDirection.REVIEW && !effectivePolicy.allowReviewBelowGrade) {
    return result(false, EligibilityReason.REVIEW_NOT_ALLOWED, direction, effectivePolicy.requireGuardianForLockedRange);
  }
  if (direction === StudyDirection.REVIEW && gradeDelta > effectivePolicy.maxReviewGradeDelta) {
    return result(false, EligibilityReason.REVIEW_RANGE_EXCEEDED, direction, effectivePolicy.requireGuardianForLockedRange);
  }
  if (direction === StudyDirection.PREVIEW && !effectivePolicy.allowPreviewAboveGrade) {
    return result(false, EligibilityReason.PREVIEW_NOT_ALLOWED, direction, effectivePolicy.requireGuardianForLockedRange);
  }
  if (direction === StudyDirection.PREVIEW && gradeDelta > effectivePolicy.maxPreviewGradeDelta) {
    return result(false, EligibilityReason.PREVIEW_RANGE_EXCEEDED, direction, effectivePolicy.requireGuardianForLockedRange);
  }
  if (!effectivePolicy.allowedDifficulties.includes(difficulty)) {
    return result(false, EligibilityReason.DIFFICULTY_NOT_ALLOWED, direction, effectivePolicy.requireGuardianForLockedRange);
  }

  const completed = new Set((completedSkillIds || []).map(String));
  const missingPrerequisite = (content?.prerequisites || []).some((skillId) => !completed.has(String(skillId)));
  if (missingPrerequisite) {
    return result(false, EligibilityReason.PREREQUISITE_NOT_MET, direction);
  }
  return result(true, EligibilityReason.ELIGIBLE, direction);
}

export function filterEligibleNewContent(items = [], context = {}) {
  return (items || []).filter((content) => evaluateContentEligibility({ ...context, content, requestedMode: "NEW" }).eligible);
}
