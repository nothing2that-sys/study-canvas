//+_+// Phase F9: 통합 추천 엔진 (Unified Recommendation Engine)
//+_+// 순수 함수형 추천 후보 생성, 우선순위 티어링, 중복 제거, 결정론적 정렬 및 예상 작업량 산출

import { DEFAULT_LEGACY_LEARNER_ID } from "../storage.js";
import { getAllSubjects } from "../platform/subjectRegistry.js";
import { evaluateContentEligibility } from "../contentEligibility.js";

/**
 * @typedef {Object} RecommendationCandidate
 * @property {string} id - 결정론적 후보 식별자
 * @property {string} learnerId - 대상 학습자 ID
 * @property {string} type - 후보 유형 (PENDING_GRADING | REVIEW_CONFIRMATION | UNRESOLVED_REVIEW | SCHEDULED_REVIEW | RESUME_SESSION | REVIEW_RETRY_RESUME | NEW_LEARNING | RETURN_TO_SUBJECT)
 * @property {number} priorityTier - 우선순위 티어 (1 ~ 7)
 * @property {string} subjectId - 과목 ID (기본: "math")
 * @property {string} [courseId] - 코스 ID
 * @property {string} [unitId] - 단원 ID
 * @property {string} [levelId] - 레벨 ID
 * @property {"guardian" | "learner" | "family"} actor - 수행 주체
 * @property {string} reasonCode - 머신 리더블 사유 코드
 * @property {string} reasonText - 사용자 친화적 추천 이유 설명
 * @property {number|null} estimatedProblemCount - 예상 문제 수
 * @property {number|null} estimatedDurationMs - 예상 소요 시간 (ms)
 * @property {string} [sourceSessionId] - 원본 세션 ID
 * @property {string} [sourceSubmissionId] - 원본 제출본 ID
 * @property {string} [sourceReviewItemId] - 원본 복습 항목 ID
 * @property {Object} action - 실행 액션 계약
 * @property {"OPEN_GRADING" | "OPEN_REVIEW" | "RESUME_SESSION" | "OPEN_LEARNING_SETUP" | "OPEN_SUBJECT"} action.kind
 * @property {string} action.label
 * @property {string} action.targetId
 * @property {any} [rawItem] - 원본 도메인 객체 (선택적)
 */

//+_+// Phase F9 Rework: 기존 앱의 기본 학습 설정 계약(countPreset = "20") SSOT 일치
export const DEFAULT_NEW_LEARNING_PROBLEM_COUNT = 20;

//+_+// Phase F9 Rework 3: 현재 canvas-only Draft에는 저장되는 typed Student Answer가 없음
//+_+// question.answer 및 question.expectedAnswer는 정답 메타데이터이므로 학생 답안 판단에서 제외
//+_+// top-level answer map과 question-level typed-answer 후보는 실제 입력·저장 계약이 아니므로 제외
//+_+// studentStrokesMap은 풀이 흔적이며 답안 완료 판정에 사용하지 않음
export function isQuestionAnswered() {
  return false;
}

/**
 * 한국어 목적격 조사(을/를)를 종성(받침) 여부에 따라 자연스럽게 부착하는 헬퍼
 * @param {string} word - 조사 대상 단어 (예: '수학', '국어', '영어')
 * @returns {string} 조사 부착 단어 (예: '수학을', '국어를', '영어를')
 */
export function appendKoreanObjectParticle(word) {
  if (!word || typeof word !== "string") return word || "";
  const trimmed = word.trim();
  if (!trimmed) return "";
  const lastChar = trimmed[trimmed.length - 1];
  const code = lastChar.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const hasBatchim = (code - 0xac00) % 28 !== 0;
    return `${trimmed}${hasBatchim ? "을" : "를"}`;
  }
  return `${trimmed}를`;
}

/**
 * 통합 추천 후보 목록 생성 및 정렬 (순수 함수)
 * @param {Object} params
 * @param {string} params.learnerId - 대상 학습자 ID
 * @param {Object|null} [params.draft] - 현재 진행 중인 드래프트 세션
 * @param {Array} [params.submissions] - 전체 제출 스냅샷 목록
 * @param {Array} [params.reviewItems] - 활성 복습 항목 목록
 * @param {Array} [params.aggregates] - 레벨별 ProgressAggregate 목록
 * @param {Array} [params.recentSessions] - 최근 완료 세션 목록
 * @param {Object} [params.curriculumProgress] - 커리큘럼 진도 데이터 ({ mul: [], div: [] })
 * @param {Array} [params.subjects] - 과목 레지스트리 목록
 * @param {number} [params.now] - 기준 시각 (테스트 주입용, 기본값 Date.now())
 * @param {number} [params.limit] - 최대 추천 수 (기본값: 5)
 * @returns {{ learnerId: string, topRecommendation: RecommendationCandidate|null, candidates: RecommendationCandidate[] }}
 */
export function buildLearningRecommendations({
  learnerId,
  draft = null,
  submissions = [],
  reviewItems = [],
  aggregates = [],
  recentSessions = [],
  curriculumProgress = { mul: [], div: [] },
  subjects = null,
  now = Date.now(),
  limit = 5,
  eligibilityContext = null
}) {
  const targetLearnerId = (typeof learnerId === "string" && learnerId) ? learnerId : DEFAULT_LEGACY_LEARNER_ID;
  const currentTime = typeof now === "number" && !isNaN(now) ? now : Date.now();

  // 0. 학습자 평균 풀이 시간(ms) 계산 (학생 학습 예상시간 산출용 SSOT)
  const targetAggregates = (aggregates || []).filter((a) => (a.learnerId || DEFAULT_LEGACY_LEARNER_ID) === targetLearnerId);
  let totalSolvedCount = 0;
  let totalSolveTimeMs = 0;
  targetAggregates.forEach((agg) => {
    totalSolvedCount += Number(agg.gradedAttemptCount) || 0;
    totalSolveTimeMs += Number(agg.totalSolveTimeMs) || 0;
  });
  const hasAverageSolveTime = totalSolvedCount > 0 && totalSolveTimeMs > 0;
  const averageSolveTimeMs = hasAverageSolveTime ? Math.round(totalSolveTimeMs / totalSolvedCount) : null;

  const candidates = [];
  const handledReviewItemIds = new Set();
  const handledSubmissionIds = new Set();

  // --------------------------------------------------------------------------
  // Tier 1: 보호자 채점 대기/진행 중 (PARENT_GRADING_PENDING, GRADING_ACTIVE)
  // --------------------------------------------------------------------------
  const activeSubmissions = (submissions || []).filter((sub) => {
    const owner = sub.learnerId || DEFAULT_LEGACY_LEARNER_ID;
    return owner === targetLearnerId &&
      (sub.status === "PARENT_GRADING_PENDING" || sub.status === "GRADING_ACTIVE");
  });

  for (const sub of activeSubmissions) {
    if (handledSubmissionIds.has(sub.id)) continue;
    handledSubmissionIds.add(sub.id);

    const isGradingActive = sub.status === "GRADING_ACTIVE";
    const totalQuestions = sub.questions?.length || sub.gradingProgress?.total || 0;
    const gradedCount = sub.gradingProgress?.graded || 0;
    const remainingCount = sub.gradingProgress?.remaining !== undefined
      ? sub.gradingProgress.remaining
      : Math.max(0, totalQuestions - gradedCount);

    candidates.push({
      id: `rec:grading:${sub.id}`,
      learnerId: targetLearnerId,
      type: "PENDING_GRADING",
      priorityTier: 1,
      subjectId: sub.subjectId || "math",
      courseId: sub.courseId || "arithmetic",
      levelId: sub.levelId || sub.config?.difficulty || sub.config?.level || "M1",
      skillId: sub.skillId || sub.config?.skillId || undefined,
      actor: "guardian",
      reasonCode: isGradingActive ? "GRADING_IN_PROGRESS" : "GRADING_PENDING",
      reasonText: isGradingActive ? "진행 중인 보호자 채점을 이어주세요" : "채점을 기다리는 풀이가 있어요",
      estimatedProblemCount: remainingCount > 0 ? remainingCount : totalQuestions,
      estimatedDurationMs: null, // 보호자 채점은 학생 풀이시간 오용 금지 (항상 null)
      sourceSubmissionId: sub.id,
      sourceSessionId: sub.sessionId || sub.id,
      action: {
        kind: "OPEN_GRADING",
        label: isGradingActive ? "채점 이어하기" : "보호자 채점 열기",
        targetId: sub.id
      },
      rawItem: sub
    });
  }

  // --------------------------------------------------------------------------
  // Tier 2: 재풀이 후 보호자 확인 대기 (review_pending)
  // --------------------------------------------------------------------------
  const activeReviews = (reviewItems || []).filter((item) => {
    const owner = item.learnerId || DEFAULT_LEGACY_LEARNER_ID;
    return owner === targetLearnerId;
  });

  const pendingReviewConfirmations = activeReviews.filter((item) => item.state === "review_pending");
  for (const item of pendingReviewConfirmations) {
    if (handledReviewItemIds.has(item.id)) continue;
    handledReviewItemIds.add(item.id);

    candidates.push({
      id: `rec:review:${item.id}`,
      learnerId: targetLearnerId,
      type: "REVIEW_CONFIRMATION",
      priorityTier: 2,
      subjectId: item.subjectId || "math",
      courseId: item.courseId || "arithmetic",
      unitId: item.unitId || "mul",
      levelId: item.levelId || "M1",
      skillId: item.skillId || undefined,
      actor: "guardian",
      reasonCode: "REVIEW_CONFIRMATION_PENDING",
      reasonText: "다시 푼 문제를 확인해 주세요",
      estimatedProblemCount: 1,
      estimatedDurationMs: null, // 보호자 확인 작업은 학생 풀이시간 오용 금지
      sourceReviewItemId: item.id,
      sourceSessionId: item.sourceSessionId,
      sourceSubmissionId: item.sourceSubmissionId,
      action: {
        kind: "OPEN_REVIEW",
        label: "오답 확인하기",
        targetId: item.id
      },
      rawItem: item
    });
  }

  // --------------------------------------------------------------------------
  // Tier 3 & Tier 4: 미해결 오답 (unresolved) & 복습 예정 (SCHEDULED_REVIEW)
  // --------------------------------------------------------------------------
  const unresolvedReviews = activeReviews.filter((item) => item.state === "unresolved");
  for (const item of unresolvedReviews) {
    if (handledReviewItemIds.has(item.id)) continue;

    // nextReviewAt 스케줄 정책:
    // 1) nextReviewAt > currentTime: 미래 예정이므로 현재 due 후보에서 제외
    if (item.nextReviewAt !== null && item.nextReviewAt !== undefined && item.nextReviewAt > currentTime) {
      continue;
    }

    handledReviewItemIds.add(item.id);
    const isScheduledDue = item.nextReviewAt !== null && item.nextReviewAt !== undefined && item.nextReviewAt <= currentTime;
    const estDuration = averageSolveTimeMs !== null ? averageSolveTimeMs : null;

    if (isScheduledDue) {
      // Tier 4: 복습 예정일이 도래한 문제
      candidates.push({
        id: `rec:review:${item.id}`,
        learnerId: targetLearnerId,
        type: "SCHEDULED_REVIEW",
        priorityTier: 4,
        subjectId: item.subjectId || "math",
        courseId: item.courseId || (item.subjectId === "english" ? "english-core" : (item.subjectId === "korean" ? "korean-core" : "arithmetic")),
        unitId: item.unitId || (item.subjectId === "english" ? "vocabulary" : (item.subjectId === "korean" ? "vocabulary" : "mul")),
        levelId: item.levelId || "M1",
        skillId: item.skillId || undefined,
        actor: "learner",
        reasonCode: "SCHEDULED_REVIEW_DUE",
        reasonText: "복습할 때가 된 문제가 있어요",
        estimatedProblemCount: 1,
        estimatedDurationMs: estDuration,
        sourceReviewItemId: item.id,
        sourceSessionId: item.sourceSessionId,
        sourceSubmissionId: item.sourceSubmissionId,
        action: {
          kind: "OPEN_REVIEW",
          label: "예정된 복습 시작",
          targetId: item.id
        },
        rawItem: item
      });
    } else {
      // Tier 3: 일반 미해결 오답 (즉시 복습 대상)
      candidates.push({
        id: `rec:review:${item.id}`,
        learnerId: targetLearnerId,
        type: "UNRESOLVED_REVIEW",
        priorityTier: 3,
        subjectId: item.subjectId || "math",
        courseId: item.courseId || (item.subjectId === "english" ? "english-core" : (item.subjectId === "korean" ? "korean-core" : "arithmetic")),
        unitId: item.unitId || (item.subjectId === "english" ? "vocabulary" : (item.subjectId === "korean" ? "vocabulary" : "mul")),
        levelId: item.levelId || "M1",
        skillId: item.skillId || undefined,
        actor: "learner",
        reasonCode: "UNRESOLVED_WRONG",
        reasonText: "아직 함께 확인할 오답이 있어요",
        estimatedProblemCount: 1,
        estimatedDurationMs: estDuration,
        sourceReviewItemId: item.id,
        sourceSessionId: item.sourceSessionId,
        sourceSubmissionId: item.sourceSubmissionId,
        action: {
          kind: "OPEN_REVIEW",
          label: "오답 함께 보기",
          targetId: item.id
        },
        rawItem: item
      });
    }
  }

  // --------------------------------------------------------------------------
  // Tier 5: 풀이 중인 세션 (PRACTICE_ACTIVE draft) & retrying ReviewItem 중복 제거
  // --------------------------------------------------------------------------
  const retryingReviews = activeReviews.filter((item) => item.state === "retrying");
  let draftConsumed = false;

  if (draft && draft.questions && draft.questions.length > 0) {
    const draftOwner = draft.learnerId || DEFAULT_LEGACY_LEARNER_ID;
    if (draftOwner === targetLearnerId) {
      const isPracticeActive = (draft.sessionState === "PRACTICE_ACTIVE" || !draft.sessionState) &&
        draft.sessionType !== "grading" &&
        draft.sessionState !== "GRADING_ACTIVE";

      if (isPracticeActive) {
        //+_+// Phase F9 Rework 3: normalizeDraft round-trip 뒤에도 남는 명시적 relation만 사용
        const matchingRetryingReview = retryingReviews.find((r) =>
          (draft.config?.reviewItemId && draft.config.reviewItemId === r.id) ||
          (Array.isArray(draft.questions) && draft.questions.some((q) => q.reviewItemId === r.id)) ||
          (r.sourceSessionId && r.sourceSessionId === draft.sessionId)
        ) || null;

        //+_+// Phase F9 Rework 3: canvas-only Draft는 문항 완료 상태를 영속하지 않으므로 거짓 잔여 수치를 만들지 않음
        const remainingQ = null;
        const estDuration = null;

        if (matchingRetryingReview) {
          handledReviewItemIds.add(matchingRetryingReview.id);
          candidates.push({
            id: `rec:resume:${draft.sessionId || matchingRetryingReview.id}`,
            learnerId: targetLearnerId,
            type: "REVIEW_RETRY_RESUME",
            priorityTier: 5,
            subjectId: draft.subjectId || matchingRetryingReview.subjectId || "math",
            courseId: draft.config?.courseId || draft.courseId || (draft.subjectId === "english" ? "english-core" : (draft.subjectId === "korean" ? "korean-core" : "arithmetic")),
            levelId: draft.config?.difficulty || draft.config?.level || matchingRetryingReview.levelId || "M1",
            skillId: draft.config?.skillId || matchingRetryingReview.skillId || undefined,
            actor: "learner",
            reasonCode: "SESSION_IN_PROGRESS",
            reasonText: "다시 풀던 문제가 남아 있어요",
            estimatedProblemCount: remainingQ,
            estimatedDurationMs: estDuration,
            sourceSessionId: draft.sessionId,
            sourceReviewItemId: matchingRetryingReview.id,
            action: {
              kind: "RESUME_SESSION",
              label: "재풀이 이어하기",
              targetId: draft.sessionId
            },
            rawItem: draft
          });
        } else {
          candidates.push({
            id: `rec:resume:${draft.sessionId}`,
            learnerId: targetLearnerId,
            type: "RESUME_SESSION",
            priorityTier: 5,
            subjectId: draft.subjectId || "math",
            courseId: draft.config?.courseId || draft.courseId || (draft.subjectId === "english" ? "english-core" : (draft.subjectId === "korean" ? "korean-core" : "arithmetic")),
            levelId: draft.config?.difficulty || draft.config?.level || "M1",
            skillId: draft.config?.skillId || undefined,
            actor: "learner",
            reasonCode: "SESSION_IN_PROGRESS",
            reasonText: "풀던 학습이 남아 있어요",
            estimatedProblemCount: remainingQ,
            estimatedDurationMs: estDuration,
            sourceSessionId: draft.sessionId,
            action: {
              kind: "RESUME_SESSION",
              label: "이어서 풀기",
              targetId: draft.sessionId
            },
            rawItem: draft
          });
        }
        draftConsumed = true;
      }
    }
  }

  // 만약 draft가 없더라도 retrying ReviewItem이 남아있다면 Tier 5 단독 후보로 처리
  for (const item of retryingReviews) {
    if (handledReviewItemIds.has(item.id)) continue;
    handledReviewItemIds.add(item.id);

    const estDuration = averageSolveTimeMs !== null ? averageSolveTimeMs : null;
    candidates.push({
      id: `rec:review:${item.id}`,
      learnerId: targetLearnerId,
      type: "REVIEW_RETRY_RESUME",
      priorityTier: 5,
      subjectId: item.subjectId || "math",
      courseId: item.courseId || (item.subjectId === "english" ? "english-core" : (item.subjectId === "korean" ? "korean-core" : "arithmetic")),
      unitId: item.unitId || (item.subjectId === "english" ? "vocabulary" : (item.subjectId === "korean" ? "vocabulary" : "mul")),
      levelId: item.levelId || "M1",
      skillId: item.skillId || undefined,
      actor: "learner",
      reasonCode: "SESSION_IN_PROGRESS",
      reasonText: "다시 풀던 문제가 남아 있어요",
      estimatedProblemCount: 1,
      estimatedDurationMs: estDuration,
      sourceReviewItemId: item.id,
      sourceSessionId: item.sourceSessionId,
      action: {
        kind: "OPEN_REVIEW",
        label: "재풀이 이어하기",
        targetId: item.id
      },
      rawItem: item
    });
  }

  // --------------------------------------------------------------------------
  // Tier 6: 현재 단계 새 학습 (NEW_LEARNING)
  // --------------------------------------------------------------------------
  // 커리큘럼 진도 기반으로 현재 학습자가 학습할 최적 단계 산출
  const mulLevels = curriculumProgress?.mul || [];
  const divLevels = curriculumProgress?.div || [];
  const allLevels = [...mulLevels, ...divLevels];

  // 1) 학습 중('learning')인 단계가 있으면 우선
  // 2) 없으면 시작 안 한('unstarted') 첫 번째 단계
  // 3) 전부 마스터했으면 마지막 레벨 또는 기본 M1
  const currentLearningStage = allLevels.find((l) => l.status === "learning") ||
    allLevels.find((l) => l.status === "unstarted") ||
    allLevels[0] ||
    { id: "M1", levelId: "M1", title: "구구단 2·3·4·5단", operation: "mul" };

  //+_+// Phase F9 Rework: 기존 기본 학습 설정 계약(countPreset = "20") SSOT 일치
  const defaultNewLearningCount = DEFAULT_NEW_LEARNING_PROBLEM_COUNT;
  const newLearningEstDuration = averageSolveTimeMs !== null
    ? Math.round(averageSolveTimeMs * defaultNewLearningCount)
    : null;

  const newLearningCandidate = {
    id: `rec:new:${targetLearnerId}:math:arithmetic:${currentLearningStage.id || currentLearningStage.levelId || "M1"}`,
    learnerId: targetLearnerId,
    type: "NEW_LEARNING",
    priorityTier: 6,
    subjectId: "math",
    courseId: "arithmetic",
    unitId: currentLearningStage.operation || (currentLearningStage.id?.startsWith("D") ? "div" : "mul"),
    levelId: currentLearningStage.id || currentLearningStage.levelId || "M1",
    actor: "learner",
    reasonCode: "CURRENT_STAGE_PRACTICE",
    reasonText: "현재 단계에서 새 문제를 연습해 보세요",
    estimatedProblemCount: defaultNewLearningCount,
    estimatedDurationMs: newLearningEstDuration,
    action: {
      kind: "OPEN_LEARNING_SETUP",
      label: "새 학습 시작",
      targetId: currentLearningStage.id || "M1"
    },
    rawItem: currentLearningStage
  };
  const eligibility = eligibilityContext
    ? evaluateContentEligibility({ ...eligibilityContext, content: currentLearningStage, requestedMode: "NEW" })
    : null;
  if (!eligibility || eligibility.eligible) {
    candidates.push({
      ...newLearningCandidate,
      eligibility: eligibility || undefined
    });
  }

  // --------------------------------------------------------------------------
  // Tier 7: 최근 학습하지 않은 활성 과목 (RETURN_TO_SUBJECT)
  // --------------------------------------------------------------------------
  const allRegSubjects = subjects || getAllSubjects();
  // 오직 active && enabled인 과목만 후보화 (coming_soon인 국어, 영어는 절대 제외)
  const activeSubjects = allRegSubjects.filter((s) => s.status === "active" && s.enabled !== false);

  if (activeSubjects.length > 1) {
    // 여러 활성 과목이 있는 경우 가장 오래 학습하지 않은 과목 산출
    const subjectLastStudiedMap = new Map();
    (recentSessions || []).forEach((sess) => {
      const sId = sess.subjectId || "math";
      const time = sess.completedAt || 0;
      if (!subjectLastStudiedMap.has(sId) || subjectLastStudiedMap.get(sId) < time) {
        subjectLastStudiedMap.set(sId, time);
      }
    });

    const sortedActiveSubjects = [...activeSubjects].sort((a, b) => {
      const aTime = subjectLastStudiedMap.get(a.id) || 0;
      const bTime = subjectLastStudiedMap.get(b.id) || 0;
      return aTime - bTime;
    });

    const leastStudied = sortedActiveSubjects[0];
    if (leastStudied) {
      candidates.push({
        id: `rec:subject:${leastStudied.id}`,
        learnerId: targetLearnerId,
        type: "RETURN_TO_SUBJECT",
        priorityTier: 7,
        subjectId: leastStudied.id,
        actor: "learner",
        reasonCode: "SUBJECT_NOT_RECENTLY_STUDIED",
        reasonText: `${appendKoreanObjectParticle(leastStudied.title)} 오랫동안 공부하지 않았어요`,
        estimatedProblemCount: defaultNewLearningCount,
        estimatedDurationMs: newLearningEstDuration,
        action: {
          kind: "OPEN_SUBJECT",
          label: `${leastStudied.title} 학습하기`,
          targetId: leastStudied.id
        },
        rawItem: leastStudied
      });
    }
  }

  // --------------------------------------------------------------------------
  // 결정론적 정렬 및 Stable Tie-Break
  // --------------------------------------------------------------------------
  // 1차: priorityTier 오름차순
  // 2차: 동일 Tier 내 진행 중 상태 우선 (GRADING_ACTIVE > PARENT_GRADING_PENDING 등)
  // 3차: 대기 시간이 긴 순서 (더 일찍 생성된 타임스탬프)
  // 4차: ID 사전순 (안정적 결정론)
  candidates.sort((a, b) => {
    if (a.priorityTier !== b.priorityTier) {
      return a.priorityTier - b.priorityTier;
    }

    // 2차 tie-break: 진행 중 상태 우선
    const isAActive = a.reasonCode === "GRADING_IN_PROGRESS" || a.type === "REVIEW_RETRY_RESUME";
    const isBActive = b.reasonCode === "GRADING_IN_PROGRESS" || b.type === "REVIEW_RETRY_RESUME";
    if (isAActive && !isBActive) return -1;
    if (!isAActive && isBActive) return 1;

    // 3차 tie-break: 생성/제출 타임스탬프 (오래 대기한 것 우선)
    const timeA = a.rawItem?.submittedAt || a.rawItem?.createdAt || a.rawItem?.savedAt || 0;
    const timeB = b.rawItem?.submittedAt || b.rawItem?.createdAt || b.rawItem?.savedAt || 0;
    if (timeA !== timeB && timeA > 0 && timeB > 0) {
      return timeA - timeB;
    }

    // 4차 tie-break: ID 문자열 결정론 정렬
    return a.id.localeCompare(b.id);
  });

  const slicedCandidates = candidates.slice(0, Math.max(1, limit));
  const topRecommendation = slicedCandidates.length > 0 ? slicedCandidates[0] : null;

  return {
    learnerId: targetLearnerId,
    topRecommendation,
    candidates: slicedCandidates
  };
}
