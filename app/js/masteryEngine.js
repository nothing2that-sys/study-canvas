/**
 * Math Canvas Pro - 단계형 숙달(Mastery) 및 취약점 분석 엔진 (Milestone E)
 * SSOT Section 200~206 명세 준수
 * - Stage 상태 머신 (UNSTARTED, LEARNING, NEAR_MASTERY, MASTERED, REVIEW_DUE, MAINTAINED)
 * - 최근 20문제 정답률 90%, 최근 2세션 85%, 미해결 오답 2개 이하 기반 숙달 판정
 * - 취약 기술 랭킹 및 Error Category 분석
 * - 일일 완료 기준(10문제 or 10분) 기반 Streak 산출
 */

import { getAllStages, STAGE_REGISTRY } from "./curriculumRegistry.js";

export const StageStatus = Object.freeze({
  UNSTARTED: "UNSTARTED",
  LEARNING: "LEARNING",
  NEAR_MASTERY: "NEAR_MASTERY",
  MASTERED: "MASTERED",
  REVIEW_DUE: "REVIEW_DUE",
  MAINTAINED: "MAINTAINED"
});

/**
 * 특정 Stage의 숙달 상태 계산
 */
export function calculateStageMastery(stageId, allAttempts = [], allMistakes = [], allSessions = []) {
  const stageAttempts = allAttempts.filter(a => a.stageId === stageId || a.macroLevelId === stageId);
  const totalSolved = stageAttempts.length;

  if (totalSolved === 0) {
    return {
      stageId,
      status: StageStatus.UNSTARTED,
      totalSolved: 0,
      totalCorrect: 0,
      totalAccuracy: 0,
      recentAccuracy: 0,
      recentAttemptsCount: 0,
      unresolvedMistakesCount: 0,
      missingConditions: ["최소 30문제 풀이", "최근 20문제 정답률 90% 이상", "최근 2개 세션 각 85% 이상", "미해결 오답 2개 이하"],
      isMastered: false
    };
  }

  const totalCorrect = stageAttempts.filter(a => a.isCorrect).length;
  const totalAccuracy = Math.round((totalCorrect / totalSolved) * 100);

  // 최근 20문제
  const sortedAttempts = [...stageAttempts].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  const recent20 = sortedAttempts.slice(0, 20);
  const recent20Correct = recent20.filter(a => a.isCorrect).length;
  const recentAccuracy = recent20.length > 0 ? Math.round((recent20Correct / recent20.length) * 100) : 0;

  // 미해결 오답 수
  const stageMistakes = allMistakes.filter(m => m.stageId === stageId || m.macroLevelId === stageId || m.level === stageId);
  const unresolvedMistakesCount = stageMistakes.length;

  // 최근 2개 세션
  const stageSessions = allSessions.filter(s => s.stageId === stageId || s.macroLevelId === stageId || s.results?.some(r => r.stageId === stageId));
  const recent2Sessions = stageSessions.slice(0, 2);
  const recent2SessionsPass = recent2Sessions.length >= 2 && recent2Sessions.every(s => (s.accuracyRate || 0) >= 85);

  // 숙달 조건 검증
  const cond1_count = totalSolved >= 30;
  const cond2_recentAcc = recent20.length >= 10 && recentAccuracy >= 90;
  const cond3_sessions = recent2SessionsPass || (recent20.length >= 20 && recentAccuracy >= 90);
  const cond4_mistakes = unresolvedMistakesCount <= 2;

  const missingConditions = [];
  if (!cond1_count) missingConditions.push(`누적 30문제 필요 (현재 ${totalSolved}문제)`);
  if (!cond2_recentAcc) missingConditions.push(`최근 20문제 정답률 90% 필요 (현재 ${recentAccuracy}%)`);
  if (!cond3_sessions) missingConditions.push("최근 2세션 각각 85% 이상 필요");
  if (!cond4_mistakes) missingConditions.push(`미해결 오답 2개 이하 필요 (현재 ${unresolvedMistakesCount}개)`);

  let status = StageStatus.LEARNING;
  if (cond1_count && cond2_recentAcc && cond3_sessions && cond4_mistakes) {
    // 마지막 풀이 후 7일 이상 경과 시 REVIEW_DUE
    const lastAttemptTime = sortedAttempts[0]?.completedAt || 0;
    const daysSinceLast = (Date.now() - lastAttemptTime) / (1000 * 60 * 60 * 24);
    if (daysSinceLast > 7) {
      status = StageStatus.REVIEW_DUE;
    } else {
      status = StageStatus.MASTERED;
    }
  } else if (recentAccuracy >= 80 || (totalSolved >= 15 && totalAccuracy >= 85)) {
    status = StageStatus.NEAR_MASTERY;
  }

  return {
    stageId,
    status,
    totalSolved,
    totalCorrect,
    totalAccuracy,
    recentAccuracy,
    recentAttemptsCount: recent20.length,
    unresolvedMistakesCount,
    missingConditions,
    isMastered: status === StageStatus.MASTERED || status === StageStatus.MAINTAINED || status === StageStatus.REVIEW_DUE
  };
}

/**
 * 취약 기술 및 오류 원인 분석
 */
export function analyzeWeaknesses(allAttempts = [], allMistakes = []) {
  const stageStats = new Map();

  allAttempts.forEach((a) => {
    const sId = a.stageId || a.macroLevelId || "unknown";
    if (!stageStats.has(sId)) {
      stageStats.set(sId, { stageId: sId, operation: a.operation, total: 0, wrong: 0, solveTimeMs: 0 });
    }
    const stat = stageStats.get(sId);
    stat.total += 1;
    if (!a.isCorrect) stat.wrong += 1;
    stat.solveTimeMs += (a.solveTimeMs || 0);
  });

  const weaknesses = [];
  stageStats.forEach((stat) => {
    const errorRate = stat.total > 0 ? Math.round((stat.wrong / stat.total) * 100) : 0;
    const stageDef = STAGE_REGISTRY[stat.stageId];
    const weaknessScore = (stat.wrong * 3) + (errorRate * 0.5);

    if (stat.wrong > 0 || errorRate >= 20) {
      weaknesses.push({
        stageId: stat.stageId,
        title: stageDef?.title || stat.stageId,
        operation: stat.operation || stageDef?.operation || "mul",
        totalSolved: stat.total,
        wrongCount: stat.wrong,
        errorRate,
        weaknessScore
      });
    }
  });

  // 오답 카테고리 집계
  const errorCategoriesCount = new Map();
  allMistakes.forEach((m) => {
    (m.errorCategories || ["일반 계산 오류"]).forEach((cat) => {
      errorCategoriesCount.set(cat, (errorCategoriesCount.get(cat) || 0) + 1);
    });
  });

  return {
    weaknesses: weaknesses.sort((a, b) => b.weaknessScore - a.weaknessScore),
    errorCategories: Array.from(errorCategoriesCount.entries()).map(([cat, count]) => ({ category: cat, count }))
  };
}

/**
 * 일일 완료 및 Streak 계산 (10문제 이상 또는 10분 이상 풀이한 날만 인정)
 */
export function calculateDailyStreak(dailyMap) {
  if (!dailyMap || dailyMap.size === 0) {
    return { currentStreak: 0, maxStreak: 0, todayActive: false };
  }

  const formatYmd = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const isDayCompleted = (entry) => {
    if (!entry) return false;
    return (entry.totalQuestions >= 10) || (entry.totalSolveTimeMs >= 600000) || (entry.sessionCount >= 2);
  };

  const today = new Date();
  const todayKey = formatYmd(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = formatYmd(yesterday);

  const todayEntry = dailyMap.get(todayKey);
  const yesterdayEntry = dailyMap.get(yesterdayKey);

  const todayActive = isDayCompleted(todayEntry);
  const yesterdayActive = isDayCompleted(yesterdayEntry);

  if (!todayActive && !yesterdayActive) {
    return { currentStreak: 0, maxStreak: calculateMaxCompletedStreak(dailyMap, isDayCompleted), todayActive: false };
  }

  let streak = 0;
  let checkDate = new Date(todayActive ? today : yesterday);

  while (true) {
    const key = formatYmd(checkDate);
    const entry = dailyMap.get(key);
    if (isDayCompleted(entry)) {
      streak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    currentStreak: streak,
    maxStreak: Math.max(streak, calculateMaxCompletedStreak(dailyMap, isDayCompleted)),
    todayActive
  };
}

function calculateMaxCompletedStreak(dailyMap, isCompletedFn) {
  const sortedDates = Array.from(dailyMap.keys()).sort();
  let max = 0;
  let current = 0;
  let lastDate = null;

  for (const dateStr of sortedDates) {
    const entry = dailyMap.get(dateStr);
    if (!isCompletedFn(entry)) continue;

    const currDate = new Date(dateStr);
    if (!lastDate) {
      current = 1;
      max = 1;
    } else {
      const diffDays = Math.round((currDate - lastDate) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        current += 1;
        if (current > max) max = current;
      } else {
        current = 1;
      }
    }
    lastDate = currDate;
  }

  return max;
}
