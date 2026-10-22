import { resolveActivityResponseType, ResponseType } from "./learningActivity.js";

// Keep explicit snapshot identities. Typed activities have no arithmetic operands.
export function getQuestionKey(question, context = {}) {
  if (question.questionKey || question.key) return question.questionKey || question.key;
  if (resolveActivityResponseType(question) !== ResponseType.CANVAS) {
    const subject = question.subjectId || context.subjectId || "math";
    const skill = question.skillId || question.moduleId || question.courseId || context.courseId || "typed";
    if (!question.id) throw new Error("입력형 문제의 원본 ID가 없습니다.");
    return `${subject}:${skill}:${question.id}`;
  }
  return `${question.operation || context.operation}:${question.operandA}:${question.operandB}`;
}

export function getQuestionMathFormat(question, session = {}) {
  return [question?.mathFormat, session.config?.mathFormat, session.mathFormat]
    .find(format => format === "horizontal" || format === "vertical") || "vertical";
}
