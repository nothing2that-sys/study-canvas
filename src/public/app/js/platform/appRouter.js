//+_+// Math Canvas Pro - 플랫폼 라우터 (App Router)
//+_+// SSOT Section 12~13 및 Phase F3 최종 보완 명세 준수
//+_+// - 브라우저 History API (pushState, replaceState, popstate) 기반 단일 SSOT 라우터
//+_+// - Browser Location 객체 직접 대입(location.pathname =) 전면 제거 (오직 History API만 사용)
//+_+// - Route Guard (active learner 미존재 시 /learners 리다이렉트)
//+_+// - 활성 학습 세션(Practice / Grading) 중 브라우저 Back/Forward 이탈 원천 차단
//+_+// - Deep Link 안전 처리 (복원할 세션/Draft 없는 practice 직접 로드 -> /math/arithmetic 복귀)
//+_+// - windowRef 주입 지원을 통한 Node 및 브라우저 환경 완벽 대응

import { getActiveLearnerId } from "../learners/learnerQueries.js";
import { isReleaseSubjectAllowed } from "../publicReleasePolicy.js";

export const ROUTES = Object.freeze({
  ROOT: "/",
  LEARNERS: "/learners",
  HOME: "/home",
  BOOKSHELF: "/bookshelf",
  WORKBOOK_DETAIL: "/workbook",
  WORKBOOK_READER: "/workbook/read",
  MATH_HOME: "/math",
  MATH_ARITHMETIC: "/math/arithmetic",
  MATH_PRACTICE: "/math/arithmetic/practice",
  MATH_GRADING: "/math/arithmetic/grading",
  MATH_RESULT: "/math/arithmetic/result",
  //+_+// Phase F11: Measurement 모듈 라우트
  MATH_MEASUREMENT: "/math/measurement",
  MATH_MEASUREMENT_PRACTICE: "/math/measurement/practice",
  //+_+// Phase F15A: Fraction Concepts 모듈 라우트
  MATH_FRACTION: "/math/fraction",
  MATH_FRACTION_PRACTICE: "/math/fraction/practice",
  //+_+// Phase F15C: Decimal Concepts & Operations 모듈 라우트
  MATH_DECIMAL: "/math/decimal",
  MATH_DECIMAL_PRACTICE: "/math/decimal/practice",
  //+_+// Phase F12: Korean Core 모듈 라우트
  KOREAN_HOME: "/korean",
  KOREAN_CORE: "/korean/core",
  KOREAN_CORE_PRACTICE: "/korean/core/practice",
  //+_+// Phase F13: English Core 모듈 라우트
  ENGLISH_HOME: "/english",
  ENGLISH_CORE: "/english/core",
  ENGLISH_CORE_PRACTICE: "/english/core/practice"
});

//+_+// 활성 학습자가 필요한 보호된 라우트 목록
const PROTECTED_ROUTES = new Set([
  ROUTES.HOME,
  ROUTES.BOOKSHELF,
  ROUTES.WORKBOOK_DETAIL,
  ROUTES.WORKBOOK_READER,
  ROUTES.MATH_HOME,
  ROUTES.MATH_ARITHMETIC,
  ROUTES.MATH_PRACTICE,
  ROUTES.MATH_GRADING,
  ROUTES.MATH_RESULT,
  ROUTES.MATH_MEASUREMENT,
  ROUTES.MATH_MEASUREMENT_PRACTICE,
  ROUTES.MATH_FRACTION,
  ROUTES.MATH_FRACTION_PRACTICE,
  ROUTES.MATH_DECIMAL,
  ROUTES.MATH_DECIMAL_PRACTICE,
  ROUTES.KOREAN_HOME,
  ROUTES.KOREAN_CORE,
  ROUTES.KOREAN_CORE_PRACTICE,
  ROUTES.ENGLISH_HOME,
  ROUTES.ENGLISH_CORE,
  ROUTES.ENGLISH_CORE_PRACTICE
]);

let currentPath = ROUTES.ROOT;
let routeListeners = new Set();
let sessionCheckCallback = null;
let activeWindowRef = null;
let popstateHandler = null;

//+_+// URL 경로 정규화 (base path 제거 및 쿼리/해시/끝 슬래시 정리)
export function normalizePath(pathStr) {
  if (!pathStr) return ROUTES.ROOT;
  let p = String(pathStr).trim();
  try {
    if (p.startsWith("http://") || p.startsWith("https://")) {
      p = new URL(p).pathname;
    }
  } catch (err) {
    //+_+// URL 파싱 불가 시 원본 문자열 기반으로 정규화 진행
  }

  p = p.split("?")[0].split("#")[0];
  p = p.replace(/\/+/g, "/");

  if (p.length > 1 && p.endsWith("/")) {
    p = p.slice(0, -1);
  }

  return p || ROUTES.ROOT;
}

//+_+// 라우트 유효성 및 가드 검사 후 최종 목적지 경로 결정
export function resolveGuardedPath(targetPath) {
  const normalized = normalizePath(targetPath);
  const activeLearnerId = getActiveLearnerId();
  const subjectId = normalized.split("/")[1];
  if (["math", "english", "korean"].includes(subjectId) && !isReleaseSubjectAllowed(subjectId)) return ROUTES.HOME;

  //+_+// 0. 활성 세션(Practice / Grading) 중 외부 라우트 이탈 방어
  if (sessionCheckCallback) {
    const isPracticeActive = sessionCheckCallback("practice_active");
    const isGradingActive = sessionCheckCallback("grading_active");

    if (isPracticeActive && normalized !== ROUTES.MATH_PRACTICE && normalized !== ROUTES.MATH_MEASUREMENT_PRACTICE && normalized !== ROUTES.MATH_FRACTION_PRACTICE && normalized !== ROUTES.MATH_DECIMAL_PRACTICE && normalized !== ROUTES.KOREAN_CORE_PRACTICE && normalized !== ROUTES.ENGLISH_CORE_PRACTICE) {
      if (currentPath === ROUTES.ENGLISH_CORE_PRACTICE) return ROUTES.ENGLISH_CORE_PRACTICE;
      if (currentPath === ROUTES.KOREAN_CORE_PRACTICE) return ROUTES.KOREAN_CORE_PRACTICE;
      if (currentPath === ROUTES.MATH_DECIMAL_PRACTICE) return ROUTES.MATH_DECIMAL_PRACTICE;
      if (currentPath === ROUTES.MATH_FRACTION_PRACTICE) return ROUTES.MATH_FRACTION_PRACTICE;
      if (currentPath === ROUTES.MATH_MEASUREMENT_PRACTICE) return ROUTES.MATH_MEASUREMENT_PRACTICE;
      return ROUTES.MATH_PRACTICE;
    }
    if (isGradingActive && normalized !== ROUTES.MATH_GRADING) {
      return ROUTES.MATH_GRADING;
    }
  }

  //+_+// 1. 루트 경로인 경우 활성 학습자 유무에 따라 분기
  if (normalized === ROUTES.ROOT) {
    return activeLearnerId ? ROUTES.HOME : ROUTES.LEARNERS;
  }

  //+_+// 2. 보호된 라우트인데 활성 학습자가 없으면 /learners 로 redirect
  if (PROTECTED_ROUTES.has(normalized) && !activeLearnerId) {
    return ROUTES.LEARNERS;
  }

  //+_+// 3. 풀이 화면 직접 진입 가드 (세션/Draft 미존재 시 설정 화면으로 안전 복귀)
  if (normalized === ROUTES.MATH_PRACTICE) {
    if (sessionCheckCallback && !sessionCheckCallback("practice")) {
      return ROUTES.MATH_ARITHMETIC;
    }
  }

  //+_+// Phase F11: Measurement 풀이 화면 직접 진입 가드
  if (normalized === ROUTES.MATH_MEASUREMENT_PRACTICE) {
    if (sessionCheckCallback && !sessionCheckCallback("practice")) {
      return ROUTES.MATH_MEASUREMENT;
    }
  }

  //+_+// Phase F15A: Fraction Concepts 풀이 화면 직접 진입 가드
  if (normalized === ROUTES.MATH_FRACTION_PRACTICE) {
    if (sessionCheckCallback && !sessionCheckCallback("practice")) {
      return ROUTES.MATH_FRACTION;
    }
  }

  //+_+// Phase F15C: Decimal Concepts 풀이 화면 직접 진입 가드
  if (normalized === ROUTES.MATH_DECIMAL_PRACTICE) {
    if (sessionCheckCallback && !sessionCheckCallback("practice")) {
      return ROUTES.MATH_DECIMAL;
    }
  }

  //+_+// Phase F12: Korean Core 풀이 화면 직접 진입 가드
  if (normalized === ROUTES.KOREAN_CORE_PRACTICE) {
    if (sessionCheckCallback && !sessionCheckCallback("practice")) {
      return ROUTES.KOREAN_CORE;
    }
  }

  //+_+// Phase F13: English Core 풀이 화면 직접 진입 가드
  if (normalized === ROUTES.ENGLISH_CORE_PRACTICE) {
    if (sessionCheckCallback && !sessionCheckCallback("practice")) {
      return ROUTES.ENGLISH_CORE;
    }
  }

  //+_+// 4. 채점 화면 직접 진입 가드
  if (normalized === ROUTES.MATH_GRADING) {
    if (sessionCheckCallback && !sessionCheckCallback("grading")) {
      return ROUTES.MATH_ARITHMETIC;
    }
  }

  //+_+// 5. 결과 화면 직접 진입 가드
  if (normalized === ROUTES.MATH_RESULT) {
    if (sessionCheckCallback && !sessionCheckCallback("result")) {
      return ROUTES.MATH_ARITHMETIC;
    }
  }

  return normalized;
}

//+_+// 현재 라우트 경로 반환
export function getCurrentRoute() {
  return currentPath;
}

//+_+// 라우트 변경 리스너 등록
export function addRouteListener(listener) {
  if (typeof listener === "function") {
    routeListeners.add(listener);
  }
  return () => routeListeners.delete(listener);
}

//+_+// 라우트 변경 알림 발생
function notifyRouteListeners(newPath, oldPath, state = {}) {
  for (const listener of routeListeners) {
    try {
      listener({ path: newPath, oldPath, state });
    } catch (err) {
      console.error("[Router] Listener error:", err);
    }
  }
}

//+_+// 새 경로로 이동 (History pushState 사용, location.pathname 직접 쓰기 절대 금지)
export function navigate(targetPath, state = {}) {
  const resolved = resolveGuardedPath(targetPath);
  const oldPath = currentPath;

  currentPath = resolved;

  if (activeWindowRef && activeWindowRef.history && typeof activeWindowRef.history.pushState === "function") {
    try {
      activeWindowRef.history.pushState(state, "", resolved);
    } catch (err) {
      //+_+// 히스토리 push 실패 시 메모리 라우트 상태 유지
    }
  }

  notifyRouteListeners(resolved, oldPath, state);
  return resolved;
}

//+_+// 현재 경로 교체 (History replaceState 사용, location.pathname 직접 쓰기 절대 금지)
export function replace(targetPath, state = {}) {
  const resolved = resolveGuardedPath(targetPath);
  const oldPath = currentPath;

  currentPath = resolved;

  if (activeWindowRef && activeWindowRef.history && typeof activeWindowRef.history.replaceState === "function") {
    try {
      activeWindowRef.history.replaceState(state, "", resolved);
    } catch (err) {
      //+_+// 히스토리 replace 실패 시 메모리 라우트 상태 유지
    }
  }

  notifyRouteListeners(resolved, oldPath, state);
  return resolved;
}

//+_+// 라우터 초기화 (단일 SSOT: 전달된 initialPath 또는 window.location.pathname 기준)
export function initRouter(options = {}) {
  if (options.hasActiveSession) {
    sessionCheckCallback = options.hasActiveSession;
  }

  const win = options.windowRef || (typeof window !== "undefined" ? window : null);
  activeWindowRef = win;

  //+_+// 1. 시작 경로 결정 (명시적 initialPath가 있으면 우선, 없으면 window.location.pathname 읽기)
  const candidatePath = options.initialPath !== undefined
    ? options.initialPath
    : (win && win.location ? win.location.pathname : ROUTES.ROOT);

  const resolved = resolveGuardedPath(candidatePath);
  const oldPath = currentPath;
  currentPath = resolved;

  if (win) {
    //+_+// 이전 리스너 해제 후 신규 popstate 리스너 등록
    if (popstateHandler && typeof win.removeEventListener === "function") {
      win.removeEventListener("popstate", popstateHandler);
    }

    popstateHandler = (event) => {
      const pathFromUrl = normalizePath(win.location ? win.location.pathname : "/");
      const poppedResolved = resolveGuardedPath(pathFromUrl);
      const prevPath = currentPath;
      currentPath = poppedResolved;

      //+_+// 가드에 의해 URL이 보정되어야 하는 경우 replaceState로 URL만 교체 (location.pathname 대입 금지)
      if (poppedResolved !== pathFromUrl && win.history && typeof win.history.replaceState === "function") {
        try {
          win.history.replaceState(event.state || {}, "", poppedResolved);
        } catch (err) {
          //+_+// 상태 동기화 실패 시 무시
        }
      }

      notifyRouteListeners(poppedResolved, prevPath, event.state || {});
    };

    if (typeof win.addEventListener === "function") {
      win.addEventListener("popstate", popstateHandler);
    }

    if (win.history && typeof win.history.replaceState === "function") {
      try {
        win.history.replaceState({}, "", resolved);
      } catch (err) {
        //+_+// 초기 history 동기화
      }
    }
  }

  notifyRouteListeners(resolved, oldPath, {});
  return resolved;
}

//+_+// 테스트용 라우터 리셋
export function _resetRouterForTesting() {
  if (activeWindowRef && popstateHandler && typeof activeWindowRef.removeEventListener === "function") {
    activeWindowRef.removeEventListener("popstate", popstateHandler);
  }
  currentPath = ROUTES.ROOT;
  routeListeners.clear();
  sessionCheckCallback = null;
  activeWindowRef = null;
  popstateHandler = null;
}
