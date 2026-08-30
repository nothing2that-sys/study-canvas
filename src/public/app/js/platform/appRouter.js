/**
 * Math Canvas Pro - 플랫폼 라우터 (App Router)
 * SSOT Section 12~13 및 Phase F3 명세 준수
 * - 브라우저 History API (pushState, replaceState, popstate) 기반
 * - Route Guard (active learner 미존재 시 /learners 리다이렉트)
 * - Deep Link 안전 처리 (복원할 세션 없는 practice 직접 로드 -> /math/arithmetic 복귀)
 */

import { getActiveLearnerId } from "../learners/learnerQueries.js";

export const ROUTES = Object.freeze({
  ROOT: "/",
  LEARNERS: "/learners",
  HOME: "/home",
  MATH_HOME: "/math",
  MATH_ARITHMETIC: "/math/arithmetic",
  MATH_PRACTICE: "/math/arithmetic/practice",
  MATH_GRADING: "/math/arithmetic/grading",
  MATH_RESULT: "/math/arithmetic/result"
});

// 활성 학습자가 필요한 보호된 라우트 목록
const PROTECTED_ROUTES = new Set([
  ROUTES.HOME,
  ROUTES.MATH_HOME,
  ROUTES.MATH_ARITHMETIC,
  ROUTES.MATH_PRACTICE,
  ROUTES.MATH_GRADING,
  ROUTES.MATH_RESULT
]);

let currentPath = ROUTES.ROOT;
let routeListeners = new Set();
let sessionCheckCallback = null;
let initialized = false;

/**
 * URL 경로 정규화 (base path 제거 및 끝 슬래시 정리)
 */
export function normalizePath(pathStr) {
  if (!pathStr) return ROUTES.ROOT;
  let p = String(pathStr).trim();
  try {
    if (p.startsWith("http://") || p.startsWith("https://")) {
      p = new URL(p).pathname;
    }
  } catch (_) {}

  // query / hash 제거
  p = p.split("?")[0].split("#")[0];

  // 연속 슬래시 단일화
  p = p.replace(/\/+/g, "/");

  // 끝 슬래시 정리 (루트 제외)
  if (p.length > 1 && p.endsWith("/")) {
    p = p.slice(0, -1);
  }

  return p || ROUTES.ROOT;
}

/**
 * 라우트 유효성 및 가드 검사 후 최종 목적지 경로 결정
 */
export function resolveGuardedPath(targetPath) {
  const normalized = normalizePath(targetPath);
  const activeLearnerId = getActiveLearnerId();

  // 1. 루트 경로인 경우 학습자 상태에 따라 분기
  if (normalized === ROUTES.ROOT) {
    return activeLearnerId ? ROUTES.HOME : ROUTES.LEARNERS;
  }

  // 2. 보호된 라우트인데 활성 학습자가 없으면 /learners 로 redirect
  if (PROTECTED_ROUTES.has(normalized) && !activeLearnerId) {
    return ROUTES.LEARNERS;
  }

  // 3. 풀이 화면 직접 진입 가드 (세션/Draft 미존재 시 설정 화면으로 안전 복귀)
  if (normalized === ROUTES.MATH_PRACTICE) {
    if (sessionCheckCallback && !sessionCheckCallback("practice")) {
      return ROUTES.MATH_ARITHMETIC;
    }
  }

  // 4. 채점 화면 직접 진입 가드
  if (normalized === ROUTES.MATH_GRADING) {
    if (sessionCheckCallback && !sessionCheckCallback("grading")) {
      return ROUTES.MATH_ARITHMETIC;
    }
  }

  // 5. 결과 화면 직접 진입 가드
  if (normalized === ROUTES.MATH_RESULT) {
    if (sessionCheckCallback && !sessionCheckCallback("result")) {
      return ROUTES.MATH_ARITHMETIC;
    }
  }

  return normalized;
}

/**
 * 현재 라우트 경로 반환
 */
export function getCurrentRoute() {
  return currentPath;
}

/**
 * 라우트 변경 리스너 등록
 */
export function addRouteListener(listener) {
  if (typeof listener === "function") {
    routeListeners.add(listener);
  }
  return () => routeListeners.delete(listener);
}

/**
 * 라우트 변경 알림 발생
 */
function notifyRouteListeners(newPath, oldPath, state = {}) {
  for (const listener of routeListeners) {
    try {
      listener({ path: newPath, oldPath, state });
    } catch (err) {
      console.error("[Router] Listener error:", err);
    }
  }
}

/**
 * 새 경로로 이동 (History pushState)
 */
export function navigate(targetPath, state = {}) {
  const resolved = resolveGuardedPath(targetPath);
  const oldPath = currentPath;

  currentPath = resolved;

  if (typeof window !== "undefined" && window.history) {
    try {
      window.history.pushState(state, "", resolved);
    } catch (_) {}
  }

  notifyRouteListeners(resolved, oldPath, state);
  return resolved;
}

/**
 * 현재 경로 교체 (History replaceState)
 */
export function replace(targetPath, state = {}) {
  const resolved = resolveGuardedPath(targetPath);
  const oldPath = currentPath;

  currentPath = resolved;

  if (typeof window !== "undefined" && window.history) {
    try {
      window.history.replaceState(state, "", resolved);
    } catch (_) {}
  }

  notifyRouteListeners(resolved, oldPath, state);
  return resolved;
}

/**
 * 라우터 초기화
 */
export function initRouter(options = {}) {
  if (options.hasActiveSession) {
    sessionCheckCallback = options.hasActiveSession;
  }

  if (typeof window !== "undefined") {
    if (!initialized) {
      window.addEventListener("popstate", (event) => {
        const pathFromUrl = normalizePath(window.location.pathname);
        const resolved = resolveGuardedPath(pathFromUrl);
        const oldPath = currentPath;
        currentPath = resolved;

        if (resolved !== pathFromUrl) {
          try {
            window.history.replaceState(event.state || {}, "", resolved);
          } catch (_) {}
        }

        notifyRouteListeners(resolved, oldPath, event.state || {});
      });
      initialized = true;
    }

    const initialPath = normalizePath(window.location.pathname);
    const resolved = resolveGuardedPath(initialPath);
    currentPath = resolved;

    if (resolved !== initialPath) {
      try {
        window.history.replaceState({}, "", resolved);
      } catch (_) {}
    }

    return resolved;
  }

  currentPath = resolveGuardedPath(options.initialPath || ROUTES.ROOT);
  return currentPath;
}

/**
 * 테스트용 라우터 리셋
 */
export function _resetRouterForTesting() {
  currentPath = ROUTES.ROOT;
  routeListeners.clear();
  sessionCheckCallback = null;
  initialized = false;
}
