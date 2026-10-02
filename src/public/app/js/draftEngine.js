import { normalizeResponseRecordsMap } from "./responseEngine.js";

//+_+// Phase F10A: DRAFT_SCHEMA_VERSION 4 승격 (typed responseRecords 지원)
export const DRAFT_SCHEMA_VERSION = 4;

export const DraftSaveStatus = Object.freeze({
  IDLE: "idle",
  SCHEDULED: "scheduled",
  SAVING: "saving",
  SAVED: "saved",
  FAILED: "failed",
  CONFLICT: "conflict"
});

export function cloneDraftSnapshot(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function getDraftVersion(draft) {
  return draft ? { sessionId: draft.sessionId, revision: draft.revision,
    updatedAt: draft.updatedAt, writeId: draft.writeId || null } : null;
}

function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? cloneDraftSnapshot(value) : {};
}

export function normalizeDraft(input) {
  if (!input || typeof input !== "object") throw new TypeError("Draft 데이터가 올바르지 않습니다.");
  if (!Array.isArray(input.questions) || input.questions.length === 0) {
    throw new TypeError("Draft 문제 데이터가 누락되었습니다.");
  }

  const config = objectOrEmpty(input.config);
  const studentStrokesMap = objectOrEmpty(input.studentStrokesMap || input.strokesMap);
  const gradingStrokesMap = objectOrEmpty(input.gradingStrokesMap);
  const gradingResults = objectOrEmpty(input.gradingResults);
  for (const question of input.questions) {
    if (question?.id && question.grade && !gradingResults[question.id]) {
      gradingResults[question.id] = cloneDraftSnapshot(question.grade);
    }
  }

  //+_+// Phase F10A: typed responseRecords 지원 (v3 Draft는 빈 객체로 정상 복원)
  const responseRecords = normalizeResponseRecordsMap(input.responseRecords);

  let inputProfile = input.inputProfile;
  if (!inputProfile && input.pencilOnly !== undefined) {
    inputProfile = input.pencilOnly ? "IPAD_PEN_ONLY" : "DESKTOP_MOUSE_PEN";
  }

  const pageSize = Math.max(1, Number(config.pageSize) || 4);
  const maxPageIndex = Math.max(0, Math.ceil(input.questions.length / pageSize) - 1);
  const currentPageIndex = Math.max(0, Math.min(maxPageIndex, Number(input.currentPageIndex) || 0));
  const now = Date.now();

  const totalElapsedMs = Math.max(0, Number(input.totalElapsedMs ?? input.elapsedMs) || 0);
  let sessionState = input.sessionState || "PRACTICE_ACTIVE";
  //+_+// Phase F4: 비정상 종료된 SUBMITTING practice draft는 안전하게 PRACTICE_ACTIVE로 복원
  if ((!input.sessionType || input.sessionType === "practice") && sessionState === "SUBMITTING") {
    sessionState = "PRACTICE_ACTIVE";
  }

  return {
    id: input.id || "current_draft",
    learnerId: input.learnerId || null,
    schemaVersion: DRAFT_SCHEMA_VERSION,
    appBuildId: String(input.appBuildId || "unknown"),
    revision: Math.max(0, Number(input.revision) || 0),
    writeId: typeof input.writeId === "string" ? input.writeId : null,
    sessionId: input.sessionId || null,
    submissionId: input.submissionId || (input.sessionId ? `sub_${input.sessionId}` : null),
    sessionType: input.sessionType || "practice",
    sessionState,
    subjectId: input.subjectId || config.subjectId || "math",
    courseId: input.courseId || config.courseId || null,
    moduleId: input.moduleId || config.moduleId || null,
    config,
    questions: cloneDraftSnapshot(input.questions),
    currentPageIndex,
    studentStrokesMap,
    responseRecords,
    gradingStrokesMap,
    gradingResults,
    answersHidden: Boolean(input.answersHidden),
    gradingViewMode: input.gradingViewMode === "detail" ? "detail" : "quick",
    currentGradingQuestionId: input.currentGradingQuestionId || null,
    totalElapsedMs,
    elapsedMs: totalElapsedMs,
    perQuestionElapsedMs: objectOrEmpty(input.perQuestionElapsedMs),
    inputProfile: inputProfile || "DESKTOP_MOUSE_PEN",
    penColor: input.penColor || "#173f35",
    penWidth: Math.max(0.5, Number(input.penWidth) || 2.5),
    isEraser: Boolean(input.isEraser),
    eraserRadius: Math.max(1, Number(input.eraserRadius) || 14),
    createdAt: Number(input.createdAt) || now,
    updatedAt: Number(input.updatedAt) || now
  };
}

export function createDraftSaveCoordinator(options = {}) {
  const captureSnapshot = options.captureSnapshot;
  const save = options.save;
  const onStatusChange = options.onStatusChange;
  const setTimer = options.setTimeout || globalThis.setTimeout;
  const clearTimer = options.clearTimeout || globalThis.clearTimeout;
  if (typeof captureSnapshot !== "function" || typeof save !== "function") {
    throw new TypeError("captureSnapshot과 save 함수가 필요합니다.");
  }

  let revision = Math.max(0, Number(options.initialRevision) || 0);
  let baseVersion = options.initialBaseVersion || null;
  let generation = 0;
  let status = DraftSaveStatus.IDLE;
  let debounceTimer = null;
  let queue = Promise.resolve();
  let activePromise = null;
  let destroyed = false;

  function setStatus(nextStatus, error = null) {
    status = nextStatus;
    if (typeof onStatusChange === "function") onStatusChange(nextStatus, error);
  }

  function schedule(delayMs = 400) {
    if (destroyed) return false;
    if (debounceTimer !== null) clearTimer(debounceTimer);
    setStatus(DraftSaveStatus.SCHEDULED);
    debounceTimer = setTimer(() => {
      debounceTimer = null;
      flush().catch(() => {});
    }, Math.max(0, Number(delayMs) || 0));
    return true;
  }

  function flush() {
    if (destroyed) return Promise.resolve(false);
    if (debounceTimer !== null) {
      clearTimer(debounceTimer);
      debounceTimer = null;
    }

    const captured = captureSnapshot();
    if (!captured) {
      setStatus(DraftSaveStatus.IDLE);
      return Promise.resolve(true);
    }
    const currentRevision = ++revision;
    const snapshot = cloneDraftSnapshot({ ...captured, revision: currentRevision });
    const capturedGeneration = generation;
    setStatus(DraftSaveStatus.SAVING);

    const operation = queue
      .catch(() => {})
      .then(async () => {
        if (capturedGeneration !== generation) throw Object.assign(new Error("풀이가 변경되어 이전 저장을 중단했습니다."), { code: "DRAFT_CONFLICT" });
        const saved = await save(snapshot, options.requireBaseVersion ? { expectedBaseVersion: cloneDraftSnapshot(baseVersion) } : {});
        if (saved && capturedGeneration === generation) baseVersion = getDraftVersion(saved);
      })
      .then(() => {
        if (!destroyed && currentRevision === revision) setStatus(DraftSaveStatus.SAVED);
        return true;
      })
      .catch((error) => {
        if (!destroyed && currentRevision === revision) setStatus(error?.code === "DRAFT_CONFLICT" ? DraftSaveStatus.CONFLICT : DraftSaveStatus.FAILED, error);
        throw error;
      });
    queue = operation;
    activePromise = operation;
    operation.finally(() => {
      if (activePromise === operation) activePromise = null;
    }).catch(() => {});
    return operation;
  }

  function retry() {
    return flush();
  }

  function setRevision(nextRevision) {
    revision = Math.max(revision, Number(nextRevision) || 0);
  }

  function setBaseVersion(draft) {
    generation += 1;
    baseVersion = getDraftVersion(draft);
    if (draft) setRevision(draft.revision);
  }

  function destroy() {
    destroyed = true;
    if (debounceTimer !== null) {
      clearTimer(debounceTimer);
      debounceTimer = null;
    }
  }

  return {
    schedule,
    flush,
    retry,
    setRevision,
    setBaseVersion,
    destroy,
    get status() { return status; },
    get revision() { return revision; },
    get baseVersion() { return cloneDraftSnapshot(baseVersion); },
    get activePromise() { return activePromise; }
  };
}

export async function navigateWithDraftFlush({ flush, navigate, render }) {
  await flush();
  navigate();
  render();
  await flush();
  return true;
}
