//+_+// Math Canvas Pro - 기존 레거시 데이터 마이그레이션 엔진 (Phase F2)
//+_+// 
//+_+// - 미변환 레거시 데이터(learnerId 없는 데이터 및 DEFAULT_LEGACY_LEARNER_ID) 정밀 감지
//+_+// - 변환 전 원본 6대 Store 백업 및 실패 시 원자적 롤백(Rollback) 안전성 보장
//+_+// - 명시적 기본 학습자(LearnerProfile) 생성/재사용 및 바인딩 계약
//+_+// - 기존 학습자 소유권(learnerId) 보존 (learnerId 보유 레코드는 타 프로필로 재귀속 금지)
//+_+// - migration key 충돌 preflight 검사 (TARGET_CONFLICT 시 0건 변경 및 안전 중단)
//+_+// - partial migration ownership 무결성 검증 (부모 session 소유권 계승 및 불일치 시 OWNERSHIP_CONFLICT)
//+_+// - strokes Store 100% 무손실 보존
//+_+// - 멱등성(Idempotency): 중복 실행 시 데이터 증폭 0건 보장

import {
  getDB,
  DEFAULT_LEGACY_LEARNER_ID,
  createLearnerProfile,
  getLearnerProfile,
  getAllLearnerProfiles,
  deleteLearnerProfile,
  getCurrentLearnerId,
  setCurrentLearnerId
} from "./storage.js";

export const MIGRATION_VERSION = "2.0";

//+_+// 레코드의 실제 소유 학습자 ID 결정 헬퍼
function resolveRecordOwner(record, defaultTargetId) {
  if (record && record.learnerId && record.learnerId !== DEFAULT_LEGACY_LEARNER_ID) {
    return record.learnerId;
  }
  return defaultTargetId;
}

/**
 * //+_+// 6대 Store 내 미변환 레거시 데이터 감지
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

  //+_+// mistake 레거시/미변환 판별 헬퍼 (단순 includes(':') 배제 및 정확한 prefix 검사)
  function isLegacyMistake(m) {
    if (!m) return false;
    if (!m.learnerId || m.learnerId === DEFAULT_LEGACY_LEARNER_ID) return true;
    const keyStr = String(m.key || "");
    if (!keyStr.startsWith(`${m.learnerId}:`)) return true;
    if (!m.questionKey || keyStr !== `${m.learnerId}:${m.questionKey}`) return true;
    if (keyStr.startsWith(`${DEFAULT_LEGACY_LEARNER_ID}:`)) return true;
    return false;
  }

  //+_+// stageProgress 레거시/미변환 판별 헬퍼
  function isLegacyStageProgress(p) {
    if (!p) return false;
    if (!p.learnerId || p.learnerId === DEFAULT_LEGACY_LEARNER_ID) return true;
    const keyStr = String(p.stageKey || "");
    if (!keyStr.startsWith(`${p.learnerId}:`)) return true;
    if (!p.stageId || keyStr !== `${p.learnerId}:${p.stageId}`) return true;
    if (keyStr.startsWith(`${DEFAULT_LEGACY_LEARNER_ID}:`)) return true;
    return false;
  }

  //+_+// draftSession 레거시/미변환 판별 헬퍼
  function isLegacyDraft(d) {
    if (!d) return false;
    if (d.id === "current_draft") return true;
    if (!d.learnerId || d.learnerId === DEFAULT_LEGACY_LEARNER_ID) return true;
    if (d.id !== `current_draft_${d.learnerId}`) return true;
    return false;
  }

  if (db.isMemory) {
    for (const s of db.sessions.values()) {
      if (!s.learnerId || s.learnerId === DEFAULT_LEGACY_LEARNER_ID) counts.sessions += 1;
    }
    for (const a of db.attempts.values()) {
      if (!a.learnerId || a.learnerId === DEFAULT_LEGACY_LEARNER_ID) counts.attempts += 1;
    }
    for (const m of db.mistakes.values()) {
      if (isLegacyMistake(m)) counts.mistakes += 1;
    }
    for (const p of db.stageProgress.values()) {
      if (isLegacyStageProgress(p)) counts.stageProgress += 1;
    }
    for (const st of db.strokes.values()) {
      if (!st.learnerId || st.learnerId === DEFAULT_LEGACY_LEARNER_ID) counts.strokes += 1;
    }
    for (const d of db.draftSessions.values()) {
      if (isLegacyDraft(d)) counts.draftSessions += 1;
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
          if (isLegacyMistake(val)) counts.mistakes += 1;
          cursor.continue();
        }
      };

      tx.objectStore("stageProgress").openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const val = cursor.value;
          if (isLegacyStageProgress(val)) counts.stageProgress += 1;
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
          if (isLegacyDraft(val)) counts.draftSessions += 1;
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
 * //+_+// 마이그레이션 전 6대 Store 원본 스냅샷 백업 생성
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
 * //+_+// 백업 스냅샷으로부터 6대 Store 완전 롤백 복원
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

    sessions.forEach(s => db.sessions.set(s.id, JSON.parse(JSON.stringify(s))));
    attempts.forEach(a => db.attempts.set(a.id, JSON.parse(JSON.stringify(a))));
    mistakes.forEach(m => db.mistakes.set(m.key, JSON.parse(JSON.stringify(m))));
    stageProgress.forEach(p => db.stageProgress.set(p.stageKey, JSON.parse(JSON.stringify(p))));
    strokes.forEach(st => db.strokes.set(st.sessionId_questionId || st.key, JSON.parse(JSON.stringify(st))));
    draftSessions.forEach(d => db.draftSessions.set(d.id, JSON.parse(JSON.stringify(d))));
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
 * //+_+// 마이그레이션 대상 학습자 프로필 결정 (기존 active learner 임의 선택 금지)
 */
async function resolveDefaultMigrationProfile(options = {}) {
  //+_+// 1. 명시적으로 전달된 targetLearnerId가 있는 경우
  if (options.targetLearnerId) {
    const profile = await getLearnerProfile(options.targetLearnerId);
    if (!profile) {
      throw new Error(`마이그레이션 대상 학습자 프로필(${options.targetLearnerId})이 존재하지 않습니다.`);
    }
    if (profile.archived) {
      throw new Error(`보관된 학습자 프로필(${options.targetLearnerId})은 마이그레이션 대상으로 지정할 수 없습니다.`);
    }
    return { profile, isNewlyCreated: false };
  }

  //+_+// 2. targetLearnerId 미지정 시: 기존 active learner 임의 선택 금지.
  //+_+//    전용 migration 프로필(migrationSource: "legacy_migration" 또는 isLegacyDefault: true) 검색 및 재사용
  const allProfiles = await getAllLearnerProfiles({ includeArchived: true });
  const existingMigrationProfile = allProfiles.find(p => !p.archived && (p.migrationSource === "legacy_migration" || p.isLegacyDefault === true));
  if (existingMigrationProfile) {
    return { profile: existingMigrationProfile, isNewlyCreated: false };
  }

  //+_+// 3. 전용 프로필이 없으면 신규 생성
  const created = await createLearnerProfile({
    name: options.defaultLearnerName || "기본 학습자",
    icon: "avatar_boy",
    avatarKey: "avatar_boy",
    migrationSource: "legacy_migration",
    isLegacyDefault: true
  });

  return { profile: created, isNewlyCreated: true };
}

/**
 * //+_+// 마이그레이션 실행 전 대상 Key 충돌 및 부분 소유권(ownership) 일관성 Preflight 검사
 */
function runPreflightCheck(snapshot, defaultTargetId) {
  const { sessions = [], attempts = [], mistakes = [], stageProgress = [], strokes = [], draftSessions = [] } = snapshot.stores;

  //+_+// 1. 부모 세션 소유권 매핑 구성
  const sessionLearnerMap = new Map();
  sessions.forEach(s => {
    const sLearner = (s.learnerId && s.learnerId !== DEFAULT_LEGACY_LEARNER_ID) ? s.learnerId : defaultTargetId;
    sessionLearnerMap.set(s.id, sLearner);
  });

  //+_+// 2. Attempts 소유권 일치 검사
  for (const a of attempts) {
    if (a.sessionId && sessionLearnerMap.has(a.sessionId)) {
      const expectedLearner = sessionLearnerMap.get(a.sessionId);
      if (a.learnerId && a.learnerId !== DEFAULT_LEGACY_LEARNER_ID && a.learnerId !== expectedLearner) {
        return {
          ok: false,
          reason: "OWNERSHIP_CONFLICT",
          error: `Attempt(${a.id})의 learnerId(${a.learnerId})가 부모 세션(${a.sessionId})의 learnerId(${expectedLearner})와 일치하지 않습니다.`
        };
      }
    }
  }

  //+_+// 3. Strokes 소유권 일치 검사
  for (const st of strokes) {
    const sessionId = st.sessionId || (st.sessionId_questionId ? st.sessionId_questionId.split("_")[0] : null);
    if (sessionId && sessionLearnerMap.has(sessionId)) {
      const expectedLearner = sessionLearnerMap.get(sessionId);
      if (st.learnerId && st.learnerId !== DEFAULT_LEGACY_LEARNER_ID && st.learnerId !== expectedLearner) {
        return {
          ok: false,
          reason: "OWNERSHIP_CONFLICT",
          error: `Stroke(${st.sessionId_questionId})의 learnerId(${st.learnerId})가 부모 세션(${sessionId})의 learnerId(${expectedLearner})와 일치하지 않습니다.`
        };
      }
    }
  }

  //+_+// 4. Target Key 충돌 검사 (각 record의 실제 resolved owner 기준)
  const conflicts = [];

  //+_+// 4.1 mistakes 대상 키 충돌 검사
  for (const m of mistakes) {
    const isLegacy = !m.learnerId || m.learnerId === DEFAULT_LEGACY_LEARNER_ID || !String(m.key || "").startsWith(`${m.learnerId}:`);
    if (isLegacy) {
      const ownerId = resolveRecordOwner(m, defaultTargetId);
      const rawQKey = m.questionKey || String(m.key || "").replace(new RegExp(`^(${DEFAULT_LEGACY_LEARNER_ID}:|${m.learnerId || ""}:)`), "");
      const targetCompoundKey = `${ownerId}:${rawQKey}`;

      const existingForOwner = mistakes.find(em => em.learnerId === ownerId && em.key === targetCompoundKey && em !== m);
      if (existingForOwner) {
        conflicts.push({
          store: "mistakes",
          key: targetCompoundKey,
          message: `오답 대상 키(${targetCompoundKey})가 이미 존재합니다.`
        });
      }
    }
  }

  //+_+// 4.2 stageProgress 대상 키 충돌 검사
  for (const p of stageProgress) {
    const isLegacy = !p.learnerId || p.learnerId === DEFAULT_LEGACY_LEARNER_ID || !String(p.stageKey || "").startsWith(`${p.learnerId}:`);
    if (isLegacy) {
      const ownerId = resolveRecordOwner(p, defaultTargetId);
      const rawStageId = p.stageId || String(p.stageKey || "").replace(new RegExp(`^(${DEFAULT_LEGACY_LEARNER_ID}:|${p.learnerId || ""}:)`), "");
      const targetCompoundKey = `${ownerId}:${rawStageId}`;

      const existingForOwner = stageProgress.find(ep => ep.learnerId === ownerId && ep.stageKey === targetCompoundKey && ep !== p);
      if (existingForOwner) {
        conflicts.push({
          store: "stageProgress",
          key: targetCompoundKey,
          message: `진도 대상 키(${targetCompoundKey})가 이미 존재합니다.`
        });
      }
    }
  }

  //+_+// 4.3 draftSessions 대상 키 충돌 검사
  for (const d of draftSessions) {
    const isLegacy = d.id === "current_draft" || !d.learnerId || d.learnerId === DEFAULT_LEGACY_LEARNER_ID || d.id !== `current_draft_${d.learnerId}`;
    if (isLegacy) {
      const ownerId = resolveRecordOwner(d, defaultTargetId);
      const targetDraftKey = `current_draft_${ownerId}`;

      const existingDraftForOwner = draftSessions.find(ed => ed.id === targetDraftKey && ed !== d);
      if (existingDraftForOwner) {
        conflicts.push({
          store: "draftSessions",
          key: targetDraftKey,
          message: `임시 저장 대상 키(${targetDraftKey})가 이미 존재합니다.`
        });
      }
    }
  }

  if (conflicts.length > 0) {
    return {
      ok: false,
      reason: "TARGET_CONFLICT",
      conflicts,
      error: `마이그레이션 대상 키 충돌이 발견되었습니다 (${conflicts.length}건).`
    };
  }

  return { ok: true };
}

/**
 * //+_+// 실제 6대 Store 마이그레이션 변환 트랜잭션 실행
 */
async function executeMigrationTransaction(backupSnapshot, defaultTargetId, options = {}) {
  const db = await getDB();
  const sessionLearnerMap = new Map();
  backupSnapshot.stores.sessions.forEach(s => {
    const sLearner = (s.learnerId && s.learnerId !== DEFAULT_LEGACY_LEARNER_ID) ? s.learnerId : defaultTargetId;
    sessionLearnerMap.set(s.id, sLearner);
  });

  if (db.isMemory) {
    if (options._failInjection?.failAtStore === "pre") {
      throw new Error("Simulated memory migration failure at pre");
    }

    //+_+// 1) sessions (기존 정상 learnerId는 보존)
    for (const [key, s] of Array.from(db.sessions.entries())) {
      if (!s.learnerId || s.learnerId === DEFAULT_LEGACY_LEARNER_ID) {
        const updated = {
          ...s,
          learnerId: defaultTargetId,
          results: (s.results || []).map(r => ({ ...r, learnerId: defaultTargetId }))
        };
        db.sessions.set(key, updated);
      }
    }

    if (options._failInjection?.failAtStore === "sessions") {
      throw new Error("Simulated memory migration failure at sessions");
    }

    //+_+// 2) attempts (부모 session 소유권 반영)
    for (const [key, a] of Array.from(db.attempts.entries())) {
      if (!a.learnerId || a.learnerId === DEFAULT_LEGACY_LEARNER_ID) {
        const assignedLearnerId = (a.sessionId && sessionLearnerMap.has(a.sessionId))
          ? sessionLearnerMap.get(a.sessionId)
          : defaultTargetId;
        db.attempts.set(key, { ...a, learnerId: assignedLearnerId });
      }
    }

    if (options._failInjection?.failAtStore === "attempts") {
      throw new Error("Simulated memory migration failure at attempts");
    }

    //+_+// 3) mistakes (소유자 learnerId 유지하며 복합 키 변환)
    for (const [key, m] of Array.from(db.mistakes.entries())) {
      const isLegacy = !m.learnerId || m.learnerId === DEFAULT_LEGACY_LEARNER_ID || !String(m.key || "").startsWith(`${m.learnerId}:`);
      if (isLegacy) {
        db.mistakes.delete(key);
        const ownerId = resolveRecordOwner(m, defaultTargetId);
        const rawQKey = m.questionKey || String(m.key || "").replace(new RegExp(`^(${DEFAULT_LEGACY_LEARNER_ID}:|${m.learnerId || ""}:)`), "");
        const compoundKey = `${ownerId}:${rawQKey}`;
        db.mistakes.set(compoundKey, {
          ...m,
          key: compoundKey,
          id: compoundKey,
          compoundKey: compoundKey,
          learnerId: ownerId,
          questionKey: rawQKey
        });
      }
    }

    if (options._failInjection?.failAtStore === "mistakes") {
      throw new Error("Simulated memory migration failure at mistakes");
    }

    //+_+// 4) stageProgress (소유자 learnerId 유지하며 복합 키 변환)
    for (const [key, p] of Array.from(db.stageProgress.entries())) {
      const isLegacy = !p.learnerId || p.learnerId === DEFAULT_LEGACY_LEARNER_ID || !String(p.stageKey || "").startsWith(`${p.learnerId}:`);
      if (isLegacy) {
        db.stageProgress.delete(key);
        const ownerId = resolveRecordOwner(p, defaultTargetId);
        const rawStageId = p.stageId || String(p.stageKey || "").replace(new RegExp(`^(${DEFAULT_LEGACY_LEARNER_ID}:|${p.learnerId || ""}:)`), "");
        const compoundKey = `${ownerId}:${rawStageId}`;
        db.stageProgress.set(compoundKey, {
          ...p,
          stageKey: compoundKey,
          stageId: rawStageId,
          learnerId: ownerId
        });
      }
    }

    if (options._failInjection?.failAtStore === "stageProgress") {
      throw new Error("Simulated memory migration failure at stageProgress");
    }

    //+_+// 5) strokes (부모 session 소유권 반영 및 필기 무손실 보존)
    for (const [key, st] of Array.from(db.strokes.entries())) {
      if (!st.learnerId || st.learnerId === DEFAULT_LEGACY_LEARNER_ID) {
        const sessionId = st.sessionId || (st.sessionId_questionId ? st.sessionId_questionId.split("_")[0] : null);
        const assignedLearnerId = (sessionId && sessionLearnerMap.has(sessionId))
          ? sessionLearnerMap.get(sessionId)
          : defaultTargetId;
        db.strokes.set(key, { ...st, learnerId: assignedLearnerId });
      }
    }

    if (options._failInjection?.failAtStore === "strokes") {
      throw new Error("Simulated memory migration failure at strokes");
    }

    //+_+// 6) draftSessions (소유자 learnerId 유지하며 current_draft_${ownerId} 변환)
    for (const [key, d] of Array.from(db.draftSessions.entries())) {
      const isLegacy = d.id === "current_draft" || !d.learnerId || d.learnerId === DEFAULT_LEGACY_LEARNER_ID || d.id !== `current_draft_${d.learnerId}`;
      if (isLegacy) {
        db.draftSessions.delete(key);
        const ownerId = resolveRecordOwner(d, defaultTargetId);
        const draftKey = `current_draft_${ownerId}`;
        db.draftSessions.set(draftKey, {
          ...d,
          id: draftKey,
          learnerId: ownerId
        });
      }
    }

    if (options._failInjection?.failAtStore === "draftSessions") {
      throw new Error("Simulated memory migration failure at draftSessions");
    }

    return true;
  }

  //+_+// IndexedDB 트랜잭션 Promise await 단일 경로 처리
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(["sessions", "attempts", "mistakes", "stageProgress", "strokes", "draftSessions"], "readwrite");
      
      const sStore = tx.objectStore("sessions");
      const aStore = tx.objectStore("attempts");
      const mStore = tx.objectStore("mistakes");
      const pStore = tx.objectStore("stageProgress");
      const stStore = tx.objectStore("strokes");
      const dStore = tx.objectStore("draftSessions");

      let injectionError = null;

      //+_+// 1) sessions 변환
      sStore.openCursor().onsuccess = (e) => {
        try {
          if (options._failInjection?.failAtStore === "sessions") {
            throw new Error("Simulated IndexedDB failure at sessions store");
          }
          const cursor = e.target.result;
          if (cursor) {
            const val = cursor.value;
            if (!val.learnerId || val.learnerId === DEFAULT_LEGACY_LEARNER_ID) {
              val.learnerId = defaultTargetId;
              val.results = (val.results || []).map(r => ({ ...r, learnerId: defaultTargetId }));
              cursor.update(val);
            }
            cursor.continue();
          }
        } catch (err) {
          injectionError = err;
          tx.abort();
        }
      };

      //+_+// 2) attempts 변환 (부모 세션 소유권 반영)
      aStore.openCursor().onsuccess = (e) => {
        try {
          if (options._failInjection?.failAtStore === "attempts") {
            throw new Error("Simulated IndexedDB failure at attempts store");
          }
          const cursor = e.target.result;
          if (cursor) {
            const val = cursor.value;
            if (!val.learnerId || val.learnerId === DEFAULT_LEGACY_LEARNER_ID) {
              const assignedLearnerId = (val.sessionId && sessionLearnerMap.has(val.sessionId))
                ? sessionLearnerMap.get(val.sessionId)
                : defaultTargetId;
              val.learnerId = assignedLearnerId;
              cursor.update(val);
            }
            cursor.continue();
          }
        } catch (err) {
          injectionError = err;
          tx.abort();
        }
      };

      //+_+// 3) mistakes 변환 (소유자 learnerId 유지하며 복합 키 변환)
      mStore.openCursor().onsuccess = (e) => {
        try {
          if (options._failInjection?.failAtStore === "mistakes") {
            throw new Error("Simulated IndexedDB failure at mistakes store");
          }
          const cursor = e.target.result;
          if (cursor) {
            const val = cursor.value;
            const isLegacy = !val.learnerId || val.learnerId === DEFAULT_LEGACY_LEARNER_ID || !String(val.key || "").startsWith(`${val.learnerId}:`);
            if (isLegacy) {
              cursor.delete();
              const ownerId = resolveRecordOwner(val, defaultTargetId);
              const rawQKey = val.questionKey || String(val.key || "").replace(new RegExp(`^(${DEFAULT_LEGACY_LEARNER_ID}:|${val.learnerId || ""}:)`), "");
              const compoundKey = `${ownerId}:${rawQKey}`;
              mStore.put({
                ...val,
                key: compoundKey,
                id: compoundKey,
                compoundKey: compoundKey,
                learnerId: ownerId,
                questionKey: rawQKey
              });
            }
            cursor.continue();
          }
        } catch (err) {
          injectionError = err;
          tx.abort();
        }
      };

      //+_+// 4) stageProgress 변환 (소유자 learnerId 유지하며 복합 키 변환)
      pStore.openCursor().onsuccess = (e) => {
        try {
          if (options._failInjection?.failAtStore === "stageProgress") {
            throw new Error("Simulated IndexedDB failure at stageProgress store");
          }
          const cursor = e.target.result;
          if (cursor) {
            const val = cursor.value;
            const isLegacy = !val.learnerId || val.learnerId === DEFAULT_LEGACY_LEARNER_ID || !String(val.stageKey || "").startsWith(`${val.learnerId}:`);
            if (isLegacy) {
              cursor.delete();
              const ownerId = resolveRecordOwner(val, defaultTargetId);
              const rawStageId = val.stageId || String(val.stageKey || "").replace(new RegExp(`^(${DEFAULT_LEGACY_LEARNER_ID}:|${val.learnerId || ""}:)`), "");
              const compoundKey = `${ownerId}:${rawStageId}`;
              pStore.put({
                ...val,
                stageKey: compoundKey,
                stageId: rawStageId,
                learnerId: ownerId
              });
            }
            cursor.continue();
          }
        } catch (err) {
          injectionError = err;
          tx.abort();
        }
      };

      //+_+// 5) strokes 변환 (부모 세션 소유권 반영 및 필기 데이터 100% 보존)
      stStore.openCursor().onsuccess = (e) => {
        try {
          if (options._failInjection?.failAtStore === "strokes") {
            throw new Error("Simulated IndexedDB failure at strokes store");
          }
          const cursor = e.target.result;
          if (cursor) {
            const val = cursor.value;
            if (!val.learnerId || val.learnerId === DEFAULT_LEGACY_LEARNER_ID) {
              const sessionId = val.sessionId || (val.sessionId_questionId ? val.sessionId_questionId.split("_")[0] : null);
              const assignedLearnerId = (sessionId && sessionLearnerMap.has(sessionId))
                ? sessionLearnerMap.get(sessionId)
                : defaultTargetId;
              val.learnerId = assignedLearnerId;
              cursor.update(val);
            }
            cursor.continue();
          }
        } catch (err) {
          injectionError = err;
          tx.abort();
        }
      };

      //+_+// 6) draftSessions 변환 (소유자 learnerId 유지하며 current_draft_${ownerId} 변환)
      dStore.openCursor().onsuccess = (e) => {
        try {
          if (options._failInjection?.failAtStore === "draftSessions") {
            throw new Error("Simulated IndexedDB failure at draftSessions store");
          }
          const cursor = e.target.result;
          if (cursor) {
            const val = cursor.value;
            const isLegacy = val.id === "current_draft" || !val.learnerId || val.learnerId === DEFAULT_LEGACY_LEARNER_ID || val.id !== `current_draft_${val.learnerId}`;
            if (isLegacy) {
              cursor.delete();
              const ownerId = resolveRecordOwner(val, defaultTargetId);
              const draftKey = `current_draft_${ownerId}`;
              dStore.put({
                ...val,
                id: draftKey,
                learnerId: ownerId
              });
            }
            cursor.continue();
          }
        } catch (err) {
          injectionError = err;
          tx.abort();
        }
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => {
        const errorToReport = injectionError || e.target?.error || new Error("IndexedDB Transaction Error");
        reject(errorToReport);
      };
      tx.onabort = (e) => {
        const errorToReport = injectionError || e.target?.error || new Error("IndexedDB Transaction Aborted");
        reject(errorToReport);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * //+_+// 기존 레거시 데이터 전체를 안전하고 원자적으로 마이그레이션
 */
export async function migrateLegacyData(options = {}) {
  //+_+// 1. targetLearnerId가 명시된 경우 즉시 유효성 검증
  if (options.targetLearnerId) {
    const profile = await getLearnerProfile(options.targetLearnerId);
    if (!profile) {
      return {
        success: false,
        migrated: false,
        error: `마이그레이션 대상 학습자 프로필(${options.targetLearnerId})이 존재하지 않습니다.`
      };
    }
    if (profile.archived) {
      return {
        success: false,
        migrated: false,
        error: `보관된 학습자 프로필(${options.targetLearnerId})은 마이그레이션 대상으로 지정할 수 없습니다.`
      };
    }
  }

  //+_+// 2. 레거시 데이터 사전 감지
  const detection = await detectLegacyData();
  if (!detection.hasLegacyData) {
    const currentId = getCurrentLearnerId();
    return {
      success: true,
      migrated: false,
      targetLearnerId: options.targetLearnerId || currentId || null,
      message: "마이그레이션할 레거시 데이터가 없습니다.",
      counts: detection.counts
    };
  }

  //+_+// 3. 초기 active learner 상태 저장 (롤백 시 복원용)
  const initialActiveLearnerId = getCurrentLearnerId();

  //+_+// 4. 마이그레이션 대상 학습자 프로필 확보
  let targetProfile = null;
  let isNewlyCreated = false;
  try {
    const res = await resolveDefaultMigrationProfile(options);
    targetProfile = res.profile;
    isNewlyCreated = res.isNewlyCreated;
  } catch (err) {
    return {
      success: false,
      migrated: false,
      error: err.message
    };
  }

  const targetLearnerId = targetProfile.id;

  //+_+// 5. 백업 스냅샷 캡처 (6대 Store 원본 데이터)
  const backupSnapshot = await createMigrationBackup();

  //+_+// 6. Preflight 체크 (Key 충돌 및 Ownership 일관성 검사)
  const preflight = runPreflightCheck(backupSnapshot, targetLearnerId);
  if (!preflight.ok) {
    if (isNewlyCreated) {
      try {
        await deleteLearnerProfile(targetLearnerId);
      } catch (_) {}
      setCurrentLearnerId(initialActiveLearnerId);
    }
    return {
      success: false,
      migrated: false,
      reason: preflight.reason,
      ...(preflight.conflicts ? { conflicts: preflight.conflicts } : {}),
      error: preflight.error
    };
  }

  //+_+// 7. 실제 변환 트랜잭션 수행
  try {
    await executeMigrationTransaction(backupSnapshot, targetLearnerId, options);
    
    //+_+// 성공 시에만 활성 학습자 갱신
    setCurrentLearnerId(targetLearnerId);

    return {
      success: true,
      migrated: true,
      targetLearnerId,
      targetLearnerName: targetProfile.name,
      counts: detection.counts
    };
  } catch (error) {
    //+_+// 8. 실패 시 원본 백업 및 프로필, 활성 학습자 상태 자동 롤백
    let rollbackSuccess = false;
    let rollbackError = null;

    try {
      await restoreMigrationBackup(backupSnapshot);
      if (isNewlyCreated) {
        await deleteLearnerProfile(targetLearnerId);
      }
      setCurrentLearnerId(initialActiveLearnerId);
      rollbackSuccess = true;
    } catch (rbErr) {
      rollbackSuccess = false;
      rollbackError = rbErr.message;
    }

    if (rollbackSuccess) {
      return {
        success: false,
        migrated: false,
        rolledBack: true,
        error: error.message
      };
    } else {
      return {
        success: false,
        migrated: false,
        rolledBack: false,
        error: error.message,
        rollbackError: rollbackError || "롤백 실패"
      };
    }
  }
}

/**
 * //+_+// 마이그레이션 완료 여부 확인
 */
export async function isMigrationCompleted() {
  const detection = await detectLegacyData();
  return !detection.hasLegacyData;
}
