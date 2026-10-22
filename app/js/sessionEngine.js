import { GradeDecision, createGradeDecision, getGradingProgress, normalizeGradeDecision } from "./parentGrading.js";

/**
 * Math Canvas Pro - 세션 상태 머신, 워크시트 페이지 및 채점 엔진
 * 워크시트 페이지네이션, 학생 풀이 제출, 채점자 평가(정답 확인 & 맞음/틀림 판정) 및 세션 통계 관리
 */

export const SessionState = Object.freeze({
  IDLE: "IDLE",
  SESSION_SETUP: "SESSION_SETUP",
  PRACTICE_ACTIVE: "PRACTICE_ACTIVE",
  SUBMITTING: "SUBMITTING",
  SUBMITTED: "SUBMITTED",
  SUBMITTED_LOCKED: "SUBMITTED_LOCKED",
  PARENT_GRADING_PENDING: "PARENT_GRADING_PENDING",
  GRADING_ACTIVE: "GRADING_ACTIVE",
  SESSION_COMPLETE: "SESSION_COMPLETE"
});

//+_+// HTML 특수문자 안전 이스케이프 유틸리티
export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateSessionId() {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `session_${timestamp}_${rand}`;
}

//+_+// 오답 객체를 Question 형식으로 안전하게 변환하는 매퍼 함수
export function mistakeToQuestion(mistake, index = 0) {
  if (!mistake) throw new Error("변환할 오답 객체가 없습니다.");
  const op = mistake.operation || (mistake.key && String(mistake.key).startsWith("div") ? "div" : "mul");
  const rawAns = mistake.answer !== undefined ? mistake.answer : (mistake.expectedAnswer !== undefined ? mistake.expectedAnswer : 0);
  const expectedAnswer = Number(rawAns);
  const orderNumber = Number(mistake.orderNumber || index + 1);
  const qKey = mistake.questionKey || mistake.key || `${op}:${mistake.operandA}:${mistake.operandB}`;

  return {
    id: mistake.id || `mistake_q_${Date.now()}_${index}`,
    key: qKey,
    questionKey: qKey,
    orderNumber,
    operation: op,
    operandA: Number(mistake.operandA),
    operandB: Number(mistake.operandB),
    answer: expectedAnswer,
    expectedAnswer,
    level: mistake.level || (op === "div" ? "D1" : "M1"),
    macroLevelId: mistake.macroLevelId || mistake.level || (op === "div" ? "D1" : "M1"),
    stageId: mistake.stageId || mistake.level || null,
    sourceWrongAnswerId: mistake.questionId || mistake.id || mistake.key || qKey,
    errorCategories: Array.isArray(mistake.errorCategories) ? [...mistake.errorCategories] : [],
    mathFormat: mistake.mathFormat || "vertical"
  };
}

export function createSession(config = {}, questions = []) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("세션을 시작하려면 최소 1개 이상의 문제가 필요합니다.");
  }

  const id = config.sessionId || generateSessionId();
  const startedAt = Date.now();
  let state = SessionState.IDLE;

  // 세션 메타데이터 추출
  const operation = config.operation || questions[0]?.operation || "mul";
  const mathFormat = config.mathFormat || questions[0]?.mathFormat || "vertical";
  const macroLevelId = config.macroLevelId || questions[0]?.macroLevelId || questions[0]?.level || (operation === "div" ? "D1" : "M1");
  const stageId = config.stageId || questions[0]?.stageId || macroLevelId;

  // 워크시트 페이지 설정
  const pageSize = Math.max(1, Math.min(50, Number(config.pageSize) || 4));
  let currentPageIndex = 0;
  const totalPages = Math.ceil(questions.length / pageSize);

  let totalSolveTimeMs = 0;
  let submittedAt = null;
  let completedAt = null;

  // 문제별 채점 결과 맵 (questionId -> { isCorrect, ... })
  const grades = new Map();
  //+_+// 문제별 실제 측정 풀이 시간 맵 (questionId -> ms)
  const questionSolveTimes = new Map();

  function start() {
    currentPageIndex = 0;
    grades.clear();
    questionSolveTimes.clear();
    totalSolveTimeMs = 0;
    state = SessionState.PRACTICE_ACTIVE;
    return getPageQuestions(currentPageIndex);
  }

  //+_+// Phase F4 Reviewer Rework 3차: PRACTICE_ACTIVE 상태 불변식 검사
  function assertPracticeMutable(actionName) {
    if (state !== SessionState.PRACTICE_ACTIVE) {
      throw new Error(
        `${actionName}은 PRACTICE_ACTIVE 상태에서만 수행할 수 있습니다. 현재 상태: ${state}`
      );
    }
  }

  function recordQuestionSolveTime(questionId, durationMs) {
    assertPracticeMutable("recordQuestionSolveTime");
    const prev = questionSolveTimes.get(questionId) || 0;
    questionSolveTimes.set(questionId, prev + Math.max(0, Math.round(durationMs)));
  }

  function _applyQuestionSolveTimes(timesMap) {
    if (timesMap instanceof Map) {
      timesMap.forEach((val, key) => questionSolveTimes.set(key, Math.max(0, Math.round(val))));
    } else if (typeof timesMap === "object" && timesMap !== null) {
      Object.entries(timesMap).forEach(([key, val]) => questionSolveTimes.set(key, Math.max(0, Math.round(val))));
    }
  }

  function setQuestionSolveTimes(timesMap) {
    assertPracticeMutable("setQuestionSolveTimes");
    _applyQuestionSolveTimes(timesMap);
  }

  function getQuestionSolveTimes() {
    return Object.fromEntries(questionSolveTimes.entries());
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
    assertPracticeMutable("nextPage");
    if (currentPageIndex + 1 < totalPages) {
      currentPageIndex += 1;
    }
    return getPageQuestions(currentPageIndex);
  }

  function prevPage() {
    assertPracticeMutable("prevPage");
    if (currentPageIndex > 0) {
      currentPageIndex -= 1;
    }
    return getPageQuestions(currentPageIndex);
  }

  function goToPage(pageIndex) {
    assertPracticeMutable("goToPage");
    currentPageIndex = Math.max(0, Math.min(totalPages - 1, pageIndex));
    return getPageQuestions(currentPageIndex);
  }

  //+_+// Phase F4: 제출 시작 및 학생 입력 잠금 (PRACTICE_ACTIVE -> SUBMITTING)
  function startSubmitting() {
    if (state !== SessionState.PRACTICE_ACTIVE) {
      throw new Error(`현재 상태(${state})에서는 제출을 시작할 수 없습니다.`);
    }
    state = SessionState.SUBMITTING;
    return { state };
  }

  //+_+// Phase F4: 저장 실패 시 PRACTICE_ACTIVE로 안전 복구
  function rollbackSubmitting() {
    if (state === SessionState.SUBMITTING) {
      state = SessionState.PRACTICE_ACTIVE;
    }
    return { state };
  }

  //+_+// Phase F4: 학생 풀이 완료 및 제출 (SUBMITTING -> SUBMITTED_LOCKED)
  function submitPractice(elapsedMs = 0, individualTimes = null) {
    if (state !== SessionState.SUBMITTING) {
      throw new Error(`현재 상태(${state})에서는 풀이를 제출할 수 없습니다. SUBMITTING 상태에서만 가능합니다.`);
    }
    totalSolveTimeMs = Math.max(0, Math.round(elapsedMs));
    if (individualTimes) {
      _applyQuestionSolveTimes(individualTimes);
    }
    submittedAt = Date.now();
    state = SessionState.SUBMITTED_LOCKED;
    return {
      submittedAt,
      totalSolveTimeMs,
      totalQuestions: questions.length
    };
  }

  //+_+// Phase F4: 보호자 채점 대기 상태로 전이 (SUBMITTED_LOCKED -> PARENT_GRADING_PENDING)
  function setPendingGrading() {
    if (state !== SessionState.SUBMITTED_LOCKED) {
      throw new Error(`현재 상태(${state})에서는 채점 대기 상태로 변경할 수 없습니다. SUBMITTED_LOCKED 상태에서만 가능합니다.`);
    }
    state = SessionState.PARENT_GRADING_PENDING;
    return { state };
  }

  //+_+// Phase F4: 채점자 평가 모드 시작 (PARENT_GRADING_PENDING -> GRADING_ACTIVE)
  function startGrading() {
    if (state !== SessionState.PARENT_GRADING_PENDING) {
      throw new Error(`채점을 시작할 수 없는 상태입니다. 현재 상태: ${state} (PARENT_GRADING_PENDING 상태에서만 가능)`);
    }
    state = SessionState.GRADING_ACTIVE;
    return getGradingStatus();
  }

  //+_+// Phase F4: 개별 문제 채점 (GRADING_ACTIVE 상태에서만 허용)
  function gradeQuestion(questionId, decision, comment = "") {
    if (state !== SessionState.GRADING_ACTIVE) {
      throw new Error(`채점할 수 없는 상태입니다. 현재 상태: ${state} (GRADING_ACTIVE 상태에서만 가능)`);
    }

    //+_+// DOM dataset와 persisted object key는 문자열이므로 원본 question ID 타입과 정규화해 같은 문항으로 판정한다.
    const question = questions.find((q) => String(q.id) === String(questionId));
    if (!question) {
      throw new Error(`해당 ID(${questionId})의 문제를 찾을 수 없습니다.`);
    }

    const resolvedQuestionId = question.id;

    const gradeData = createGradeDecision({
      ...question,
      operation: question.operation || operation,
      level: question.level || macroLevelId,
      macroLevelId: question.macroLevelId || macroLevelId,
      stageId: question.stageId || stageId
    }, decision, comment, grades.get(resolvedQuestionId));

    grades.set(resolvedQuestionId, gradeData);
    question.grade = gradeData;
    return {
      questionId: resolvedQuestionId,
      gradeData,
      status: getGradingStatus()
    };
  }

  // 전체 문제 일괄 채점
  function gradeAll(decision) {
    questions.forEach((q) => {
      gradeQuestion(q.id, decision);
    });
    return getGradingStatus();
  }

  // 채점 진행 현황
  function getGradingStatus() {
    const status = getGradingProgress(questions, grades);
    return {
      ...status,
      allGraded: status.allGraded
    };
  }

  //+_+// Phase F4: 채점 완료 및 최종 통계 산출 (GRADING_ACTIVE 상태에서만 가능)
  function finishGrading() {
    if (state !== SessionState.GRADING_ACTIVE) {
      throw new Error(`채점을 완료할 수 없는 상태입니다. 현재 상태: ${state} (GRADING_ACTIVE 상태에서만 가능)`);
    }
    const status = getGradingStatus();
    if (!status.allGraded) {
      throw new Error(`아직 채점되지 않은 문제가 ${status.total - status.graded}개 있습니다.`);
    }

    completedAt = Date.now();
    state = SessionState.SESSION_COMPLETE;
    return getSummary();
  }

  //+_+// Phase F4: 불변 제출 Snapshot 객체 생성
  function createSubmissionSnapshot(options = {}) {
    const now = Date.now();
    const sId = options.sessionId || id;
    const targetLearnerId = options.learnerId || null;
    const studentStrokesMapObj = options.studentStrokesMap instanceof Map
      ? Object.fromEntries(options.studentStrokesMap.entries())
      : (options.studentStrokesMap || {});

    return {
      id: options.id || `sub_${sId}`,
      sessionId: sId,
      learnerId: targetLearnerId,
      subjectId: options.subjectId || config.subjectId || questions[0]?.subjectId || "math",
      courseId: options.courseId || config.courseId || questions[0]?.courseId || "arithmetic",
      moduleId: options.moduleId || config.moduleId || questions[0]?.moduleId || "arithmetic",
      status: options.status || "PARENT_GRADING_PENDING",
      config: {
        ...config,
        operation,
        mathFormat,
        macroLevelId,
        stageId,
        pageSize,
        cols: config.cols || (pageSize <= 2 ? pageSize : 2),
        rows: config.rows || Math.ceil(pageSize / (config.cols || 2))
      },
      questions: questions.map((q, idx) => ({
        ...q,
        orderNumber: idx + 1,
        expectedAnswer: q.answer !== undefined ? q.answer : q.expectedAnswer
      })),
      studentStrokesMap: studentStrokesMapObj,
      responseSnapshots: options.responseSnapshots instanceof Map
        ? Object.fromEntries(options.responseSnapshots.entries())
        : options.responseRecordsMap instanceof Map
          ? Object.fromEntries(options.responseRecordsMap.entries())
          : options.responseRecords instanceof Map
            ? Object.fromEntries(options.responseRecords.entries())
            : (options.responseSnapshots || options.responseRecordsMap || options.responseRecords || {}),
      gradingStrokesMap: {},
      gradingResults: {},
      gradingProgress: getGradingProgress(questions, {}),
      gradingViewMode: "quick",
      currentGradingQuestionId: null,
      answersHidden: false,
      totalSolveTimeMs: totalSolveTimeMs || Math.max(0, Math.round(options.totalSolveTimeMs || 0)),
      perQuestionElapsedMs: options.perQuestionElapsedMs || getQuestionSolveTimes(),
      totalPages,
      pageSize,
      cols: config.cols || (pageSize <= 2 ? pageSize : 2),
      rows: config.rows || Math.ceil(pageSize / (config.cols || 2)),
      inputProfile: options.inputProfile || "DESKTOP_MOUSE_PEN",
      submittedAt: submittedAt || now,
      schemaVersion: options.schemaVersion !== undefined ? Number(options.schemaVersion) : 4,
      appBuildId: String(options.appBuildId || "unknown"),
      gradedAt: null,
      completedAt: null
    };
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
      const decision = normalizeGradeDecision(g?.decision ?? g?.isCorrect);
      const isCorrect = decision === GradeDecision.CORRECT;
      const comment = g ? g.comment : "";
      if (isCorrect) correctCount += 1;
      else wrongCount += 1;

      //+_+// 개별 문제 측정 시간이 있으면 우선 사용, 없으면 평균 시간
      const actualSolveTime = questionSolveTimes.has(q.id)
        ? questionSolveTimes.get(q.id)
        : avgSolvePerQuestionMs;

      const qAns = q.answer !== undefined ? q.answer : q.expectedAnswer;

      results.push({
        questionId: q.id,
        questionKey: q.key || `${q.operation || operation}:${q.operandA}:${q.operandB}`,
        operation: q.operation || operation,
        level: q.level || macroLevelId,
        macroLevelId: q.macroLevelId || macroLevelId,
        stageId: q.stageId || stageId,
        operandA: q.operandA,
        operandB: q.operandB,
        answer: qAns,
        expectedAnswer: qAns,
        isCorrect,
        decision,
        retryRequested: decision === GradeDecision.RETRY,
        comment,
        solveTimeMs: actualSolveTime,
        sourceWrongAnswerId: q.sourceWrongAnswerId || null,
        errorCategories: q.errorCategories || []
      });
    }

    const accuracyRate = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    return {
      sessionId: id,
      operation,
      mathFormat,
      macroLevelId,
      stageId,
      config: {
        ...config,
        operation,
        mathFormat,
        macroLevelId,
        stageId
      },
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
    get config() { return config; },
    get subjectId() { return config.subjectId || questions[0]?.subjectId || "math"; },
    get courseId() { return config.courseId || questions[0]?.courseId || "arithmetic"; },
    get moduleId() { return config.moduleId || questions[0]?.moduleId || "arithmetic"; },
    get unitId() { return config.unitId || questions[0]?.unitId || null; },
    get skillId() { return config.skillId || questions[0]?.skillId || null; },
    get operation() { return operation; },
    get mathFormat() { return mathFormat; },
    get macroLevelId() { return macroLevelId; },
    get stageId() { return stageId; },
    get pageSize() { return pageSize; },
    get cols() { return config.cols || (pageSize <= 2 ? pageSize : 2); },
    get rows() { return config.rows || Math.ceil(pageSize / (config.cols || 2)); },
    get currentPageIndex() { return currentPageIndex; },
    get totalPages() { return totalPages; },
    get questions() { return questions; },
    get totalQuestions() { return questions.length; },
    isPracticeMutable: () => state === SessionState.PRACTICE_ACTIVE,
    isLocked: () => (
      state === SessionState.SUBMITTING ||
      state === SessionState.SUBMITTED ||
      state === SessionState.SUBMITTED_LOCKED ||
      state === SessionState.PARENT_GRADING_PENDING ||
      state === SessionState.GRADING_ACTIVE ||
      state === SessionState.SESSION_COMPLETE
    ),
    start,
    getPageQuestions,
    nextPage,
    prevPage,
    goToPage,
    recordQuestionSolveTime,
    setQuestionSolveTimes,
    getQuestionSolveTimes,
    startSubmitting,
    rollbackSubmitting,
    submitPractice,
    setPendingGrading,
    startGrading,
    gradeQuestion,
    gradeAll,
    getGradingStatus,
    finishGrading,
    createSubmissionSnapshot,
    getSummary
  };
}
