//+_+// Phase F5 보호자 채점 판정 및 진행률 공통 계약

export const GradeDecision = Object.freeze({
  CORRECT: "CORRECT",
  WRONG: "WRONG",
  RETRY: "RETRY"
});

const VALID_DECISIONS = new Set(Object.values(GradeDecision));

export function normalizeGradeDecision(value) {
  if (value === true) return GradeDecision.CORRECT;
  if (value === false) return GradeDecision.WRONG;
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "INCORRECT") return GradeDecision.WRONG;
  if (normalized === "RETRY_REQUESTED") return GradeDecision.RETRY;
  return VALID_DECISIONS.has(normalized) ? normalized : null;
}

export function isGradeDecision(value) {
  return normalizeGradeDecision(value) !== null;
}

export function createGradeDecision(question, decision, comment = "", existing = null, now = Date.now()) {
  const normalizedDecision = normalizeGradeDecision(decision);
  if (!normalizedDecision) {
    throw new Error("채점 판정은 CORRECT, WRONG, RETRY 중 하나여야 합니다.");
  }

  const finalComment = comment !== undefined && comment !== null
    ? String(comment).trim()
    : String(existing?.comment || "");

  //+_+// Phase F10A: 비연산 Fixture/신규 Skill 문제의 questionKey 안전 fallback
  const questionKey = question.key ||
    question.questionKey ||
    (question.skillId ? `${question.subjectId || "math"}:${question.skillId}:${question.id}` : `${question.operation}:${question.operandA}:${question.operandB}`);

  return {
    questionId: question.id,
    questionKey,
    subjectId: question.subjectId || "math",
    moduleId: question.moduleId || (question.operation === "div" ? "div" : "mul"),
    skillId: question.skillId || null,
    operation: question.operation,
    level: question.level,
    macroLevelId: question.macroLevelId || question.level,
    stageId: question.stageId || question.macroLevelId || question.level,
    operandA: question.operandA,
    operandB: question.operandB,
    answer: question.answer !== undefined ? question.answer : question.expectedAnswer,
    expectedAnswer: question.answer !== undefined ? question.answer : question.expectedAnswer,
    decision: normalizedDecision,
    gradingState: "GRADED",
    isCorrect: normalizedDecision === GradeDecision.CORRECT,
    retryRequested: normalizedDecision === GradeDecision.RETRY,
    comment: finalComment,
    sourceWrongAnswerId: question.sourceWrongAnswerId || null,
    errorCategories: Array.isArray(question.errorCategories) ? [...question.errorCategories] : [],
    gradedAt: Number(existing?.gradedAt) || now,
    revisedAt: existing ? now : null
  };
}

export function getGradingProgress(questions = [], grades = new Map()) {
  const getGrade = grades instanceof Map
    ? (questionId) => grades.get(questionId)
    : (questionId) => grades?.[questionId];
  const progress = {
    total: questions.length,
    graded: 0,
    correct: 0,
    wrong: 0,
    retry: 0,
    remaining: questions.length,
    allGraded: false,
    progressPercent: 0
  };

  for (const question of questions) {
    const decision = normalizeGradeDecision(getGrade(question.id)?.decision ?? getGrade(question.id)?.isCorrect);
    if (!decision) continue;
    progress.graded += 1;
    if (decision === GradeDecision.CORRECT) progress.correct += 1;
    if (decision === GradeDecision.WRONG) progress.wrong += 1;
    if (decision === GradeDecision.RETRY) progress.retry += 1;
  }

  progress.remaining = Math.max(0, progress.total - progress.graded);
  progress.allGraded = progress.total > 0 && progress.remaining === 0;
  progress.progressPercent = progress.total > 0
    ? Math.round((progress.graded / progress.total) * 100)
    : 0;
  return progress;
}

export function assertSubmissionGradingOwnership(submission, learnerId) {
  if (!submission) throw new Error("채점할 제출본을 찾을 수 없습니다.");
  if (!learnerId || submission.learnerId !== learnerId) {
    throw new Error("해당 제출본에 대한 보호자 채점 권한이 없습니다.");
  }
  return true;
}
