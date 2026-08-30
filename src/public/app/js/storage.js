import { normalizeDraft } from "./draftEngine.js";

/**
 * Math Canvas Pro - IndexedDB 로컬 영구 스토리지 관리자 (Phase F1: 스키마 버전 및 학습자 프로필)
 * SSOT Section 95~108 및 Phase F1 명세 준수
 * - DB_VERSION 3 업그레이드 및 learnerProfiles Store 추가
 * - 학습자별 데이터 격리 (sessions, attempts, mistakes, stageProgress, strokes, draftSessions)
 * - 레거시 데이터 호환 계약 (DEFAULT_LEGACY_LEARNER_ID)
 * - 현재 선택 학습자(Active Learner) 상태 관리
 */

const DB_NAME = "math_canvas_pro_db";
const DB_VERSION = 3;

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

      //+_+// 7. learnerProfiles store (Phase F1 신규 추가)
      if (!db.objectStoreNames.contains("learnerProfiles")) {
        const profileStore = db.createObjectStore("learnerProfiles", { keyPath: "id" });
        profileStore.createIndex("updatedAt", "updatedAt", { unique: false });
        profileStore.createIndex("lastActiveAt", "lastActiveAt", { unique: false });
        profileStore.createIndex("archived", "archived", { unique: false });
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
  draftSessions: new Map()
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
    draftSessions: memoryStore.draftSessions
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
    icon: updates.icon || updates.avatarKey || existing.icon,
    avatarKey: updates.icon || updates.avatarKey || existing.avatarKey,
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
  const sessionId = summary.sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
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

  const draftRecord = {
    ...normalizeDraft(draft),
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

export async function clearDraftSession(options = {}) {
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
      const draftKey = targetLearnerId === DEFAULT_LEGACY_LEARNER_ID ? "current_draft" : `current_draft_${targetLearnerId}`;
      db.draftSessions.delete(draftKey);
      return true;
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(["sessions", "attempts", "mistakes", "stageProgress", "strokes", "draftSessions"], "readwrite");
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
    return true;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["learnerProfiles", "sessions", "attempts", "mistakes", "stageProgress", "strokes", "draftSessions"], "readwrite");
    tx.objectStore("learnerProfiles").clear();
    tx.objectStore("sessions").clear();
    tx.objectStore("attempts").clear();
    tx.objectStore("mistakes").clear();
    tx.objectStore("stageProgress").clear();
    tx.objectStore("strokes").clear();
    tx.objectStore("draftSessions").clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}
