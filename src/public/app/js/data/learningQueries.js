//+_+// Math Canvas Pro - 학습 데이터 읽기 전용 Query 계층
//+_+// SSOT Section 3 & 9 및 Phase F4 명세 준수
//+_+// - UI -> Query -> storage.js 읽기 전용 경계 제공

import {
  getRecentSessions as storageGetRecentSessions,
  getMistakeQuestions as storageGetMistakeQuestions,
  getLearningStats as storageGetLearningStats,
  getCurriculumProgress as storageGetCurriculumProgress,
  getDraftSession as storageGetDraftSession,
  getRecentAttempts as storageGetRecentAttempts,
  getDailyLearningMap as storageGetDailyLearningMap,
  getCurrentStreak as storageGetCurrentStreak,
  getSessionsByDate as storageGetSessionsByDate,
  getSubmission as storageGetSubmission,
  getSubmissionBySessionId as storageGetSubmissionBySessionId,
  getPendingSubmissions as storageGetPendingSubmissions,
  getAllSubmissions as storageGetAllSubmissions,
  getProgressAggregate as storageGetProgressAggregate,
  getAllProgressAggregates as storageGetAllProgressAggregates,
  getProgressAggregateByLevel as storageGetProgressAggregateByLevel,
  getReviewItem as storageGetReviewItem,
  getAllReviewItems as storageGetAllReviewItems,
  getActiveReviewItems as storageGetActiveReviewItems,
  getResolvedReviewItems as storageGetResolvedReviewItems,
  getReviewItemsByState as storageGetReviewItemsByState,
  getReviewItemsByLevel as storageGetReviewItemsByLevel,
  getReviewItemBySourceAttemptId as storageGetReviewItemBySourceAttemptId
} from "../storage.js";

//+_+// 최근 완료 세션 목록 조회
export async function getRecentSessions(limit = 10, filter = {}) {
  return await storageGetRecentSessions(limit, filter);
}

//+_+// 오답 문제 큐 조회
export async function getMistakes(filter = {}) {
  return await storageGetMistakeQuestions(filter);
}

//+_+// 전체 학습 통계 조회 (총 문제 수, 정답률 등)
export async function getLearningStats(filter = {}) {
  return await storageGetLearningStats(filter);
}

//+_+// 교육과정 단계별 진도/마스터리 정보 조회
export async function getCurriculumProgress(filter = {}) {
  return await storageGetCurriculumProgress(filter);
}

//+_+// 임시 저장된 Draft 세션 조회
export async function getDraft(options = {}) {
  return await storageGetDraftSession(options);
}

//+_+// 최근 개별 시도(Attempts) 목록 조회
export async function getRecentAttempts(limit = 20, filter = {}) {
  return await storageGetRecentAttempts(limit, filter);
}

//+_+// 일별 학습 기록 맵 조회 (달력/잔디 뷰용)
export async function getDailyLearningMap(filter = {}) {
  return await storageGetDailyLearningMap(filter);
}

//+_+// 현재 연속 학습 일수(Streak) 조회
export async function getCurrentStreak(filter = {}) {
  return await storageGetCurrentStreak(filter);
}

//+_+// 특정 날짜의 세션 목록 조회
export async function getSessionsByDate(dateKey, filter = {}) {
  return await storageGetSessionsByDate(dateKey, filter);
}

//+_+// 학습자 홈 요약 정보 조회 (Streak, 총 문제 수, 최근 세션 등)
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

//+_+// Phase F4: 특정 제출 Snapshot 조회 (ID 기준, active learnerId 기본 격리)
export async function getSubmission(id, options = {}) {
  return await storageGetSubmission(id, options);
}

//+_+// Phase F4: 특정 세션 ID 기준 제출 Snapshot 조회
export async function getSubmissionBySessionId(sessionId, options = {}) {
  return await storageGetSubmissionBySessionId(sessionId, options);
}

//+_+// Phase F4: 보호자 채점 대기(PARENT_GRADING_PENDING) 목록 조회 (learnerId 격리)
export async function getPendingSubmissions(options = {}) {
  return await storageGetPendingSubmissions(options);
}

//+_+// Phase F4: 전체 제출본 목록 조회 (learnerId 격리)
export async function getAllSubmissions(filter = {}) {
  return await storageGetAllSubmissions(filter);
}

//+_+// Phase F6: 특정 ID 기준 ProgressAggregate 조회
export async function getProgressAggregate(id, options = {}) {
  return await storageGetProgressAggregate(id, options);
}

//+_+// Phase F6: 특정 학습자의 특정 레벨 ProgressAggregate 조회
export async function getProgressAggregateByLevel(learnerId, levelId, options = {}) {
  return await storageGetProgressAggregateByLevel(learnerId, levelId, options);
}

//+_+// Phase F6: 전체 ProgressAggregate 목록 조회 (learnerId 격리)
export async function getProgressAggregates(options = {}) {
  return await storageGetAllProgressAggregates(options);
}

//+_+// ============================================================================
//+_+// Phase F7: 오답 함께 보기 & 재풀이 (ReviewItem) Query 계층 API
//+_+// ============================================================================

//+_+// Phase F7: ReviewItem 단건 조회 (learnerId 격리)
export async function getReviewItem(id, options = {}) {
  return await storageGetReviewItem(id, options);
}

//+_+// Phase F7: ReviewItem 전체 목록 조회 (learnerId 격리 및 필터)
export async function getAllReviewItems(filter = {}, options = {}) {
  return await storageGetAllReviewItems(filter, options);
}

//+_+// Phase F7: 활성 복습 항목 목록 조회 (unresolved, retrying, review_pending)
export async function getActiveReviewItems(options = {}) {
  return await storageGetActiveReviewItems(options);
}

//+_+// Phase F7: 해결 완료된 복습 항목 목록 조회 (resolved)
export async function getResolvedReviewItems(options = {}) {
  return await storageGetResolvedReviewItems(options);
}

//+_+// Phase F7: 특정 상태의 복습 항목 목록 조회
export async function getReviewItemsByState(state, options = {}) {
  return await storageGetReviewItemsByState(state, options);
}

//+_+// Phase F7: 특정 레벨의 복습 항목 목록 조회
export async function getReviewItemsByLevel(learnerId, levelId, options = {}) {
  return await storageGetReviewItemsByLevel(learnerId, levelId, options);
}

//+_+// Phase F7: 원본 Attempt ID 기준 ReviewItem 조회
export async function getReviewItemBySourceAttemptId(sourceAttemptId, options = {}) {
  return await storageGetReviewItemBySourceAttemptId(sourceAttemptId, options);
}


