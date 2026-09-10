//+_+// Math Canvas Pro - Phase F11 Learning Route Resolver
//+_+// SSOT UNIFIED_CURRICULUM_ACTIVITY_PLATFORM_v2.2 및 Phase F11 명세 준수
//+_+// - 과목/코스/모듈에 따른 학습 풀이 및 랜딩 라우트 단일 결정 SSOT
//+_+// - Measurement 세션이 Arithmetic 라우트로 오라우팅되는 F9-R4 유형 회귀 원천 차단

export const LEARNING_ROUTES = Object.freeze({
  ARITHMETIC_LANDING: "/math/arithmetic",
  ARITHMETIC_PRACTICE: "/math/arithmetic/practice",
  MEASUREMENT_LANDING: "/math/measurement",
  MEASUREMENT_PRACTICE: "/math/measurement/practice",
  //+_+// Phase F12: Korean Core 라우트
  KOREAN_LANDING: "/korean/core",
  KOREAN_PRACTICE: "/korean/core/practice",
  //+_+// Phase F13: English Core 라우트
  ENGLISH_LANDING: "/english/core",
  ENGLISH_PRACTICE: "/english/core/practice"
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
  const normSubject = String(subjectId || "").toLowerCase();
  const normCourse = String(courseId || "").toLowerCase();
  const normModule = String(moduleId || "").toLowerCase();

  if (normSubject === "english" || normCourse === "english-core" || normModule === "english-core") {
    return LEARNING_ROUTES.ENGLISH_PRACTICE;
  }

  if (normSubject === "korean" || normCourse === "korean-core" || normModule === "korean-core") {
    return LEARNING_ROUTES.KOREAN_PRACTICE;
  }

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
  const normSubject = String(subjectId || "").toLowerCase();
  const normCourse = String(courseId || "").toLowerCase();
  const normModule = String(moduleId || "").toLowerCase();

  if (normSubject === "english" || normCourse === "english-core" || normModule === "english-core") {
    return LEARNING_ROUTES.ENGLISH_LANDING;
  }

  if (normSubject === "korean" || normCourse === "korean-core" || normModule === "korean-core") {
    return LEARNING_ROUTES.KOREAN_LANDING;
  }

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

/**
 * 주어진 라우트가 Korean 관련 경로인지 확인
 */
export function isKoreanRoute(routePath) {
  if (!routePath) return false;
  return routePath === "/korean" || routePath === LEARNING_ROUTES.KOREAN_LANDING || routePath === LEARNING_ROUTES.KOREAN_PRACTICE;
}

/**
 * 주어진 라우트가 English 관련 경로인지 확인
 */
export function isEnglishRoute(routePath) {
  if (!routePath) return false;
  return routePath === "/english" || routePath === LEARNING_ROUTES.ENGLISH_LANDING || routePath === LEARNING_ROUTES.ENGLISH_PRACTICE;
}

//+_+// Phase F11 Rework 1: Production 세션/Draft 라우트 결정 및 네비게이션 Facade
export function resolvePracticeRouteForSession(draftOrSession) {
  if (!draftOrSession) return LEARNING_ROUTES.ARITHMETIC_PRACTICE;
  const config = draftOrSession.config || {};
  const subjectId = draftOrSession.subjectId || config.subjectId || "math";
  const courseId = config.courseId || draftOrSession.courseId;
  const moduleId = config.moduleId || draftOrSession.moduleId;

  return resolvePracticeRoute({ subjectId, courseId, moduleId });
}

export function handleSessionPracticeNavigation(draftOrSession, navigateFn) {
  const targetRoute = resolvePracticeRouteForSession(draftOrSession);
  if (typeof navigateFn === "function") {
    return navigateFn(targetRoute);
  }
  return targetRoute;
}
