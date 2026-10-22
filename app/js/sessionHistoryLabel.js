import { getActivityDisplayLabel, isInternalIdentifier } from "./displayLabels.js";
export function getSessionHistoryLabel(session = {}) {
  const config = session.config || {};
  const activity = session.questions?.[0] || session.results?.[0] || {};
  const title = session.skillTitle || config.skillTitle || activity.skillTitle;
  if (typeof title === "string" && title.trim() && !isInternalIdentifier(title)) return title.trim();
  const course = session.courseId || config.courseId || activity.courseId;
  const courseLabels = { decimal: "소수", fraction: "분수", measurement: "측정", "fraction-concept": "분수 개념", "fraction-operation": "분수 연산" };
  if (courseLabels[course]) return courseLabels[course];
  const subject = session.subjectId || config.subjectId || activity.subjectId;
  const op = session.operation || config.operation || activity.operation;
  if ((!subject || subject === "math") && (!course || course === "arithmetic")) {
    const labels = { mul: "곱셈", div: "나눗셈", add: "덧셈", sub: "뺄셈" };
    if (labels[op]) return labels[op];
  }
  return getActivityDisplayLabel(activity, { ...config, subjectId: subject });
}
