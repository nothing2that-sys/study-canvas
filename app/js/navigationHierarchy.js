//+_+// Math Canvas Pro - Global Learning Navigation Hierarchy SSOT
//+_+// Cross-Phase Learning Navigation Contract

import { ROUTES, normalizePath } from "./platform/appRouter.js";

/**
 * 라우트 계층 정의 테이블
 */
const ROUTE_HIERARCHY_CONFIG = Object.freeze({
  [ROUTES.HOME]: {
    label: "홈",
    parentRoute: null,
    parentLabel: null,
    breadcrumbs: [{ label: "홈", route: ROUTES.HOME }]
  },
  [ROUTES.BOOKSHELF]: {
    label: "내 문제집 책장",
    parentRoute: ROUTES.HOME,
    parentLabel: "홈",
    breadcrumbs: [{ label: "홈", route: ROUTES.HOME }, { label: "책장", route: ROUTES.BOOKSHELF }]
  },
  [ROUTES.WORKBOOK_DETAIL]: {
    label: "문제집 안내",
    parentRoute: ROUTES.BOOKSHELF,
    parentLabel: "책장",
    breadcrumbs: [{ label: "홈", route: ROUTES.HOME }, { label: "책장", route: ROUTES.BOOKSHELF }, { label: "문제집", route: ROUTES.WORKBOOK_DETAIL }]
  },
  [ROUTES.WORKBOOK_READER]: {
    label: "문제집 읽기",
    parentRoute: ROUTES.BOOKSHELF,
    parentLabel: "책장",
    breadcrumbs: [{ label: "홈", route: ROUTES.HOME }, { label: "책장", route: ROUTES.BOOKSHELF }, { label: "문제집 읽기", route: ROUTES.WORKBOOK_READER }]
  },
  [ROUTES.MATH_HOME]: {
    label: "수학",
    parentRoute: ROUTES.HOME,
    parentLabel: "홈",
    breadcrumbs: [{ label: "홈", route: ROUTES.HOME }, { label: "수학", route: ROUTES.MATH_HOME }]
  },
  [ROUTES.MATH_ARITHMETIC]: {
    label: "자연수 연산",
    parentRoute: ROUTES.MATH_HOME,
    parentLabel: "수학",
    breadcrumbs: [{ label: "홈", route: ROUTES.HOME }, { label: "수학", route: ROUTES.MATH_HOME }, { label: "자연수 연산", route: ROUTES.MATH_ARITHMETIC }]
  },
  [ROUTES.MATH_PRACTICE]: {
    label: "문제풀이",
    parentRoute: ROUTES.MATH_ARITHMETIC,
    parentLabel: "자연수 연산",
    breadcrumbs: [{ label: "홈", route: ROUTES.HOME }, { label: "수학", route: ROUTES.MATH_HOME }, { label: "자연수 연산", route: ROUTES.MATH_ARITHMETIC }, { label: "문제풀이", route: ROUTES.MATH_PRACTICE }]
  },
  [ROUTES.MATH_MEASUREMENT]: {
    label: "측정 및 단위",
    parentRoute: ROUTES.MATH_HOME,
    parentLabel: "수학",
    breadcrumbs: [{ label: "홈", route: ROUTES.HOME }, { label: "수학", route: ROUTES.MATH_HOME }, { label: "측정", route: ROUTES.MATH_MEASUREMENT }]
  },
  [ROUTES.MATH_MEASUREMENT_PRACTICE]: {
    label: "문제풀이",
    parentRoute: ROUTES.MATH_MEASUREMENT,
    parentLabel: "측정",
    breadcrumbs: [{ label: "홈", route: ROUTES.HOME }, { label: "수학", route: ROUTES.MATH_HOME }, { label: "측정", route: ROUTES.MATH_MEASUREMENT }, { label: "문제풀이", route: ROUTES.MATH_MEASUREMENT_PRACTICE }]
  },
  [ROUTES.MATH_FRACTION]: {
    label: "분수",
    parentRoute: ROUTES.MATH_HOME,
    parentLabel: "수학",
    breadcrumbs: [{ label: "홈", route: ROUTES.HOME }, { label: "수학", route: ROUTES.MATH_HOME }, { label: "분수", route: ROUTES.MATH_FRACTION }]
  },
  [ROUTES.MATH_FRACTION_PRACTICE]: {
    label: "문제풀이",
    parentRoute: ROUTES.MATH_FRACTION,
    parentLabel: "분수",
    breadcrumbs: [{ label: "홈", route: ROUTES.HOME }, { label: "수학", route: ROUTES.MATH_HOME }, { label: "분수", route: ROUTES.MATH_FRACTION }, { label: "문제풀이", route: ROUTES.MATH_FRACTION_PRACTICE }]
  },
  [ROUTES.MATH_DECIMAL]: {
    label: "소수",
    parentRoute: ROUTES.MATH_HOME,
    parentLabel: "수학",
    breadcrumbs: [{ label: "홈", route: ROUTES.HOME }, { label: "수학", route: ROUTES.MATH_HOME }, { label: "소수", route: ROUTES.MATH_DECIMAL }]
  },
  [ROUTES.MATH_DECIMAL_PRACTICE]: {
    label: "문제풀이",
    parentRoute: ROUTES.MATH_DECIMAL,
    parentLabel: "소수",
    breadcrumbs: [{ label: "홈", route: ROUTES.HOME }, { label: "수학", route: ROUTES.MATH_HOME }, { label: "소수", route: ROUTES.MATH_DECIMAL }, { label: "문제풀이", route: ROUTES.MATH_DECIMAL_PRACTICE }]
  },
  [ROUTES.KOREAN_HOME]: {
    label: "국어",
    parentRoute: ROUTES.HOME,
    parentLabel: "홈",
    breadcrumbs: [{ label: "홈", route: ROUTES.HOME }, { label: "국어", route: ROUTES.KOREAN_HOME }]
  },
  [ROUTES.KOREAN_CORE]: {
    label: "국어 기초",
    parentRoute: ROUTES.KOREAN_HOME,
    parentLabel: "국어",
    breadcrumbs: [{ label: "홈", route: ROUTES.HOME }, { label: "국어", route: ROUTES.KOREAN_HOME }, { label: "국어 기초", route: ROUTES.KOREAN_CORE }]
  },
  [ROUTES.KOREAN_CORE_PRACTICE]: {
    label: "문제풀이",
    parentRoute: ROUTES.KOREAN_CORE,
    parentLabel: "국어 기초",
    breadcrumbs: [{ label: "홈", route: ROUTES.HOME }, { label: "국어", route: ROUTES.KOREAN_HOME }, { label: "국어 기초", route: ROUTES.KOREAN_CORE }, { label: "문제풀이", route: ROUTES.KOREAN_CORE_PRACTICE }]
  },
  [ROUTES.ENGLISH_HOME]: {
    label: "영어",
    parentRoute: ROUTES.HOME,
    parentLabel: "홈",
    breadcrumbs: [{ label: "홈", route: ROUTES.HOME }, { label: "영어", route: ROUTES.ENGLISH_HOME }]
  },
  [ROUTES.ENGLISH_CORE]: {
    label: "영어 기초",
    parentRoute: ROUTES.ENGLISH_HOME,
    parentLabel: "영어",
    breadcrumbs: [{ label: "홈", route: ROUTES.HOME }, { label: "영어", route: ROUTES.ENGLISH_HOME }, { label: "영어 기초", route: ROUTES.ENGLISH_CORE }]
  },
  [ROUTES.ENGLISH_CORE_PRACTICE]: {
    label: "문제풀이",
    parentRoute: ROUTES.ENGLISH_CORE,
    parentLabel: "영어 기초",
    breadcrumbs: [{ label: "홈", route: ROUTES.HOME }, { label: "영어", route: ROUTES.ENGLISH_HOME }, { label: "영어 기초", route: ROUTES.ENGLISH_CORE }, { label: "문제풀이", route: ROUTES.ENGLISH_CORE_PRACTICE }]
  },
  [ROUTES.MATH_GRADING]: {
    label: "보호자 채점",
    parentRoute: ROUTES.HOME,
    parentLabel: "홈",
    breadcrumbs: [{ label: "홈", route: ROUTES.HOME }, { label: "채점 대기", route: ROUTES.HOME }, { label: "보호자 채점", route: ROUTES.MATH_GRADING }]
  },
  [ROUTES.MATH_RESULT]: {
    label: "학습 결과",
    parentRoute: ROUTES.HOME,
    parentLabel: "홈",
    breadcrumbs: [{ label: "홈", route: ROUTES.HOME }, { label: "학습 결과", route: ROUTES.MATH_RESULT }]
  }
});

/**
 * 주어진 경로의 네비게이션 계층 메타데이터를 반환
 * @param {string} routePath
 * @param {Object} [context]
 * @returns {{
 *   homeRoute: string,
 *   parentRoute: string|null,
 *   parentLabel: string|null,
 *   currentLabel: string,
 *   breadcrumbs: Array<{ label: string, route: string }>
 * }}
 */
export function getNavigationHierarchy(routePath, context = {}) {
  const normPath = normalizePath(routePath);
  const matched = ROUTE_HIERARCHY_CONFIG[normPath];

  if (matched) {
    // 문맥(context)에 따른 동적 breadcrumb 라벨 보정 (예: 특정 워크북 제목)
    const breadcrumbs = [...matched.breadcrumbs];
    if (context.workbookTitle && breadcrumbs.length > 0) {
      const last = breadcrumbs[breadcrumbs.length - 1];
      if (last.route === ROUTES.WORKBOOK_DETAIL || last.route === ROUTES.WORKBOOK_READER) {
        last.label = context.workbookTitle;
      }
    }
    return {
      homeRoute: ROUTES.HOME,
      parentRoute: matched.parentRoute,
      parentLabel: matched.parentLabel,
      currentLabel: matched.label,
      breadcrumbs
    };
  }

  // 매칭되지 않는 라우트는 기본 홈 계층으로 안전 fallback
  return {
    homeRoute: ROUTES.HOME,
    parentRoute: normPath === ROUTES.HOME ? null : ROUTES.HOME,
    parentLabel: normPath === ROUTES.HOME ? null : "홈",
    currentLabel: "학습",
    breadcrumbs: [
      { label: "홈", route: ROUTES.HOME },
      { label: "학습", route: normPath }
    ]
  };
}

function escapeNavHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 전역 학습 네비게이션 DOM UI 갱신 함수 (SSOT)
 * @param {string} currentPath
 * @param {Object} [context]
 * @param {Object} [options]
 * @param {Document} [options.documentRef]
 */
export function updateGlobalLearningNav(currentPath, context = {}, options = {}) {
  const doc = options.documentRef || (typeof document !== "undefined" ? document : null);
  if (!doc) return;
  const navEl = doc.getElementById ? doc.getElementById("topbarNavActions") : doc.querySelector?.("#topbarNavActions");
  if (!navEl) return;

  const normPath = normalizePath(currentPath || "/");

  // Home 및 Learners 화면에서는 Topbar 네비게이션 버튼을 숨김 (루트/선택 화면)
  if (normPath === ROUTES.HOME || normPath === ROUTES.LEARNERS) {
    navEl.hidden = true;
    return;
  }

  const hierarchy = getNavigationHierarchy(normPath, context);
  navEl.hidden = false;

  const homeBtn = doc.getElementById ? doc.getElementById("globalNavHomeBtn") : doc.querySelector?.("#globalNavHomeBtn");
  const upBtn = doc.getElementById ? doc.getElementById("globalNavUpBtn") : doc.querySelector?.("#globalNavUpBtn");

  if (upBtn) {
    upBtn.disabled = !hierarchy.parentRoute;
    if (upBtn.dataset) upBtn.dataset.targetRoute = hierarchy.parentRoute || "";
    upBtn.title = hierarchy.parentLabel ? `${hierarchy.parentLabel}(으)로 이동` : "상위 단계로 이동";
  }

  if (homeBtn) {
    if (homeBtn.dataset) homeBtn.dataset.targetRoute = hierarchy.homeRoute || ROUTES.HOME;
  }
}

