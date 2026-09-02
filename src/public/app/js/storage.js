import { normalizeDraft } from "./draftEngine.js";
import { getGradingProgress, normalizeGradeDecision, createGradeDecision } from "./parentGrading.js";

/**
 * Math Canvas Pro - IndexedDB 로컬 영구 스토리지 관리자 (Phase F1: 스키마 버전 및 학습자 프로필)
 * SSOT Section 95~108 및 Phase F1 명세 준수
 * - DB_VERSION 3 업그레이드 및 learnerProfiles Store 추가
 * - 학습자별 데이터 격리 (sessions, attempts, mistakes, stageProgress, strokes, draftSessions)
 * - 레거시 데이터 호환 계약 (DEFAULT_LEGACY_LEARNER_ID)
 * - 현재 선택 학습자(Active Learner) 상태 관리
 */

const DB_NAME = "math_canvas_pro_db";
const DB_VERSION = 5;

//+_+// 기존 레거시 데이터 및 미지정 데이터용 기본 학습자 식별자
export const DEFAULT_LEGACY_LEARNER_ID = "legacy_default_learner";
const ACTIVE_LEARNER_STORAGE_KEY = "math_canvas_pro_active_learner_id";

let dbPromise = null;
let activeLearnerId = null;

// ============================================================================
// 1. 현재 학습자 상태 관리
// ============================================================================

export function setCurrentLearnerId(learnerId) {
  if (learnerId !== null && learnerId !== undefined) {
    activeLearnerId = String(learnerId).trim();
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(ACTIVE_LEARNER_STORAGE_KEY, activeLearnerId);
      } catch (_) {}
    }
  } else {
    activeLearnerId = null;
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.removeItem(ACTIVE_LEARNER_STORAGE_KEY);
      } catch (_) {}
    }
  }
  return activeLearnerId;
}

export function getCurrentLearnerId() {
  if (activeLearnerId) return activeLearnerId;
  if (typeof localStorage !== "undefined") {
    try {
      const saved = localStorage.getItem(ACTIVE_LEARNER_STORAGE_KEY);
      if (saved) {
        activeLearnerId = saved;
        return activeLearnerId;
      }
    } catch (_) {}
  }
  return null;
}

export function resolveActiveLearnerId(options = {}) {
  if (options.learnerId) return options.learnerId;
  return getCurrentLearnerId() || DEFAULT_LEGACY_LEARNER_ID;
}

export function clearCurrentLearner() {
  activeLearnerId = null;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(ACTIVE_LEARNER_STORAGE_KEY);
    } catch (_) {}
  }
}

export function _resetActiveLearnerInMemoryForTesting() {
  activeLearnerId = null;
}

export async function restoreActiveLearner(options = {}) {
  let storedId = null;
  if (typeof localStorage !== "undefined") {
    try {
      storedId = localStorage.getItem(ACTIVE_LEARNER_STORAGE_KEY);
    } catch (_) {}
  }
  if (!storedId) {
    storedId = activeLearnerId;
  }

  if (storedId) {
    const profile = await getLearnerProfile(storedId);
    if (profile && !profile.archived) {
      activeLearnerId = profile.id;
      return profile.id;
    }
  }

  // storedId가 없거나 유효하지 않거나(미존재) 보관(archived)된 경우 -> 활성 목록에서 fallback
  const activeLearners = await getActiveLearners();
  if (activeLearners.length > 0) {
    const fallbackId = activeLearners[0].id;
    setCurrentLearnerId(fallbackId);
    return fallbackId;
  }

  clearCurrentLearner();
  return null;
}

export async function closeDB() {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      if (db && typeof db.close === "function") {
        db.close();
      }
    } catch (_) {}
    dbPromise = null;
  }
}

// ============================================================================
// 2. IndexedDB 연결 및 스키마 관리
// ============================================================================

export function getDB() {
  if (dbPromise) return dbPromise;

  if (typeof indexedDB === "undefined") {
    return Promise.resolve(createMemoryFallbackDB());
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. sessions store
      if (!db.objectStoreNames.contains("sessions")) {
        const sessionStore = db.createObjectStore("sessions", { keyPath: "id" });
        sessionStore.createIndex("completedAt", "completedAt", { unique: false });
        sessionStore.createIndex("operation", "operation", { unique: false });
        sessionStore.createIndex("learnerId", "learnerId", { unique: false });
      } else {
        const sessionStore = request.transaction.objectStore("sessions");
        if (!sessionStore.indexNames.contains("learnerId")) {
          sessionStore.createIndex("learnerId", "learnerId", { unique: false });
        }
      }

      // 2. attempts store
      if (!db.objectStoreNames.contains("attempts")) {
        const attemptStore = db.createObjectStore("attempts", { keyPath: "id" });
        attemptStore.createIndex("sessionId", "sessionId", { unique: false });
        attemptStore.createIndex("questionKey", "questionKey", { unique: false });
        attemptStore.createIndex("stageId", "stageId", { unique: false });
        attemptStore.createIndex("completedAt", "completedAt", { unique: false });
        attemptStore.createIndex("isCorrect", "isCorrect", { unique: false });
        attemptStore.createIndex("learnerId", "learnerId", { unique: false });
      } else {
        const attemptStore = request.transaction.objectStore("attempts");
        if (!attemptStore.indexNames.contains("learnerId")) {
          attemptStore.createIndex("learnerId", "learnerId", { unique: false });
        }
      }

      // 3. mistakes store
      if (!db.objectStoreNames.contains("mistakes")) {
        const mistakeStore = db.createObjectStore("mistakes", { keyPath: "key" });
        mistakeStore.createIndex("lastWrongAt", "lastWrongAt", { unique: false });
        mistakeStore.createIndex("stageId", "stageId", { unique: false });
        mistakeStore.createIndex("learnerId", "learnerId", { unique: false });
      } else {
        const mistakeStore = request.transaction.objectStore("mistakes");
        if (!mistakeStore.indexNames.contains("learnerId")) {
          mistakeStore.createIndex("learnerId", "learnerId", { unique: false });
        }
      }

      // 4. stageProgress store
      if (!db.objectStoreNames.contains("stageProgress")) {
        const progressStore = db.createObjectStore("stageProgress", { keyPath: "stageKey" });
        progressStore.createIndex("macroLevelId", "macroLevelId", { unique: false });
        progressStore.createIndex("status", "status", { unique: false });
        progressStore.createIndex("learnerId", "learnerId", { unique: false });
      } else {
        const progressStore = request.transaction.objectStore("stageProgress");
        if (!progressStore.indexNames.contains("learnerId")) {
          progressStore.createIndex("learnerId", "learnerId", { unique: false });
        }
      }

      // 5. strokes store
      if (!db.objectStoreNames.contains("strokes")) {
        db.createObjectStore("strokes", { keyPath: "sessionId_questionId" });
      }

      // 6. draftSessions store
      if (!db.objectStoreNames.contains("draftSessions")) {
        const draftStore = db.createObjectStore("draftSessions", { keyPath: "id" });
        draftStore.createIndex("learnerId", "learnerId", { unique: false });
      } else {
        const draftStore = request.transaction.objectStore("draftSessions");
        if (!draftStore.indexNames.contains("learnerId")) {
          draftStore.createIndex("learnerId", "learnerId", { unique: false });
        }
      }

      //+_+// 7. learnerProfiles store (Phase F1)
      if (!db.objectStoreNames.contains("learnerProfiles")) {
        const profileStore = db.createObjectStore("learnerProfiles", { keyPath: "id" });
        profileStore.createIndex("updatedAt", "updatedAt", { unique: false });
        profileStore.createIndex("lastActiveAt", "lastActiveAt", { unique: false });
        profileStore.createIndex("archived", "archived", { unique: false });
      }

      //+_+// 8. submissions store (Phase F4: 불변 제출 Snapshot & Lock)
      if (!db.objectStoreNames.contains("submissions")) {
        const submissionStore = db.createObjectStore("submissions", { keyPath: "id" });
        submissionStore.createIndex("sessionId", "sessionId", { unique: false });
        submissionStore.createIndex("learnerId", "learnerId", { unique: false });
        submissionStore.createIndex("submittedAt", "submittedAt", { unique: false });
        submissionStore.createIndex("status", "status", { unique: false });
        submissionStore.createIndex("subjectId", "subjectId", { unique: false });
      } else {
        const submissionStore = request.transaction.objectStore("submissions");
        if (!submissionStore.indexNames.contains("learnerId")) {
          submissionStore.createIndex("learnerId", "learnerId", { unique: false });
        }
      }

      //+_+// 9. progressAggregates store (Phase F6: 결과 확정 및 통계 재계산)
      if (!db.objectStoreNames.contains("progressAggregates")) {
        const progressAggStore = db.createObjectStore("progressAggregates", { keyPath: "id" });
        progressAggStore.createIndex("learnerId", "learnerId", { unique: false });
        progressAggStore.createIndex("subjectId", "subjectId", { unique: false });
        progressAggStore.createIndex("levelId", "levelId", { unique: false });
        progressAggStore.createIndex("macroLevelId", "macroLevelId", { unique: false });
        progressAggStore.createIndex("updatedAt", "updatedAt", { unique: false });
      } else {
        const progressAggStore = request.transaction.objectStore("progressAggregates");
        if (!progressAggStore.indexNames.contains("learnerId")) {
          progressAggStore.createIndex("learnerId", "learnerId", { unique: false });
        }
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(new Error(`IndexedDB 열기 실패: ${event.target.error}`));
    };
  });

  return dbPromise;
}

// ============================================================================
// 3. 메모리 Fallback DB (Node.js 테스트 및 mock 환경용)
// ============================================================================

let memoryStore = {
  learnerProfiles: new Map(),
  sessions: new Map(),
  attempts: new Map(),
  mistakes: new Map(),
  stageProgress: new Map(),
  strokes: new Map(),
  draftSessions: new Map(),
  submissions: new Map(),
  progressAggregates: new Map()
};

function createMemoryFallbackDB() {
  return {
    isMemory: true,
    learnerProfiles: memoryStore.learnerProfiles,
    sessions: memoryStore.sessions,
    attempts: memoryStore.attempts,
    mistakes: memoryStore.mistakes,
    stageProgress: memoryStore.stageProgress,
    strokes: memoryStore.strokes,
    draftSessions: memoryStore.draftSessions,
    submissions: memoryStore.submissions,
    progressAggregates: memoryStore.progressAggregates
  };
}

// ============================================================================
// 4. 학습자 프로필(LearnerProfile) CRUD API
// ============================================================================

export async function createLearnerProfile({ name, icon, avatarKey, migrationSource, isLegacyDefault } = {}) {
  const trimmedName = String(name || "").trim();
  if (!trimmedName) {
    throw new Error("학습자 이름이 필요합니다.");
  }

  const db = await getDB();
  const id = `learner_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  const selectedIcon = icon || avatarKey || "avatar_1";

  const profile = {
    id,
    name: trimmedName,
    icon: selectedIcon,
    avatarKey: selectedIcon,
    createdAt: now,
    updatedAt: now,
    lastActiveAt: now,
    archived: false,
    archivedAt: null,
    ...(migrationSource !== undefined ? { migrationSource } : {}),
    ...(isLegacyDefault !== undefined ? { isLegacyDefault } : {})
  };

  if (db.isMemory) {
    db.learnerProfiles.set(id, profile);
    if (!getCurrentLearnerId()) {
      setCurrentLearnerId(id);
    }
    return profile;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction("learnerProfiles", "readwrite");
    tx.objectStore("learnerProfiles").put(profile);
    tx.oncomplete = () => {
      if (!getCurrentLearnerId()) {
        setCurrentLearnerId(id);
      }
      resolve(profile);
    };
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function updateLearnerProfile(id, updates = {}) {
  if (!id) throw new Error("업데이트할 학습자 ID가 필요합니다.");
  const db = await getDB();
  const existing = await getLearnerProfile(id);
  if (!existing) {
    throw new Error(`해당 ID(${id})의 학습자 프로필을 찾을 수 없습니다.`);
  }

  const now = Date.now();
  const updatedProfile = {
    ...existing,
    name: updates.name !== undefined ? String(updates.name).trim() : existing.name,
    avatar: updates.avatar || updates.icon || updates.avatarKey || existing.avatar || existing.icon || "🌱",
    icon: updates.avatar || updates.icon || updates.avatarKey || existing.icon || existing.avatar || "🌱",
    avatarKey: updates.avatar || updates.icon || updates.avatarKey || existing.avatarKey || existing.avatar || "🌱",
    archived: updates.archived !== undefined ? Boolean(updates.archived) : existing.archived,
    archivedAt: updates.archivedAt !== undefined ? updates.archivedAt : existing.archivedAt,
    lastActiveAt: updates.lastActiveAt !== undefined ? updates.lastActiveAt : existing.lastActiveAt,
    updatedAt: now
  };

  if (!updatedProfile.name) {
    throw new Error("학습자 이름은 비워둘 수 없습니다.");
  }

  if (db.isMemory) {
    db.learnerProfiles.set(id, updatedProfile);
    return updatedProfile;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction("learnerProfiles", "readwrite");
    tx.objectStore("learnerProfiles").put(updatedProfile);
    tx.oncomplete = () => resolve(updatedProfile);
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function archiveLearnerProfile(id) {
  const updated = await updateLearnerProfile(id, {
    archived: true,
    archivedAt: Date.now()
  });

  // 현재 선택된 학습자가 보관된 경우 다른 활성 학습자 또는 기본값으로 전환
  if (getCurrentLearnerId() === id) {
    const activeLearners = await getActiveLearners();
    if (activeLearners.length > 0) {
      setCurrentLearnerId(activeLearners[0].id);
    } else {
      clearCurrentLearner();
    }
  }

  return updated;
}

export async function unarchiveLearnerProfile(id) {
  return updateLearnerProfile(id, {
    archived: false,
    archivedAt: null
  });
}

export async function getLearnerProfile(id) {
  if (!id) return null;
  const db = await getDB();

  if (db.isMemory) {
    return db.learnerProfiles.get(id) || null;
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction("learnerProfiles", "readonly");
      const req = tx.objectStore("learnerProfiles").get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    } catch (_) {
      resolve(null);
    }
  });
}

export async function getAllLearnerProfiles({ includeArchived = false } = {}) {
  const db = await getDB();
  let all = [];

  if (db.isMemory) {
    all = Array.from(db.learnerProfiles.values());
  } else {
    all = await new Promise((resolve, reject) => {
      try {
        const tx = db.transaction("learnerProfiles", "readonly");
        const req = tx.objectStore("learnerProfiles").getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = (e) => reject(e.target.error);
      } catch (_) {
        resolve([]);
      }
    });
  }

  if (!includeArchived) {
    all = all.filter((p) => !p.archived);
  }

  return all.sort((a, b) => (b.lastActiveAt || b.createdAt || 0) - (a.lastActiveAt || a.createdAt || 0));
}

export async function getActiveLearners() {
  return getAllLearnerProfiles({ includeArchived: false });
}

export async function deleteLearnerProfile(id) {
  if (!id) return false;
  const db = await getDB();

  if (getCurrentLearnerId() === id) {
    const activeLearners = (await getActiveLearners()).filter((p) => p.id !== id);
    if (activeLearners.length > 0) {
      setCurrentLearnerId(activeLearners[0].id);
    } else {
      clearCurrentLearner();
    }
  }

  if (db.isMemory) {
    db.learnerProfiles.delete(id);
    return true;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction("learnerProfiles", "readwrite");
    tx.objectStore("learnerProfiles").delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

// ============================================================================
// 5. 세션 및 학습 기록 저장 / 조회 API (learnerId 격리)
// ============================================================================

export function resolveSessionOperation(session) {
  if (!session) return "mul";
  if (session.operation === "div" || session.operation === "mul") return session.operation;
  if (session.config?.operation === "div" || session.config?.operation === "mul") return session.config.operation;
  if (session.results && session.results.length > 0 && session.results[0].operation) {
    return session.results[0].operation === "div" ? "div" : "mul";
  }
  return "mul";
}

/**
 * 완료된 세션 기록 및 스트로크, 오답 큐 저장 (learnerId 격리 적용)
 */
export async function saveSessionRecord(summary, strokesMap = new Map(), gradingStrokesMap = new Map(), options = {}) {
  const db = await getDB();
  const sessionId = summary.sessionId || summary.id || `session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();

  const learnerId = summary.learnerId || options.learnerId || getCurrentLearnerId() || DEFAULT_LEGACY_LEARNER_ID;

  const operation = summary.operation || summary.config?.operation || summary.results?.[0]?.operation || "mul";
  const mathFormat = summary.mathFormat || summary.config?.mathFormat || "vertical";
  const macroLevelId = summary.macroLevelId || summary.config?.macroLevelId || summary.results?.[0]?.level || (operation === "div" ? "D1" : "M1");
  const stageId = summary.stageId || summary.config?.stageId || macroLevelId;

  const sessionRecord = {
    ...summary,
    id: sessionId,
    learnerId,
    operation,
    mathFormat,
    macroLevelId,
    stageId,
    completedAt: now,
    results: (summary.results || []).map((r) => {
      const qAns = r.answer !== undefined ? r.answer : r.expectedAnswer;
      return {
        ...r,
        learnerId,
        operation: r.operation || operation,
        answer: qAns,
        expectedAnswer: qAns,
        strokes: strokesMap.get(r.questionId) || r.strokes || [],
        studentStrokes: strokesMap.get(r.questionId) || r.studentStrokes || r.strokes || [],
        gradingStrokes: gradingStrokesMap.get(r.questionId) || r.gradingStrokes || []
      };
    })
  };

  if (db.isMemory) {
    db.sessions.set(sessionId, sessionRecord);

    sessionRecord.results.forEach((r, idx) => {
      const qKey = r.questionKey || r.key || `${r.operation || operation}:${r.operandA}:${r.operandB}`;
      const mistakeCompoundKey = (!learnerId || learnerId === DEFAULT_LEGACY_LEARNER_ID) ? qKey : `${learnerId}:${qKey}`;

      // 개별 Attempt 객체 생성 및 저장
      const attemptId = `att_${sessionId}_${r.questionId || idx}_${now}`;
      const attemptRecord = {
        id: attemptId,
        sessionId,
        learnerId,
        questionId: r.questionId || `q_${idx}`,
        questionKey: qKey,
        operation: r.operation || operation,
        macroLevelId: r.macroLevelId || macroLevelId,
        stageId: r.stageId || stageId,
        operandA: r.operandA,
        operandB: r.operandB,
        answer: r.answer,
        isCorrect: Boolean(r.isCorrect),
        solveTimeMs: r.solveTimeMs || 0,
        comment: r.comment || "",
        sourceWrongAnswerId: r.sourceWrongAnswerId || null,
        errorCategories: r.errorCategories || [],
        sourceType: r.sourceWrongAnswerId ? "retry" : "normal",
        completedAt: now
      };
      db.attempts.set(attemptId, attemptRecord);

      if (!r.isCorrect) {
        const prev = db.mistakes.get(mistakeCompoundKey) || { wrongCount: 0 };
        db.mistakes.set(mistakeCompoundKey, {
          ...r,
          key: qKey,
          id: mistakeCompoundKey,
          compoundKey: mistakeCompoundKey,
          learnerId,
          questionKey: qKey,
          operation: r.operation || operation,
          macroLevelId: r.macroLevelId || macroLevelId,
          stageId: r.stageId || stageId,
          answer: r.answer,
          expectedAnswer: r.answer,
          wrongCount: prev.wrongCount + 1,
          lastWrongAt: now
        });
      } else {
        // 정답을 맞춘 경우 해당 학습자의 오답 큐에서만 해제
        db.mistakes.delete(mistakeCompoundKey);
      }

      if (strokesMap.has(r.questionId)) {
        db.strokes.set(`${sessionId}_${r.questionId}`, {
          sessionId_questionId: `${sessionId}_${r.questionId}`,
          sessionId,
          learnerId,
          questionId: r.questionId,
          strokes: strokesMap.get(r.questionId)
        });
      }
    });

    return sessionRecord;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["sessions", "attempts", "mistakes", "strokes"], "readwrite");
    const sessionStore = tx.objectStore("sessions");
    const attemptStore = tx.objectStore("attempts");
    const mistakeStore = tx.objectStore("mistakes");
    const strokeStore = tx.objectStore("strokes");

    sessionStore.put(sessionRecord);

    sessionRecord.results.forEach((r, idx) => {
      const qKey = r.questionKey || r.key || `${r.operation || operation}:${r.operandA}:${r.operandB}`;
      const mistakeCompoundKey = (!learnerId || learnerId === DEFAULT_LEGACY_LEARNER_ID) ? qKey : `${learnerId}:${qKey}`;

      const attemptId = `att_${sessionId}_${r.questionId || idx}_${now}`;
      const attemptRecord = {
        id: attemptId,
        sessionId,
        learnerId,
        questionId: r.questionId || `q_${idx}`,
        questionKey: qKey,
        operation: r.operation || operation,
        macroLevelId: r.macroLevelId || macroLevelId,
        stageId: r.stageId || stageId,
        operandA: r.operandA,
        operandB: r.operandB,
        answer: r.answer,
        isCorrect: Boolean(r.isCorrect),
        solveTimeMs: r.solveTimeMs || 0,
        comment: r.comment || "",
        sourceWrongAnswerId: r.sourceWrongAnswerId || null,
        errorCategories: r.errorCategories || [],
        sourceType: r.sourceWrongAnswerId ? "retry" : "normal",
        completedAt: now
      };
      attemptStore.put(attemptRecord);

      if (!r.isCorrect) {
        const getReq = mistakeStore.get(mistakeCompoundKey);
        getReq.onsuccess = () => {
          const prev = getReq.result || { wrongCount: 0 };
          mistakeStore.put({
            ...r,
            key: mistakeCompoundKey,
            id: mistakeCompoundKey,
            compoundKey: mistakeCompoundKey,
            learnerId,
            questionKey: qKey,
            operation: r.operation || operation,
            macroLevelId: r.macroLevelId || macroLevelId,
            stageId: r.stageId || stageId,
            answer: r.answer,
            expectedAnswer: r.answer,
            wrongCount: prev.wrongCount + 1,
            lastWrongAt: now
          });
        };
      } else {
        mistakeStore.delete(mistakeCompoundKey);
      }

      if (strokesMap.has(r.questionId)) {
        strokeStore.put({
          sessionId_questionId: `${sessionId}_${r.questionId}`,
          sessionId,
          learnerId,
          questionId: r.questionId,
          strokes: strokesMap.get(r.questionId)
        });
      }
    });

    tx.oncomplete = () => resolve(sessionRecord);
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Attempt 단위 목록 조회 (learnerId 격리)
 */
export async function getRecentAttempts(limit = 50, filter = {}) {
  const db = await getDB();
  const targetLearnerId = filter.allLearners ? null : resolveActiveLearnerId(filter);
  let all = [];

  if (db.isMemory) {
    all = Array.from(db.attempts.values());
  } else {
    all = await new Promise((resolve, reject) => {
      const tx = db.transaction("attempts", "readonly");
      const store = tx.objectStore("attempts");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // learnerId 필터링
  if (targetLearnerId) {
    all = all.filter((a) => (a.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId);
  }

  // 추가 필터링
  if (filter.operation) {
    all = all.filter((a) => a.operation === filter.operation);
  }
  if (filter.stageId) {
    all = all.filter((a) => a.stageId === filter.stageId);
  }
  if (filter.macroLevelId) {
    all = all.filter((a) => a.macroLevelId === filter.macroLevelId);
  }

  return all
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
    .slice(0, limit);
}

/**
 * Draft Session (세션 중단 및 이어하기) 관리 (learnerId 격리)
 */
export async function saveDraftSession(draft, options = {}) {
  const db = await getDB();
  const targetLearnerId = draft.learnerId || options.learnerId || getCurrentLearnerId() || DEFAULT_LEGACY_LEARNER_ID;
  const draftKey = targetLearnerId === DEFAULT_LEGACY_LEARNER_ID ? "current_draft" : `current_draft_${targetLearnerId}`;

  const normalizedInput = {
    ...draft,
    studentStrokesMap: mapToObject(draft.studentStrokesMap || draft.strokesMap),
    gradingStrokesMap: mapToObject(draft.gradingStrokesMap),
    gradingResults: mapToObject(draft.gradingResults)
  };

  const draftRecord = {
    ...normalizeDraft(normalizedInput),
    id: draftKey,
    learnerId: targetLearnerId,
    updatedAt: Date.now()
  };

  if (db.isMemory) {
    db.draftSessions.set(draftKey, draftRecord);
    return draftRecord;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction("draftSessions", "readwrite");
    tx.objectStore("draftSessions").put(draftRecord);
    tx.oncomplete = () => resolve(draftRecord);
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function getDraftSession(options = {}) {
  const db = await getDB();
  const targetLearnerId = options.learnerId !== undefined ? options.learnerId : getCurrentLearnerId();
  const draftKey = !targetLearnerId || targetLearnerId === DEFAULT_LEGACY_LEARNER_ID ? "current_draft" : `current_draft_${targetLearnerId}`;

  if (db.isMemory) {
    const record = db.draftSessions.get(draftKey) || (targetLearnerId === DEFAULT_LEGACY_LEARNER_ID ? db.draftSessions.get("current_draft") : null);
    return record ? normalizeDraft(record) : null;
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction("draftSessions", "readonly");
      const req = tx.objectStore("draftSessions").get(draftKey);
      req.onsuccess = () => {
        try {
          resolve(req.result ? normalizeDraft(req.result) : null);
        } catch (error) {
          reject(error);
        }
      };
      req.onerror = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}

//+_+// Phase F4 Reviewer Rework 3차: 테스트용 failure injectors
let submissionFailureInjector = null;
export function _setSubmissionFailureInjectorForTesting(fn) {
  submissionFailureInjector = fn;
}

let draftCleanupFailureInjector = null;
export function _setDraftCleanupFailureInjectorForTesting(fn) {
  draftCleanupFailureInjector = fn;
}

//+_+// Phase F4 Reviewer Rework 4차: 테스트용 transaction lifecycle observer
let submissionTransactionObserver = null;
export function _setSubmissionTransactionObserverForTesting(observer) {
  submissionTransactionObserver = observer;
}

export async function clearDraftSession(options = {}) {
  //+_+// Phase F4: 테스트용 failure injection 훅
  if (typeof draftCleanupFailureInjector === "function") {
    draftCleanupFailureInjector(options);
  }
  const db = await getDB();
  const targetLearnerId = options.learnerId !== undefined ? options.learnerId : getCurrentLearnerId();
  const draftKey = !targetLearnerId || targetLearnerId === DEFAULT_LEGACY_LEARNER_ID ? "current_draft" : `current_draft_${targetLearnerId}`;

  if (db.isMemory) {
    db.draftSessions.delete(draftKey);
    return true;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction("draftSessions", "readwrite");
    tx.objectStore("draftSessions").delete(draftKey);
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * 단계별 학습 진도 및 마스터리 기록 저장 (learnerId 격리)
 */
export async function saveStageProgress(progressData, options = {}) {
  if (!progressData) throw new Error("저장할 stageProgress 데이터가 필요합니다.");
  const db = await getDB();
  const stageId = progressData.stageId || progressData.stageKey;
  if (!stageId) throw new Error("stageId 또는 stageKey가 필요합니다.");

  const targetLearnerId = progressData.learnerId || options.learnerId || getCurrentLearnerId() || DEFAULT_LEGACY_LEARNER_ID;
  const storageKey = (!targetLearnerId || targetLearnerId === DEFAULT_LEGACY_LEARNER_ID)
    ? stageId
    : `${targetLearnerId}:${stageId}`;

  const record = {
    ...progressData,
    stageKey: storageKey,
    stageId: stageId,
    learnerId: targetLearnerId,
    updatedAt: progressData.updatedAt || Date.now()
  };

  if (db.isMemory) {
    db.stageProgress.set(storageKey, record);
    return record;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction("stageProgress", "readwrite");
    tx.objectStore("stageProgress").put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * 특정 단계의 학습 진도 조회 (learnerId 격리)
 */
export async function getStageProgress(stageId, options = {}) {
  if (!stageId) return null;
  const db = await getDB();
  const targetLearnerId = options.learnerId !== undefined
    ? options.learnerId
    : (getCurrentLearnerId() || DEFAULT_LEGACY_LEARNER_ID);

  const storageKey = (!targetLearnerId || targetLearnerId === DEFAULT_LEGACY_LEARNER_ID)
    ? stageId
    : `${targetLearnerId}:${stageId}`;

  if (db.isMemory) {
    let rec = db.stageProgress.get(storageKey);
    if (!rec && targetLearnerId === DEFAULT_LEGACY_LEARNER_ID) {
      rec = db.stageProgress.get(stageId);
    }
    return rec || null;
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction("stageProgress", "readonly");
      const store = tx.objectStore("stageProgress");
      const req = store.get(storageKey);
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result);
        } else if (targetLearnerId === DEFAULT_LEGACY_LEARNER_ID) {
          const fallbackReq = store.get(stageId);
          fallbackReq.onsuccess = () => resolve(fallbackReq.result || null);
          fallbackReq.onerror = () => resolve(null);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}

/**
 * 전체 단계 학습 진도 목록 조회 (learnerId 격리)
 */
export async function getAllStageProgress(options = {}) {
  const db = await getDB();
  const targetLearnerId = options.allLearners ? null : resolveActiveLearnerId(options);
  let all = [];

  if (db.isMemory) {
    all = Array.from(db.stageProgress.values());
  } else {
    all = await new Promise((resolve, reject) => {
      try {
        const tx = db.transaction("stageProgress", "readonly");
        const store = tx.objectStore("stageProgress");
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = (e) => reject(e.target.error);
      } catch (_) {
        resolve([]);
      }
    });
  }

  if (targetLearnerId) {
    if (targetLearnerId === DEFAULT_LEGACY_LEARNER_ID) {
      all = all.filter((p) => (!p.learnerId || p.learnerId === DEFAULT_LEGACY_LEARNER_ID || !String(p.stageKey || "").includes(":")));
    } else {
      all = all.filter((p) => p.learnerId === targetLearnerId);
    }
  }

  return all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * 특정 세션의 문제별 스트로크 조회
 */
export async function getSessionStrokesMap(sessionId) {
  const db = await getDB();
  const strokesMap = new Map();

  if (db.isMemory) {
    const session = db.sessions.get(sessionId);
    if (session && session.results) {
      session.results.forEach((r) => {
        if (r.strokes) strokesMap.set(r.questionId, r.strokes);
      });
    }
    return strokesMap;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction("sessions", "readonly");
      const store = tx.objectStore("sessions");
      const req = store.get(sessionId);

      req.onsuccess = () => {
        const session = req.result;
        if (session && session.results) {
          session.results.forEach((r) => {
            if (r.strokes) strokesMap.set(r.questionId, r.strokes);
          });
        }
        resolve(strokesMap);
      };
      req.onerror = () => resolve(strokesMap);
    } catch (_) {
      resolve(strokesMap);
    }
  });
}

/**
 * 최근 완료 세션 목록 조회 (learnerId 격리)
 */
export async function getRecentSessions(limit = 10, filter = {}) {
  const db = await getDB();
  const targetLearnerId = filter.allLearners ? null : resolveActiveLearnerId(filter);
  let all = [];

  if (db.isMemory) {
    all = Array.from(db.sessions.values());
  } else {
    all = await new Promise((resolve, reject) => {
      const tx = db.transaction("sessions", "readonly");
      const store = tx.objectStore("sessions");
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  if (targetLearnerId) {
    all = all.filter((s) => (s.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId);
  }

  return all
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
    .slice(0, limit);
}

/**
 * 누적 오답 문제 목록 조회 (learnerId 격리)
 */
export async function getMistakeQuestions(filter = {}) {
  const db = await getDB();
  const targetLearnerId = filter.allLearners ? null : resolveActiveLearnerId(filter);
  let all = [];

  if (db.isMemory) {
    all = Array.from(db.mistakes.values());
  } else {
    all = await new Promise((resolve, reject) => {
      const tx = db.transaction("mistakes", "readonly");
      const store = tx.objectStore("mistakes");
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  if (targetLearnerId) {
    all = all.filter((m) => (m.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId);
  }

  return all
    .map((m) => ({
      ...m,
      key: m.questionKey || m.key
    }))
    .sort((a, b) => (b.lastWrongAt || 0) - (a.lastWrongAt || 0));
}

/**
 * 전체 완료 세션 목록 조회 (누적 통계용, learnerId 격리)
 */
export async function getAllSessions(filter = {}) {
  const db = await getDB();
  const targetLearnerId = filter.allLearners ? null : resolveActiveLearnerId(filter);
  let all = [];

  if (db.isMemory) {
    all = Array.from(db.sessions.values());
  } else {
    all = await new Promise((resolve, reject) => {
      const tx = db.transaction("sessions", "readonly");
      const store = tx.objectStore("sessions");
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  if (targetLearnerId) {
    all = all.filter((s) => (s.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId);
  }

  return all.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
}

/**
 * 전체 학습 누적 통계 집계 (learnerId 격리)
 */
export async function getLearningStats(filter = {}) {
  const sessions = await getAllSessions(filter);
  const mistakes = await getMistakeQuestions(filter);

  let totalQuestions = 0;
  let totalCorrect = 0;
  let totalSolveTimeMs = 0;

  sessions.forEach((s) => {
    totalQuestions += (s.totalQuestions || 0);
    totalCorrect += (s.correctCount || 0);
    totalSolveTimeMs += (s.totalSolveTimeMs || 0);
  });

  const averageAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  return {
    totalSessions: sessions.length,
    totalQuestions,
    totalCorrect,
    totalSolveTimeMs,
    averageAccuracy,
    mistakeCount: mistakes.length
  };
}

/**
 * 최근 통계 집계 (learnerId 격리)
 */
export async function getRecentStats(attemptLimit = 20, filter = {}) {
  const recentAttempts = await getRecentAttempts(attemptLimit, filter);
  const recentSessions = await getRecentSessions(5, filter);

  let recentQuestions = recentAttempts.length;
  let recentCorrect = 0;
  let recentSolveTimeMs = 0;

  recentAttempts.forEach((a) => {
    if (a.isCorrect) recentCorrect += 1;
    recentSolveTimeMs += (a.solveTimeMs || 0);
  });

  const recentAccuracy = recentQuestions > 0 ? Math.round((recentCorrect / recentQuestions) * 100) : 0;
  const recentAvgSolveTimeMs = recentQuestions > 0 ? Math.round(recentSolveTimeMs / recentQuestions) : 0;

  return {
    recentAttemptsCount: recentQuestions,
    recentCorrect,
    recentAccuracy,
    recentSolveTimeMs,
    recentAvgSolveTimeMs,
    recentSessionsCount: recentSessions.length
  };
}

/**
 * 표준 레퍼런스 교육과정별(Lv.1~Lv.6) 누적 학습 진행도 및 마스터리 집계 (learnerId 격리)
 */
export async function getCurriculumProgress(filter = {}) {
  const sessions = await getRecentSessions(200, filter);

  const initProgress = () => ([
    { level: 1, solved: 0, correct: 0, accuracy: 0, status: "unstarted" },
    { level: 2, solved: 0, correct: 0, accuracy: 0, status: "unstarted" },
    { level: 3, solved: 0, correct: 0, accuracy: 0, status: "unstarted" },
    { level: 4, solved: 0, correct: 0, accuracy: 0, status: "unstarted" },
    { level: 5, solved: 0, correct: 0, accuracy: 0, status: "unstarted" },
    { level: 6, solved: 0, correct: 0, accuracy: 0, status: "unstarted" }
  ]);

  const progress = {
    mul: initProgress(),
    div: initProgress()
  };

  sessions.forEach((session) => {
    const op = resolveSessionOperation(session);
    const results = session.results || [];

    results.forEach((r) => {
      let lvl = 1;
      const code = String(r.level || "");
      if (op === "mul") {
        if (code === "M1") lvl = 1;
        else if (code === "M2" || code === "M4") lvl = 2;
        else if (code === "M3" || code === "M7") lvl = 3;
        else if (code === "M5") lvl = 4;
        else if (code === "M6" || code === "M8") lvl = 5;
        else if (code === "M9") lvl = 6;
        else lvl = 2;
      } else {
        if (code === "D1") lvl = 1;
        else if (code === "D2") lvl = 2;
        else if (code === "D3") lvl = 3;
        else if (code === "D4") lvl = 4;
        else if (code === "D5") lvl = 5;
        else if (code === "D6") lvl = 6;
        else lvl = 2;
      }

      const item = progress[op][lvl - 1];
      if (item) {
        item.solved += 1;
        if (r.isCorrect) item.correct += 1;
      }
    });
  });

  // 상태 및 정답률 계산
  ["mul", "div"].forEach((op) => {
    progress[op].forEach((item) => {
      item.accuracy = item.solved > 0 ? Math.round((item.correct / item.solved) * 100) : 0;
      if (item.solved === 0) {
        item.status = "unstarted";
      } else if (item.solved >= 15 && item.accuracy >= 85) {
        item.status = "mastered";
      } else {
        item.status = "learning";
      }
    });
  });

  return progress;
}

/**
 * 날짜별(YYYY-MM-DD) 학습 데이터 및 잔디 집계 (learnerId 격리)
 */
export async function getDailyLearningMap(filter = {}) {
  const sessions = await getRecentSessions(200, filter);
  const map = new Map();

  sessions.forEach((s) => {
    const d = new Date(s.completedAt);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${day}`;

    if (!map.has(dateKey)) {
      map.set(dateKey, {
        date: dateKey,
        sessionCount: 0,
        totalQuestions: 0,
        correctQuestions: 0,
        totalSolveTimeMs: 0,
        sessions: []
      });
    }

    const entry = map.get(dateKey);
    entry.sessionCount += 1;
    entry.totalQuestions += s.totalQuestions || 0;
    entry.correctQuestions += s.correctCount || 0;
    entry.totalSolveTimeMs += s.totalSolveTimeMs || 0;
    entry.sessions.push(s);
  });

  map.forEach((entry) => {
    entry.accuracy = entry.totalQuestions > 0 ? Math.round((entry.correctQuestions / entry.totalQuestions) * 100) : 0;
  });

  return map;
}

/**
 * 연속 학습 일수 (Streak) 계산 (learnerId 격리)
 */
export async function getCurrentStreak(filter = {}) {
  const dailyMap = await getDailyLearningMap(filter);
  if (dailyMap.size === 0) return { currentStreak: 0, maxStreak: 0, todayActive: false };

  const today = new Date();
  const formatYmd = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const todayKey = formatYmd(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = formatYmd(yesterday);

  const todayActive = dailyMap.has(todayKey);
  const yesterdayActive = dailyMap.has(yesterdayKey);

  if (!todayActive && !yesterdayActive) {
    return { currentStreak: 0, maxStreak: calculateMaxStreak(dailyMap), todayActive: false };
  }

  let streak = 0;
  let checkDate = new Date(todayActive ? today : yesterday);

  while (true) {
    const key = formatYmd(checkDate);
    if (dailyMap.has(key)) {
      streak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    currentStreak: streak,
    maxStreak: Math.max(streak, calculateMaxStreak(dailyMap)),
    todayActive
  };
}

function calculateMaxStreak(dailyMap) {
  const sortedDates = Array.from(dailyMap.keys()).sort();
  if (sortedDates.length === 0) return 0;

  let max = 1;
  let current = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1]);
    const curr = new Date(sortedDates[i]);
    const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      current += 1;
      if (current > max) max = current;
    } else if (diffDays > 1) {
      current = 1;
    }
  }

  return max;
}

/**
 * 특정 날짜에 완료된 세션 목록 반환 (learnerId 격리)
 */
export async function getSessionsByDate(dateKey, filter = {}) {
  const dailyMap = await getDailyLearningMap(filter);
  const entry = dailyMap.get(dateKey);
  return entry ? entry.sessions : [];
}

/**
 * 저장소 초기화 (특정 learnerId 지정 시 해당 학습자 데이터만 초기화, 미지정 시 전체 초기화)
 */
export async function clearAllData(options = {}) {
  const db = await getDB();
  const targetLearnerId = options.learnerId;

  if (targetLearnerId) {
    // 특정 학습자의 데이터만 필터링 삭제
    if (db.isMemory) {
      for (const [key, s] of db.sessions.entries()) {
        if ((s.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId) db.sessions.delete(key);
      }
      for (const [key, a] of db.attempts.entries()) {
        if ((a.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId) db.attempts.delete(key);
      }
      for (const [key, m] of db.mistakes.entries()) {
        if ((m.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId) db.mistakes.delete(key);
      }
      for (const [key, p] of db.stageProgress.entries()) {
        if ((p.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId) db.stageProgress.delete(key);
      }
      for (const [key, st] of db.strokes.entries()) {
        if ((st.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId) db.strokes.delete(key);
      }
      for (const [key, sub] of db.submissions.entries()) {
        if ((sub.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId) db.submissions.delete(key);
      }
      for (const [key, agg] of db.progressAggregates.entries()) {
        if ((agg.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId) db.progressAggregates.delete(key);
      }
      const draftKey = targetLearnerId === DEFAULT_LEGACY_LEARNER_ID ? "current_draft" : `current_draft_${targetLearnerId}`;
      db.draftSessions.delete(draftKey);
      return true;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(["sessions", "attempts", "mistakes", "stageProgress", "strokes", "draftSessions", "submissions", "progressAggregates"], "readwrite");
      // sessions
      const sessionStore = tx.objectStore("sessions");
      sessionStore.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if ((cursor.value.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId) cursor.delete();
          cursor.continue();
        }
      };
      // attempts
      const attemptStore = tx.objectStore("attempts");
      attemptStore.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if ((cursor.value.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId) cursor.delete();
          cursor.continue();
        }
      };
      // mistakes
      const mistakeStore = tx.objectStore("mistakes");
      mistakeStore.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if ((cursor.value.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId) cursor.delete();
          cursor.continue();
        }
      };
      // stageProgress
      const progressStore = tx.objectStore("stageProgress");
      progressStore.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if ((cursor.value.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId) cursor.delete();
          cursor.continue();
        }
      };
      // strokes
      const strokeStore = tx.objectStore("strokes");
      strokeStore.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if ((cursor.value.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId) cursor.delete();
          cursor.continue();
        }
      };
      // draftSessions
      const draftStore = tx.objectStore("draftSessions");
      const draftKey = targetLearnerId === DEFAULT_LEGACY_LEARNER_ID ? "current_draft" : `current_draft_${targetLearnerId}`;
      draftStore.delete(draftKey);

      // submissions
      const submissionStore = tx.objectStore("submissions");
      submissionStore.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if ((cursor.value.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId) cursor.delete();
          cursor.continue();
        }
      };

      // progressAggregates
      const progressAggStore = tx.objectStore("progressAggregates");
      progressAggStore.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if ((cursor.value.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId) cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // 전체 초기화
  clearCurrentLearner();

  if (db.isMemory) {
    db.learnerProfiles.clear();
    db.sessions.clear();
    db.attempts.clear();
    db.mistakes.clear();
    db.stageProgress.clear();
    db.strokes.clear();
    db.draftSessions.clear();
    db.submissions.clear();
    db.progressAggregates.clear();
    return true;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["learnerProfiles", "sessions", "attempts", "mistakes", "stageProgress", "strokes", "draftSessions", "submissions", "progressAggregates"], "readwrite");
    tx.objectStore("learnerProfiles").clear();
    tx.objectStore("sessions").clear();
    tx.objectStore("attempts").clear();
    tx.objectStore("mistakes").clear();
    tx.objectStore("stageProgress").clear();
    tx.objectStore("strokes").clear();
    tx.objectStore("draftSessions").clear();
    tx.objectStore("submissions").clear();
    tx.objectStore("progressAggregates").clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

//+_+// ============================================================================
//+_+// 6. Phase F4: 불변 제출 Snapshot & Lock API
//+_+// ============================================================================

function mapToObject(mapOrObj) {
  if (mapOrObj instanceof Map) {
    return Object.fromEntries(mapOrObj.entries());
  }
  return mapOrObj && typeof mapOrObj === "object" ? { ...mapOrObj } : {};
}

function deepClone(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  return JSON.parse(JSON.stringify(obj));
}

//+_+// Phase F4: 불변 SubmissionSnapshot 저장 (원자적 트랜잭션 및 멱등성 보장)
export async function saveSubmissionSnapshot(snapshotData, options = {}) {
  if (!snapshotData) throw new Error("저장할 submission snapshot 데이터가 필요합니다.");
  const db = await getDB();
  const sessionId = snapshotData.sessionId || snapshotData.id;
  if (!sessionId) throw new Error("submission snapshot에 sessionId가 필요합니다.");

  const id = snapshotData.id || (String(sessionId).startsWith("sub_") ? sessionId : `sub_${sessionId}`);
  const learnerId = snapshotData.learnerId || options.learnerId || getCurrentLearnerId() || DEFAULT_LEGACY_LEARNER_ID;

  const now = Date.now();
  const studentStrokesMapObj = deepClone(mapToObject(snapshotData.studentStrokesMap || snapshotData.strokesMap));
  const gradingStrokesMapObj = deepClone(mapToObject(snapshotData.gradingStrokesMap));
  const gradingResultsObj = deepClone(mapToObject(snapshotData.gradingResults));

  //+_+// 불변 학생 영역과 가변 채점 영역을 분리하여 스냅샷 레코드 생성 (Deep Copy 보장)
  const snapshotRecord = {
    id,
    sessionId,
    learnerId,
    subjectId: snapshotData.subjectId || "math",
    moduleId: snapshotData.moduleId || "arithmetic",
    status: snapshotData.status || "PARENT_GRADING_PENDING",
    config: deepClone(snapshotData.config || {}),
    questions: Array.isArray(snapshotData.questions) ? deepClone(snapshotData.questions) : [],
    studentStrokesMap: studentStrokesMapObj,
    gradingStrokesMap: gradingStrokesMapObj,
    gradingResults: gradingResultsObj,
    gradingProgress: getGradingProgress(snapshotData.questions || [], gradingResultsObj),
    gradingViewMode: snapshotData.gradingViewMode || "quick",
    currentGradingQuestionId: snapshotData.currentGradingQuestionId || null,
    answersHidden: Boolean(snapshotData.answersHidden),
    totalSolveTimeMs: Math.max(0, Number(snapshotData.totalSolveTimeMs) || 0),
    perQuestionElapsedMs: deepClone(snapshotData.perQuestionElapsedMs || {}),
    totalPages: Math.max(1, Number(snapshotData.totalPages) || 1),
    pageSize: Math.max(1, Number(snapshotData.pageSize) || 4),
    cols: Math.max(1, Number(snapshotData.cols) || 2),
    rows: Math.max(1, Number(snapshotData.rows) || 2),
    inputProfile: snapshotData.inputProfile || "DESKTOP_MOUSE_PEN",
    submittedAt: Number(snapshotData.submittedAt) || now,
    schemaVersion: 4,
    appBuildId: String(snapshotData.appBuildId || "unknown"),
    gradedAt: snapshotData.gradedAt || null,
    completedAt: snapshotData.completedAt || null
  };

  if (db.isMemory) {
    if (db.submissions.has(id)) {
      return db.submissions.get(id);
    }
    db.submissions.set(id, snapshotRecord);
    return snapshotRecord;
  }

  //+_+// IndexedDB 원자적 트랜잭션 내에서 중복 검사 및 add 수행 (Race Condition 방어 및 oncomplete 이후 resolve)
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction("submissions", "readwrite");
      const store = tx.objectStore("submissions");
      let resultRecord = null;

      //+_+// Phase F4 Reviewer Rework 3차: 테스트용 failure injection
      if (typeof submissionFailureInjector === "function") {
        submissionFailureInjector({ tx, store, snapshotRecord });
      }

      const getReq = store.get(id);

      getReq.onsuccess = () => {
        if (typeof submissionTransactionObserver === "function") {
          submissionTransactionObserver("request-success");
        }
        if (getReq.result) {
          resultRecord = getReq.result;
          return;
        }
        const addReq = store.add(snapshotRecord);
        addReq.onsuccess = () => {
          if (typeof submissionTransactionObserver === "function") {
            submissionTransactionObserver("add-success");
          }
          resultRecord = snapshotRecord;
        };
        addReq.onerror = (e) => {
          // 동시 요청 충돌(ConstraintError) 발생 시 기존 레코드 조회
          try {
            e.preventDefault?.();
            e.stopPropagation?.();
          } catch (_) {}
          const readReq = store.get(id);
          readReq.onsuccess = () => {
            if (typeof submissionTransactionObserver === "function") {
              submissionTransactionObserver("read-after-conflict-success");
            }
            resultRecord = readReq.result || snapshotRecord;
          };
          readReq.onerror = (err) => reject(err.target?.error || new Error("스냅샷 저장 후 조회 실패"));
        };
      };
      getReq.onerror = (e) => reject(e.target?.error || new Error("스냅샷 조회 실패"));

      tx.oncomplete = () => {
        if (typeof submissionTransactionObserver === "function") {
          submissionTransactionObserver("transaction-complete");
        }
        if (!resultRecord) {
          reject(new Error("Submission transaction completed without result."));
          return;
        }
        resolve(resultRecord);
      };

      tx.onerror = (e) => {
        reject(e.target?.error || tx.error || new Error("Submission transaction failed."));
      };

      tx.onabort = (e) => {
        reject(tx.error || e.target?.error || new Error("Submission transaction aborted."));
      };
    } catch (err) {
      reject(err);
    }
  });
}

//+_+// Phase F4: 특정 submission 조회 (learnerId ownership 기본 강제)
export async function getSubmission(id, options = {}) {
  if (!id) return null;
  const db = await getDB();
  let record = null;

  if (db.isMemory) {
    record = db.submissions.get(id) || null;
  } else {
    record = await new Promise((resolve, reject) => {
      try {
        const tx = db.transaction("submissions", "readonly");
        const req = tx.objectStore("submissions").get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = (e) => reject(e.target?.error || new Error("조회 실패"));
      } catch (_) {
        resolve(null);
      }
    });
  }

  if (!record) return null;

  //+_+// learnerId 소유권 기본 강제: allLearners가 true가 아닌 경우 targetLearnerId와 일치해야 함
  const targetLearnerId = options.allLearners
    ? null
    : (options.learnerId || getCurrentLearnerId() || DEFAULT_LEGACY_LEARNER_ID);
  if (targetLearnerId && (record.learnerId || DEFAULT_LEGACY_LEARNER_ID) !== targetLearnerId) {
    return null;
  }

  return record;
}

export async function getSubmissionBySessionId(sessionId, options = {}) {
  if (!sessionId) return null;
  const resolvedOptions = {
    ...options,
    learnerId: options.allLearners ? null : (options.learnerId || getCurrentLearnerId() || DEFAULT_LEGACY_LEARNER_ID)
  };
  const targetId = String(sessionId).startsWith("sub_") ? sessionId : `sub_${sessionId}`;
  const direct = await getSubmission(targetId, resolvedOptions);
  if (direct) {
    return direct;
  }

  const all = await getAllSubmissions(resolvedOptions);
  return all.find((s) => s.sessionId === sessionId) || null;
}

export async function getAllSubmissions(filter = {}) {
  const db = await getDB();
  const targetLearnerId = filter.allLearners ? null : resolveActiveLearnerId(filter);
  let all = [];

  if (db.isMemory) {
    all = Array.from(db.submissions.values());
  } else {
    all = await new Promise((resolve, reject) => {
      try {
        const tx = db.transaction("submissions", "readonly");
        const req = tx.objectStore("submissions").getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = (e) => reject(e.target?.error || new Error("전체 조회 실패"));
      } catch (_) {
        resolve([]);
      }
    });
  }

  if (targetLearnerId) {
    all = all.filter((s) => (s.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId);
  }
  if (filter.status) {
    all = all.filter((s) => s.status === filter.status);
  }
  if (filter.subjectId) {
    all = all.filter((s) => s.subjectId === filter.subjectId);
  }

  return all.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
}

export async function getPendingSubmissions(filter = {}) {
  return getAllSubmissions({ ...filter, status: "PARENT_GRADING_PENDING" });
}

const ALLOWED_LIFECYCLE_TRANSITIONS = {
  PARENT_GRADING_PENDING: ["PARENT_GRADING_PENDING"],
  GRADING_ACTIVE: ["GRADING_ACTIVE", "GRADED"],
  GRADED: ["GRADED", "SESSION_COMPLETE"],
  SESSION_COMPLETE: ["SESSION_COMPLETE"]
};

//+_+// Phase F5: 전용 Start transition API (PARENT_GRADING_PENDING -> GRADING_ACTIVE 전용)
export async function startSubmissionGradingTransition(id, options = {}) {
  if (!id) throw new Error("채점을 시작할 submission ID가 필요합니다.");
  const rawExisting = await getSubmission(id, { allLearners: true });
  if (!rawExisting) {
    throw new Error(`해당 ID(${id})의 submission snapshot을 찾을 수 없습니다.`);
  }

  // 소유권 검사: 타겟 learnerId와 제출본 learnerId 불일치 시 명시적 거부
  const targetLearnerId = options.allLearners ? null : (options.learnerId || getCurrentLearnerId());
  if (targetLearnerId && (rawExisting.learnerId || DEFAULT_LEGACY_LEARNER_ID) !== targetLearnerId) {
    throw new Error("해당 제출본에 대한 접근 또는 수정 권한이 없습니다.");
  }

  const currentStatus = rawExisting.status || "PARENT_GRADING_PENDING";
  if (currentStatus !== "PARENT_GRADING_PENDING") {
    throw new Error(`PARENT_GRADING_PENDING 상태의 제출본만 채점을 시작할 수 있습니다. (현재 상태: ${currentStatus})`);
  }

  const db = await getDB();
  const updatedRecord = {
    ...rawExisting,
    status: "GRADING_ACTIVE",
    gradingViewMode: options.gradingViewMode || rawExisting.gradingViewMode || "quick",
    currentGradingQuestionId: options.currentGradingQuestionId !== undefined
      ? options.currentGradingQuestionId
      : (rawExisting.currentGradingQuestionId || null),
    answersHidden: options.answersHidden !== undefined
      ? Boolean(options.answersHidden)
      : Boolean(rawExisting.answersHidden)
  };

  if (db.isMemory) {
    db.submissions.set(id, updatedRecord);
    return updatedRecord;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction("submissions", "readwrite");
    const store = tx.objectStore("submissions");
    const request = store.put(updatedRecord);

    tx.oncomplete = () => resolve(updatedRecord);
    tx.onerror = () => reject(tx.error);
  });
}

//+_+// Phase F4/F5: 보호자 채점 정보 갱신 (소유권 검증, 전수 판정 불변식 및 forward-only lifecycle whitelist 강제)
export async function updateSubmissionGrading(id, gradingResults = {}, gradingStrokesMap = new Map(), options = {}) {
  if (!id) throw new Error("업데이트할 submission ID가 필요합니다.");
  const rawExisting = await getSubmission(id, { allLearners: true });
  if (!rawExisting) {
    throw new Error(`해당 ID(${id})의 submission snapshot을 찾을 수 없습니다.`);
  }

  //+_+// 소유권 검사: 타겟 learnerId와 제출본 learnerId 불일치 시 명시적 거부
  const targetLearnerId = options.allLearners ? null : (options.learnerId || getCurrentLearnerId());
  if (targetLearnerId && (rawExisting.learnerId || DEFAULT_LEGACY_LEARNER_ID) !== targetLearnerId) {
    throw new Error("해당 제출본에 대한 접근 또는 수정 권한이 없습니다.");
  }

  const db = await getDB();
  const now = Date.now();
  const updatedGradingResults = {
    ...(rawExisting.gradingResults || {}),
    ...mapToObject(gradingResults)
  };
  const updatedGradingStrokes = {
    ...(rawExisting.gradingStrokesMap || {}),
    ...mapToObject(gradingStrokesMap)
  };
  const gradingProgress = getGradingProgress(rawExisting.questions || [], updatedGradingResults);
  const currentStatus = rawExisting.status || "PARENT_GRADING_PENDING";
  const nextStatus = options.status || currentStatus;

  //+_+// F5 Invariant 1: Forward-only 상태 전이 Whitelist 검사 (PARENT_GRADING_PENDING -> GRADING_ACTIVE는 generic update에서 원천 차단)
  const allowedTargets = ALLOWED_LIFECYCLE_TRANSITIONS[currentStatus];
  if (!allowedTargets || !allowedTargets.includes(nextStatus)) {
    throw new Error(`유효하지 않은 채점 상태 전이입니다: ${currentStatus} -> ${nextStatus}`);
  }

  //+_+// F5 Invariant 2: GRADED 또는 SESSION_COMPLETE 전환 시 requireAllGraded 옵션 유무와 무관하게 항상 전 문제 채점 완료 필수
  if (nextStatus === "GRADED" || nextStatus === "SESSION_COMPLETE") {
    if (!gradingProgress.allGraded) {
      throw new Error(`미채점 ${gradingProgress.remaining}문제가 남아 있어 채점을 완료할 수 없습니다.`);
    }
  }

  //+_+// 불변 학생 영역(questions, studentStrokesMap, config 등) 100% 보존 & 가변 채점 영역만 갱신
  const updatedRecord = {
    ...rawExisting,
    gradingResults: updatedGradingResults,
    gradingStrokesMap: updatedGradingStrokes,
    status: nextStatus,
    gradingProgress,
    gradingViewMode: options.gradingViewMode || rawExisting.gradingViewMode || "quick",
    currentGradingQuestionId: options.currentGradingQuestionId !== undefined
      ? options.currentGradingQuestionId
      : (rawExisting.currentGradingQuestionId || null),
    answersHidden: options.answersHidden !== undefined
      ? Boolean(options.answersHidden)
      : Boolean(rawExisting.answersHidden),
    gradedAt: gradingProgress.graded > 0 ? (options.gradedAt || rawExisting.gradedAt || now) : rawExisting.gradedAt,
    completedAt: options.completedAt !== undefined ? options.completedAt : rawExisting.completedAt
  };

  if (db.isMemory) {
    db.submissions.set(id, updatedRecord);
    return updatedRecord;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction("submissions", "readwrite");
    tx.objectStore("submissions").put(updatedRecord);
    tx.oncomplete = () => resolve(updatedRecord);
    tx.onerror = (e) => reject(e.target?.error || new Error("채점 정보 갱신 실패"));
  });
}

//+_+// ============================================================================
//+_+// 7. Phase F6: ProgressAggregate 및 결과 확정/통계 재계산 API
//+_+// ============================================================================

export function buildProgressAggregateKey(learnerId, subjectId = "math", courseId = "arithmetic", unitId = "default", levelId = "all") {
  const normLearner = learnerId || DEFAULT_LEGACY_LEARNER_ID;
  const normSubject = subjectId || "math";
  const normCourse = courseId || "arithmetic";
  const normUnit = unitId || "default";
  const normLevel = levelId || "all";
  return `${normLearner}:${normSubject}:${normCourse}:${normUnit}:${normLevel}`;
}

let finalizeFailureInjector = null;
export function _setFinalizeFailureInjectorForTesting(fn) {
  finalizeFailureInjector = fn;
}

export async function saveProgressAggregate(aggregateData, options = {}) {
  if (!aggregateData) throw new Error("저장할 progressAggregate 데이터가 필요합니다.");
  const db = await getDB();
  const learnerId = aggregateData.learnerId || options.learnerId || getCurrentLearnerId() || DEFAULT_LEGACY_LEARNER_ID;
  const subjectId = aggregateData.subjectId || "math";
  const courseId = aggregateData.courseId || "arithmetic";
  const unitId = aggregateData.unitId || "default";
  const levelId = aggregateData.levelId || aggregateData.macroLevelId || "all";
  const id = aggregateData.id || buildProgressAggregateKey(learnerId, subjectId, courseId, unitId, levelId);

  const gradedAttemptCount = Math.max(0, Number(aggregateData.gradedAttemptCount) || 0);
  const correctCount = Math.max(0, Number(aggregateData.correctCount) || 0);
  const incorrectCount = Math.max(0, Number(aggregateData.incorrectCount) || 0);
  const retryRequestedCount = Math.max(0, Number(aggregateData.retryRequestedCount) || 0);
  const accuracy = gradedAttemptCount > 0 ? (correctCount / gradedAttemptCount) * 100 : 0;
  const totalSolveTimeMs = Math.max(0, Number(aggregateData.totalSolveTimeMs) || 0);
  const averageSolveTimeMs = gradedAttemptCount > 0 ? Math.round(totalSolveTimeMs / gradedAttemptCount) : 0;
  const sessionCount = Math.max(0, Number(aggregateData.sessionCount) || 0);
  const updatedAt = Number(aggregateData.updatedAt) || Date.now();

  const record = {
    id,
    learnerId,
    subjectId,
    courseId,
    unitId,
    levelId,
    macroLevelId: aggregateData.macroLevelId || levelId,
    gradedAttemptCount,
    correctCount,
    incorrectCount,
    retryRequestedCount,
    accuracy,
    totalSolveTimeMs,
    averageSolveTimeMs,
    sessionCount,
    updatedAt
  };

  if (db.isMemory) {
    db.progressAggregates.set(id, record);
    return record;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction("progressAggregates", "readwrite");
    tx.objectStore("progressAggregates").put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = (e) => reject(e.target?.error || tx.error || new Error("ProgressAggregate 저장 실패"));
  });
}

export async function getProgressAggregate(id, options = {}) {
  if (!id) return null;
  const db = await getDB();
  let record = null;

  if (db.isMemory) {
    record = db.progressAggregates.get(id) || null;
  } else {
    record = await new Promise((resolve, reject) => {
      try {
        const tx = db.transaction("progressAggregates", "readonly");
        const req = tx.objectStore("progressAggregates").get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = (e) => reject(e.target?.error || new Error("ProgressAggregate 조회 실패"));
      } catch (_) {
        resolve(null);
      }
    });
  }

  if (!record) return null;

  const targetLearnerId = options.allLearners ? null : (options.learnerId || getCurrentLearnerId() || DEFAULT_LEGACY_LEARNER_ID);
  if (targetLearnerId && (record.learnerId || DEFAULT_LEGACY_LEARNER_ID) !== targetLearnerId) {
    return null;
  }
  return record;
}

export async function getProgressAggregateByLevel(learnerId, levelId, options = {}) {
  const targetLearnerId = learnerId || getCurrentLearnerId() || DEFAULT_LEGACY_LEARNER_ID;
  const all = await getAllProgressAggregates({ ...options, learnerId: targetLearnerId });
  return all.find((a) => a.levelId === levelId || a.macroLevelId === levelId) || null;
}

export async function getAllProgressAggregates(filter = {}) {
  const db = await getDB();
  const targetLearnerId = filter.allLearners ? null : resolveActiveLearnerId(filter);
  let all = [];

  if (db.isMemory) {
    all = Array.from(db.progressAggregates.values());
  } else {
    all = await new Promise((resolve, reject) => {
      try {
        const tx = db.transaction("progressAggregates", "readonly");
        const req = tx.objectStore("progressAggregates").getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = (e) => reject(e.target?.error || new Error("전체 조회 실패"));
      } catch (_) {
        resolve([]);
      }
    });
  }

  if (targetLearnerId) {
    all = all.filter((a) => (a.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId);
  }
  if (filter.subjectId) {
    all = all.filter((a) => a.subjectId === filter.subjectId);
  }
  if (filter.levelId) {
    all = all.filter((a) => a.levelId === filter.levelId || a.macroLevelId === filter.levelId);
  }

  return all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

//+_+// Phase F6: 확정된 제출본 목록으로부터 학습자의 ProgressAggregate를 순수하게 계산 (DB I/O 없음)
export function calculateProgressAggregatesForLearner(targetLearnerId, finalizedSubs = [], options = {}) {
  const normLearnerId = targetLearnerId || DEFAULT_LEGACY_LEARNER_ID;
  const aggMap = new Map();

  finalizedSubs.forEach((sub) => {
    const subjectId = sub.subjectId || "math";
    const courseId = sub.courseId || sub.config?.courseId || "arithmetic";
    const sessionId = sub.sessionId || sub.id;
    const questions = sub.questions || [];
    const gradingResults = sub.gradingResults || {};

    questions.forEach((q) => {
      const grade = gradingResults[q.id] || q.grade;
      const decision = normalizeGradeDecision(grade?.decision ?? grade?.isCorrect);
      if (!decision) return;

      const unitId = sub.unitId || sub.config?.operation || (q.operation === "div" ? "div" : "mul") || "default";
      const levelId = q.level || q.macroLevelId || sub.config?.macroLevelId || (q.operation === "div" ? "D1" : "M1");
      const macroLevelId = q.macroLevelId || q.level || (q.operation === "div" ? "D1" : "M1");

      const compoundKey = buildProgressAggregateKey(normLearnerId, subjectId, courseId, unitId, levelId);

      if (!aggMap.has(compoundKey)) {
        aggMap.set(compoundKey, {
          id: compoundKey,
          learnerId: normLearnerId,
          subjectId,
          courseId,
          unitId,
          levelId,
          macroLevelId,
          gradedAttemptCount: 0,
          correctCount: 0,
          incorrectCount: 0,
          retryRequestedCount: 0,
          totalSolveTimeMs: 0,
          sessionsSet: new Set()
        });
      }

      const item = aggMap.get(compoundKey);
      item.gradedAttemptCount += 1;
      if (decision === "CORRECT") {
        item.correctCount += 1;
      } else if (decision === "WRONG") {
        item.incorrectCount += 1;
      } else if (decision === "RETRY") {
        item.retryRequestedCount += 1;
      }

      let qTime = 0;
      if (sub.perQuestionElapsedMs && sub.perQuestionElapsedMs[q.id] !== undefined) {
        qTime = Math.max(0, Number(sub.perQuestionElapsedMs[q.id]) || 0);
      } else if (q.solveTimeMs !== undefined) {
        qTime = Math.max(0, Number(q.solveTimeMs) || 0);
      } else if (sub.totalSolveTimeMs && questions.length > 0) {
        qTime = Math.round(Number(sub.totalSolveTimeMs) / questions.length);
      }
      item.totalSolveTimeMs += qTime;
      item.sessionsSet.add(sessionId);
    });
  });

  const now = options.updatedAt || Date.now();
  return Array.from(aggMap.values()).map((raw) => {
    const accuracy = raw.gradedAttemptCount > 0 ? (raw.correctCount / raw.gradedAttemptCount) * 100 : 0;
    const averageSolveTimeMs = raw.gradedAttemptCount > 0 ? Math.round(raw.totalSolveTimeMs / raw.gradedAttemptCount) : 0;
    return {
      id: raw.id,
      learnerId: raw.learnerId,
      subjectId: raw.subjectId,
      courseId: raw.courseId,
      unitId: raw.unitId,
      levelId: raw.levelId,
      macroLevelId: raw.macroLevelId,
      gradedAttemptCount: raw.gradedAttemptCount,
      correctCount: raw.correctCount,
      incorrectCount: raw.incorrectCount,
      retryRequestedCount: raw.retryRequestedCount,
      accuracy,
      totalSolveTimeMs: raw.totalSolveTimeMs,
      averageSolveTimeMs,
      sessionCount: raw.sessionsSet.size,
      updatedAt: now
    };
  });
}

//+_+// Phase F6: 지정 학습자의 모든 최종 확정 세션을 기반으로 ProgressAggregate를 결정론적으로 전체 재생성 (외부 복구용 API)
export async function rebuildProgressAggregatesForLearner(learnerId, options = {}) {
  const targetLearnerId = learnerId || getCurrentLearnerId() || DEFAULT_LEGACY_LEARNER_ID;
  const db = await getDB();

  // 1. 해당 학습자의 모든 제출본 조회
  const allSubs = await getAllSubmissions({ learnerId: targetLearnerId, allLearners: !targetLearnerId });
  
  // 2. 최종 확정된(GRADED, SESSION_COMPLETE) 세션만 선별 (PENDING, GRADING_ACTIVE 엄격 제외)
  const finalizedSubs = allSubs.filter((s) => s.status === "GRADED" || s.status === "SESSION_COMPLETE");

  // 3. 순수 계산
  const calculatedAggregates = calculateProgressAggregatesForLearner(targetLearnerId, finalizedSubs, options);

  if (db.isMemory) {
    for (const [key, agg] of db.progressAggregates.entries()) {
      if ((agg.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId) {
        db.progressAggregates.delete(key);
      }
    }
    calculatedAggregates.forEach((agg) => {
      db.progressAggregates.set(agg.id, agg);
    });
    return calculatedAggregates;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction("progressAggregates", "readwrite");
    const store = tx.objectStore("progressAggregates");

    // 1. 기존 학습자 aggregate 삭제 후 완료 시점에 새 aggregate 일괄 저장
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        if ((cursor.value.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId) {
          cursor.delete();
        }
        cursor.continue();
      } else {
        // 기존 레코드 정리 완료 -> 새 aggregate 일괄 삽입
        calculatedAggregates.forEach((agg) => {
          store.put(agg);
        });
      }
    };
    req.onerror = (e) => reject(req.error || e.target?.error || new Error("ProgressAggregate cursor 실패"));

    tx.oncomplete = () => resolve(calculatedAggregates);
    tx.onerror = (e) => reject(e.target?.error || tx.error || new Error("ProgressAggregate rebuild 실패"));
  });
}

//+_+// Phase F6: 보호자 채점 최종 확정 Command (단일 트랜잭션 내 Submissions/Sessions/Attempts/Mistakes/ProgressAggregates 원자적 반영)
export async function finalizeSubmissionGrading(id, options = {}) {
  if (!id) throw new Error("결과를 확정할 submission ID가 필요합니다.");
  const rawExisting = await getSubmission(id, { allLearners: true });
  if (!rawExisting) {
    throw new Error(`해당 ID(${id})의 submission snapshot을 찾을 수 없습니다.`);
  }

  // 1. 소유권 검사
  const targetLearnerId = options.allLearners ? null : (options.learnerId || getCurrentLearnerId());
  if (targetLearnerId && (rawExisting.learnerId || DEFAULT_LEGACY_LEARNER_ID) !== targetLearnerId) {
    throw new Error("해당 제출본에 대한 접근 또는 수정 권한이 없습니다.");
  }

  const currentStatus = rawExisting.status || "PARENT_GRADING_PENDING";

  // 2. 멱등성 처리: 이미 GRADED 또는 SESSION_COMPLETE로 확정된 경우 안전한 멱등 반환
  if (currentStatus === "GRADED" || currentStatus === "SESSION_COMPLETE") {
    const learnerAggs = await getAllProgressAggregates({ learnerId: rawExisting.learnerId });
    return {
      submission: rawExisting,
      sessionRecord: rawExisting,
      aggregates: learnerAggs
    };
  }

  // 3. 시작 상태 검사: GRADING_ACTIVE 상태에서만 확정 가능
  if (currentStatus !== "GRADING_ACTIVE") {
    throw new Error(`GRADING_ACTIVE 상태의 제출본만 결과를 확정할 수 있습니다. (현재 상태: ${currentStatus})`);
  }

  // 4. 채점 판정 및 진행률 전수 검사
  const updatedGradingResults = {
    ...(rawExisting.gradingResults || {}),
    ...mapToObject(options.gradingResults)
  };
  const updatedGradingStrokes = {
    ...(rawExisting.gradingStrokesMap || {}),
    ...mapToObject(options.gradingStrokesMap)
  };
  const gradingProgress = getGradingProgress(rawExisting.questions || [], updatedGradingResults);

  if (!gradingProgress.allGraded) {
    throw new Error(`미채점 ${gradingProgress.remaining}문제가 남아 있어 결과를 확정할 수 없습니다.`);
  }

  // 5. 유효 판정값 검사 (CORRECT, WRONG, RETRY 외 금지)
  for (const q of rawExisting.questions || []) {
    const grade = updatedGradingResults[q.id];
    const decision = normalizeGradeDecision(grade?.decision ?? grade?.isCorrect);
    if (!decision) {
      throw new Error(`유효하지 않은 채점 판정이 포함되어 있습니다: ${q.id}`);
    }
  }

  const db = await getDB();
  const now = Date.now();
  const completedAt = options.completedAt || now;

  const finalizedSubmission = {
    ...rawExisting,
    gradingResults: updatedGradingResults,
    gradingStrokesMap: updatedGradingStrokes,
    status: "GRADED",
    gradingProgress,
    gradedAt: rawExisting.gradedAt || now,
    completedAt
  };

  // 호환용 Session 및 Attempt 레코드 생성
  const sessionId = rawExisting.sessionId || rawExisting.id;
  const operation = rawExisting.config?.operation || rawExisting.questions[0]?.operation || "mul";
  const macroLevelId = rawExisting.config?.macroLevelId || rawExisting.questions[0]?.level || (operation === "div" ? "D1" : "M1");
  const stageId = rawExisting.config?.stageId || macroLevelId;
  const strokesMapObj = rawExisting.studentStrokesMap || {};

  const sessionResults = (rawExisting.questions || []).map((q, idx) => {
    const grade = updatedGradingResults[q.id];
    const decision = normalizeGradeDecision(grade?.decision ?? grade?.isCorrect);
    const isCorrect = decision === "CORRECT";
    const qKey = q.questionKey || q.key || `${q.operation || operation}:${q.operandA}:${q.operandB}`;
    const qAns = q.answer !== undefined ? q.answer : q.expectedAnswer;
    let qSolveTime = 0;
    if (rawExisting.perQuestionElapsedMs && rawExisting.perQuestionElapsedMs[q.id] !== undefined) {
      qSolveTime = Number(rawExisting.perQuestionElapsedMs[q.id]) || 0;
    } else if (q.solveTimeMs !== undefined) {
      qSolveTime = Number(q.solveTimeMs) || 0;
    } else if (rawExisting.totalSolveTimeMs && rawExisting.questions.length > 0) {
      qSolveTime = Math.round(Number(rawExisting.totalSolveTimeMs) / rawExisting.questions.length);
    }

    return {
      ...q,
      learnerId: rawExisting.learnerId,
      questionId: q.id || `q_${idx}`,
      questionKey: qKey,
      operation: q.operation || operation,
      level: q.level || macroLevelId,
      macroLevelId: q.macroLevelId || macroLevelId,
      stageId: q.stageId || stageId,
      operandA: q.operandA,
      operandB: q.operandB,
      answer: qAns,
      expectedAnswer: qAns,
      decision,
      gradeOutcome: decision,
      isCorrect,
      retryRequested: decision === "RETRY",
      comment: grade?.comment || "",
      solveTimeMs: qSolveTime,
      strokes: strokesMapObj[q.id] || [],
      studentStrokes: strokesMapObj[q.id] || [],
      gradingStrokes: updatedGradingStrokes[q.id] || [],
      sourceWrongAnswerId: q.sourceWrongAnswerId || null,
      errorCategories: q.errorCategories || []
    };
  });

  const correctCount = sessionResults.filter((r) => r.isCorrect).length;
  const wrongCount = sessionResults.length - correctCount;
  const accuracyRate = sessionResults.length > 0 ? Math.round((correctCount / sessionResults.length) * 100) : 0;
  const avgSolveTimeMs = sessionResults.length > 0 ? Math.round(rawExisting.totalSolveTimeMs / sessionResults.length) : 0;

  const sessionRecord = {
    id: sessionId,
    sessionId,
    learnerId: rawExisting.learnerId,
    operation,
    mathFormat: rawExisting.config?.mathFormat || "vertical",
    macroLevelId,
    stageId,
    config: rawExisting.config,
    startedAt: rawExisting.submittedAt || now,
    submittedAt: rawExisting.submittedAt || now,
    completedAt,
    totalQuestions: sessionResults.length,
    pageSize: rawExisting.pageSize || 4,
    totalPages: rawExisting.totalPages || 1,
    correctCount,
    wrongCount,
    accuracyRate,
    totalSolveTimeMs: rawExisting.totalSolveTimeMs || 0,
    averageSolveTimeMs: avgSolveTimeMs,
    results: sessionResults
  };

  // 트랜잭션 전 Aggregate 순수 계산 (원자적 쓰기를 위해 미리 계산)
  const allSubs = await getAllSubmissions({ learnerId: rawExisting.learnerId, allLearners: !rawExisting.learnerId });
  const otherFinalized = allSubs.filter((s) => s.id !== id && (s.status === "GRADED" || s.status === "SESSION_COMPLETE"));
  const allFinalizedForLearner = [...otherFinalized, finalizedSubmission];
  const calculatedAggregates = calculateProgressAggregatesForLearner(rawExisting.learnerId, allFinalizedForLearner, { updatedAt: completedAt });

  if (db.isMemory) {
    if (typeof finalizeFailureInjector === "function") {
      finalizeFailureInjector({ isMemory: true, phase: "before_write" });
    }

    const backupSubmissions = new Map(db.submissions);
    const backupSessions = new Map(db.sessions);
    const backupAttempts = new Map(db.attempts);
    const backupMistakes = new Map(db.mistakes);
    const backupProgressAggregates = new Map(db.progressAggregates);

    try {
      db.submissions.set(id, finalizedSubmission);
      db.sessions.set(sessionId, sessionRecord);

      sessionResults.forEach((r, idx) => {
        const attemptId = `att_${sessionId}_${r.questionId || idx}_${now}`;
        db.attempts.set(attemptId, {
          id: attemptId,
          sessionId,
          learnerId: rawExisting.learnerId,
          questionId: r.questionId,
          questionKey: r.questionKey,
          operation: r.operation,
          macroLevelId: r.macroLevelId,
          stageId: r.stageId,
          operandA: r.operandA,
          operandB: r.operandB,
          answer: r.answer,
          decision: r.decision,
          gradeOutcome: r.decision,
          responseState: "submitted",
          gradingState: "graded",
          isCorrect: r.isCorrect,
          retryRequested: r.retryRequested,
          solveTimeMs: r.solveTimeMs,
          comment: r.comment,
          sourceWrongAnswerId: r.sourceWrongAnswerId,
          errorCategories: r.errorCategories,
          sourceType: r.sourceWrongAnswerId ? "retry" : "normal",
          completedAt
        });

        const mistakeCompoundKey = (!rawExisting.learnerId || rawExisting.learnerId === DEFAULT_LEGACY_LEARNER_ID)
          ? r.questionKey
          : `${rawExisting.learnerId}:${r.questionKey}`;

        if (!r.isCorrect) {
          const prev = db.mistakes.get(mistakeCompoundKey) || { wrongCount: 0 };
          db.mistakes.set(mistakeCompoundKey, {
            ...r,
            key: mistakeCompoundKey,
            id: mistakeCompoundKey,
            compoundKey: mistakeCompoundKey,
            questionKey: r.questionKey,
            learnerId: rawExisting.learnerId,
            wrongCount: prev.wrongCount + 1,
            lastWrongAt: now
          });
        } else {
          db.mistakes.delete(mistakeCompoundKey);
        }
      });

      if (typeof finalizeFailureInjector === "function") {
        finalizeFailureInjector({ isMemory: true, phase: "during_aggregates" });
      }

      for (const [key, agg] of db.progressAggregates.entries()) {
        if ((agg.learnerId || DEFAULT_LEGACY_LEARNER_ID) === rawExisting.learnerId) {
          db.progressAggregates.delete(key);
        }
      }
      calculatedAggregates.forEach((agg) => {
        db.progressAggregates.set(agg.id, agg);
      });

      return {
        submission: finalizedSubmission,
        sessionRecord,
        aggregates: calculatedAggregates
      };
    } catch (err) {
      db.submissions = backupSubmissions;
      db.sessions = backupSessions;
      db.attempts = backupAttempts;
      db.mistakes = backupMistakes;
      db.progressAggregates = backupProgressAggregates;
      memoryStore.submissions = backupSubmissions;
      memoryStore.sessions = backupSessions;
      memoryStore.attempts = backupAttempts;
      memoryStore.mistakes = backupMistakes;
      memoryStore.progressAggregates = backupProgressAggregates;
      throw err;
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(["submissions", "sessions", "attempts", "mistakes", "progressAggregates"], "readwrite");
      const subStore = tx.objectStore("submissions");
      const sessStore = tx.objectStore("sessions");
      const attStore = tx.objectStore("attempts");
      const misStore = tx.objectStore("mistakes");
      const progStore = tx.objectStore("progressAggregates");

      if (typeof finalizeFailureInjector === "function") {
        finalizeFailureInjector({ tx, phase: "before_write" });
      }

      subStore.put(finalizedSubmission);
      sessStore.put(sessionRecord);

      sessionResults.forEach((r, idx) => {
        const attemptId = `att_${sessionId}_${r.questionId || idx}_${now}`;
        attStore.put({
          id: attemptId,
          sessionId,
          learnerId: rawExisting.learnerId,
          questionId: r.questionId,
          questionKey: r.questionKey,
          operation: r.operation,
          macroLevelId: r.macroLevelId,
          stageId: r.stageId,
          operandA: r.operandA,
          operandB: r.operandB,
          answer: r.answer,
          decision: r.decision,
          gradeOutcome: r.decision,
          responseState: "submitted",
          gradingState: "graded",
          isCorrect: r.isCorrect,
          retryRequested: r.retryRequested,
          solveTimeMs: r.solveTimeMs,
          comment: r.comment,
          sourceWrongAnswerId: r.sourceWrongAnswerId,
          errorCategories: r.errorCategories,
          sourceType: r.sourceWrongAnswerId ? "retry" : "normal",
          completedAt
        });

        const mistakeCompoundKey = (!rawExisting.learnerId || rawExisting.learnerId === DEFAULT_LEGACY_LEARNER_ID)
          ? r.questionKey
          : `${rawExisting.learnerId}:${r.questionKey}`;

        if (!r.isCorrect) {
          const getReq = misStore.get(mistakeCompoundKey);
          getReq.onsuccess = () => {
            const prev = getReq.result || { wrongCount: 0 };
            misStore.put({
              ...r,
              key: mistakeCompoundKey,
              id: mistakeCompoundKey,
              compoundKey: mistakeCompoundKey,
              questionKey: r.questionKey,
              learnerId: rawExisting.learnerId,
              wrongCount: prev.wrongCount + 1,
              lastWrongAt: now
            });
          };
        } else {
          misStore.delete(mistakeCompoundKey);
        }
      });

      // ProgressAggregate를 동일 트랜잭션 내부에서 일괄 교체
      const req = progStore.openCursor();
      req.onsuccess = (e) => {
        try {
          const cursor = e.target.result;
          if (cursor) {
            if ((cursor.value.learnerId || DEFAULT_LEGACY_LEARNER_ID) === rawExisting.learnerId) {
              cursor.delete();
            }
            cursor.continue();
          } else {
            if (typeof finalizeFailureInjector === "function") {
              finalizeFailureInjector({ tx, phase: "during_aggregates" });
            }
            calculatedAggregates.forEach((agg) => {
              progStore.put(agg);
            });
          }
        } catch (err) {
          try { tx.abort(); } catch (_) {}
          reject(err);
        }
      };
      req.onerror = (e) => {
        try { tx.abort(); } catch (_) {}
        reject(req.error || e.target?.error || new Error("ProgressAggregate cursor failed"));
      };

      tx.oncomplete = () => {
        resolve({
          submission: finalizedSubmission,
          sessionRecord,
          aggregates: calculatedAggregates
        });
      };

      tx.onerror = (e) => reject(tx.error || e.target?.error || new Error("Finalize transaction failed"));
      tx.onabort = (e) => reject(tx.error || e.target?.error || new Error("Finalize transaction aborted"));
    } catch (err) {
      reject(err);
    }
  });
}

//+_+// Phase F6: 최종 확정된 판정에 대한 보호자 재채점 Revision API (상태 역행 없이 GRADED 유지 & wrongCount 중복 증가 방지)
export async function reviseFinalizedGradeDecision(submissionId, questionId, newDecision, newComment, options = {}) {
  if (!submissionId) throw new Error("재채점할 submission ID가 필요합니다.");
  if (!questionId) throw new Error("재채점할 question ID가 필요합니다.");

  const rawExisting = await getSubmission(submissionId, { allLearners: true });
  if (!rawExisting) {
    throw new Error(`해당 ID(${submissionId})의 submission snapshot을 찾을 수 없습니다.`);
  }

  // 1. 소유권 검사
  const targetLearnerId = options.allLearners ? null : (options.learnerId || getCurrentLearnerId());
  if (targetLearnerId && (rawExisting.learnerId || DEFAULT_LEGACY_LEARNER_ID) !== targetLearnerId) {
    throw new Error("해당 제출본에 대한 접근 또는 수정 권한이 없습니다.");
  }

  // 2. 최종 확정 상태 검사 (GRADED 또는 SESSION_COMPLETE만 재채점 가능)
  if (rawExisting.status !== "GRADED" && rawExisting.status !== "SESSION_COMPLETE") {
    throw new Error(`최종 확정된(GRADED) 제출본만 재채점할 수 있습니다. (현재 상태: ${rawExisting.status})`);
  }

  // 3. 대상 문제 존재 검사
  const question = (rawExisting.questions || []).find((q) => q.id === questionId);
  if (!question) {
    throw new Error(`해당 ID(${questionId})의 문제를 찾을 수 없습니다.`);
  }

  // 4. 새 판정값 검증
  const normalizedDecision = normalizeGradeDecision(newDecision);
  if (!normalizedDecision) {
    throw new Error("유효하지 않은 채점 판정입니다: " + newDecision);
  }

  const now = Date.now();
  const existingGrade = rawExisting.gradingResults?.[questionId];
  const prevDecision = normalizeGradeDecision(existingGrade?.decision ?? existingGrade?.isCorrect);
  const wasMistake = prevDecision !== "CORRECT";
  const isMistake = normalizedDecision !== "CORRECT";
  const finalComment = newComment !== undefined && newComment !== null ? String(newComment).trim() : (existingGrade?.comment || "");

  const updatedGrade = {
    ...createGradeDecision(question, normalizedDecision, finalComment, existingGrade, now),
    revisedAt: now
  };

  const updatedGradingResults = {
    ...(rawExisting.gradingResults || {}),
    [questionId]: updatedGrade
  };
  const gradingProgress = getGradingProgress(rawExisting.questions || [], updatedGradingResults);

  const revisedSubmission = {
    ...rawExisting,
    gradingResults: updatedGradingResults,
    gradingProgress,
    status: rawExisting.status // GRADED 상태 유지 (역행 금지)
  };

  const db = await getDB();
  const sessionId = rawExisting.sessionId || rawExisting.id;

  // 전체 Aggregate 사전 계산
  const allSubs = await getAllSubmissions({ learnerId: rawExisting.learnerId, allLearners: !rawExisting.learnerId });
  const otherFinalized = allSubs.filter((s) => s.id !== submissionId && (s.status === "GRADED" || s.status === "SESSION_COMPLETE"));
  const allFinalizedForLearner = [...otherFinalized, revisedSubmission];
  const calculatedAggregates = calculateProgressAggregatesForLearner(rawExisting.learnerId, allFinalizedForLearner);

  const qKey = question.questionKey || question.key || `${question.operation}:${question.operandA}:${question.operandB}`;
  const mistakeCompoundKey = (!rawExisting.learnerId || rawExisting.learnerId === DEFAULT_LEGACY_LEARNER_ID)
    ? qKey
    : `${rawExisting.learnerId}:${qKey}`;

  if (db.isMemory) {
    db.submissions.set(submissionId, revisedSubmission);

    // attempts 갱신
    for (const [attId, att] of db.attempts.entries()) {
      if (att.sessionId === sessionId && att.questionId === questionId) {
        db.attempts.set(attId, {
          ...att,
          decision: normalizedDecision,
          gradeOutcome: normalizedDecision,
          isCorrect: normalizedDecision === "CORRECT",
          retryRequested: normalizedDecision === "RETRY",
          comment: finalComment,
          revisedAt: now
        });
      }
    }

    // mistakes 갱신 (F6-R2: 재채점 시 wrongCount 중복 증가 방지)
    if (isMistake) {
      const prev = db.mistakes.get(mistakeCompoundKey) || { wrongCount: 0 };
      // 기존에도 오답이었던 경우(WRONG->WRONG, WRONG->RETRY, RETRY->WRONG)는 wrongCount 유지
      const wrongCount = wasMistake ? Math.max(1, prev.wrongCount || 1) : ((prev.wrongCount || 0) + 1);
      db.mistakes.set(mistakeCompoundKey, {
        ...question,
        key: mistakeCompoundKey,
        id: mistakeCompoundKey,
        compoundKey: mistakeCompoundKey,
        questionKey: qKey,
        learnerId: rawExisting.learnerId,
        wrongCount,
        lastWrongAt: now
      });
    } else {
      // CORRECT로 변경된 경우 오답 큐에서 제거
      db.mistakes.delete(mistakeCompoundKey);
    }

    // progressAggregates 갱신
    for (const [key, agg] of db.progressAggregates.entries()) {
      if ((agg.learnerId || DEFAULT_LEGACY_LEARNER_ID) === rawExisting.learnerId) {
        db.progressAggregates.delete(key);
      }
    }
    calculatedAggregates.forEach((agg) => {
      db.progressAggregates.set(agg.id, agg);
    });

    return {
      submission: revisedSubmission,
      aggregates: calculatedAggregates
    };
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(["submissions", "attempts", "mistakes", "progressAggregates"], "readwrite");
      const subStore = tx.objectStore("submissions");
      const attStore = tx.objectStore("attempts");
      const misStore = tx.objectStore("mistakes");
      const progStore = tx.objectStore("progressAggregates");

      subStore.put(revisedSubmission);

      // attempt 갱신
      attStore.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (cursor.value.sessionId === sessionId && cursor.value.questionId === questionId) {
            cursor.update({
              ...cursor.value,
              decision: normalizedDecision,
              gradeOutcome: normalizedDecision,
              isCorrect: normalizedDecision === "CORRECT",
              retryRequested: normalizedDecision === "RETRY",
              comment: finalComment,
              revisedAt: now
            });
          }
          cursor.continue();
        }
      };

      if (isMistake) {
        const getReq = misStore.get(mistakeCompoundKey);
        getReq.onsuccess = () => {
          const prev = getReq.result || { wrongCount: 0 };
          const wrongCount = wasMistake ? Math.max(1, prev.wrongCount || 1) : ((prev.wrongCount || 0) + 1);
          misStore.put({
            ...question,
            key: mistakeCompoundKey,
            id: mistakeCompoundKey,
            compoundKey: mistakeCompoundKey,
            questionKey: qKey,
            learnerId: rawExisting.learnerId,
            wrongCount,
            lastWrongAt: now
          });
        };
      } else {
        misStore.delete(mistakeCompoundKey);
      }

      // progressAggregates 일괄 교체
      const req = progStore.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if ((cursor.value.learnerId || DEFAULT_LEGACY_LEARNER_ID) === rawExisting.learnerId) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          calculatedAggregates.forEach((agg) => {
            progStore.put(agg);
          });
        }
      };
      req.onerror = (e) => {
        try { tx.abort(); } catch (_) {}
        reject(req.error || e.target?.error || new Error("ProgressAggregate cursor failed"));
      };

      tx.oncomplete = () => {
        resolve({
          submission: revisedSubmission,
          aggregates: calculatedAggregates
        });
      };

      tx.onerror = (e) => reject(tx.error || e.target?.error || new Error("Revision transaction failed"));
    } catch (err) {
      reject(err);
    }
  });
}
