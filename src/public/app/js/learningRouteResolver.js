//+_+// Math Canvas Pro - Phase F11 Learning Route Resolver
//+_+// SSOT UNIFIED_CURRICULUM_ACTIVITY_PLATFORM_v2.2 및 Phase F11 명세 준수
//+_+// - 과목/코스/모듈에 따른 학습 풀이 및 랜딩 라우트 단일 결정 SSOT
//+_+// - Measurement 세션이 Arithmetic 라우트로 오라우팅되는 F9-R4 유형 회귀 원천 차단

export const LEARNING_ROUTES = Object.freeze({
  ARITHMETIC_LANDING: "/math/arithmetic",
  ARITHMETIC_PRACTICE: "/math/arithmetic/practice",
  MEASUREMENT_LANDING: "/math/measurement",
  MEASUREMENT_PRACTICE: "/math/measurement/practice"
});

/**
 * 학습 모듈 정보에 따라 올바른 Practice 풀이 라우트 경로 결정
 * @param {Object} params
 * @param {string} [params.subjectId="math"]
 * @param {string} [params.courseId]
 * @param {string} [params.moduleId]
 * @returns {string} 라우트 경로
 */
export function resolvePracticeRoute({ subjectId = "math", courseId = "", moduleId = "" } = {}) {
  const normCourse = String(courseId || "").toLowerCase();
  const normModule = String(moduleId || "").toLowerCase();

  if (normCourse === "measurement" || normModule === "measurement") {
    return LEARNING_ROUTES.MEASUREMENT_PRACTICE;
  }

  return LEARNING_ROUTES.ARITHMETIC_PRACTICE;
}

/**
 * 학습 모듈 정보에 따라 올바른 학습 설정/랜딩 라우트 경로 결정
 * @param {Object} params
 * @param {string} [params.subjectId="math"]
 * @param {string} [params.courseId]
 * @param {string} [params.moduleId]
 * @returns {string} 라우트 경로
 */
export function resolveLandingRoute({ subjectId = "math", courseId = "", moduleId = "" } = {}) {
  const normCourse = String(courseId || "").toLowerCase();
  const normModule = String(moduleId || "").toLowerCase();

  if (normCourse === "measurement" || normModule === "measurement") {
    return LEARNING_ROUTES.MEASUREMENT_LANDING;
  }

  return LEARNING_ROUTES.ARITHMETIC_LANDING;
}

/**
 * 주어진 라우트가 Measurement 관련 경로인지 확인
 */
export function isMeasurementRoute(routePath) {
  if (!routePath) return false;
  return routePath === LEARNING_ROUTES.MEASUREMENT_LANDING || routePath === LEARNING_ROUTES.MEASUREMENT_PRACTICE;
}
