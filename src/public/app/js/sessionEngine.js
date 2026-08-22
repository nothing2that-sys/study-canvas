/**
 * Math Canvas Pro - 세션 상태 머신, 워크시트 페이지 및 채점 엔진
 * 워크시트 페이지네이션, 학생 풀이 제출, 채점자 평가(정답 확인 & 맞음/틀림 판정) 및 세션 통계 관리
 */

export const SessionState = Object.freeze({
  IDLE: "IDLE",
  SESSION_SETUP: "SESSION_SETUP",
  PRACTICE_ACTIVE: "PRACTICE_ACTIVE",
  SUBMITTED: "SUBMITTED",
  GRADING_ACTIVE: "GRADING_ACTIVE",
  SESSION_COMPLETE: "SESSION_COMPLETE"
});

function generateSessionId() {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `session_${timestamp}_${rand}`;
}

export function createSession(config = {}, questions = []) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("세션을 시작하려면 최소 1개 이상의 문제가 필요합니다.");
  }

  const id = generateSessionId();
  const startedAt = Date.now();
  let state = SessionState.IDLE;

  // 워크시트 페이지 설정
  const pageSize = Math.max(1, Math.min(50, Number(config.pageSize) || 4));
  let currentPageIndex = 0;
  const totalPages = Math.ceil(questions.length / pageSize);

  let totalSolveTimeMs = 0;
  let submittedAt = null;
  let completedAt = null;

  // 문제별 채점 결과 맵 (questionId -> { isCorrect, ... })
  const grades = new Map();

  function start() {
    currentPageIndex = 0;
    grades.clear();
    totalSolveTimeMs = 0;
    state = SessionState.PRACTICE_ACTIVE;
    return getPageQuestions(currentPageIndex);
  }

  function getPageQuestions(pageIndex = currentPageIndex) {
    const validPageIndex = Math.max(0, Math.min(totalPages - 1, pageIndex));
    const startIdx = validPageIndex * pageSize;
    const endIdx = Math.min(questions.length, startIdx + pageSize);
    const pageQuestions = questions.slice(startIdx, endIdx);

    return {
      pageIndex: validPageIndex,
      pageNumber: validPageIndex + 1,
      totalPages,
      pageSize,
      startIndex: startIdx,
      endIndex: endIdx,
      isFirstPage: validPageIndex === 0,
      isLastPage: validPageIndex === totalPages - 1,
      questions: pageQuestions.map((q, idx) => ({
        ...q,
        orderNumber: startIdx + idx + 1,
        grade: grades.get(q.id) || null
      }))
    };
  }

  function nextPage() {
    if (currentPageIndex + 1 < totalPages) {
      currentPageIndex += 1;
    }
    return getPageQuestions(currentPageIndex);
  }

  function prevPage() {
    if (currentPageIndex > 0) {
      currentPageIndex -= 1;
    }
    return getPageQuestions(currentPageIndex);
  }

  function goToPage(pageIndex) {
    currentPageIndex = Math.max(0, Math.min(totalPages - 1, pageIndex));
    return getPageQuestions(currentPageIndex);
  }

  // 학생 풀이 완료 및 제출
  function submitPractice(elapsedMs = 0) {
    if (state !== SessionState.PRACTICE_ACTIVE) {
      throw new Error(`현재 상태(${state})에서는 풀이를 제출할 수 없습니다.`);
    }
    totalSolveTimeMs = Math.max(0, Math.round(elapsedMs));
    submittedAt = Date.now();
    state = SessionState.SUBMITTED;
    return {
      submittedAt,
      totalSolveTimeMs,
      totalQuestions: questions.length
    };
  }

  // 채점자 평가 모드 시작
  function startGrading() {
    if (state !== SessionState.SUBMITTED && state !== SessionState.PRACTICE_ACTIVE) {
      throw new Error(`채점을 시작할 수 없는 상태입니다. 현재 상태: ${state}`);
    }
    state = SessionState.GRADING_ACTIVE;
    return getGradingStatus();
  }

  // 개별 문제 채점
  function gradeQuestion(questionId, isCorrect, comment = "") {
    if (state !== SessionState.GRADING_ACTIVE && state !== SessionState.SUBMITTED) {
      throw new Error(`채점할 수 없는 상태입니다. 현재 상태: ${state}`);
    }

    const question = questions.find((q) => q.id === questionId);
    if (!question) {
      throw new Error(`해당 ID(${questionId})의 문제를 찾을 수 없습니다.`);
    }

    const existingGrade = grades.get(questionId);
    const finalComment = comment !== undefined && comment !== null
      ? String(comment).trim()
      : (existingGrade?.comment || "");

    const gradeData = {
      questionId: question.id,
      questionKey: question.key,
      operation: question.operation,
      level: question.level,
      operandA: question.operandA,
      operandB: question.operandB,
      answer: question.answer,
      isCorrect: Boolean(isCorrect),
      comment: finalComment,
      gradedAt: Date.now()
    };

    grades.set(questionId, gradeData);
    return {
      questionId,
      gradeData,
      status: getGradingStatus()
    };
  }

  // 전체 문제 일괄 채점
  function gradeAll(isCorrect) {
    questions.forEach((q) => {
      gradeQuestion(q.id, isCorrect);
    });
    return getGradingStatus();
  }

  // 채점 진행 현황
  function getGradingStatus() {
    const total = questions.length;
    let correct = 0;
    let wrong = 0;

    for (const q of questions) {
      const g = grades.get(q.id);
      if (g) {
        if (g.isCorrect) correct += 1;
        else wrong += 1;
      }
    }

    const graded = correct + wrong;
    return {
      total,
      graded,
      correct,
      wrong,
      allGraded: graded === total,
      progressPercent: Math.round((graded / total) * 100)
    };
  }

  // 채점 완료 및 최종 통계 산출
  function finishGrading() {
    const status = getGradingStatus();
    if (!status.allGraded) {
      // 채점되지 않은 문제는 기본적으로 오답 또는 미채점 처리하지 않고 알림
      throw new Error(`아직 채점되지 않은 문제가 ${status.total - status.graded}개 있습니다.`);
    }

    completedAt = Date.now();
    state = SessionState.SESSION_COMPLETE;
    return getSummary();
  }

  // 최종 통계 집계
  function getSummary() {
    const totalQuestions = questions.length;
    const results = [];
    let correctCount = 0;
    let wrongCount = 0;

    const avgSolvePerQuestionMs = totalQuestions > 0 ? Math.round(totalSolveTimeMs / totalQuestions) : 0;

    for (const q of questions) {
      const g = grades.get(q.id);
      const isCorrect = g ? g.isCorrect : false;
      const comment = g ? g.comment : "";
      if (isCorrect) correctCount += 1;
      else wrongCount += 1;

      results.push({
        questionId: q.id,
        questionKey: q.key,
        operation: q.operation,
        level: q.level,
        operandA: q.operandA,
        operandB: q.operandB,
        answer: q.answer,
        isCorrect,
        comment,
        solveTimeMs: avgSolvePerQuestionMs
      });
    }

    const accuracyRate = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    return {
      sessionId: id,
      config,
      startedAt,
      submittedAt,
      completedAt,
      totalQuestions,
      pageSize,
      totalPages,
      correctCount,
      wrongCount,
      accuracyRate,
      totalSolveTimeMs,
      averageSolveTimeMs: avgSolvePerQuestionMs,
      results
    };
  }

  return {
    get id() { return id; },
    get state() { return state; },
    get pageSize() { return pageSize; },
    get cols() { return config.cols || (pageSize <= 2 ? pageSize : 2); },
    get rows() { return config.rows || Math.ceil(pageSize / (config.cols || 2)); },
    get currentPageIndex() { return currentPageIndex; },
    get totalPages() { return totalPages; },
    get questions() { return questions; },
    get totalQuestions() { return questions.length; },
    start,
    getPageQuestions,
    nextPage,
    prevPage,
    goToPage,
    submitPractice,
    startGrading,
    gradeQuestion,
    gradeAll,
    getGradingStatus,
    finishGrading,
    getSummary
  };
}
