import {currentEditionSkillProgress} from '../languageCandidateProgress.js';
//+_+// Math Canvas Pro - 학습 데이터 읽기 전용 Query 계층
//+_+// SSOT Section 3 & 9 및 Phase F4 명세 준수
//+_+// - UI -> Query -> storage.js 읽기 전용 경계 제공

import {
  getDB as storageGetDB,
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
  getReviewItemBySourceAttemptId as storageGetReviewItemBySourceAttemptId,
  getCurrentLearnerId,
  DEFAULT_LEGACY_LEARNER_ID
} from "../storage.js";
import { evaluateStartupDraftResumePolicy } from "../submissionLifecycle.js";
import { collectReviewEvidence } from "../f16dReviewEvidence.js";

export async function getF16dReviewEvidence(learnerId, buildId) {
  return collectReviewEvidence(await storageGetDB(), learnerId, buildId);
}
import { getAllSubjects } from "../platform/subjectRegistry.js";
//+_+// Phase F9: 추천 엔진 빌더 import
import { buildLearningRecommendations } from "../recommendations/recommendationEngine.js";


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

//+_+// 학습자 홈 요약 정보 조회 (Streak, 총 문제 수, 최근 세션 등 - F8 getLearnerDashboard 기반 통합)
export async function getLearnerHomeSummary(learnerId) {
  const filter = learnerId ? { learnerId } : {};
  const [streakInfo, dashboard] = await Promise.all([
    getCurrentStreak(filter).catch(() => ({ currentStreak: 0, todayActive: false })),
    getLearnerDashboard(learnerId)
  ]);

  return {
    learnerId,
    currentStreak: streakInfo.currentStreak || 0,
    todayActive: Boolean(streakInfo.todayActive),
    totalProblems: dashboard.overall.gradedAttemptCount,
    overallAccuracy: Math.round(dashboard.overall.accuracy),
    recentSessionsCount: dashboard.recentSessions.length,
    stats: {
      totalQuestions: dashboard.overall.gradedAttemptCount,
      accuracyRate: Math.round(dashboard.overall.accuracy)
    }
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

//+_+// Phase F11: 전체 ProgressAggregate 목록 조회 alias
export async function getAllProgressAggregates(options = {}) {
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

//+_+// ============================================================================
//+_+// Phase F8: 학습자 홈 및 진도 대시보드 통합 Read Model (SSOT Query)
//+_+// ============================================================================

//+_+// Phase F8: 학습자 통합 대시보드 조회 (순수 읽기 전용, 결정론적, 격리)
export async function getLearnerDashboard(learnerId, options = {}) {
  const targetLearnerId = (typeof learnerId === "string" && learnerId)
    ? learnerId
    : (getCurrentLearnerId() || DEFAULT_LEGACY_LEARNER_ID);

  // 병렬로 기존 Read Query 호출 (DB Write 없는 순수 읽기)
  const [
    draftRead,
    allSubmissions,
    activeReviewItems,
    aggregates,
    recentSessions,
    curriculumProgressData
  ] = await Promise.all([
    getDraft({ learnerId: targetLearnerId, withRecoveryToken: true }).catch(() => null),
    getAllSubmissions({ learnerId: targetLearnerId }).catch(() => []),
    getActiveReviewItems({ learnerId: targetLearnerId }).catch(() => []),
    getProgressAggregates({ learnerId: targetLearnerId }).catch(() => []),
    getRecentSessions(options.recentLimit || 5, { learnerId: targetLearnerId }).catch(() => []),
    getCurriculumProgress({ learnerId: targetLearnerId }).catch(() => ({ mul: [], div: [] }))
  ]);
  const draft = draftRead?.draft || null;

  // 1. Action Card: 풀이 중 (inProgress)
  const inProgressCards = [];
  if (draft && draft.questions && draft.questions.length > 0) {
    const draftOwner = draft.learnerId || DEFAULT_LEGACY_LEARNER_ID;
    if (draftOwner === targetLearnerId) {
      const submissionForDraft = draft.sessionId
        ? allSubmissions.find((s) => s.sessionId === draft.sessionId || s.id === draft.sessionId)
        : null;
      const policy = evaluateStartupDraftResumePolicy({ draft, submission: submissionForDraft });

      const isPracticeActive = (draft.sessionState === "PRACTICE_ACTIVE" || !draft.sessionState) &&
        draft.sessionType !== "grading" &&
        draft.sessionState !== "GRADING_ACTIVE";

      if (policy.canResumePractice && isPracticeActive && (!submissionForDraft || submissionForDraft.status === "PRACTICE_ACTIVE")) {
        const solvedKeys = new Set([
          ...Object.keys(draft.studentStrokesMap || {}),
          ...Object.keys(draft.responseRecords || {})
        ]);
        const defaultLevelName = draft.subjectId === "korean" ? "국어 학습"
          : draft.subjectId === "english" ? "영어 학습"
          : (draft.courseId === "measurement" || draft.config?.courseId === "measurement") ? "단위 변환"
          : (draft.courseId === "fraction" || draft.config?.courseId === "fraction") ? "분수 개념"
          : "2자리 입문";

        inProgressCards.push({
          sessionId: draft.sessionId,
          subjectId: draft.subjectId || draft.config?.subjectId || "math",
          courseId: draft.config?.courseId || draft.courseId || "arithmetic",
          levelId: draft.config?.difficulty || draft.config?.level || "Lv.2",
          levelName: draft.config?.skillTitle || draft.config?.title || draft.config?.name || draft.config?.levelName || defaultLevelName,
          totalQuestions: draft.questions.length,
          solvedQuestions: solvedKeys.size,
          savedAt: draft.updatedAt || draft.createdAt || Date.now(),
          rawDraft: draft
        });
      }
    }
  }

  // 2. Action Card: 채점 대기 (pendingGrading)
  // PARENT_GRADING_PENDING, GRADING_ACTIVE만 포함 (GRADED, SESSION_COMPLETE 제외)
  const pendingGradingCards = (allSubmissions || [])
    .filter((sub) => {
      const subOwner = sub.learnerId || DEFAULT_LEGACY_LEARNER_ID;
      return subOwner === targetLearnerId &&
        (sub.status === "PARENT_GRADING_PENDING" || sub.status === "GRADING_ACTIVE");
    })
    .sort((a, b) => (b.submittedAt || b.createdAt || 0) - (a.submittedAt || a.createdAt || 0))
    .map((sub) => {
      const progress = sub.gradingProgress || {};
      const graded = progress.graded || 0;
      const total = progress.total || sub.questions?.length || 0;
      const isGradingActive = sub.status === "GRADING_ACTIVE";
      return {
        submissionId: sub.id,
        sessionId: sub.sessionId,
        status: sub.status,
        subjectId: sub.subjectId || "math",
        courseId: sub.courseId || "arithmetic",
        totalQuestions: total,
        gradedQuestions: graded,
        title: isGradingActive ? "진행 중인 채점을 이어가세요" : "채점을 기다리는 풀이가 있어요",
        actionLabel: isGradingActive ? "채점 이어하기" : "보호자 채점 열기",
        submittedAt: sub.submittedAt || sub.createdAt || 0,
        rawSubmission: sub
      };
    });

  // 3. Action Card: 복습 필요 (reviewRequired)
  const activeReviews = (activeReviewItems || [])
    .filter((item) => {
      const itemOwner = item.learnerId || DEFAULT_LEGACY_LEARNER_ID;
      return itemOwner === targetLearnerId &&
        (item.state === "unresolved" || item.state === "retrying" || item.state === "review_pending");
    })
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  // 4. Overall 통계: F6 ProgressAggregate SSOT 기반 가중치 정답률 계산
  const targetAggregates = (aggregates || []).filter((a) => {
    const aggOwner = a.learnerId || DEFAULT_LEGACY_LEARNER_ID;
    return aggOwner === targetLearnerId;
  });

  let gradedAttemptCount = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let retryRequestedCount = 0;
  let totalSolveTimeMs = 0;

  targetAggregates.forEach((agg) => {
    gradedAttemptCount += Number(agg.gradedAttemptCount) || 0;
    correctCount += Number(agg.correctCount) || 0;
    incorrectCount += Number(agg.incorrectCount) || 0;
    retryRequestedCount += Number(agg.retryRequestedCount) || 0;
    totalSolveTimeMs += Number(agg.totalSolveTimeMs) || 0;
  });

  const accuracy = gradedAttemptCount > 0 ? (correctCount / gradedAttemptCount) * 100 : 0;
  const averageSolveTimeMs = gradedAttemptCount > 0 ? Math.round(totalSolveTimeMs / gradedAttemptCount) : 0;

  const completedSubs = (allSubmissions || []).filter((s) => {
    const subOwner = s.learnerId || DEFAULT_LEGACY_LEARNER_ID;
    return subOwner === targetLearnerId && (s.status === "GRADED" || s.status === "SESSION_COMPLETE");
  });
  const sessionCount = completedSubs.length > 0 ? completedSubs.length : recentSessions.length;

  const overall = {
    gradedAttemptCount,
    correctCount,
    incorrectCount,
    retryRequestedCount,
    accuracy,
    totalSolveTimeMs,
    averageSolveTimeMs,
    sessionCount
  };

  // 5. 과목별 진도: Subject Registry 기준 렌더링
  const registrySubjects = getAllSubjects();
  const mulLevels = curriculumProgressData?.mul || [];
  const divLevels = curriculumProgressData?.div || [];
  const allCurriculumLevels = [...mulLevels, ...divLevels];
  const totalLevels = allCurriculumLevels.length || 12;
  const masteredLevels = allCurriculumLevels.filter((l) => l.status === "mastered").length;
  const learningLevels = allCurriculumLevels.filter((l) => l.status === "learning").length;
  const unstartedLevels = allCurriculumLevels.filter((l) => l.status === "unstarted").length;
  const progressRate = totalLevels > 0 ? Math.round((masteredLevels / totalLevels) * 100) : 0;

  const mathAggs = targetAggregates.filter((a) => (a.subjectId || "math") === "math");
  let mathGraded = 0;
  let mathCorrect = 0;
  let mathIncorrect = 0;
  let mathRetry = 0;
  let mathTime = 0;

  mathAggs.forEach((a) => {
    mathGraded += Number(a.gradedAttemptCount) || 0;
    mathCorrect += Number(a.correctCount) || 0;
    mathIncorrect += Number(a.incorrectCount) || 0;
    mathRetry += Number(a.retryRequestedCount) || 0;
    mathTime += Number(a.totalSolveTimeMs) || 0;
  });

  const mathAccuracy = mathGraded > 0 ? (mathCorrect / mathGraded) * 100 : 0;
  const mathAvgTime = mathGraded > 0 ? Math.round(mathTime / mathGraded) : 0;

  //+_+// Phase F12: 국어(Korean) 집계 통계
  const koreanAggs = targetAggregates.filter((a) => a.subjectId === "korean");
  let koreanGraded = 0;
  let koreanCorrect = 0;
  let koreanIncorrect = 0;
  let koreanRetry = 0;
  let koreanTime = 0;

  koreanAggs.forEach((a) => {
    koreanGraded += Number(a.gradedAttemptCount) || 0;
    koreanCorrect += Number(a.correctCount) || 0;
    koreanIncorrect += Number(a.incorrectCount) || 0;
    koreanRetry += Number(a.retryRequestedCount) || 0;
    koreanTime += Number(a.totalSolveTimeMs) || 0;
  });

  const koreanAccuracy = koreanGraded > 0 ? (koreanCorrect / koreanGraded) * 100 : 0;
  const koreanAvgTime = koreanGraded > 0 ? Math.round(koreanTime / koreanGraded) : 0;
  const koreanCompletedSubs = (allSubmissions || []).filter((s) => {
    const subOwner = s.learnerId || DEFAULT_LEGACY_LEARNER_ID;
    return subOwner === targetLearnerId && s.subjectId === "korean" && (s.status === "GRADED" || s.status === "SESSION_COMPLETE");
  });

  //+_+// Phase F13: 영어(English) 집계 통계
  const englishAggs = targetAggregates.filter((a) => a.subjectId === "english");
  let englishGraded = 0;
  let englishCorrect = 0;
  let englishIncorrect = 0;
  let englishRetry = 0;
  let englishTime = 0;

  englishAggs.forEach((a) => {
    englishGraded += Number(a.gradedAttemptCount) || 0;
    englishCorrect += Number(a.correctCount) || 0;
    englishIncorrect += Number(a.incorrectCount) || 0;
    englishRetry += Number(a.retryRequestedCount) || 0;
    englishTime += Number(a.totalSolveTimeMs) || 0;
  });

  const englishAccuracy = englishGraded > 0 ? (englishCorrect / englishGraded) * 100 : 0;
  const englishAvgTime = englishGraded > 0 ? Math.round(englishTime / englishGraded) : 0;
  const englishCompletedSubs = (allSubmissions || []).filter((s) => {
    const subOwner = s.learnerId || DEFAULT_LEGACY_LEARNER_ID;
    return subOwner === targetLearnerId && s.subjectId === "english" && (s.status === "GRADED" || s.status === "SESSION_COMPLETE");
  });

  const mathCompletedSubs = (allSubmissions || []).filter((s) => {
    const subOwner = s.learnerId || DEFAULT_LEGACY_LEARNER_ID;
    return subOwner === targetLearnerId && (s.subjectId || "math") === "math" && (s.status === "GRADED" || s.status === "SESSION_COMPLETE");
  });

  const subjects = registrySubjects.map((subj) => {
    if (subj.status === "active" && subj.id === "math") {
      return {
        id: subj.id,
        subjectId: subj.id,
        title: subj.title,
        icon: subj.icon,
        status: subj.status,
        enabled: subj.enabled,
        stats: {
          gradedAttemptCount: mathGraded,
          correctCount: mathCorrect,
          incorrectCount: mathIncorrect,
          retryRequestedCount: mathRetry,
          accuracy: mathAccuracy,
          totalSolveTimeMs: mathTime,
          averageSolveTimeMs: mathAvgTime,
          sessionCount: mathCompletedSubs.length
        },
        progress: {
          totalLevels,
          masteredLevels,
          learningLevels,
          unstartedLevels,
          progressRate,
          curriculum: curriculumProgressData
        }
      };
    }
    if (subj.status === "active" && subj.id === "korean") {
      const hasKoreanData = koreanGraded > 0 || koreanAggs.length > 0 || koreanCompletedSubs.length > 0;
      if (!hasKoreanData) {
        return {
          id: subj.id,
          subjectId: subj.id,
          title: subj.title,
          icon: subj.icon,
          status: subj.status,
          enabled: subj.enabled,
          stats: null,
          progress: null
        };
      }
      return {
        id: subj.id,
        subjectId: subj.id,
        title: subj.title,
        icon: subj.icon,
        status: subj.status,
        enabled: subj.enabled,
        stats: {
          gradedAttemptCount: koreanGraded,
          correctCount: koreanCorrect,
          incorrectCount: koreanIncorrect,
          retryRequestedCount: koreanRetry,
          accuracy: koreanAccuracy,
          totalSolveTimeMs: koreanTime,
          averageSolveTimeMs: koreanAvgTime,
          sessionCount: koreanCompletedSubs.length
        },
        progress: {
          ...currentEditionSkillProgress(koreanAggs,["KO_SPACING_PARTICLE_REBUILD","KO_BANK_A_NOUN_SPACING","KO_BANK_A_UNIT_SPACING","KO_BANK_A_PUNCTUATION","KO_REVIEW_READING_COMPREHENSION","KO_REVIEW_VOCAB_CONTEXT"]),
          curriculum: null
        }
      };
    }
    if (subj.status === "active" && subj.id === "english") {
      const hasEnglishData = englishGraded > 0 || englishAggs.length > 0 || englishCompletedSubs.length > 0;
      if (!hasEnglishData) {
        return {
          id: subj.id,
          subjectId: subj.id,
          title: subj.title,
          icon: subj.icon,
          status: subj.status,
          enabled: subj.enabled,
          stats: null,
          progress: null
        };
      }
      return {
        id: subj.id,
        subjectId: subj.id,
        title: subj.title,
        icon: subj.icon,
        status: subj.status,
        enabled: subj.enabled,
        stats: {
          gradedAttemptCount: englishGraded,
          correctCount: englishCorrect,
          incorrectCount: englishIncorrect,
          retryRequestedCount: englishRetry,
          accuracy: englishAccuracy,
          totalSolveTimeMs: englishTime,
          averageSolveTimeMs: englishAvgTime,
          sessionCount: englishCompletedSubs.length
        },
        progress: {
          ...currentEditionSkillProgress(englishAggs,["EN_WORD_CORRECT_FORM","EN_VOCAB_CONTEXT"]),
          curriculum: null
        }
      };
    }
    return {
      id: subj.id,
      subjectId: subj.id,
      title: subj.title,
      icon: subj.icon,
      status: subj.status,
      enabled: subj.enabled,
      stats: null,
      progress: null
    };
  });

  // 6. 최근 세션 목록
  const reviewBySession = new Map();
  activeReviews.forEach((r) => {
    if (r.sourceSessionId) reviewBySession.set(r.sourceSessionId, r.state);
  });

  const formattedRecentSessions = (recentSessions || [])
    .slice(0, options.recentLimit || 5)
    .map((s) => ({
      sessionId: s.id || s.sessionId,
      completedAt: s.completedAt,
      subjectId: s.subjectId || "math",
      operation: s.operation,
      level: s.level || s.difficulty,
      totalQuestions: s.totalQuestions || (s.results ? s.results.length : 0),
      correctCount: s.correctCount || 0,
      wrongCount: s.wrongCount || 0,
      accuracyRate: s.accuracyRate !== undefined ? s.accuracyRate : 0,
      totalSolveTimeMs: s.totalSolveTimeMs || 0,
      averageSolveTimeMs: s.averageSolveTimeMs || 0,
      reviewState: reviewBySession.get(s.id || s.sessionId) || null,
      results: s.results || [],
      rawSession: s
    }));

  //+_+// Phase F9: 추천 후보 산출 (순수 함수 연동, DB write 0건)
  const recommendations = buildLearningRecommendations({
    learnerId: targetLearnerId,
    draft,
    submissions: allSubmissions,
    reviewItems: activeReviewItems,
    aggregates,
    recentSessions,
    curriculumProgress: curriculumProgressData,
    now: options.now,
    limit: options.recommendationLimit || 5
  });

  return {
    learnerId: targetLearnerId,
    actionCards: {
      inProgress: inProgressCards,
      pendingGrading: pendingGradingCards,
      reviewRequired: activeReviews,
      // Every Draft which blocks a new start must have a visible way out.
      // Do not turn orphan grading Drafts into editable Submission placeholders.
      recoveryDrafts: draft && (draft.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId && !inProgressCards.length
        ? [{ rawDraft: draft, recoveryToken: draftRead.recoveryToken, hasSubmission: allSubmissions.some(s => s.sessionId === draft.sessionId),
          reason: draft.sessionState === "SESSION_COMPLETE" ? "COMPLETE_DRAFT" : "UNRESUMABLE_DRAFT" }]
        : []
    },
    overall,
    subjects,
    recentSessions: formattedRecentSessions,
    recommendations
  };
}

//+_+// Phase F8: getLearnerHomeDashboard alias
export const getLearnerHomeDashboard = getLearnerDashboard;

//+_+// Phase F9: 학습자 맞춤 추천 후보 조회 (순수 읽기 전용, 결정론적, 격리)
export async function getLearningRecommendations(learnerId, options = {}) {
  const targetLearnerId = (typeof learnerId === "string" && learnerId)
    ? learnerId
    : (getCurrentLearnerId() || DEFAULT_LEGACY_LEARNER_ID);

  const [
    draft,
    allSubmissions,
    activeReviewItems,
    aggregates,
    recentSessions,
    curriculumProgressData
  ] = await Promise.all([
    getDraft({ learnerId: targetLearnerId }).catch(() => null),
    getAllSubmissions({ learnerId: targetLearnerId }).catch(() => []),
    getActiveReviewItems({ learnerId: targetLearnerId }).catch(() => []),
    getProgressAggregates({ learnerId: targetLearnerId }).catch(() => []),
    getRecentSessions(options.recentLimit || 5, { learnerId: targetLearnerId }).catch(() => []),
    getCurriculumProgress({ learnerId: targetLearnerId }).catch(() => ({ mul: [], div: [] }))
  ]);

  return buildLearningRecommendations({
    learnerId: targetLearnerId,
    draft,
    submissions: allSubmissions,
    reviewItems: activeReviewItems,
    aggregates,
    recentSessions,
    curriculumProgress: curriculumProgressData,
    now: options.now,
    limit: options.limit || 5
  });
}



