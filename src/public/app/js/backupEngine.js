/**
 * Math Canvas Pro - 백업 및 복원 엔진 (Milestone C)
 * SSOT Section 120~135 명세 준수
 * - JSON Export (설정, 세션, Attempt, 오답 큐, 스트로크 필기 데이터 포함)
 * - JSON Import (버전 검증, Preview, Replace vs Merge 모드, 무결성 검증)
 */

import { getDB, getAllSessions, getRecentAttempts, getMistakeQuestions, getDraftSession, clearAllData } from "./storage.js";

export const BACKUP_FORMAT_VERSION = "1.0";

/**
 * 전체 저장소 데이터를 JSON 문자열/객체로 Export
 */
export async function exportAllData() {
  const db = await getDB();
  const sessions = await getAllSessions();
  const attempts = await getRecentAttempts(100000);
  const mistakes = await getMistakeQuestions();
  const currentDraft = await getDraftSession();

  let stageProgress = [];
  let strokes = [];

  if (db.isMemory) {
    stageProgress = Array.from(db.stageProgress?.values() || []);
    strokes = Array.from(db.strokes?.entries() || []).map(([k, v]) => ({
      key: k,
      strokes: v
    }));
  } else {
    stageProgress = await new Promise((resolve) => {
      try {
        const tx = db.transaction("stageProgress", "readonly");
        const req = tx.objectStore("stageProgress").getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (_) {
        resolve([]);
      }
    });

    strokes = await new Promise((resolve) => {
      try {
        const tx = db.transaction("strokes", "readonly");
        const req = tx.objectStore("strokes").getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (_) {
        resolve([]);
      }
    });
  }

  const now = Date.now();
  const payload = {
    appName: "Math Canvas Pro",
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: now,
    exportedAtISO: new Date(now).toISOString(),
    metadata: {
      sessionCount: sessions.length,
      attemptCount: attempts.length,
      mistakeCount: mistakes.length,
      stageProgressCount: stageProgress.length,
      strokeCount: strokes.length,
      draftCount: currentDraft ? 1 : 0
    },
    data: {
      sessions,
      attempts,
      mistakes,
      stageProgress,
      strokes,
      drafts: currentDraft ? [currentDraft] : []
    }
  };

  return payload;
}

/**
 * 백업 JSON 데이터 유효성 검사 및 Preview 통계 산출
 */
export function validateBackupData(backup) {
  if (!backup || typeof backup !== "object") {
    return { isValid: false, error: "올바른 JSON 데이터가 아닙니다." };
  }

  if (backup.formatVersion !== BACKUP_FORMAT_VERSION && backup.formatVersion !== "1.0") {
    return { isValid: false, error: `지원하지 않는 백업 버전입니다: ${backup.formatVersion || "알 수 없음"}` };
  }

  if (!backup.data || typeof backup.data !== "object") {
    return { isValid: false, error: "백업 데이터 구조(data 객체)가 누락되었습니다." };
  }

  const sessions = Array.isArray(backup.data.sessions) ? backup.data.sessions : [];
  const attempts = Array.isArray(backup.data.attempts) ? backup.data.attempts : [];
  const mistakes = Array.isArray(backup.data.mistakes) ? backup.data.mistakes : [];
  const stageProgress = Array.isArray(backup.data.stageProgress) ? backup.data.stageProgress : [];
  const strokes = Array.isArray(backup.data.strokes) ? backup.data.strokes : [];
  const drafts = Array.isArray(backup.data.drafts) ? backup.data.drafts : [];

  let oldestDate = null;
  let newestDate = null;

  sessions.forEach((s) => {
    const t = s.completedAt || s.startedAt;
    if (t) {
      if (!oldestDate || t < oldestDate) oldestDate = t;
      if (!newestDate || t > newestDate) newestDate = t;
    }
  });

  return {
    isValid: true,
    error: null,
    preview: {
      formatVersion: backup.formatVersion,
      exportedAt: backup.exportedAt ? new Date(backup.exportedAt).toLocaleString("ko-KR") : "알 수 없음",
      sessionCount: sessions.length,
      attemptCount: attempts.length,
      mistakeCount: mistakes.length,
      stageProgressCount: stageProgress.length,
      strokeCount: strokes.length,
      draftCount: drafts.length,
      dateRange: oldestDate && newestDate
        ? `${new Date(oldestDate).toLocaleDateString("ko-KR")} ~ ${new Date(newestDate).toLocaleDateString("ko-KR")}`
        : "기록 없음"
    }
  };
}

/**
 * 백업 데이터 복원
 * @param {object} backup
 * @param {object} options - { mode: "replace" | "merge" }
 */
export async function importBackupData(backup, options = { mode: "replace" }) {
  const validation = validateBackupData(backup);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const mode = options.mode === "merge" ? "merge" : "replace";
  const db = await getDB();

  if (mode === "replace") {
    await clearAllData();
  }

  const { sessions, attempts, mistakes, stageProgress, strokes, drafts = [] } = backup.data;

  if (db.isMemory) {
    (sessions || []).forEach((s) => db.sessions.set(s.id, s));
    (attempts || []).forEach((a) => db.attempts.set(a.id, a));
    (mistakes || []).forEach((m) => db.mistakes.set(m.key, m));
    (stageProgress || []).forEach((p) => db.stageProgress.set(p.stageKey, p));
    (strokes || []).forEach((st) => {
      const k = st.key || st.sessionId_questionId;
      if (k) db.strokes.set(k, st.strokes || st);
    });
    (drafts || []).forEach((draft) => db.draftSessions.set("current_draft", { ...draft, id: "current_draft" }));

    return {
      success: true,
      mode,
      importedSessions: (sessions || []).length,
      importedAttempts: (attempts || []).length,
      importedMistakes: (mistakes || []).length,
      importedStrokes: (strokes || []).length,
      importedDrafts: (drafts || []).length
    };
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["sessions", "attempts", "mistakes", "stageProgress", "strokes", "draftSessions"], "readwrite");
    const sessionStore = tx.objectStore("sessions");
    const attemptStore = tx.objectStore("attempts");
    const mistakeStore = tx.objectStore("mistakes");
    const progressStore = tx.objectStore("stageProgress");
    const strokeStore = tx.objectStore("strokes");
    const draftStore = tx.objectStore("draftSessions");

    (sessions || []).forEach((s) => sessionStore.put(s));
    (attempts || []).forEach((a) => attemptStore.put(a));
    (mistakes || []).forEach((m) => mistakeStore.put(m));
    (stageProgress || []).forEach((p) => progressStore.put(p));
    (strokes || []).forEach((st) => strokeStore.put(st));
    (drafts || []).forEach((draft) => draftStore.put({ ...draft, id: "current_draft" }));

    tx.oncomplete = () => {
      resolve({
        success: true,
        mode,
        importedSessions: (sessions || []).length,
        importedAttempts: (attempts || []).length,
        importedMistakes: (mistakes || []).length,
        importedStrokes: (strokes || []).length,
        importedDrafts: (drafts || []).length
      });
    };

    tx.onerror = (e) => reject(e.target.error);
  });
}
