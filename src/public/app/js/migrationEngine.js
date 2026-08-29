/**
 * Math Canvas Pro - 기존 레거시 데이터 마이그레이션 엔진 (Phase F2)
 * 
 * - 미변환 레거시 데이터(learnerId 없는 데이터 및 DEFAULT_LEGACY_LEARNER_ID) 정밀 감지
 * - 변환 전 원본 6대 Store 백업 및 실패 시 원자적 롤백(Rollback) 안전성 보장
 * - 명시적 기본 학습자(LearnerProfile) 생성 및 바인딩 계약
 * - 6대 Store 전체 레코드 및 복합 키 변환:
 *   * sessions: learnerId 적용 및 results 내부 learnerId 동기화
 *   * attempts: learnerId 적용 (sessionId, questionKey, stageId 참조 무결성 유지)
 *   * mistakes: legacy key -> `${learnerId}:${questionKey}` 변환 및 legacy key 삭제
 *   * stageProgress: legacy key -> `${learnerId}:${stageId}` 변환 및 legacy key 삭제, stageId 보존
 *   * strokes: learnerId 적용 (sessionId_questionId, 필기 좌표 무손실 보존)
 *   * draftSessions: `current_draft` -> `current_draft_${learnerId}` 변환 및 legacy key 삭제
 * - 멱등성(Idempotency): 중복 실행 시 데이터 증폭 0건 보장
 */

import {
  getDB,
  DEFAULT_LEGACY_LEARNER_ID,
  createLearnerProfile,
  getLearnerProfile,
  getActiveLearners,
  getCurrentLearnerId,
  setCurrentLearnerId
} from "./storage.js";

export const MIGRATION_VERSION = "2.0";

/**
 * 6대 Store 내 미변환 레거시 데이터 감지
 */
export async function detectLegacyData() {
  const db = await getDB();
  const counts = {
    sessions: 0,
    attempts: 0,
    mistakes: 0,
    stageProgress: 0,
    strokes: 0,
    draftSessions: 0,
    total: 0
  };

  if (db.isMemory) {
    for (const s of db.sessions.values()) {
      if (!s.learnerId || s.learnerId === DEFAULT_LEGACY_LEARNER_ID) counts.sessions += 1;
    }
    for (const a of db.attempts.values()) {
      if (!a.learnerId || a.learnerId === DEFAULT_LEGACY_LEARNER_ID) counts.attempts += 1;
    }
    for (const m of db.mistakes.values()) {
      const isLegacy = !m.learnerId || m.learnerId === DEFAULT_LEGACY_LEARNER_ID || !String(m.key || "").includes(":") || String(m.key || "").startsWith(`${DEFAULT_LEGACY_LEARNER_ID}:`);
      if (isLegacy) counts.mistakes += 1;
    }
    for (const p of db.stageProgress.values()) {
      const isLegacy = !p.learnerId || p.learnerId === DEFAULT_LEGACY_LEARNER_ID || !String(p.stageKey || "").includes(":") || String(p.stageKey || "").startsWith(`${DEFAULT_LEGACY_LEARNER_ID}:`);
      if (isLegacy) counts.stageProgress += 1;
    }
    for (const st of db.strokes.values()) {
      if (!st.learnerId || st.learnerId === DEFAULT_LEGACY_LEARNER_ID) counts.strokes += 1;
    }
    for (const d of db.draftSessions.values()) {
      const isLegacy = d.id === "current_draft" || !d.learnerId || d.learnerId === DEFAULT_LEGACY_LEARNER_ID;
      if (isLegacy) counts.draftSessions += 1;
    }

    counts.total = counts.sessions + counts.attempts + counts.mistakes + counts.stageProgress + counts.strokes + counts.draftSessions;
    return {
      hasLegacyData: counts.total > 0,
      counts
    };
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(["sessions", "attempts", "mistakes", "stageProgress", "strokes", "draftSessions"], "readonly");
      
      tx.objectStore("sessions").openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const val = cursor.value;
          if (!val.learnerId || val.learnerId === DEFAULT_LEGACY_LEARNER_ID) counts.sessions += 1;
          cursor.continue();
        }
      };

      tx.objectStore("attempts").openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const val = cursor.value;
          if (!val.learnerId || val.learnerId === DEFAULT_LEGACY_LEARNER_ID) counts.attempts += 1;
          cursor.continue();
        }
      };

      tx.objectStore("mistakes").openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const val = cursor.value;
          const isLegacy = !val.learnerId || val.learnerId === DEFAULT_LEGACY_LEARNER_ID || !String(val.key || "").includes(":") || String(val.key || "").startsWith(`${DEFAULT_LEGACY_LEARNER_ID}:`);
          if (isLegacy) counts.mistakes += 1;
          cursor.continue();
        }
      };

      tx.objectStore("stageProgress").openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const val = cursor.value;
          const isLegacy = !val.learnerId || val.learnerId === DEFAULT_LEGACY_LEARNER_ID || !String(val.stageKey || "").includes(":") || String(val.stageKey || "").startsWith(`${DEFAULT_LEGACY_LEARNER_ID}:`);
          if (isLegacy) counts.stageProgress += 1;
          cursor.continue();
        }
      };

      tx.objectStore("strokes").openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const val = cursor.value;
          if (!val.learnerId || val.learnerId === DEFAULT_LEGACY_LEARNER_ID) counts.strokes += 1;
          cursor.continue();
        }
      };

      tx.objectStore("draftSessions").openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const val = cursor.value;
          const isLegacy = val.id === "current_draft" || !val.learnerId || val.learnerId === DEFAULT_LEGACY_LEARNER_ID;
          if (isLegacy) counts.draftSessions += 1;
          cursor.continue();
        }
      };

      tx.oncomplete = () => {
        counts.total = counts.sessions + counts.attempts + counts.mistakes + counts.stageProgress + counts.strokes + counts.draftSessions;
        resolve({
          hasLegacyData: counts.total > 0,
          counts
        });
      };

      tx.onerror = (e) => reject(e.target.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 마이그레이션 전 6대 Store 원본 스냅샷 백업 생성
 */
export async function createMigrationBackup() {
  const db = await getDB();
  const snapshot = {
    timestamp: Date.now(),
    stores: {
      sessions: [],
      attempts: [],
      mistakes: [],
      stageProgress: [],
      strokes: [],
      draftSessions: []
    }
  };

  if (db.isMemory) {
    snapshot.stores.sessions = Array.from(db.sessions.values()).map(x => JSON.parse(JSON.stringify(x)));
    snapshot.stores.attempts = Array.from(db.attempts.values()).map(x => JSON.parse(JSON.stringify(x)));
    snapshot.stores.mistakes = Array.from(db.mistakes.values()).map(x => JSON.parse(JSON.stringify(x)));
    snapshot.stores.stageProgress = Array.from(db.stageProgress.values()).map(x => JSON.parse(JSON.stringify(x)));
    snapshot.stores.strokes = Array.from(db.strokes.values()).map(x => JSON.parse(JSON.stringify(x)));
    snapshot.stores.draftSessions = Array.from(db.draftSessions.values()).map(x => JSON.parse(JSON.stringify(x)));
    return snapshot;
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(["sessions", "attempts", "mistakes", "stageProgress", "strokes", "draftSessions"], "readonly");
      
      tx.objectStore("sessions").getAll().onsuccess = (e) => {
        snapshot.stores.sessions = e.target.result || [];
      };
      tx.objectStore("attempts").getAll().onsuccess = (e) => {
        snapshot.stores.attempts = e.target.result || [];
      };
      tx.objectStore("mistakes").getAll().onsuccess = (e) => {
        snapshot.stores.mistakes = e.target.result || [];
      };
      tx.objectStore("stageProgress").getAll().onsuccess = (e) => {
        snapshot.stores.stageProgress = e.target.result || [];
      };
      tx.objectStore("strokes").getAll().onsuccess = (e) => {
        snapshot.stores.strokes = e.target.result || [];
      };
      tx.objectStore("draftSessions").getAll().onsuccess = (e) => {
        snapshot.stores.draftSessions = e.target.result || [];
      };

      tx.oncomplete = () => resolve(snapshot);
      tx.onerror = (e) => reject(e.target.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 백업 스냅샷으로부터 6대 Store 완전 롤백 복원
 */
export async function restoreMigrationBackup(snapshot) {
  if (!snapshot || !snapshot.stores) {
    throw new Error("올바른 마이그레이션 백업 스냅샷이 아닙니다.");
  }

  const db = await getDB();
  const { sessions = [], attempts = [], mistakes = [], stageProgress = [], strokes = [], draftSessions = [] } = snapshot.stores;

  if (db.isMemory) {
    db.sessions.clear();
    db.attempts.clear();
    db.mistakes.clear();
    db.stageProgress.clear();
    db.strokes.clear();
    db.draftSessions.clear();

    sessions.forEach(s => db.sessions.set(s.id, s));
    attempts.forEach(a => db.attempts.set(a.id, a));
    mistakes.forEach(m => db.mistakes.set(m.key, m));
    stageProgress.forEach(p => db.stageProgress.set(p.stageKey, p));
    strokes.forEach(st => db.strokes.set(st.sessionId_questionId || st.key, st));
    draftSessions.forEach(d => db.draftSessions.set(d.id, d));
    return true;
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(["sessions", "attempts", "mistakes", "stageProgress", "strokes", "draftSessions"], "readwrite");
      
      const sStore = tx.objectStore("sessions");
      const aStore = tx.objectStore("attempts");
      const mStore = tx.objectStore("mistakes");
      const pStore = tx.objectStore("stageProgress");
      const stStore = tx.objectStore("strokes");
      const dStore = tx.objectStore("draftSessions");

      sStore.clear();
      aStore.clear();
      mStore.clear();
      pStore.clear();
      stStore.clear();
      dStore.clear();

      sessions.forEach(s => sStore.put(s));
      attempts.forEach(a => aStore.put(a));
      mistakes.forEach(m => mStore.put(m));
      stageProgress.forEach(p => pStore.put(p));
      strokes.forEach(st => stStore.put(st));
      draftSessions.forEach(d => dStore.put(d));

      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 기본 학습자 프로필 확보 (존재하지 않으면 신규 생성)
 */
async function resolveDefaultMigrationProfile(options = {}) {
  // 1. 명시적으로 전달된 learnerId가 있는 경우
  if (options.targetLearnerId) {
    const profile = await getLearnerProfile(options.targetLearnerId);
    if (profile) return profile;
  }

  // 2. 현재 활성 학습자가 있는 경우
  const currentId = getCurrentLearnerId();
  if (currentId && currentId !== DEFAULT_LEGACY_LEARNER_ID) {
    const profile = await getLearnerProfile(currentId);
    if (profile && !profile.archived) return profile;
  }

  // 3. 기존 활성 학습자 목록이 있는 경우 첫 번째 학습자 선택
  const activeLearners = await getActiveLearners();
  if (activeLearners.length > 0) {
    return activeLearners[0];
  }

  // 4. 없으면 신규 기본 학습자 프로필 생성
  const defaultProfile = await createLearnerProfile({
    name: options.defaultLearnerName || "기본 학습자",
    icon: "avatar_boy",
    avatarKey: "avatar_boy"
  });

  return defaultProfile;
}

/**
 * 기존 레거시 데이터 전체를 지정된 기본 학습자 프로필로 안전하게 마이그레이션
 */
export async function migrateLegacyData(options = {}) {
  // 1. 레거시 데이터 사전 감지
  const detection = await detectLegacyData();
  if (!detection.hasLegacyData) {
    const currentId = getCurrentLearnerId();
    return {
      success: true,
      migrated: false,
      targetLearnerId: currentId || null,
      message: "마이그레이션할 레거시 데이터가 없습니다.",
      counts: detection.counts
    };
  }

  // 2. 마이그레이션 대상 학습자 프로필 확보
  const targetProfile = await resolveDefaultMigrationProfile(options);
  const targetLearnerId = targetProfile.id;

  // 3. 마이그레이션 전 원본 백업 확보 (실패 시 원복용)
  const backupSnapshot = await createMigrationBackup();

  try {
    const db = await getDB();

    if (db.isMemory) {
      // 1) sessions
      for (const [key, s] of Array.from(db.sessions.entries())) {
        if (!s.learnerId || s.learnerId === DEFAULT_LEGACY_LEARNER_ID) {
          const updated = {
            ...s,
            learnerId: targetLearnerId,
            results: (s.results || []).map(r => ({ ...r, learnerId: targetLearnerId }))
          };
          db.sessions.set(key, updated);
        }
      }

      // 2) attempts
      for (const [key, a] of Array.from(db.attempts.entries())) {
        if (!a.learnerId || a.learnerId === DEFAULT_LEGACY_LEARNER_ID) {
          db.attempts.set(key, { ...a, learnerId: targetLearnerId });
        }
      }

      // 3) mistakes (legacy key -> targetLearnerId:questionKey 변환)
      for (const [key, m] of Array.from(db.mistakes.entries())) {
        const isLegacy = !m.learnerId || m.learnerId === DEFAULT_LEGACY_LEARNER_ID || !String(m.key || "").includes(":") || String(m.key || "").startsWith(`${DEFAULT_LEGACY_LEARNER_ID}:`);
        if (isLegacy) {
          db.mistakes.delete(key);
          const rawQKey = m.questionKey || m.key.replace(new RegExp(`^${DEFAULT_LEGACY_LEARNER_ID}:`), "");
          const compoundKey = `${targetLearnerId}:${rawQKey}`;
          db.mistakes.set(compoundKey, {
            ...m,
            key: compoundKey,
            id: compoundKey,
            compoundKey: compoundKey,
            learnerId: targetLearnerId,
            questionKey: rawQKey
          });
        }
      }

      // 4) stageProgress (legacy stageKey -> targetLearnerId:stageId 변환)
      for (const [key, p] of Array.from(db.stageProgress.entries())) {
        const isLegacy = !p.learnerId || p.learnerId === DEFAULT_LEGACY_LEARNER_ID || !String(p.stageKey || "").includes(":") || String(p.stageKey || "").startsWith(`${DEFAULT_LEGACY_LEARNER_ID}:`);
        if (isLegacy) {
          db.stageProgress.delete(key);
          const rawStageId = p.stageId || p.stageKey.replace(new RegExp(`^${DEFAULT_LEGACY_LEARNER_ID}:`), "");
          const compoundKey = `${targetLearnerId}:${rawStageId}`;
          db.stageProgress.set(compoundKey, {
            ...p,
            stageKey: compoundKey,
            stageId: rawStageId,
            learnerId: targetLearnerId
          });
        }
      }

      // 5) strokes
      for (const [key, st] of Array.from(db.strokes.entries())) {
        if (!st.learnerId || st.learnerId === DEFAULT_LEGACY_LEARNER_ID) {
          db.strokes.set(key, { ...st, learnerId: targetLearnerId });
        }
      }

      // 6) draftSessions (`current_draft` -> `current_draft_${targetLearnerId}` 변환)
      for (const [key, d] of Array.from(db.draftSessions.entries())) {
        const isLegacy = d.id === "current_draft" || !d.learnerId || d.learnerId === DEFAULT_LEGACY_LEARNER_ID;
        if (isLegacy) {
          db.draftSessions.delete(key);
          const draftKey = `current_draft_${targetLearnerId}`;
          db.draftSessions.set(draftKey, {
            ...d,
            id: draftKey,
            learnerId: targetLearnerId
          });
        }
      }

      setCurrentLearnerId(targetLearnerId);

      return {
        success: true,
        migrated: true,
        targetLearnerId,
        targetLearnerName: targetProfile.name,
        counts: detection.counts
      };
    }

    // IndexedDB 원자적 변환 트랜잭션
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["sessions", "attempts", "mistakes", "stageProgress", "strokes", "draftSessions"], "readwrite");
      
      const sStore = tx.objectStore("sessions");
      const aStore = tx.objectStore("attempts");
      const mStore = tx.objectStore("mistakes");
      const pStore = tx.objectStore("stageProgress");
      const stStore = tx.objectStore("strokes");
      const dStore = tx.objectStore("draftSessions");

      // 1) sessions 변환
      sStore.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const val = cursor.value;
          if (!val.learnerId || val.learnerId === DEFAULT_LEGACY_LEARNER_ID) {
            val.learnerId = targetLearnerId;
            val.results = (val.results || []).map(r => ({ ...r, learnerId: targetLearnerId }));
            cursor.update(val);
          }
          cursor.continue();
        }
      };

      // 2) attempts 변환
      aStore.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const val = cursor.value;
          if (!val.learnerId || val.learnerId === DEFAULT_LEGACY_LEARNER_ID) {
            val.learnerId = targetLearnerId;
            cursor.update(val);
          }
          cursor.continue();
        }
      };

      // 3) mistakes 변환
      mStore.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const val = cursor.value;
          const isLegacy = !val.learnerId || val.learnerId === DEFAULT_LEGACY_LEARNER_ID || !String(val.key || "").includes(":") || String(val.key || "").startsWith(`${DEFAULT_LEGACY_LEARNER_ID}:`);
          if (isLegacy) {
            cursor.delete();
            const rawQKey = val.questionKey || val.key.replace(new RegExp(`^${DEFAULT_LEGACY_LEARNER_ID}:`), "");
            const compoundKey = `${targetLearnerId}:${rawQKey}`;
            mStore.put({
              ...val,
              key: compoundKey,
              id: compoundKey,
              compoundKey: compoundKey,
              learnerId: targetLearnerId,
              questionKey: rawQKey
            });
          }
          cursor.continue();
        }
      };

      // 4) stageProgress 변환
      pStore.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const val = cursor.value;
          const isLegacy = !val.learnerId || val.learnerId === DEFAULT_LEGACY_LEARNER_ID || !String(val.stageKey || "").includes(":") || String(val.stageKey || "").startsWith(`${DEFAULT_LEGACY_LEARNER_ID}:`);
          if (isLegacy) {
            cursor.delete();
            const rawStageId = val.stageId || val.stageKey.replace(new RegExp(`^${DEFAULT_LEGACY_LEARNER_ID}:`), "");
            const compoundKey = `${targetLearnerId}:${rawStageId}`;
            pStore.put({
              ...val,
              stageKey: compoundKey,
              stageId: rawStageId,
              learnerId: targetLearnerId
            });
          }
          cursor.continue();
        }
      };

      // 5) strokes 변환
      stStore.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const val = cursor.value;
          if (!val.learnerId || val.learnerId === DEFAULT_LEGACY_LEARNER_ID) {
            val.learnerId = targetLearnerId;
            cursor.update(val);
          }
          cursor.continue();
        }
      };

      // 6) draftSessions 변환
      dStore.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const val = cursor.value;
          const isLegacy = val.id === "current_draft" || !val.learnerId || val.learnerId === DEFAULT_LEGACY_LEARNER_ID;
          if (isLegacy) {
            cursor.delete();
            const draftKey = `current_draft_${targetLearnerId}`;
            dStore.put({
              ...val,
              id: draftKey,
              learnerId: targetLearnerId
            });
          }
          cursor.continue();
        }
      };

      tx.oncomplete = () => {
        setCurrentLearnerId(targetLearnerId);
        resolve({
          success: true,
          migrated: true,
          targetLearnerId,
          targetLearnerName: targetProfile.name,
          counts: detection.counts
        });
      };

      tx.onerror = async (e) => {
        // 실패 시 자동 롤백 실행
        try {
          await restoreMigrationBackup(backupSnapshot);
        } catch (_) {}
        reject(new Error(`마이그레이션 트랜잭션 실패 (자동 롤백됨): ${e.target.error}`));
      };
    });
  } catch (error) {
    // 예외 발생 시 원본 롤백
    try {
      await restoreMigrationBackup(backupSnapshot);
    } catch (_) {}
    return {
      success: false,
      error: error.message,
      rolledBack: true
    };
  }
}

/**
 * 마이그레이션 완료 여부 확인
 */
export async function isMigrationCompleted() {
  const detection = await detectLegacyData();
  return !detection.hasLegacyData;
}
