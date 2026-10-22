//+_+// Phase F13-R3 디지털 문제집 도메인 SSOT

export const WorkbookType = Object.freeze({
  FIXED: "FIXED",
  PERSONALIZED: "PERSONALIZED",
  REVIEW: "REVIEW",
  GUARDIAN: "GUARDIAN"
});

export const WorkbookAssignmentStatus = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  ARCHIVED: "ARCHIVED"
});

export const PageProgressStatus = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  READY_TO_SUBMIT: "READY_TO_SUBMIT",
  SUBMITTED: "SUBMITTED",
  GRADING_PENDING: "GRADING_PENDING",
  GRADED: "GRADED",
  REVIEW_DUE: "REVIEW_DUE",
  COMPLETED: "COMPLETED"
});

const VALID_TYPES = new Set(Object.values(WorkbookType));
const VALID_ASSIGNMENT_STATUSES = new Set(Object.values(WorkbookAssignmentStatus));
const VALID_SEMESTERS = new Set(["1", "2", "ALL"]);
const VALID_DIFFICULTIES = new Set(["FOUNDATION", "STANDARD", "ADVANCED"]);

function requiredText(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} 값이 필요합니다.`);
  return normalized;
}

function positiveInteger(value, label) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 1) throw new Error(`${label} 값은 1 이상의 정수여야 합니다.`);
  return normalized;
}

export function deepFreezeWorkbook(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach((child) => deepFreezeWorkbook(child));
  return Object.freeze(value);
}

export function normalizeWorkbookDefinition(input = {}) {
  const type = String(input.type || WorkbookType.FIXED).trim().toUpperCase();
  if (!VALID_TYPES.has(type)) throw new Error(`유효하지 않은 문제집 유형입니다: ${input.type}`);
  const legacyUnclassified = input.legacyUnclassified === true;
  const gradeLevel = input.gradeLevel === null || input.gradeLevel === undefined || input.gradeLevel === ""
    ? null
    : Number(input.gradeLevel);
  if (gradeLevel !== null && (!Number.isInteger(gradeLevel) || gradeLevel < 1 || gradeLevel > 6)) {
    throw new Error("문제집 학년은 1부터 6까지여야 합니다.");
  }
  if (gradeLevel === null && !legacyUnclassified) throw new Error("검수된 문제집에는 학년이 필요합니다.");
  const semester = String(input.semester || "ALL").trim().toUpperCase();
  if (!VALID_SEMESTERS.has(semester)) throw new Error(`유효하지 않은 학기입니다: ${input.semester}`);
  const difficulty = input.difficulty ? String(input.difficulty).trim().toUpperCase() : null;
  if (difficulty && !VALID_DIFFICULTIES.has(difficulty)) throw new Error(`유효하지 않은 난이도입니다: ${input.difficulty}`);
  if (!legacyUnclassified && !difficulty) throw new Error("검수된 문제집에는 표준 난이도가 필요합니다.");
  return deepFreezeWorkbook({
    workbookId: requiredText(input.workbookId, "workbookId"),
    type,
    subjectId: requiredText(input.subjectId, "subjectId").toLowerCase(),
    courseId: requiredText(input.courseId, "courseId").toLowerCase(),
    title: requiredText(input.title, "title"),
    description: String(input.description || "").trim(),
    gradeLevel,
    semester,
    difficulty,
    status: String(input.status || "ACTIVE").trim().toUpperCase(),
    legacyUnclassified,
    curriculumVersion: input.curriculumVersion ? String(input.curriculumVersion).trim() : null,
    achievementStandardIds: Array.isArray(input.achievementStandardIds) ? input.achievementStandardIds.map(String) : [],
    reviewStatus: input.reviewStatus ? String(input.reviewStatus).trim().toUpperCase() : null
  });
}

export function normalizeWorkbookPage(input = {}, workbookId, editionVersion) {
  const pageId = requiredText(input.pageId, "pageId");
  return deepFreezeWorkbook({
    pageId,
    workbookId: requiredText(input.workbookId || workbookId, "workbookId"),
    editionVersion: positiveInteger(input.editionVersion || editionVersion, "editionVersion"),
    unitId: requiredText(input.unitId || "general", "unitId"),
    title: String(input.title || `페이지 ${input.pageNumber || ""}`).trim(),
    pageNumber: positiveInteger(input.pageNumber, "pageNumber"),
    activityRefs: Array.isArray(input.activityRefs) ? input.activityRefs.map((item) => ({ ...item })) : [],
    layout: String(input.layout || "SINGLE_COLUMN").trim().toUpperCase(),
    launchTarget: input.launchTarget ? String(input.launchTarget).trim() : null
  });
}

export function normalizeWorkbookEdition(input = {}) {
  const workbookId = requiredText(input.workbookId, "workbookId");
  const editionVersion = positiveInteger(input.editionVersion, "editionVersion");
  const reviewStatus = String(input.reviewStatus || "").trim().toUpperCase();
  if (reviewStatus !== "APPROVED") throw new Error("발행 문제집 Edition은 APPROVED 상태여야 합니다.");
  const pages = (input.pages || []).map((page) => normalizeWorkbookPage(page, workbookId, editionVersion));
  if (pages.length === 0) throw new Error("문제집 Edition에는 한 페이지 이상이 필요합니다.");
  const pageIds = new Set();
  const pageNumbers = new Set();
  for (const page of pages) {
    if (page.workbookId !== workbookId || page.editionVersion !== editionVersion) throw new Error("Page의 문제집 또는 Edition 참조가 일치하지 않습니다.");
    if (pageIds.has(page.pageId) || pageNumbers.has(page.pageNumber)) throw new Error("중복된 문제집 페이지가 있습니다.");
    pageIds.add(page.pageId);
    pageNumbers.add(page.pageNumber);
  }
  pages.sort((a, b) => a.pageNumber - b.pageNumber);
  return deepFreezeWorkbook({
    workbookId,
    editionVersion,
    contentPackageRefs: Array.isArray(input.contentPackageRefs) ? input.contentPackageRefs.map((item) => ({ ...item })) : [],
    publishedAt: Number(input.publishedAt) || 0,
    reviewStatus,
    pages
  });
}

export function createWorkbookAssignment(input = {}) {
  const learnerId = requiredText(input.learnerId, "learnerId");
  const workbookId = requiredText(input.workbookId, "workbookId");
  const editionVersion = positiveInteger(input.editionVersion, "editionVersion");
  const now = Number(input.now) || Date.now();
  return normalizeWorkbookAssignment({
    assignmentId: input.assignmentId || `workbook_${learnerId}_${workbookId}_v${editionVersion}`,
    learnerId,
    workbookId,
    editionVersion,
    status: input.status || WorkbookAssignmentStatus.NOT_STARTED,
    lastPageId: input.lastPageId || null,
    bookmarkPageId: input.bookmarkPageId || null,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
    lastOpenedAt: input.lastOpenedAt || 0
  });
}

export function normalizeWorkbookAssignment(input = {}) {
  const status = String(input.status || WorkbookAssignmentStatus.NOT_STARTED).trim().toUpperCase();
  if (!VALID_ASSIGNMENT_STATUSES.has(status)) throw new Error(`유효하지 않은 Assignment 상태입니다: ${input.status}`);
  return {
    assignmentId: requiredText(input.assignmentId, "assignmentId"),
    learnerId: requiredText(input.learnerId, "learnerId"),
    workbookId: requiredText(input.workbookId, "workbookId"),
    editionVersion: positiveInteger(input.editionVersion, "editionVersion"),
    status,
    lastPageId: input.lastPageId ? String(input.lastPageId) : null,
    bookmarkPageId: input.bookmarkPageId ? String(input.bookmarkPageId) : null,
    createdAt: Number(input.createdAt) || Date.now(),
    updatedAt: Number(input.updatedAt) || Date.now(),
    lastOpenedAt: Number(input.lastOpenedAt) || 0
  };
}

export function moveWorkbookAssignment(assignment, pageId, { bookmark = false, now = Date.now() } = {}) {
  const current = normalizeWorkbookAssignment(assignment);
  const targetPageId = requiredText(pageId, "pageId");
  return normalizeWorkbookAssignment({
    ...current,
    status: current.status === WorkbookAssignmentStatus.NOT_STARTED ? WorkbookAssignmentStatus.IN_PROGRESS : current.status,
    lastPageId: targetPageId,
    bookmarkPageId: bookmark ? targetPageId : current.bookmarkPageId,
    lastOpenedAt: now,
    updatedAt: now
  });
}

export function projectWorkbookPageProgress({ pageId, draft = null, submissions = [], reviewItems = [] } = {}) {
  const id = requiredText(pageId, "pageId");
  const ownedSubmissions = (submissions || []).filter((item) => String(item?.config?.workbookPageId || item?.workbookPageId || "") === id);
  const ownedSubmissionIds = new Set(ownedSubmissions.map((item) => String(item.id || "")));
  const ownedReviews = (reviewItems || []).filter((item) => {
    const directPageId = String(item?.workbookPageId || item?.sourceWorkbookPageId || "");
    const linkedSubmission = ownedSubmissionIds.has(String(item?.sourceSubmissionId || ""));
    return (directPageId === id || linkedSubmission) && String(item?.state || "").toUpperCase() !== "RESOLVED";
  });
  if (ownedReviews.length > 0) return PageProgressStatus.REVIEW_DUE;
  if (ownedSubmissions.some((item) => item.status === "GRADED" || item.status === "SESSION_COMPLETE")) return PageProgressStatus.GRADED;
  if (ownedSubmissions.some((item) => item.status === "PARENT_GRADING_PENDING" || item.status === "GRADING_ACTIVE")) return PageProgressStatus.GRADING_PENDING;
  if (ownedSubmissions.length > 0) return PageProgressStatus.SUBMITTED;
  if (String(draft?.config?.workbookPageId || draft?.workbookPageId || "") === id) return PageProgressStatus.IN_PROGRESS;
  return PageProgressStatus.NOT_STARTED;
}

export function resolveWorkbookSpread(pageIndex, totalPages, viewportWidth) {
  const count = Math.max(0, Number(totalPages) || 0);
  const current = Math.min(Math.max(0, Number(pageIndex) || 0), Math.max(0, count - 1));
  const twoPage = Number(viewportWidth) >= 1024 && count > 1;
  return {
    mode: twoPage ? "TWO_PAGE" : "ONE_PAGE",
    visibleIndexes: twoPage ? [current, current + 1].filter((index) => index < count) : [current]
  };
}
