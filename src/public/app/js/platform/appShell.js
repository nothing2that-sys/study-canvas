//+_+// Math Canvas Pro - 공통 앱 셸 관리자 (App Shell)
//+_+// SSOT Section 7 & 8 및 Phase F3 재검토 명세 준수
//+_+// - 상단 공통 네비게이션 및 학습자 상태 렌더링
//+_+// - 메인 라우트 뷰 전환 관리 (#platformRoot, #mathAppRoot 등)
//+_+// - 풀이/채점 세션 중 학습자 임의 변경 완전 차단 (안내 표시 후 이동 차단)

import { getActiveLearner } from "../learners/learnerQueries.js";
import { navigate, ROUTES, getCurrentRoute } from "./appRouter.js";

let domElements = {};
let isSessionActiveCallback = null;
let activeWindowRef = null;

//+_+// App Shell DOM 캐싱 및 이벤트 바인딩
export function initAppShell(options = {}) {
  const doc = options.documentRef || (typeof document !== "undefined" ? document : null);
  const win = options.windowRef || (typeof window !== "undefined" ? window : null);
  if (!doc) return;

  activeWindowRef = win;

  if (options.isSessionActive) {
    isSessionActiveCallback = options.isSessionActive;
  }

  domElements = {
    topbar: doc.querySelector(".topbar"),
    brandLink: doc.querySelector("#homeBrandLink"),
    activeLearnerBadge: doc.querySelector("#activeLearnerBadge"),
    activeLearnerAvatar: doc.querySelector("#activeLearnerAvatar"),
    activeLearnerName: doc.querySelector("#activeLearnerName"),
    switchLearnerBtn: doc.querySelector("#switchLearnerBtn"),

    //+_+// 메인 뷰 컨테이너들
    platformRoot: doc.querySelector("#platformRoot"),
    learnerSelectView: doc.querySelector("#learnerSelectView"),
    learnerHomeView: doc.querySelector("#learnerHomeView"),
    subjectHomeView: doc.querySelector("#subjectHomeView"),
    measurementLandingView: doc.querySelector("#measurementLandingView"),
    koreanLandingView: doc.querySelector("#koreanLandingView"),
    englishLandingView: doc.querySelector("#englishLandingView"),
    bookshelfView: doc.querySelector("#bookshelfView"),
    workbookDetailView: doc.querySelector("#workbookDetailView"),
    workbookReaderView: doc.querySelector("#workbookReaderView"),
    mathAppRoot: doc.querySelector("#mathAppRoot"),
    migrationErrorView: doc.querySelector("#migrationErrorView"),

    //+_+// 기존 수학 뷰들
    setupView: doc.querySelector("#setupView"),
    practiceView: doc.querySelector("#practiceView"),
    gradingView: doc.querySelector("#gradingView"),
    resultView: doc.querySelector("#resultView"),

    //+_+// 세션 종료/나가기 버튼
    abortSessionBtn: doc.querySelector("#abortSessionBtn")
  };

  //+_+// 1. 학습자 전환 버튼 이벤트 (활성 세션 중 변경 완전 차단)
  if (domElements.switchLearnerBtn) {
    domElements.switchLearnerBtn.onclick = () => {
      if (isSessionActiveCallback && isSessionActiveCallback()) {
        const message = "현재 학습 세션이 진행 중입니다. 학습자를 변경하려면 먼저 세션을 종료해야 합니다.";
        if (activeWindowRef && typeof activeWindowRef.alert === "function") {
          activeWindowRef.alert(message);
        } else {
          console.warn(`[AppShell] ${message}`);
        }
        return;
      }
      navigate(ROUTES.LEARNERS);
    };
  }

  //+_+// 2. 홈 브랜드 로고 클릭 이벤트 (Router 연동)
  if (domElements.brandLink) {
    domElements.brandLink.onclick = (e) => {
      e.preventDefault();
      if (isSessionActiveCallback && isSessionActiveCallback()) {
        const message = "진행 중인 학습 세션이 있습니다. 먼저 세션을 종료하거나 나가기를 눌러주세요.";
        if (activeWindowRef && typeof activeWindowRef.alert === "function") {
          activeWindowRef.alert(message);
        } else {
          console.warn(`[AppShell] ${message}`);
        }
        return;
      }
      navigate(ROUTES.HOME);
    };
  }
}

//+_+// 상단 헤더 학습자 정보 업데이트
export async function updateShellHeader(options = {}) {
  const activeLearner = options.learner !== undefined ? options.learner : await getActiveLearner();

  if (domElements.activeLearnerBadge) {
    if (activeLearner) {
      domElements.activeLearnerBadge.hidden = false;
      if (domElements.activeLearnerAvatar) {
        domElements.activeLearnerAvatar.textContent = activeLearner.avatar || "🌱";
      }
      if (domElements.activeLearnerName) {
        domElements.activeLearnerName.textContent = activeLearner.name || "학습자";
      }
    } else {
      domElements.activeLearnerBadge.hidden = true;
    }
  }

  //+_+// 풀이 또는 채점 중인 경우 상단 셸 최소화 스타일 조정
  const route = getCurrentRoute();
  const isPracticeMode = route === ROUTES.MATH_PRACTICE || route === ROUTES.MATH_MEASUREMENT_PRACTICE || route === ROUTES.MATH_FRACTION_PRACTICE || route === ROUTES.KOREAN_CORE_PRACTICE || route === ROUTES.ENGLISH_CORE_PRACTICE || route === ROUTES.MATH_GRADING;
  if (domElements.topbar) {
    if (isPracticeMode) {
      domElements.topbar.classList.add("topbar-compact");
    } else {
      domElements.topbar.classList.remove("topbar-compact");
    }
  }
}

//+_+// 라우트에 따른 뷰 표시/숨김 처리
export function renderRouteView(routePath) {
  const allViews = [
    domElements.learnerSelectView,
    domElements.learnerHomeView,
    domElements.subjectHomeView,
    domElements.measurementLandingView,
    domElements.koreanLandingView,
    domElements.englishLandingView,
    domElements.bookshelfView,
    domElements.workbookDetailView,
    domElements.workbookReaderView,
    domElements.migrationErrorView,
    domElements.setupView,
    domElements.practiceView,
    domElements.gradingView,
    domElements.resultView
  ];

  allViews.forEach((v) => {
    if (v) {
      v.hidden = true;
      v.classList.remove("active-view");
    }
  });

  const isMathRoute = routePath.startsWith("/math");
  const isPracticeRoute = routePath === ROUTES.MATH_PRACTICE || routePath === ROUTES.MATH_MEASUREMENT_PRACTICE || routePath === ROUTES.MATH_FRACTION_PRACTICE || routePath === ROUTES.KOREAN_CORE_PRACTICE || routePath === ROUTES.ENGLISH_CORE_PRACTICE;
  if (domElements.mathAppRoot) {
    domElements.mathAppRoot.hidden = (!isMathRoute && !isPracticeRoute) || routePath === ROUTES.MATH_MEASUREMENT;
  }
  if (domElements.platformRoot) {
    domElements.platformRoot.hidden = (isMathRoute && routePath !== ROUTES.MATH_HOME && routePath !== ROUTES.MATH_MEASUREMENT && routePath !== ROUTES.MATH_FRACTION) || isPracticeRoute;
  }

  switch (routePath) {
    case ROUTES.LEARNERS:
      if (domElements.platformRoot) domElements.platformRoot.hidden = false;
      if (domElements.learnerSelectView) {
        domElements.learnerSelectView.hidden = false;
        domElements.learnerSelectView.classList.add("active-view");
      }
      break;

    case ROUTES.HOME:
      if (domElements.platformRoot) domElements.platformRoot.hidden = false;
      if (domElements.learnerHomeView) {
        domElements.learnerHomeView.hidden = false;
        domElements.learnerHomeView.classList.add("active-view");
      }
      break;

    case ROUTES.BOOKSHELF:
      if (domElements.platformRoot) domElements.platformRoot.hidden = false;
      if (domElements.bookshelfView) {
        domElements.bookshelfView.hidden = false;
        domElements.bookshelfView.classList.add("active-view");
      }
      break;

    case ROUTES.WORKBOOK_DETAIL:
      if (domElements.platformRoot) domElements.platformRoot.hidden = false;
      if (domElements.workbookDetailView) {
        domElements.workbookDetailView.hidden = false;
        domElements.workbookDetailView.classList.add("active-view");
      }
      break;

    case ROUTES.WORKBOOK_READER:
      if (domElements.platformRoot) domElements.platformRoot.hidden = false;
      if (domElements.workbookReaderView) {
        domElements.workbookReaderView.hidden = false;
        domElements.workbookReaderView.classList.add("active-view");
      }
      break;

    case ROUTES.MATH_HOME:
      if (domElements.platformRoot) domElements.platformRoot.hidden = false;
      if (domElements.subjectHomeView) {
        domElements.subjectHomeView.hidden = false;
        domElements.subjectHomeView.classList.add("active-view");
      }
      break;

    case ROUTES.MATH_MEASUREMENT:
      if (domElements.platformRoot) domElements.platformRoot.hidden = false;
      if (domElements.measurementLandingView) {
        domElements.measurementLandingView.hidden = false;
        domElements.measurementLandingView.classList.add("active-view");
      }
      break;

    case ROUTES.KOREAN_HOME:
    case ROUTES.KOREAN_CORE:
      if (domElements.platformRoot) domElements.platformRoot.hidden = false;
      if (domElements.koreanLandingView) {
        domElements.koreanLandingView.hidden = false;
        domElements.koreanLandingView.classList.add("active-view");
      }
      break;

    case ROUTES.ENGLISH_HOME:
    case ROUTES.ENGLISH_CORE:
      if (domElements.platformRoot) domElements.platformRoot.hidden = false;
      if (domElements.englishLandingView) {
        domElements.englishLandingView.hidden = false;
        domElements.englishLandingView.classList.add("active-view");
      }
      break;

    case ROUTES.MATH_ARITHMETIC:
      if (domElements.mathAppRoot) domElements.mathAppRoot.hidden = false;
      if (domElements.setupView) {
        domElements.setupView.hidden = false;
        domElements.setupView.classList.add("active-view");
      }
      break;

    case ROUTES.MATH_PRACTICE:
    case ROUTES.MATH_MEASUREMENT_PRACTICE:
    case ROUTES.MATH_FRACTION_PRACTICE:
    case ROUTES.MATH_DECIMAL_PRACTICE:
    case ROUTES.KOREAN_CORE_PRACTICE:
    case ROUTES.ENGLISH_CORE_PRACTICE:
      if (domElements.mathAppRoot) domElements.mathAppRoot.hidden = false;
      if (domElements.practiceView) {
        domElements.practiceView.hidden = false;
        domElements.practiceView.classList.add("active-view");
      }
      break;

    case ROUTES.MATH_GRADING:
      if (domElements.mathAppRoot) domElements.mathAppRoot.hidden = false;
      if (domElements.gradingView) {
        domElements.gradingView.hidden = false;
        domElements.gradingView.classList.add("active-view");
      }
      break;

    case ROUTES.MATH_RESULT:
      if (domElements.mathAppRoot) domElements.mathAppRoot.hidden = false;
      if (domElements.resultView) {
        domElements.resultView.hidden = false;
        domElements.resultView.classList.add("active-view");
      }
      break;

    default:
      break;
  }
}

//+_+// 마이그레이션 실패 시 안전 화면 표시
export function showMigrationError(errorMessage, retryCallback) {
  if (domElements.platformRoot) domElements.platformRoot.hidden = false;
  if (domElements.mathAppRoot) domElements.mathAppRoot.hidden = true;

  if (domElements.migrationErrorView) {
    domElements.migrationErrorView.hidden = false;
    domElements.migrationErrorView.classList.add("active-view");

    const msgElem = domElements.migrationErrorView.querySelector("#migrationErrorMessage");
    if (msgElem) {
      msgElem.textContent = errorMessage || "기존 학습 기록을 준비하지 못했습니다.";
    }

    const retryBtn = domElements.migrationErrorView.querySelector("#migrationRetryBtn");
    if (retryBtn && typeof retryCallback === "function") {
      retryBtn.onclick = () => retryCallback();
    }
  }
}
