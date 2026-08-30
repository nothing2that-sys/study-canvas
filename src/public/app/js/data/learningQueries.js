/**
 * Math Canvas Pro - 학습 데이터 읽기 전용 Query 계층
 * SSOT Section 3 & 9 및 Phase F3 명세 준수
 * - UI -> Query -> storage.js 읽기 전용 경계 제공
 */

import {
  getRecentSessions as storageGetRecentSessions,
  getMistakeQuestions as storageGetMistakeQuestions,
  getLearningStats as storageGetLearningStats,
  getCurriculumProgress as storageGetCurriculumProgress,
  getDraftSession as storageGetDraftSession,
  getRecentAttempts as storageGetRecentAttempts,
  getDailyLearningMap as storageGetDailyLearningMap,
  getCurrentStreak as storageGetCurrentStreak,
  getSessionsByDate as storageGetSessionsByDate
} from "../storage.js";

/**
 * 최근 완료 세션 목록 조회
 */
export async function getRecentSessions(limit = 10, filter = {}) {
  return await storageGetRecentSessions(limit, filter);
}

/**
 * 오답 문제 큐 조회
 */
export async function getMistakes(filter = {}) {
  return await storageGetMistakeQuestions(filter);
}

/**
 * 전체 학습 통계 조회 (총 문제 수, 정답률 등)
 */
export async function getLearningStats(filter = {}) {
  return await storageGetLearningStats(filter);
}

/**
 * 교육과정 단계별 진도/마스터리 정보 조회
 */
export async function getCurriculumProgress(filter = {}) {
  return await storageGetCurriculumProgress(filter);
}

/**
 * 임시 저장된 Draft 세션 조회
 */
export async function getDraft(options = {}) {
  return await storageGetDraftSession(options);
}

/**
 * 최근 개별 시도(Attempts) 목록 조회
 */
export async function getRecentAttempts(limit = 20, filter = {}) {
  return await storageGetRecentAttempts(limit, filter);
}

/**
 * 일별 학습 기록 맵 조회 (달력/잔디 뷰용)
 */
export async function getDailyLearningMap(filter = {}) {
  return await storageGetDailyLearningMap(filter);
}

/**
 * 현재 연속 학습 일수(Streak) 조회
 */
export async function getCurrentStreak(filter = {}) {
  return await storageGetCurrentStreak(filter);
}

/**
 * 특정 날짜의 세션 목록 조회
 */
export async function getSessionsByDate(dateKey, filter = {}) {
  return await storageGetSessionsByDate(dateKey, filter);
}

/**
 * 학습자 홈 요약 정보 조회 (Streak, 총 문제 수, 최근 세션 등)
 */
export async function getLearnerHomeSummary(learnerId) {
  const filter = learnerId ? { learnerId } : {};
  const [streakInfo, stats, recentSessions] = await Promise.all([
    getCurrentStreak(filter),
    getLearningStats(filter),
    getRecentSessions(3, filter)
  ]);

  return {
    learnerId,
    currentStreak: streakInfo.currentStreak || 0,
    todayActive: Boolean(streakInfo.todayActive),
    totalProblems: stats.totalProblems || 0,
    overallAccuracy: stats.overallAccuracy || 0,
    recentSessionsCount: recentSessions.length
  };
}
