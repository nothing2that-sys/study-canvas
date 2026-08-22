/**
 * Math Canvas Pro - IndexedDB 로컬 영구 스토리지 관리자 (Phase 4)
 * SSOT Section 95~108 명세 준수
 * - 세션 기록, 문제별 채점 결과, 빨간 펜 코멘트 영구 저장
 * - 캔버스 손계산 필기 스트로크 영구 저장
 * - 오답 큐(Mistake Queue) 추적 및 관리
 */

const DB_NAME = "math_canvas_pro_db";
const DB_VERSION = 1;

let dbPromise = null;

export function getDB() {
  if (dbPromise) return dbPromise;

  if (typeof indexedDB === "undefined") {
    // Node.js 테스트 환경 등 indexedDB 미지원 시 메모리 mock fallback
    return Promise.resolve(createMemoryFallbackDB());
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("sessions")) {
        const sessionStore = db.createObjectStore("sessions", { keyPath: "id" });
        sessionStore.createIndex("completedAt", "completedAt", { unique: false });
      }

      if (!db.objectStoreNames.contains("mistakes")) {
        const mistakeStore = db.createObjectStore("mistakes", { keyPath: "key" });
        mistakeStore.createIndex("lastWrongAt", "lastWrongAt", { unique: false });
      }

      if (!db.objectStoreNames.contains("strokes")) {
        db.createObjectStore("strokes", { keyPath: "sessionId_questionId" });
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

// 메모리 Fallback DB (IndexedDB 미지원 환경용)
let memoryStore = {
  sessions: new Map(),
  mistakes: new Map(),
  strokes: new Map()
};

function createMemoryFallbackDB() {
  return {
    isMemory: true,
    sessions: memoryStore.sessions,
    mistakes: memoryStore.mistakes,
    strokes: memoryStore.strokes
  };
}

/**
 * 완료된 세션 기록 및 스트로크, 오답 큐 저장
 */
export async function saveSessionRecord(summary, strokesMap = new Map()) {
  const db = await getDB();
  const sessionId = summary.sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();

  const sessionRecord = {
    ...summary,
    id: sessionId,
    completedAt: now,
    results: summary.results.map((r) => ({
      ...r,
      strokes: strokesMap.get(r.questionId) || r.strokes || []
    }))
  };

  if (db.isMemory) {
    db.sessions.set(sessionId, sessionRecord);

    summary.results.forEach((r) => {
      if (!r.isCorrect) {
        const prev = db.mistakes.get(r.questionKey) || { wrongCount: 0 };
        db.mistakes.set(r.questionKey, {
          ...r,
          key: r.questionKey,
          wrongCount: prev.wrongCount + 1,
          lastWrongAt: now
        });
      } else {
        // 정답을 맞춘 경우 오답 큐에서 해제
        db.mistakes.delete(r.questionKey);
      }

      if (strokesMap.has(r.questionId)) {
        db.strokes.set(`${sessionId}_${r.questionId}`, strokesMap.get(r.questionId));
      }
    });

    return sessionRecord;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["sessions", "mistakes", "strokes"], "readwrite");
    const sessionStore = tx.objectStore("sessions");
    const mistakeStore = tx.objectStore("mistakes");
    const strokeStore = tx.objectStore("strokes");

    sessionStore.put(sessionRecord);

    summary.results.forEach((r) => {
      if (!r.isCorrect) {
        const getReq = mistakeStore.get(r.questionKey);
        getReq.onsuccess = () => {
          const prev = getReq.result || { wrongCount: 0 };
          mistakeStore.put({
            ...r,
            key: r.questionKey,
            wrongCount: prev.wrongCount + 1,
            lastWrongAt: now
          });
        };
      } else {
        mistakeStore.delete(r.questionKey);
      }

      if (strokesMap.has(r.questionId)) {
        strokeStore.put({
          sessionId_questionId: `${sessionId}_${r.questionId}`,
          sessionId,
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
 * 최근 완료 세션 목록 조회
 */
export async function getRecentSessions(limit = 10) {
  const db = await getDB();

  if (db.isMemory) {
    return Array.from(db.sessions.values())
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, limit);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction("sessions", "readonly");
    const store = tx.objectStore("sessions");
    const req = store.getAll();

    req.onsuccess = () => {
      const sorted = (req.result || [])
        .sort((a, b) => b.completedAt - a.completedAt)
        .slice(0, limit);
      resolve(sorted);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * 누적 오답 문제 목록 조회 (오답 복습용)
 */
export async function getMistakeQuestions() {
  const db = await getDB();

  if (db.isMemory) {
    return Array.from(db.mistakes.values())
      .sort((a, b) => b.lastWrongAt - a.lastWrongAt);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction("mistakes", "readonly");
    const store = tx.objectStore("mistakes");
    const req = store.getAll();

    req.onsuccess = () => {
      const sorted = (req.result || []).sort((a, b) => b.lastWrongAt - a.lastWrongAt);
      resolve(sorted);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * 전체 학습 통계 집계
 */
export async function getLearningStats() {
  const sessions = await getRecentSessions(100);
  const mistakes = await getMistakeQuestions();

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
 * 표준 레퍼런스 교육과정별(Lv.1~Lv.6) 누적 학습 진행도 및 마스터리 집계
 */
export async function getCurriculumProgress() {
  const sessions = await getRecentSessions(200);

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
    const op = session.operation === "div" ? "div" : "mul";
    const results = session.results || [];

    results.forEach((r) => {
      // 레벨 추정 (r.level e.g. "M1" -> 1, "M2" -> 2, "M5" -> 4, "M6" -> 5, "M9" -> 6)
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
        item.status = "unstarted"; // 시작 전 🌱
      } else if (item.solved >= 15 && item.accuracy >= 85) {
        item.status = "mastered"; // 마스터 ⭐
      } else {
        item.status = "learning"; // 학습 중 🏃
      }
    });
  });

  return progress;
}

/**
 * 날짜별(YYYY-MM-DD) 학습 데이터 및 잔디 집계
 */
export async function getDailyLearningMap() {
  const sessions = await getRecentSessions(200);
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

  // 정답률 계산
  map.forEach((entry) => {
    entry.accuracy = entry.totalQuestions > 0 ? Math.round((entry.correctQuestions / entry.totalQuestions) * 100) : 0;
  });

  return map;
}

/**
 * 연속 학습 일수 (Streak) 계산
 */
export async function getCurrentStreak() {
  const dailyMap = await getDailyLearningMap();
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

  // 오늘 또는 어제부터 시작해서 과거로 거슬러 올라가며 연속 일수 계산
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
 * 특정 날짜에 완료된 세션 목록 반환
 */
export async function getSessionsByDate(dateKey) {
  const dailyMap = await getDailyLearningMap();
  const entry = dailyMap.get(dateKey);
  return entry ? entry.sessions : [];
}

/**
 * 저장소 전체 초기화
 */
export async function clearAllData() {
  const db = await getDB();

  if (db.isMemory) {
    db.sessions.clear();
    db.mistakes.clear();
    db.strokes.clear();
    return true;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(["sessions", "mistakes", "strokes"], "readwrite");
    tx.objectStore("sessions").clear();
    tx.objectStore("mistakes").clear();
    tx.objectStore("strokes").clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}
