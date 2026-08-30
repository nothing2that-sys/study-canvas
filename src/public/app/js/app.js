import { generateQuestionSet, REFERENCE_CURRICULUM, mapToRefLevel, calculateCandidateCapacity } from "./mathGen.js";
import { createSession, SessionState, mistakeToQuestion, escapeHtml } from "./sessionEngine.js";
import { createQuestionTimer, formatTime, startSessionTimer } from "./timer.js";
import { getMultiplicationSteps, getDivisionSteps } from "./explainer.js";
import { createDrawingCanvas, InputProfile, resolveInputProfile, togglePenOnlyProfile } from "./canvasEngine.js";
import { saveSession, saveDraft, clearDraft, clearLearnerData, submitLearningSession, updateSubmissionGrading } from "./data/learningCommands.js";
import { getRecentSessions, getMistakes, getLearningStats, getCurriculumProgress, getDailyLearningMap, getCurrentStreak, getSessionsByDate, getDraft, getRecentAttempts, getSubmission, getSubmissionBySessionId, getPendingSubmissions } from "./data/learningQueries.js";
import { getActiveLearner, getActiveLearnerId, getLearners } from "./learners/learnerQueries.js";
import { selectLearner, createLearner, configureLearnerSessionGuard } from "./learners/learnerCommands.js";
import { bootstrapApp } from "./platform/appBootstrap.js";
import { navigate, replace, ROUTES, initRouter, addRouteListener, getCurrentRoute, resolveGuardedPath } from "./platform/appRouter.js";
import { initAppShell, updateShellHeader, renderRouteView } from "./platform/appShell.js";
import { initLearnerView, renderLearnerSelectView, renderLearnerHomeView, renderSubjectHomeView } from "./learners/learnerView.js";
import { playCorrectSound, playWrongSound, playFanfareSound, playClickSound, toggleSound, isSoundMuted } from "./sound.js";
import { launchConfetti } from "./confetti.js";
import { applyTheme, cycleTheme, getCurrentTheme, getThemeInfo } from "./theme.js";
import { setupKeyboardShortcuts } from "./shortcuts.js";
import { setupInteractionGuard, AppMode } from "./interactionGuard.js";
import { composeAdaptiveSession } from "./adaptiveEngine.js";
import { calculateStageMastery, analyzeWeaknesses } from "./masteryEngine.js";
import { createDraftSaveCoordinator, DRAFT_SCHEMA_VERSION, DraftSaveStatus, navigateWithDraftFlush } from "./draftEngine.js";
import { createUpdateCoordinator, waitForServiceWorkerControllerChange } from "./updateEngine.js";
import { createVisualViewportController, getPreferredScrollBehavior } from "./viewportEngine.js";
import { setupModalManager } from "./modalEngine.js";
import {
  canMutatePractice,
  applyStudentStrokeChange,
  performPracticeUndo,
  performPracticeRedo,
  performPracticeClear,
  performPracticeToolSelect,
  performPracticePageNav
} from "./practiceInteractionGuard.js";

// 앱 전역 인터랙션 가드 초기화
const interactionGuard = setupInteractionGuard(typeof document !== "undefined" ? document : null);
const modalManager = setupModalManager({ documentRef: document, interactionGuard });

// DOM 요소 캐싱 - 뷰 컨테이너
const setupView = document.querySelector("#setupView");
const practiceView = document.querySelector("#practiceView");
const gradingView = document.querySelector("#gradingView");
const resultView = document.querySelector("#resultView");

const themeToggleBtn = document.querySelector("#themeToggleBtn");
const themeIcon = document.querySelector("#themeIcon");
const themeLabel = document.querySelector("#themeLabel");
const soundToggleBtn = document.querySelector("#soundToggleBtn");
const soundIcon = document.querySelector("#soundIcon");
const soundLabel = document.querySelector("#soundLabel");
const shortcutsHelpBtn = document.querySelector("#shortcutsHelpBtn");
const shortcutsModal = document.querySelector("#shortcutsModal");
const shortcutsCloseBtn = document.querySelector("#shortcutsCloseBtn");
const confettiCanvas = document.querySelector("#confettiCanvas");

// 달력 & 스트릭 DOM 요소
const calendarMonthTitle = document.querySelector("#calendarMonthTitle");
const currentStreakText = document.querySelector("#currentStreakText");
const calPrevMonthBtn = document.querySelector("#calPrevMonthBtn");
const calTodayBtn = document.querySelector("#calTodayBtn");
const calNextMonthBtn = document.querySelector("#calNextMonthBtn");
const calendarDaysGrid = document.querySelector("#calendarDaysGrid");
const calendarSelectedDetails = document.querySelector("#calendarSelectedDetails");
const selectedDayTitle = document.querySelector("#selectedDayTitle");
const selectedDaySessionsList = document.querySelector("#selectedDaySessionsList");
const closeDayDetailsBtn = document.querySelector("#closeDayDetailsBtn");

let currentCalYear = new Date().getFullYear();
let currentCalMonth = new Date().getMonth(); // 0-indexed

// 1. 설정 뷰 요소
const form = document.querySelector("#practiceForm");
const queueSection = document.querySelector("#queueSection");
const questionPreview = document.querySelector("#questionPreview");
const queueNote = document.querySelector("#queueNote");
const engineState = document.querySelector("#engineState");
const multiplierMode = document.querySelector("#multiplierMode");
const modeValueLabel = document.querySelector("#modeValueLabel");
const modeValueText = document.querySelector("#modeValueText");
const modeValue = document.querySelector("#modeValue");
const multiplyOptions = document.querySelector("#multiplyOptions");
const networkStatus = document.querySelector("#networkStatus");
const startFromQueueBtn = document.querySelector("#startFromQueueBtn");
const abortSessionBtn = document.querySelector("#abortSessionBtn");
const homeBrandLink = document.querySelector("#homeBrandLink");

// 레퍼런스 교육과정 & 커스텀 수준 매핑 요소
const refLabel1 = document.querySelector("#refLabel1");
const refLabel2 = document.querySelector("#refLabel2");
const refLabel3 = document.querySelector("#refLabel3");
const refLabel4 = document.querySelector("#refLabel4");
const refLabel5 = document.querySelector("#refLabel5");
const refLabel6 = document.querySelector("#refLabel6");
const curriculumLevelCard = document.querySelector("#curriculumLevelCard");
const levelIndicatorBadge = document.querySelector("#levelIndicatorBadge");
const levelNameText = document.querySelector("#levelNameText");
const gaugeFill = document.querySelector("#gaugeFill");
const levelDescText = document.querySelector("#levelDescText");

const customDigitsCard = document.querySelector("#customDigitsCard");
const customDigitsLegend = document.querySelector("#customDigitsLegend");
const mulDigitsPair = document.querySelector("#mulDigitsPair");
const divDigitsPair = document.querySelector("#divDigitsPair");

const customCountWrap = document.querySelector("#customCountWrap");
const customCountInput = document.querySelector("#customCountInput");
const customLayoutWrap = document.querySelector("#customLayoutWrap");
const customColsSelect = document.querySelector("#customColsSelect");
const customRowsSelect = document.querySelector("#customRowsSelect");
const customGridResultText = document.querySelector("#customGridResultText");

const summaryLevel = document.querySelector("#summaryLevel");
const summaryCount = document.querySelector("#summaryCount");
const summaryPageSize = document.querySelector("#summaryPageSize");

// 대시보드 및 로드맵 트래커 요소 (Phase 4 & Curriculum Tracker)
const dashTotalQuestions = document.querySelector("#dashTotalQuestions");
const dashAvgAccuracy = document.querySelector("#dashAvgAccuracy");
const dashTotalTime = document.querySelector("#dashTotalTime");
const dashMistakeCount = document.querySelector("#dashMistakeCount");
const mistakeBanner = document.querySelector("#mistakeBanner");
const mistakeBadgeCount = document.querySelector("#mistakeBadgeCount");
const startMistakeSessionBtn = document.querySelector("#startMistakeSessionBtn");
const recentSessionsList = document.querySelector("#recentSessionsList");
const clearHistoryBtn = document.querySelector("#clearHistoryBtn");

// 과거 세션 상세 다시보기 모달
const sessionDetailModal = document.querySelector("#sessionDetailModal");
const detailModalTag = document.querySelector("#detailModalTag");
const detailModalTitle = document.querySelector("#detailModalTitle");
const sessionDetailCloseBtn = document.querySelector("#sessionDetailCloseBtn");
const sessionDetailCloseBtnBottom = document.querySelector("#sessionDetailCloseBtnBottom");
const detailModalSummary = document.querySelector("#detailModalSummary");
const detailModalList = document.querySelector("#detailModalList");
const modalViewCompactBtn = document.querySelector("#modalViewCompactBtn");
const modalViewDetailBtn = document.querySelector("#modalViewDetailBtn");
let currentModalSession = null;
let currentModalViewMode = "detail";

// 결과 화면 보기 모드 탭
const resultViewCompactBtn = document.querySelector("#resultViewCompactBtn");
const resultViewDetailBtn = document.querySelector("#resultViewDetailBtn");

const roadmapMulTab = document.querySelector("#roadmapMulTab");
const roadmapDivTab = document.querySelector("#roadmapDivTab");
const roadmapGrid = document.querySelector("#roadmapGrid");

// 2. 워크시트 풀이 뷰 요소
const practiceLevelBadge = document.querySelector("#practiceLevelBadge");
const practicePageBadge = document.querySelector("#practicePageBadge");
const practiceQuestionRange = document.querySelector("#practiceQuestionRange");
const printWorksheetBtn = document.querySelector("#printWorksheetBtn");
const printAnswerKeyBtn = document.querySelector("#printAnswerKeyBtn");
const printTitleText = document.querySelector("#printTitleText");
const printLevelTag = document.querySelector("#printLevelTag");
const timerText = document.querySelector("#timerText");
const draftSaveStatus = document.querySelector("#draftSaveStatus");
const draftSaveStatusText = document.querySelector("#draftSaveStatusText");
const retryDraftSaveBtn = document.querySelector("#retryDraftSaveBtn");
const gradingDraftSaveStatus = document.querySelector("#gradingDraftSaveStatus");
const gradingDraftSaveStatusText = document.querySelector("#gradingDraftSaveStatusText");
const retryGradingDraftSaveBtn = document.querySelector("#retryGradingDraftSaveBtn");
const sessionProgressBar = document.querySelector("#sessionProgressBar");
const worksheetGrid = document.querySelector("#worksheetGrid");
const prevPageBtn = document.querySelector("#prevPageBtn");
const nextPageBtn = document.querySelector("#nextPageBtn");
const pausePracticeBtn = document.querySelector("#pausePracticeBtn");
const pageIndicatorText = document.querySelector("#pageIndicatorText");
const submitPracticeBtn = document.querySelector("#submitPracticeBtn");
const practiceDock = document.querySelector("#practiceDock");
const dockProgress = document.querySelector("#dockProgress");

// 펜 도구바 요소
const penToolbar = document.querySelector("#penToolbar");
const colorChips = document.querySelectorAll(".color-chip-btn");
const widthChips = document.querySelectorAll(".width-chip-btn");
const pencilOnlyToggleBtn = document.querySelector("#pencilOnlyToggleBtn");
const pencilModeText = document.querySelector("#pencilModeText");
const penModeBtn = document.querySelector("#penModeBtn");
const eraserToggleBtn = document.querySelector("#eraserToggleBtn");
const undoBtn = document.querySelector("#undoBtn");
const redoBtn = document.querySelector("#redoBtn");
const clearAllCanvasBtn = document.querySelector("#clearAllCanvasBtn");

let currentFocusedProblemIndex = 0;

//+_+// 명시적 입력 프로필 결정 (기기 환경 및 사용자 저장값 반영)
function resolveDefaultInputProfile() {
  try {
    return resolveInputProfile({
      savedProfile: localStorage.getItem("math_canvas_input_profile"),
      legacyPencilOnly: localStorage.getItem("math_canvas_pencil_only"),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      maxTouchPoints: typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0,
      hasTouchStart: typeof window !== "undefined" && "ontouchstart" in window
    });
  } catch (_) {
    return InputProfile.DESKTOP_MOUSE_PEN;
  }
}

let currentInputProfile = resolveDefaultInputProfile();

// 3. 채점자 평가 뷰 요소
const gradedCountText = document.querySelector("#gradedCountText");
const gradedCorrectText = document.querySelector("#gradedCorrectText");
const gradedWrongText = document.querySelector("#gradedWrongText");
const toggleAnswersBtn = document.querySelector("#toggleAnswersBtn");
const toggleAnswersText = document.querySelector("#toggleAnswersText");
const gradeAllCorrectBtn = document.querySelector("#gradeAllCorrectBtn");
const gradingGrid = document.querySelector("#gradingGrid");
const finishGradingBtn = document.querySelector("#finishGradingBtn");
const gradingRemainingText = document.querySelector("#gradingRemainingText");
const gradingFinishHint = document.querySelector("#gradingFinishHint");
const largeProblemToggleBtn = document.querySelector("#largeProblemToggleBtn");

// 4. 결과 뷰 요소
const statAccuracy = document.querySelector("#statAccuracy");
const statAccuracyDetail = document.querySelector("#statAccuracyDetail");
const statTotalTime = document.querySelector("#statTotalTime");
const statAvgTime = document.querySelector("#statAvgTime");
const statCorrectCount = document.querySelector("#statCorrectCount");
const statWrongCount = document.querySelector("#statWrongCount");
const resultsDetailList = document.querySelector("#resultsDetailList");
const restartSessionBtn = document.querySelector("#restartSessionBtn");
const goHomeBtn = document.querySelector("#goHomeBtn");

// 모달 요소
const confirmModal = document.querySelector("#confirmModal");
const modalCancelBtn = document.querySelector("#modalCancelBtn");
const modalConfirmBtn = document.querySelector("#modalConfirmBtn");

// 앱 내부 상태
let currentSession = null;
let currentQuestions = null;
let lastSessionConfig = null;
let hideAnswersInGrading = false;
let currentDraftCreatedAt = Date.now();
let currentGradingQuestionId = null;

// 캔버스 필기 상태
let currentPenColor = "#173f35";
let currentPenWidth = 2.5;
let currentIsEraser = false;
const questionStrokesMap = new Map(); // questionId -> strokes array
const gradingStrokesMap = new Map();
const gradingResultsMap = new Map();
let activeCanvasInstances = new Map(); // questionId -> canvas instance
let gradingCanvasInstances = [];
let gradingRenderRevision = 0;
let lastActiveCanvasId = null;

// 정밀 타이머 인스턴스
const questionTimer = createQuestionTimer({
  onTick: (elapsedMs) => {
    timerText.textContent = formatTime(elapsedMs);
  }
});

function mapToObject(map) {
  return Object.fromEntries(Array.from(map.entries()));
}

function collectGradingResults() {
  if (!currentSession) return {};
  const results = mapToObject(gradingResultsMap);
  currentSession.questions.forEach((question) => {
    if (question.grade) results[question.id] = question.grade;
  });
  return results;
}

function captureDraftSnapshot() {
  if (!currentSession || currentSession.state === SessionState.SESSION_COMPLETE) return null;
  const now = Date.now();
  return {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    appBuildId: "20260830T112655307Z-00ed65a",
    sessionId: currentSession.id,
    sessionType: currentSession.state === SessionState.GRADING_ACTIVE ? "grading" : "practice",
    sessionState: currentSession.state,
    config: lastSessionConfig || {},
    questions: currentQuestions,
    currentPageIndex: currentSession.currentPageIndex,
    studentStrokesMap: mapToObject(questionStrokesMap),
    gradingStrokesMap: mapToObject(gradingStrokesMap),
    gradingResults: collectGradingResults(),
    answersHidden: hideAnswersInGrading,
    totalElapsedMs: questionTimer.getElapsedMs(),
    perQuestionElapsedMs: currentSession.getQuestionSolveTimes?.() || {},
    inputProfile: currentInputProfile,
    penColor: currentPenColor,
    penWidth: currentPenWidth,
    isEraser: currentIsEraser,
    eraserRadius: 14,
    createdAt: currentDraftCreatedAt,
    updatedAt: now
  };
}

function updateDraftSaveStatus(status) {
  const labels = {
    [DraftSaveStatus.IDLE]: "저장 대기",
    [DraftSaveStatus.SCHEDULED]: "저장 예정",
    [DraftSaveStatus.SAVING]: "저장 중",
    [DraftSaveStatus.SAVED]: "저장됨",
    [DraftSaveStatus.FAILED]: "저장 실패"
  };
  const targets = [
    [draftSaveStatus, draftSaveStatusText, retryDraftSaveBtn],
    [gradingDraftSaveStatus, gradingDraftSaveStatusText, retryGradingDraftSaveBtn]
  ];
  targets.forEach(([container, text, retry]) => {
    if (!container || !text) return;
    container.hidden = !currentSession;
    container.dataset.status = status;
    text.textContent = labels[status] || "저장 대기";
    if (retry) retry.hidden = status !== DraftSaveStatus.FAILED;
  });
}

export const draftCoordinator = createDraftSaveCoordinator({
  captureSnapshot: captureDraftSnapshot,
  save: saveDraft,
  onStatusChange: updateDraftSaveStatus
});

export function triggerDraftSave() {
  draftCoordinator.schedule();
}

export async function flushDraftSave() {
  return draftCoordinator.flush();
}

// 생명주기 이벤트(hidden, pagehide) 시 즉시 flush
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    flushDraftSave().catch(() => {});
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      flushDraftSave().catch(() => {});
    }
  });
}

// 뷰 전환
function switchView(targetView, updateRoute = true) {
  [setupView, practiceView, gradingView, resultView].forEach((view) => {
    if (!view) return;
    const isActive = view === targetView;
    view.hidden = !isActive;
    view.classList.toggle("active-view", isActive);
  });

  const isPracticing = targetView === practiceView;
  if (abortSessionBtn) abortSessionBtn.hidden = !isPracticing;

  if (targetView === setupView) {
    interactionGuard.setAppMode(AppMode.SETUP);
    if (updateRoute && getCurrentRoute() !== ROUTES.MATH_ARITHMETIC) navigate(ROUTES.MATH_ARITHMETIC);
  } else if (targetView === practiceView) {
    interactionGuard.setAppMode(AppMode.PRACTICE);
    if (updateRoute && getCurrentRoute() !== ROUTES.MATH_PRACTICE) navigate(ROUTES.MATH_PRACTICE);
  } else if (targetView === gradingView) {
    interactionGuard.setAppMode(AppMode.GRADING);
    if (updateRoute && getCurrentRoute() !== ROUTES.MATH_GRADING) navigate(ROUTES.MATH_GRADING);
  } else if (targetView === resultView) {
    interactionGuard.setAppMode(AppMode.RESULT);
    if (updateRoute && getCurrentRoute() !== ROUTES.MATH_RESULT) navigate(ROUTES.MATH_RESULT);
  }

  if (typeof window !== "undefined") {
    window.scrollTo({ top: 0, behavior: getPreferredScrollBehavior() });
  }
}

function selectedValue(name) {
  if (!form || !form.elements) return "";
  const el = form.elements[name];
  return el ? el.value : "";
}

function getFormConfig() {
  const operation = selectedValue("operation");
  const difficulty = selectedValue("difficulty");
  const countPreset = selectedValue("countPreset") || "20";
  const customCountVal = customCountInput ? (Number(customCountInput.value) || 15) : 15;
  const count = countPreset === "custom" ? Math.max(1, Math.min(100, customCountVal)) : (Number(countPreset) || 20);

  const layoutPreset = selectedValue("layoutPreset") || "2x2";
  let cols = 2;
  let rows = 2;
  let pageSize = 4;

  if (layoutPreset === "custom") {
    cols = customColsSelect ? (Number(customColsSelect.value) || 2) : 2;
    rows = customRowsSelect ? (Number(customRowsSelect.value) || 3) : 3;
    pageSize = cols * rows;
  } else {
    const parts = layoutPreset.split("x").map(Number);
    cols = parts[0] || 2;
    rows = parts[1] || 2;
    pageSize = cols * rows;
  }

  const mathFormat = selectedValue("mathFormat") || "vertical";

  const options = {
    operation,
    difficulty,
    mathFormat,
    countPreset,
    customCount: customCountVal,
    count,
    layoutPreset,
    customCols: cols,
    customRows: rows,
    cols,
    rows,
    pageSize
  };

  // 표준 레퍼런스 교육과정 6단계 (ref_1 ~ ref_6) 자동 자릿수 세팅 (옵션에 aDigits/bDigits 전달하되 difficulty는 보존)
  if (difficulty.startsWith("ref_")) {
    const lvl = Number(difficulty.replace("ref_", "")) || 1;
    const refItem = REFERENCE_CURRICULUM[operation]?.[lvl - 1];
    if (refItem) {
      if (operation === "mul") {
        options.aDigits = refItem.aDigits;
        options.bDigits = refItem.bDigits;
        options.refLevelCode = refItem.code;
      } else {
        options.dividendDigits = refItem.dividendDigits;
        options.divisorDigits = refItem.divisorDigits;
        options.refLevelCode = refItem.code;
      }
    }
  } else if (difficulty === "custom") {
    if (operation === "mul") {
      options.aDigits = Number(selectedValue("aDigits")) || 2;
      options.bDigits = Number(selectedValue("bDigits")) || 1;
    } else {
      options.dividendDigits = Number(selectedValue("dividendDigits")) || 3;
      options.divisorDigits = Number(selectedValue("divisorDigits")) || 1;
    }
  }

  if (operation === "mul") {
    options.multiplierMode = multiplierMode.value;
    if (multiplierMode.value === "fixed") options.fixedMultiplier = Number(modeValue.value);
    if (multiplierMode.value === "multiple") options.multipleBase = Number(modeValue.value);
  }

  return options;
}

const SETTINGS_STORAGE_KEY = "math_canvas_last_config";

function saveFormSettings() {
  try {
    const config = getFormConfig();
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {}
}

function restoreFormSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!saved) return;
    const config = JSON.parse(saved);

    // 1. 연산 선택
    if (config.operation && form.elements["operation"]) {
      form.elements["operation"].value = config.operation;
    }
    // 2. 단계 선택
    if (config.difficulty && form.elements["difficulty"]) {
      form.elements["difficulty"].value = config.difficulty;
    }
    // 2-1. 수식 표기 방식 선택 (세로셈 / 가로셈)
    if (config.mathFormat && form.elements["mathFormat"]) {
      form.elements["mathFormat"].value = config.mathFormat;
    }
    // 3. 총 문제 수 프리셋 및 직접 입력
    if (config.countPreset && form.elements["countPreset"]) {
      form.elements["countPreset"].value = config.countPreset;
    }
    if (config.customCount && customCountInput) {
      customCountInput.value = config.customCount;
    }
    // 4. 한 화면 문제 수 및 배치 프리셋 & 직접 행x열
    if (config.layoutPreset && form.elements["layoutPreset"]) {
      form.elements["layoutPreset"].value = config.layoutPreset;
    }
    if (config.customCols && customColsSelect) {
      customColsSelect.value = String(config.customCols);
    }
    if (config.customRows && customRowsSelect) {
      customRowsSelect.value = String(config.customRows);
    }
    // 5. 자릿수 직접 설정
    if (config.aDigits && form.elements["aDigits"]) form.elements["aDigits"].value = String(config.aDigits);
    if (config.bDigits && form.elements["bDigits"]) form.elements["bDigits"].value = String(config.bDigits);
    if (config.dividendDigits && form.elements["dividendDigits"]) form.elements["dividendDigits"].value = String(config.dividendDigits);
    if (config.divisorDigits && form.elements["divisorDigits"]) form.elements["divisorDigits"].value = String(config.divisorDigits);

    // 6. 곱셈 특수 조건
    if (config.multiplierMode && multiplierMode) multiplierMode.value = config.multiplierMode;
    if (config.fixedMultiplier && modeValue) modeValue.value = config.fixedMultiplier;
    if (config.multipleBase && modeValue) modeValue.value = config.multipleBase;
  } catch (e) {}
}

function updateReferenceCurriculumUI() {
  const config = getFormConfig();
  const op = config.operation === "div" ? "div" : "mul";
  const curriculum = REFERENCE_CURRICULUM[op];

  // 1. 라디오 버튼 6단계 라벨 텍스트 갱신 (예시 문제 포함)
  if (refLabel1 && curriculum[0]) refLabel1.textContent = `${curriculum[0].example} (${curriculum[0].name})`;
  if (refLabel2 && curriculum[1]) refLabel2.textContent = `${curriculum[1].example} (${curriculum[1].name})`;
  if (refLabel3 && curriculum[2]) refLabel3.textContent = `${curriculum[2].example} (${curriculum[2].name})`;
  if (refLabel4 && curriculum[3]) refLabel4.textContent = `${curriculum[3].example} (${curriculum[3].name})`;
  if (refLabel5 && curriculum[4]) refLabel5.textContent = `${curriculum[4].example} (${curriculum[4].name})`;
  if (refLabel6 && curriculum[5]) refLabel6.textContent = `${curriculum[5].example} (${curriculum[5].name})`;

  // 2. 현재 설정의 로드맵 수준 계산
  let currentLevelInfo;
  const rawDifficulty = selectedValue("difficulty") || "ref_2";

  if (rawDifficulty.startsWith("ref_")) {
    const lvl = Number(rawDifficulty.replace("ref_", "")) || 2;
    currentLevelInfo = curriculum[lvl - 1] || curriculum[1];
  } else {
    // 커스텀 자릿수 매핑
    const a = op === "mul" ? (Number(selectedValue("aDigits")) || 2) : (Number(selectedValue("dividendDigits")) || 3);
    const b = op === "mul" ? (Number(selectedValue("bDigits")) || 1) : (Number(selectedValue("divisorDigits")) || 1);
    currentLevelInfo = mapToRefLevel(op, a, b);
  }

  if (levelIndicatorBadge) {
    levelIndicatorBadge.textContent = `🌟 Lv.${currentLevelInfo.level} · ${currentLevelInfo.name}`;
  }
  if (levelNameText) {
    levelNameText.textContent = `대표 예시: ${currentLevelInfo.example || ""}`;
  }
  if (levelDescText) {
    levelDescText.textContent = currentLevelInfo.desc;
  }

  // 3. 게이지 바 갱신 (1~6단계)
  if (gaugeFill) {
    const percent = Math.min(100, Math.max(10, ((currentLevelInfo.level - 1) / 5) * 100));
    gaugeFill.style.width = `${percent}%`;
  }
  const steps = document.querySelectorAll(".gauge-step");
  steps.forEach((step) => {
    const stepNum = Number(step.getAttribute("data-step"));
    step.classList.toggle("active", stepNum <= currentLevelInfo.level);
    step.classList.toggle("current", stepNum === currentLevelInfo.level);
  });
}

let currentRoadmapOp = "mul";

async function renderCurriculumRoadmap(op = currentRoadmapOp) {
  currentRoadmapOp = op;
  if (!roadmapGrid) return;

  if (roadmapMulTab) roadmapMulTab.classList.toggle("active", op === "mul");
  if (roadmapDivTab) roadmapDivTab.classList.toggle("active", op === "div");

  const progress = await getCurriculumProgress();
  const curriculum = REFERENCE_CURRICULUM[op];
  const list = progress[op] || [];

  // 가장 최근에 풀었던 세션의 레벨 찾기
  let latestLevel = null;
  try {
    const recentSessions = await getRecentSessions(20);
    const matchingSession = recentSessions.find((s) => s.operation === op);
    if (matchingSession && matchingSession.results && matchingSession.results.length > 0) {
      const firstLevelCode = matchingSession.results[0].level;
      const matchedItem = curriculum.find((c) => c.code === firstLevelCode);
      if (matchedItem) {
        latestLevel = matchedItem.level;
      }
    }
  } catch (e) {
    console.warn("최근 세션 조회 실패:", e);
  }

  roadmapGrid.innerHTML = curriculum.map((item, idx) => {
    const stat = list[idx] || { solved: 0, correct: 0, accuracy: 0, status: "unstarted" };
    const isRecent = item.level === latestLevel;

    let statusText = "🌱 시작 전";
    let statusClass = "unstarted";
    if (stat.status === "mastered") {
      statusText = "⭐ 마스터";
      statusClass = "mastered";
    } else if (stat.status === "learning") {
      statusText = "🏃 연습 중";
      statusClass = "learning";
    }

    const digitInfo = op === "mul" ? `${item.aDigits}자리 × ${item.bDigits}자리` : `${item.dividendDigits}자리 ÷ ${item.divisorDigits}자리`;

    return `
      <div class="roadmap-level-card is-${statusClass} ${isRecent ? "is-recent" : ""}" data-ref-level="${item.level}" data-op="${op}" title="클릭하여 Lv.${item.level} (${item.name}) 문제 풀기 선택">
        ${isRecent ? `<span class="recent-ribbon">🕒 최근 학습</span>` : ""}
        <div class="level-top-row">
          <span class="level-code-badge">Lv.${item.level}</span>
          <span class="mastery-status-chip ${statusClass}">${statusText}</span>
        </div>
        <strong class="level-title">${item.name}</strong>
        <span class="level-detail-tag">${item.example} · ${digitInfo}</span>
        <div class="level-stats-row">
          <span>푼 문제: <strong>${stat.solved}개</strong></span>
          <span>정답률: <strong>${stat.accuracy}%</strong></span>
        </div>
      </div>
    `;
  }).join("");

  // 카드 클릭 시 해당 레벨로 설정 선택 지원
  roadmapGrid.querySelectorAll(".roadmap-level-card").forEach((card) => {
    card.addEventListener("click", () => {
      const lvl = card.getAttribute("data-ref-level");
      const cardOp = card.getAttribute("data-op");
      if (form?.elements["operation"]) form.elements["operation"].value = cardOp;
      if (form?.elements["difficulty"]) form.elements["difficulty"].value = `ref_${lvl}`;
      updateSummary();
      updateModeInput();
      updateReferenceCurriculumUI();
      saveFormSettings();
    });
  });
}

function updateSummary() {
  const config = getFormConfig();

  // 커스텀 문제 수 영역 토글
  if (customCountWrap) {
    customCountWrap.hidden = (config.countPreset !== "custom");
  }

  // 커스텀 행x열 영역 토글 및 텍스트 갱신
  if (customLayoutWrap) {
    customLayoutWrap.hidden = (config.layoutPreset !== "custom");
  }
  if (customGridResultText) {
    const cols = customColsSelect ? customColsSelect.value : "2";
    const rows = customRowsSelect ? customRowsSelect.value : "3";
    customGridResultText.textContent = `한 화면 ${Number(cols) * Number(rows)}문제 (${cols}열 × ${rows}행)`;
  }

  // 직접 설정 여부에 따른 UI 토글
  const isCustom = config.difficulty === "custom";
  if (customDigitsCard) customDigitsCard.hidden = !isCustom;
  if (mulDigitsPair) mulDigitsPair.hidden = !isCustom || config.operation !== "mul";
  if (divDigitsPair) divDigitsPair.hidden = !isCustom || config.operation !== "div";
  if (multiplyOptions) multiplyOptions.hidden = config.operation !== "mul";

  if (customDigitsLegend) {
    customDigitsLegend.textContent = config.operation === "mul" ? "곱셈 자릿수 직접 선택 (커스텀)" : "나눗셈 자릿수 직접 선택 (커스텀)";
  }

  let levelText = "M2";
  const rawDifficulty = selectedValue("difficulty") || "ref_2";
  const op = config.operation === "div" ? "div" : "mul";
  const curriculum = REFERENCE_CURRICULUM[op];

  if (rawDifficulty.startsWith("ref_")) {
    const lvl = Number(rawDifficulty.replace("ref_", "")) || 2;
    const item = curriculum[lvl - 1] || curriculum[1];
    levelText = `Lv.${lvl} (${item.code} ${item.name})`;
  } else if (isCustom) {
    if (config.operation === "mul") {
      const a = selectedValue("aDigits") || "2";
      const b = selectedValue("bDigits") || "1";
      const mapped = mapToRefLevel("mul", a, b);
      levelText = `${a}자리 × ${b}자리 (Lv.${mapped.level})`;
    } else {
      const div = selectedValue("dividendDigits") || "3";
      const dvr = selectedValue("divisorDigits") || "1";
      const mapped = mapToRefLevel("div", div, dvr);
      levelText = `${div}자리 ÷ ${dvr}자리 (Lv.${mapped.level})`;
    }
  } else {
    levelText = "Lv.2";
  }

  if (summaryLevel) summaryLevel.textContent = levelText;
  if (summaryCount) summaryCount.textContent = `${config.count}문제`;
  if (summaryPageSize) summaryPageSize.textContent = `${config.cols}×${config.rows} (${config.pageSize}개)`;

  updateReferenceCurriculumUI();
  saveFormSettings();
}

async function loadDashboardStats() {
  try {
    const stats = await getLearningStats();
    if (dashTotalQuestions) dashTotalQuestions.textContent = `${stats.totalQuestions}개`;
    if (dashAvgAccuracy) dashAvgAccuracy.textContent = `${stats.averageAccuracy}%`;
    if (dashTotalTime) dashTotalTime.textContent = formatTime(stats.totalSolveTimeMs, "korean");
    if (dashMistakeCount) dashMistakeCount.textContent = `${stats.mistakeCount}개`;

    if (mistakeBanner) {
      mistakeBanner.hidden = (stats.mistakeCount === 0);
      if (mistakeBadgeCount) mistakeBadgeCount.textContent = String(stats.mistakeCount);
    }

    if (recentSessionsList) {
      const sessions = await getRecentSessions(10);
      if (sessions.length === 0) {
        recentSessionsList.innerHTML = `<div class="empty-sessions-note">아직 완료된 연습 기록이 없습니다. 문제를 풀고 실력을 기록해 보세요!</div>`;
      } else {
        recentSessionsList.innerHTML = sessions.map((s, idx) => {
          const dateStr = new Date(s.completedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
          const op = s.operation === "div" ? "나눗셈" : "곱셈";
          return `
            <div class="session-history-item" data-session-idx="${idx}" title="클릭하여 문제별 상세 결과 다시보기">
              <div class="session-history-main">
                <strong>${op} ${s.totalQuestions}문제 <small style="font-weight:normal; color:var(--accent);">🔍 상세보기</small></strong>
                <small>${dateStr}</small>
              </div>
              <div class="session-history-stats">
                <span class="session-acc-badge ${s.accuracyRate >= 80 ? "high" : "low"}">${s.accuracyRate}% 정답</span>
                <span class="session-time-text">${formatTime(s.totalSolveTimeMs, "korean")}</span>
              </div>
            </div>
          `;
        }).join("");

        // 세션 아이템 클릭 이벤트 바인딩
        recentSessionsList.querySelectorAll(".session-history-item").forEach((item) => {
          item.addEventListener("click", () => {
            const idx = Number(item.getAttribute("data-session-idx"));
            if (sessions[idx]) {
              showSessionDetail(sessions[idx]);
            }
          });
        });
      }
    }

    // 🌟 6단계 교육과정 로드맵 트래커 렌더링
    await renderCurriculumRoadmap(currentRoadmapOp);

    // 🌟 월간 학습 달력 & 연속 열공 스트릭 트래커 렌더링
    const streakInfo = await getCurrentStreak();
    if (currentStreakText) {
      if (streakInfo.currentStreak > 0) {
        currentStreakText.textContent = `${streakInfo.currentStreak}일 연속 열공 중! 🔥`;
      } else {
        currentStreakText.textContent = "오늘 첫 연습을 시작해보세요! 🚀";
      }
    }
    await renderStudyCalendar(currentCalYear, currentCalMonth);
  } catch (e) {
    console.error("대시보드 통계 로드 실패:", e);
  }
}

async function renderStudyCalendar(year = currentCalYear, month = currentCalMonth) {
  currentCalYear = year;
  currentCalMonth = month;

  if (!calendarDaysGrid || !calendarMonthTitle) return;

  calendarMonthTitle.textContent = `${year}년 ${month + 1}월`;

  const dailyMap = await getDailyLearningMap();

  // 이번 달의 첫 날 요일과 총 일수 계산
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0(일) ~ 6(토)
  const lastDate = new Date(year, month + 1, 0).getDate(); // 28 ~ 31

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();

  let daysHtml = "";

  // 1. 첫 날 앞 빈 칸
  for (let i = 0; i < firstDayOfWeek; i++) {
    daysHtml += `<div class="calendar-day empty-day"></div>`;
  }

  // 2. 1일부터 말일까지
  for (let d = 1; d <= lastDate; d++) {
    const monthStr = String(month + 1).padStart(2, "0");
    const dayStr = String(d).padStart(2, "0");
    const dateKey = `${year}-${monthStr}-${dayStr}`;

    const isToday = isCurrentMonth && d === todayDate;
    const entry = dailyMap.get(dateKey);
    const hasStudy = Boolean(entry && entry.sessionCount > 0);

    const studyBadgeHtml = hasStudy
      ? `<div class="cal-study-badge" title="${entry.totalQuestions}문제 (${entry.accuracy}% 정답)">
           <span class="cal-dot"></span>
           <span class="cal-q-count">${entry.totalQuestions}개</span>
         </div>`
      : "";

    daysHtml += `
      <div class="calendar-day ${hasStudy ? "has-study" : ""} ${isToday ? "is-today" : ""}" data-date="${dateKey}" ${hasStudy ? 'title="클릭하여 이 날의 학습 기록 보기"' : ""}>
        <span class="day-num">${d}</span>
        ${studyBadgeHtml}
      </div>
    `;
  }

  calendarDaysGrid.innerHTML = daysHtml;

  // 날짜 클릭 이벤트 바인딩
  calendarDaysGrid.querySelectorAll(".calendar-day.has-study").forEach((dayEl) => {
    dayEl.addEventListener("click", () => {
      const dateKey = dayEl.getAttribute("data-date");
      const entry = dailyMap.get(dateKey);
      if (entry) {
        showCalendarDayDetails(dateKey, entry);
      }
    });
  });
}

function showCalendarDayDetails(dateKey, entry) {
  if (!calendarSelectedDetails || !selectedDayTitle || !selectedDaySessionsList) return;

  const parts = dateKey.split("-").map(Number);
  selectedDayTitle.textContent = `📅 ${parts[1]}월 ${parts[2]}일 학습 기록 (${entry.sessionCount}회 · ${entry.totalQuestions}문제)`;

  selectedDaySessionsList.innerHTML = entry.sessions.map((s, idx) => {
    const timeStr = new Date(s.completedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    const op = s.operation === "div" ? "나눗셈" : "곱셈";
    return `
      <div class="day-session-card">
        <div class="day-session-info">
          <strong>${op} ${s.totalQuestions}문제 (<span class="day-acc-rate ${s.accuracyRate >= 80 ? "high" : "low"}">${s.accuracyRate}% 정답</span>)</strong>
          <small>${timeStr} · 풀이 시간 ${formatTime(s.totalSolveTimeMs, "korean")}</small>
        </div>
        <button type="button" class="view-session-btn" data-session-idx="${idx}">🔍 상세보기</button>
      </div>
    `;
  }).join("");

  selectedDaySessionsList.querySelectorAll(".view-session-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-session-idx"));
      if (entry.sessions[idx]) {
        showSessionDetail(entry.sessions[idx]);
      }
    });
  });

  calendarSelectedDetails.hidden = false;
}

let modalReviewCanvasInstances = new Map();

function renderModalDetailItems(session, mode = currentModalViewMode) {
  if (!detailModalList || !session) return;
  currentModalViewMode = mode;

  //+_+// 이전 모달 캔버스 인스턴스 완전 정리
  modalReviewCanvasInstances.forEach((inst) => inst.destroy());
  modalReviewCanvasInstances.clear();

  if (modalViewCompactBtn) modalViewCompactBtn.classList.toggle("active", mode === "compact");
  if (modalViewDetailBtn) modalViewDetailBtn.classList.toggle("active", mode === "detail");

  const results = session.results || [];
  detailModalList.innerHTML = results.map((r, idx) => {
    const symbol = r.operation === "div" ? "÷" : "×";
    const safeComment = escapeHtml(r.comment);
    const commentHtml = safeComment ? `<span class="comment-badge">✏️ 피드백: ${safeComment}</span>` : "";
    const canvasId = `modalReviewCanvas_${session.id || "temp"}_${r.questionId || idx}`;

    if (mode === "compact") {
      return `
        <div class="result-detail-item compact-view ${r.isCorrect ? "is-correct" : "is-wrong"}">
          <div class="detail-item-header">
            <div class="detail-left">
              <span class="detail-order">${idx + 1}번</span>
              <span class="detail-expr">${r.operandA.toLocaleString()} ${symbol} ${r.operandB.toLocaleString()} = <strong>${r.answer.toLocaleString()}</strong></span>
              <span class="detail-badge ${r.isCorrect ? "correct" : "wrong"}">${r.isCorrect ? "✔ 정답" : "✖ 오답"}</span>
            </div>
            ${commentHtml}
          </div>
        </div>
      `;
    }

    return `
      <div class="result-detail-item ${r.isCorrect ? "is-correct" : "is-wrong"}">
        <div class="detail-item-header">
          <div class="detail-left">
            <span class="detail-order">${idx + 1}번</span>
            <span class="detail-expr">${r.operandA.toLocaleString()} ${symbol} ${r.operandB.toLocaleString()} = <strong>${r.answer.toLocaleString()}</strong></span>
            <span class="detail-badge ${r.isCorrect ? "correct" : "wrong"}">${r.isCorrect ? "✔ 정답" : "✖ 오답"}</span>
          </div>
          ${commentHtml}
        </div>
        <!-- 학생 필기 및 빨간 펜 첨삭 복원 영역 -->
        <div class="detail-review-stage">
          <div class="problem-canvas-stage">
            ${renderProblemStageContent(r, { showGuides: false })}
            <canvas class="drawing-canvas review-canvas" id="${canvasId}"></canvas>
          </div>
        </div>
      </div>
    `;
  }).join("");

  if (mode === "detail") {
    requestAnimationFrame(() => {
      results.forEach((r, idx) => {
        const canvasId = `modalReviewCanvas_${session.id || "temp"}_${r.questionId || idx}`;
        const canvasEl = document.querySelector(`#${canvasId}`);
        if (canvasEl) {
          const studentStrokes = r.studentStrokes || r.strokes || [];
          const gradingStrokes = r.gradingStrokes || [];
          const canvasInst = createDrawingCanvas(canvasEl, { readOnly: true, backgroundStrokes: studentStrokes });
          modalReviewCanvasInstances.set(canvasId, canvasInst);
          if (gradingStrokes.length > 0) {
            canvasInst.setStrokes(gradingStrokes);
          }
        }
      });
    });
  }
}

function showSessionDetail(session) {
  if (!sessionDetailModal) return;
  currentModalSession = session;

  const dateStr = new Date(session.completedAt).toLocaleString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
  const op = session.operation === "div" ? "나눗셈" : "곱셈";

  if (detailModalTag) detailModalTag.textContent = `${dateStr} 기록`;
  if (detailModalTitle) detailModalTitle.textContent = `${op} ${session.totalQuestions}문제 풀이 및 첨삭 기록`;

  if (detailModalSummary) {
    detailModalSummary.innerHTML = `
      <span class="modal-stat-pill ${session.accuracyRate >= 80 ? "high" : ""}">${session.accuracyRate}% 정답 (${session.correctCount} / ${session.totalQuestions})</span>
      <span class="modal-stat-pill">⏱ 총 ${formatTime(session.totalSolveTimeMs, "korean")} 소요</span>
      <span class="modal-stat-pill">⚡ 평균 ${formatTime(session.averageSolveTimeMs || 0, "korean")}</span>
    `;
  }

  renderModalDetailItems(session, currentModalViewMode);
  sessionDetailModal.showModal();
}

async function handleStartMistakeSession() {
  try {
    const mistakes = await getMistakeQuestions();
    if (!mistakes || mistakes.length === 0) {
      alert("현재 복습할 오답 문제가 없습니다! 잘하셨어요! 👍");
      return;
    }

    //+_+// mistakeToQuestion 매퍼를 사용하여 정답, 키, 연산자 완전 보존
    const questions = mistakes.map((m, idx) => mistakeToQuestion(m, idx));

    startSessionWithQuestions(questions, {
      operation: questions[0].operation,
      difficulty: "custom",
      pageSize: 4,
      cols: 2,
      rows: 2
    });
  } catch (e) {
    console.error("오답 세션 생성 실패:", e);
    alert("오답 세션 생성 중 오류가 발생했습니다.");
  }
}

async function handleClearHistory() {
  if (confirm("모든 학습 기록과 오답 큐를 초기화할까요? (되돌릴 수 없습니다)")) {
    await clearAllData();
    await loadDashboardStats();
    alert("모든 기록이 초기화되었습니다.");
  }
}

function updateModeInput() {
  if (!multiplierMode) return;
  const mode = multiplierMode.value;
  if (modeValueLabel) modeValueLabel.hidden = mode === "random";
  if (modeValueText) modeValueText.textContent = mode === "fixed" ? "고정 숫자" : "배수 기준";
}

function renderQueuePreview(questions) {
  if (!questionPreview) return;
  const symbol = questions[0]?.operation === "div" ? "÷" : "×";
  questionPreview.replaceChildren(...questions.slice(0, 10).map((question, index) => {
    const item = document.createElement("li");
    const label = document.createElement("small");
    const expression = document.createElement("strong");
    label.textContent = `${index + 1}번 · ${question.level}`;
    expression.textContent = `${question.operandA.toLocaleString()} ${symbol} ${question.operandB.toLocaleString()}`;
    item.append(label, expression);
    return item;
  }));
  
  //+_+// generationMeta에 기반한 정확한 중복/반복 상태 안내
  const meta = questions.meta;
  const isRepeated = meta && meta.repeatedCount > 0;
  const repeatInfo = isRepeated ? ` (반복 학습 ${meta.repeatedCount}문제 포함)` : " (중복 없는 문제)";
  const trailingText = questions.length > 10 ? ` · 나머지 ${questions.length - 10}문제는 워크시트에 준비됨` : "";
  if (queueNote) queueNote.textContent = `${questions.length}문제 생성 완료${repeatInfo}${trailingText}`;
  if (queueSection) {
    queueSection.hidden = false;
    queueSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function previewQuestions() {
  const options = getFormConfig();
  try {
    const startedAt = performance.now();
    currentQuestions = generateQuestionSet(options);
    const elapsed = performance.now() - startedAt;
    if (engineState) {
      engineState.textContent = `${currentQuestions.length}문제 생성 완료 · ${elapsed.toFixed(1)}ms`;
      engineState.classList.remove("error-state");
    }
    renderQueuePreview(currentQuestions);
    return currentQuestions;
  } catch (error) {
    if (engineState) {
      engineState.textContent = error.message;
      engineState.classList.add("error-state");
    }
    if (queueSection) queueSection.hidden = true;
    return null;
  }
}

// ----------------------------------------------------
// 세로셈 자릿수 모눈 네모칸 그리드 HTML 렌더러
// ----------------------------------------------------
function renderVerticalMathGrid(q, options = {}) {
  const showGuides = Boolean(options.showGuides);

  if (q.operation === "div") {
    const divSteps = getDivisionSteps(q.operandA, q.operandB);
    const dvdStr = String(q.operandA);
    const dvrStr = String(q.operandB);
    const qStr = divSteps.quotientStr;
    const dvdLen = dvdStr.length;
    const dvrLen = dvrStr.length;
    const qLen = qStr.length;
    const leadEmpty = dvdLen - qLen;

    // 1. 상단 몫(Quotient) 행
    let quotientRowHtml = "";
    for (let c = 0; c < dvrLen + 1; c++) {
      quotientRowHtml += `<div class="div-grid-td empty-cell"></div>`;
    }
    for (let i = 0; i < dvdLen; i++) {
      if (i < leadEmpty) {
        quotientRowHtml += `<div class="div-grid-td empty-cell"></div>`;
      } else {
        const qDigit = qStr[i - leadEmpty] || "";
        quotientRowHtml += `
          <div class="div-grid-td">
            <div class="grid-cell box-cell accent-box">
              <span class="guide-digit">${qDigit}</span>
            </div>
          </div>
        `;
      }
    }

    // 2. 중앙 제수 ) 피제수 행
    let mainRowHtml = "";
    for (let i = 0; i < dvrLen; i++) {
      mainRowHtml += `<div class="div-grid-td">${dvrStr[i]}</div>`;
    }
    mainRowHtml += `<div class="div-grid-td arc-cell">)</div>`;
    for (let i = 0; i < dvdLen; i++) {
      mainRowHtml += `<div class="div-grid-td overbar">${dvdStr[i]}</div>`;
    }

    // 3. 하단 단계별 뺄셈 및 내려쓰기 행들
    let subStepRowsHtml = "";
    divSteps.steps.forEach((step, sIdx) => {
      const mulStr = step.multiplyValueStr;
      const mLen = mulStr.length;
      const currentDvdEndIdx = leadEmpty + sIdx;
      const startDvdIdx = currentDvdEndIdx - mLen + 1;

      let mulRow = "";
      for (let c = 0; c < dvrLen + 1; c++) mulRow += `<div class="div-grid-td empty-cell"></div>`;
      for (let i = 0; i < dvdLen; i++) {
        if (i >= startDvdIdx && i <= currentDvdEndIdx) {
          const digit = mulStr[i - startDvdIdx];
          mulRow += `
            <div class="div-grid-td sub-bar">
              <div class="grid-cell box-cell"><span class="guide-digit">${digit}</span></div>
            </div>
          `;
        } else {
          mulRow += `<div class="div-grid-td empty-cell"></div>`;
        }
      }
      subStepRowsHtml += `<div class="div-grid-tr">${mulRow}</div>`;

      if (sIdx < divSteps.steps.length - 1) {
        const nextStep = divSteps.steps[sIdx + 1];
        const nextPartialStr = String(nextStep.partialDividend);
        const npLen = nextPartialStr.length;
        const nextEndDvdIdx = leadEmpty + sIdx + 1;
        const nextStartDvdIdx = nextEndDvdIdx - npLen + 1;

        let resRow = "";
        for (let c = 0; c < dvrLen + 1; c++) resRow += `<div class="div-grid-td empty-cell"></div>`;
        for (let i = 0; i < dvdLen; i++) {
          if (i >= nextStartDvdIdx && i <= nextEndDvdIdx) {
            const digit = nextPartialStr[i - nextStartDvdIdx];
            resRow += `
              <div class="div-grid-td">
                <div class="grid-cell box-cell"><span class="guide-digit">${digit}</span></div>
              </div>
            `;
          } else {
            resRow += `<div class="div-grid-td empty-cell"></div>`;
          }
        }
        subStepRowsHtml += `<div class="div-grid-tr">${resRow}</div>`;
      }
    });

    // 4. 최종 나머지 0 행
    let finalRemainderRow = "";
    for (let c = 0; c < dvrLen + 1; c++) finalRemainderRow += `<div class="div-grid-td empty-cell"></div>`;
    for (let i = 0; i < dvdLen; i++) {
      if (i === dvdLen - 1) {
        finalRemainderRow += `
          <div class="div-grid-td">
            <div class="grid-cell box-cell"><span class="guide-digit">${divSteps.remainder}</span></div>
          </div>
        `;
      } else {
        finalRemainderRow += `<div class="div-grid-td empty-cell"></div>`;
      }
    }
    subStepRowsHtml += `<div class="div-grid-tr">${finalRemainderRow}</div>`;

    return `
      <div class="div-grid-container ${showGuides ? "show-guides" : ""}">
        <div class="div-grid-table">
          <div class="div-grid-tr">${quotientRowHtml}</div>
          <div class="div-grid-tr">${mainRowHtml}</div>
          ${subStepRowsHtml}
        </div>
      </div>
    `;
  }

  // 곱셈 세로셈
  const mulSteps = getMultiplicationSteps(q.operandA, q.operandB);
  const aStr = String(q.operandA);
  const bStr = String(q.operandB);
  const ansStr = mulSteps.resultStr;
  const aLen = aStr.length;
  const bLen = bStr.length;
  const ansLen = ansStr.length;
  const totalCols = Math.max(ansLen + 1, aLen + bLen + 1);

  // 0. 자리올림(Carry) 보조 행
  let carryCells = "";
  for (let i = 0; i < totalCols - aLen; i++) carryCells += `<div class="grid-cell empty-cell"></div>`;
  for (let i = 0; i < aLen; i++) {
    const carryVal = (showGuides && mulSteps.primaryCarries && mulSteps.primaryCarries[i] > 0)
      ? mulSteps.primaryCarries[i]
      : "";
    carryCells += `<div class="grid-cell carry-cell ${carryVal ? "has-carry" : ""}"><span class="guide-carry">${carryVal}</span></div>`;
  }

  // 1. 피승수 행
  let topCells = "";
  for (let i = 0; i < totalCols - aLen; i++) topCells += `<div class="grid-cell empty-cell"></div>`;
  for (const ch of aStr) topCells += `<div class="grid-cell number-cell">${ch}</div>`;

  // 2. 승수 행 (연산자 포함)
  let botCells = `<div class="grid-cell symbol-cell">×</div>`;
  for (let i = 0; i < totalCols - 1 - bLen; i++) botCells += `<div class="grid-cell empty-cell"></div>`;
  for (const ch of bStr) botCells += `<div class="grid-cell number-cell">${ch}</div>`;

  // 3. 부분곱 네모칸 행들 (승수 2자리 이상일 때)
  let partialRows = "";
  if (bLen >= 2) {
    mulSteps.partialProducts.forEach((pp, step) => {
      let row = "";
      const pStr = pp.rawProductStr;
      const pLen = pStr.length;
      const leadEmpty = totalCols - pLen - step;

      for (let i = 0; i < Math.max(0, leadEmpty); i++) row += `<div class="grid-cell empty-cell"></div>`;
      for (let i = 0; i < pLen; i++) {
        const digit = pStr[i];
        row += `<div class="grid-cell box-cell"><span class="guide-digit">${digit}</span></div>`;
      }
      for (let i = 0; i < step; i++) row += `<div class="grid-cell empty-cell"></div>`;
      partialRows += `<div class="math-grid-row">${row}</div>`;
    });
    partialRows += `<div class="math-grid-row divider-row"><div class="math-grid-divider-line"></div></div>`;
  }

  // 4. 최종 합산 정답 네모칸 행
  let ansBoxes = "";
  for (let i = 0; i < totalCols - ansLen; i++) ansBoxes += `<div class="grid-cell empty-cell"></div>`;
  for (let i = 0; i < ansLen; i++) {
    const digit = ansStr[i];
    ansBoxes += `<div class="grid-cell box-cell accent-box"><span class="guide-digit">${digit}</span></div>`;
  }

  return `
    <div class="math-grid-container ${showGuides ? "show-guides" : ""}">
      <div class="math-grid-row carry-row">${carryCells}</div>
      <div class="math-grid-row">${topCells}</div>
      <div class="math-grid-row">${botCells}</div>
      <div class="math-grid-row divider-row"><div class="math-grid-divider-line"></div></div>
      ${partialRows}
      <div class="math-grid-row">${ansBoxes}</div>
    </div>
  `;
}

function renderHorizontalMathGrid(q, options = {}) {
  const showGuides = Boolean(options.showGuides);
  const symbol = q.operation === "div" ? "÷" : "×";
  const ansStr = String(q.answer);

  let answerBoxesHtml = "";
  for (let i = 0; i < ansStr.length; i++) {
    const digit = ansStr[i];
    answerBoxesHtml += `<div class="grid-cell box-cell accent-box"><span class="guide-digit">${digit}</span></div>`;
  }

  return `
    <div class="horizontal-math-container math-grid-container ${showGuides ? "show-guides" : ""}">
      <div class="horizontal-math-equation">
        <span class="h-operand">${Number(q.operandA).toLocaleString()}</span>
        <span class="h-symbol">${symbol}</span>
        <span class="h-operand">${Number(q.operandB).toLocaleString()}</span>
        <span class="h-equals">=</span>
      </div>
      <div class="horizontal-answer-row">
        ${answerBoxesHtml}
      </div>
    </div>
  `;
}

function renderProblemStageContent(q, options = {}) {
  const mathFormat = q.mathFormat || currentSession?.mathFormat || (currentResultSummary?.mathFormat) || (currentModalSession?.mathFormat) || "vertical";
  if (mathFormat === "horizontal") {
    return renderHorizontalMathGrid(q, options);
  }
  return renderVerticalMathGrid(q, options);
}

// ----------------------------------------------------
// 워크시트 세션 풀이 흐름 (단일 표준 진입점)
// ----------------------------------------------------
function startSessionWithQuestions(questions, config) {
  if (!questions || questions.length === 0) return;
  lastSessionConfig = config;
  currentDraftCreatedAt = Date.now();
  currentQuestions = questions;
  questionStrokesMap.clear();
  gradingStrokesMap.clear();
  gradingResultsMap.clear();
  activeCanvasInstances.forEach((instance) => instance.destroy());
  activeCanvasInstances.clear();

  currentSession = createSession(config, questions);
  currentSession.start();

  startSessionTimer(questionTimer, 0);

  switchView(practiceView);
  renderCurrentWorksheetPage();
  triggerDraftSave();
}

function renderCurrentWorksheetPage() {
  if (!currentSession) return;

  // 이전 페이지 캔버스 인스턴스 정리
  activeCanvasInstances.forEach((instance) => instance.destroy());
  activeCanvasInstances.clear();

  const pageData = currentSession.getPageQuestions();

  // 상단 진행 정보 갱신
  practiceLevelBadge.textContent = pageData.questions[0]?.level || "연습";
  practicePageBadge.textContent = `페이지 ${pageData.pageNumber} / ${pageData.totalPages}`;
  practiceQuestionRange.textContent = `문제 ${pageData.startIndex + 1} ~ ${pageData.endIndex} / ${currentSession.totalQuestions}`;

  const progressPercent = Math.round((pageData.endIndex / currentSession.totalQuestions) * 100);
  sessionProgressBar.style.width = `${Math.max(5, progressPercent)}%`;
  if (dockProgress) {
    dockProgress.setAttribute("aria-valuenow", String(progressPercent));
    dockProgress.setAttribute("aria-valuetext", `${pageData.endIndex} / ${currentSession.totalQuestions} 문제 구간`);
  }

  // 문제 카드 그리드 열(Column) 및 밀도별 폰트/셀 크기 동적 배치 적용
  if (worksheetGrid) {
    const pSize = Number(currentSession.pageSize) || 4;
    const cols = currentSession.cols || (pSize <= 2 ? pSize : 2);
    worksheetGrid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

    worksheetGrid.classList.remove("density-1x1", "density-1x2", "density-2x2", "density-2x3", "density-2x5");
    if (pSize === 1) {
      worksheetGrid.classList.add("density-1x1");
    } else if (pSize === 2) {
      worksheetGrid.classList.add("density-1x2");
    } else if (pSize <= 4) {
      worksheetGrid.classList.add("density-2x2");
    } else if (pSize <= 6) {
      worksheetGrid.classList.add("density-2x3");
    } else {
      worksheetGrid.classList.add("density-2x5");
    }
  }

  // 문제 카드 그리드 렌더링
  worksheetGrid.replaceChildren(...pageData.questions.map((q, qIdx) => {
    const card = document.createElement("div");
    card.className = "worksheet-card";
    card.id = `worksheetCard_${q.id}`;
    if (qIdx === currentFocusedProblemIndex) {
      card.classList.add("active-focus");
    }

    card.innerHTML = `
      <div class="card-header">
        <div class="card-header-left">
          <span class="card-order">${q.orderNumber}번 문제</span>
          <span class="card-level">${q.level}</span>
        </div>
      </div>
      <div class="card-problem-body" id="problemBody_${q.id}">
        <div class="problem-canvas-stage">
          ${renderProblemStageContent(q, { showGuides: false })}
          <canvas class="drawing-canvas worksheet-problem-canvas" id="canvas_${q.id}"></canvas>
        </div>
      </div>
    `;

    card.addEventListener("pointerdown", () => {
      currentFocusedProblemIndex = qIdx;
      lastActiveCanvasId = q.id;
      document.querySelectorAll(".worksheet-card").forEach(c => c.classList.remove("active-focus"));
      card.classList.add("active-focus");
    });

    return card;
  }));

  // 각 문제 카드의 캔버스 초기화
  pageData.questions.forEach((q) => {
    const canvasEl = document.querySelector(`#canvas_${q.id}`);
    if (canvasEl) {
      const canvasInstance = createDrawingCanvas(canvasEl, {
        color: currentPenColor,
        width: currentPenWidth,
        isEraser: currentIsEraser,
        profile: currentInputProfile,
        pencilOnly: currentInputProfile === InputProfile.IPAD_PEN_ONLY,
        onStrokeChange: (strokes) => {
          applyStudentStrokeChange({
            session: currentSession,
            strokesMap: questionStrokesMap,
            questionId: q.id,
            strokes,
            onAccepted: () => {
              lastActiveCanvasId = q.id;
              triggerDraftSave();
            }
          });
        }
      });

      const savedStrokes = questionStrokesMap.get(q.id);
      if (savedStrokes) {
        canvasInstance.setStrokes(savedStrokes);
      }

      activeCanvasInstances.set(q.id, canvasInstance);
    }
  });

  // 네비게이션 및 제출 버튼 상태 갱신 (마지막 페이지에서도 다음에 풀기는 항상 노출!)
  prevPageBtn.disabled = pageData.isFirstPage;
  nextPageBtn.disabled = pageData.isLastPage;
  nextPageBtn.style.display = pageData.isLastPage ? "none" : "inline-flex";
  if (pausePracticeBtn) {
    pausePracticeBtn.style.display = "inline-flex";
  }
  submitPracticeBtn.style.display = pageData.isLastPage ? "inline-flex" : "none";
  pageIndicatorText.textContent = `${pageData.pageNumber} / ${pageData.totalPages} 페이지`;

  currentFocusedProblemIndex = 0;
  requestAnimationFrame(() => {
    autoFitProblemStages();
  });

  window.scrollTo({ top: 0, behavior: getPreferredScrollBehavior() });
}

// 화면 및 카드 크기에 맞춰 문제와 정답 셀을 가로/세로 기준 꽉 차게 자동 스케일링
function autoFitProblemStages() {
  const stages = document.querySelectorAll(".problem-canvas-stage");
  stages.forEach((stage) => {
    const cardBody = stage.closest(".card-problem-body");
    const grid = stage.querySelector(".math-grid-container, .div-grid-container, .horizontal-math-container");
    if (!cardBody || !grid) return;

    grid.style.transform = "none";

    const bodyRect = cardBody.getBoundingClientRect();
    const bodyW = (cardBody.clientWidth || bodyRect.width) - 20;
    const bodyH = (cardBody.clientHeight || bodyRect.height) - 20;
    const gridRect = grid.getBoundingClientRect();
    const gridW = grid.offsetWidth || gridRect.width;
    const gridH = grid.offsetHeight || gridRect.height;

    if (bodyW <= 0 || bodyH <= 0 || gridW <= 0 || gridH <= 0) return;

    // 가로가 넓고 세로가 좁으면 세로 기준, 세로가 길면 가로 기준으로 최적 꽉 채움 배율 계산
    const scaleX = bodyW / gridW;
    const scaleY = bodyH / gridH;
    const fitScale = Math.max(0.65, Math.min(2.2, Math.min(scaleX, scaleY) * 0.95));

    grid.style.transform = `scale(${fitScale.toFixed(3)})`;
    grid.style.transformOrigin = "center center";
  });
}

// ----------------------------------------------------
// 펜 도구바 핸들러
// ----------------------------------------------------
function updatePencilModeUI() {
  const isPenOnly = currentInputProfile === InputProfile.IPAD_PEN_ONLY;
  const isPenTouch = currentInputProfile === InputProfile.IPAD_PEN_TOUCH;
  const isDesktop = currentInputProfile === InputProfile.DESKTOP_MOUSE_PEN;

  let modeLabel = "✏️ 펜슬 전용";
  if (isPenOnly) {
    modeLabel = "✏️ 펜슬 전용";
  } else if (isPenTouch) {
    modeLabel = "🖐️ 손+펜 공용";
  } else if (isDesktop) {
    modeLabel = "🖱️ 마우스/펜";
  }

  if (pencilOnlyToggleBtn) {
    pencilOnlyToggleBtn.classList.toggle("active", isPenOnly || isDesktop);
    pencilOnlyToggleBtn.disabled = isDesktop;
    pencilOnlyToggleBtn.title = isDesktop
      ? "PC에서는 마우스와 펜 입력이 항상 활성화됩니다."
      : "애플 펜슬 전용 필기 모드를 전환합니다.";
  }
  if (pencilModeText) {
    pencilModeText.textContent = modeLabel;
  }
}

function updateToolDockUI() {
  penModeBtn?.classList.toggle("active", !currentIsEraser);
  penModeBtn?.setAttribute("aria-pressed", String(!currentIsEraser));
  eraserToggleBtn?.classList.toggle("active", currentIsEraser);
  eraserToggleBtn?.setAttribute("aria-pressed", String(currentIsEraser));
  updatePencilModeUI();
}

//+_+// Phase F4: 제출 중 인터랙션 및 버튼 일괄 잠금/해제
function setPracticeInteractionLocked(locked) {
  if (submitPracticeBtn) submitPracticeBtn.disabled = locked;
  if (prevPageBtn) prevPageBtn.disabled = locked || (currentSession?.getPageQuestions?.().isFirstPage ?? false);
  if (nextPageBtn) nextPageBtn.disabled = locked || (currentSession?.getPageQuestions?.().isLastPage ?? false);
  if (pausePracticeBtn) pausePracticeBtn.disabled = locked;
  if (pencilOnlyToggleBtn) pencilOnlyToggleBtn.disabled = locked;
  if (penModeBtn) penModeBtn.disabled = locked;
  if (eraserToggleBtn) eraserToggleBtn.disabled = locked;
  if (undoBtn) undoBtn.disabled = locked;
  if (redoBtn) redoBtn.disabled = locked;
  if (clearCanvasBtn) clearCanvasBtn.disabled = locked;
  colorChips?.forEach((b) => { b.disabled = locked; });
  widthChips?.forEach((b) => { b.disabled = locked; });
}

function handlePenMode() {
  performPracticeToolSelect(currentSession, () => {
    if (!currentIsEraser) return;
    currentIsEraser = false;
    updateToolDockUI();
    activeCanvasInstances.forEach((inst) => inst.setEraser(false));
    triggerDraftSave();
  });
}

function handlePencilOnlyToggle() {
  performPracticeToolSelect(currentSession, () => {
    currentInputProfile = togglePenOnlyProfile(currentInputProfile, {
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      maxTouchPoints: typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0,
      hasTouchStart: typeof window !== "undefined" && "ontouchstart" in window
    });

    try {
      localStorage.setItem("math_canvas_input_profile", currentInputProfile);
      localStorage.setItem("math_canvas_pencil_only", String(currentInputProfile === InputProfile.IPAD_PEN_ONLY));
    } catch (_) {}

    updatePencilModeUI();
    activeCanvasInstances.forEach((inst) => inst.setInputProfile(currentInputProfile));
    triggerDraftSave();
  });
}

function handleColorSelect(btn) {
  performPracticeToolSelect(currentSession, () => {
    currentPenColor = btn.dataset.color;
    currentIsEraser = false;
    eraserToggleBtn.classList.remove("active");
    updateToolDockUI();

    colorChips.forEach((b) => b.classList.toggle("active", b === btn));
    activeCanvasInstances.forEach((inst) => inst.setColor(currentPenColor));
    triggerDraftSave();
  });
}

function handleWidthSelect(btn) {
  performPracticeToolSelect(currentSession, () => {
    currentPenWidth = Number(btn.dataset.width) || 2.5;
    widthChips.forEach((b) => b.classList.toggle("active", b === btn));
    activeCanvasInstances.forEach((inst) => inst.setWidth(currentPenWidth));
    triggerDraftSave();
  });
}

function handleEraserToggle() {
  performPracticeToolSelect(currentSession, () => {
    currentIsEraser = !currentIsEraser;
    eraserToggleBtn.classList.toggle("active", currentIsEraser);
    updateToolDockUI();
    activeCanvasInstances.forEach((inst) => inst.setEraser(currentIsEraser));
    triggerDraftSave();
  });
}

function handleUndo() {
  if (!canMutatePractice(currentSession)) return;
  if (lastActiveCanvasId && activeCanvasInstances.has(lastActiveCanvasId)) {
    const inst = activeCanvasInstances.get(lastActiveCanvasId);
    if (performPracticeUndo(currentSession, inst)) return;
  }
  for (const inst of activeCanvasInstances.values()) {
    if (performPracticeUndo(currentSession, inst)) break;
  }
}

function handleRedo() {
  if (!canMutatePractice(currentSession)) return;
  if (lastActiveCanvasId && activeCanvasInstances.has(lastActiveCanvasId)) {
    const inst = activeCanvasInstances.get(lastActiveCanvasId);
    if (performPracticeRedo(currentSession, inst)) return;
  }
  for (const inst of activeCanvasInstances.values()) {
    if (performPracticeRedo(currentSession, inst)) break;
  }
}

function handleClearAllCanvas() {
  if (!canMutatePractice(currentSession)) return;
  activeCanvasInstances.forEach((inst, qId) => {
    performPracticeClear(currentSession, inst, questionStrokesMap, qId);
  });
}

// 이전 / 다음 페이지 이동
async function handlePrevPage() {
  if (!canMutatePractice(currentSession)) return;
  try {
    await performPracticePageNav(currentSession, () => {
      return navigateWithDraftFlush({
        flush: flushDraftSave,
        navigate: () => currentSession.prevPage(),
        render: renderCurrentWorksheetPage
      });
    });
  } catch (err) {
    console.error("이전 페이지 이동 실패:", err);
  }
}

async function handleNextPage() {
  if (!canMutatePractice(currentSession)) return;
  try {
    await performPracticePageNav(currentSession, () => {
      return navigateWithDraftFlush({
        flush: flushDraftSave,
        navigate: () => currentSession.nextPage(),
        render: renderCurrentWorksheetPage
      });
    });
  } catch (err) {
    console.error("다음 페이지 이동 실패:", err);
  }
}

//+_+// Phase F4: 제출 실패 시 PRACTICE_ACTIVE 및 Draft 상태 원복 공통 헬퍼
async function rollbackSubmissionToPractice(err) {
  console.error("제출 Snapshot 저장 실패 및 롤백:", err);
  if (typeof currentSession?.rollbackSubmitting === "function") {
    currentSession.rollbackSubmitting();
  }
  setPracticeInteractionLocked(false);
  questionTimer.start(); // 세션 및 시간 복구

  try {
    triggerDraftSave();
    await flushDraftSave();
  } catch (draftRestoreError) {
    console.error("제출 실패 후 PRACTICE_ACTIVE Draft 복구 저장 실패:", draftRestoreError);
  }
}

// 학생 풀이 완료 및 제출 -> 불변 Snapshot 저장 후 채점 모드 전환
async function handleSubmitPractice() {
  if (!canMutatePractice(currentSession)) {
    return;
  }

  //+_+// 1. 제출 시작 즉시 상태 전이 (PRACTICE_ACTIVE -> SUBMITTING) 및 UI 잠금
  if (typeof currentSession.startSubmitting === "function") {
    currentSession.startSubmitting();
  }
  setPracticeInteractionLocked(true);

  //+_+// 2. 제출 전 Draft flush (실패 시 제출 중단 및 PRACTICE_ACTIVE 복구)
  try {
    await flushDraftSave();
  } catch (draftErr) {
    await rollbackSubmissionToPractice(draftErr);
    alert("풀이 데이터 임시 저장에 실패하여 제출을 중단합니다. 다시 시도해 주세요.");
    return;
  }

  const elapsedMs = questionTimer.stop();
  const activeLId = getActiveLearnerId();

  try {
    //+_+// 3. 불변 제출 Snapshot 영구 스토리지에 원자적 저장 및 Active Draft 정리
    await submitLearningSession({
      session: currentSession,
      learnerId: activeLId,
      subjectId: "math",
      moduleId: "arithmetic",
      inputProfile: currentInputProfile,
      totalSolveTimeMs: elapsedMs,
      perQuestionElapsedMs: currentSession.getQuestionSolveTimes?.() || {},
      studentStrokesMap: questionStrokesMap,
      appBuildId: typeof BUILD_ID !== "undefined" ? BUILD_ID : "unknown"
    });
  } catch (err) {
    await rollbackSubmissionToPractice(err);
    alert("풀이 제출 저장에 실패했습니다. 다시 시도해 주세요.");
    return;
  }

  //+_+// 4. 보호자 채점 모드 전환
  currentSession.startGrading();

  switchView(gradingView);
  hideAnswersInGrading = false;
  renderGradingView();
  try {
    await flushDraftSave();
  } catch (_) {}
}

// ----------------------------------------------------
// 채점자 평가 모드 흐름 (학생 필기 보존 & 정답 오버레이 & 빨간 펜 코멘트)
// ----------------------------------------------------
function renderGradingView() {
  if (!currentSession) return;
  const renderRevision = ++gradingRenderRevision;
  gradingCanvasInstances.forEach((instance) => instance.destroy());
  gradingCanvasInstances = [];
  const questions = currentSession.questions;
  const activeGrade = questions.find((question) => question.id === currentGradingQuestionId)?.grade;
  if (typeof activeGrade?.isCorrect === "boolean") currentGradingQuestionId = null;

  toggleAnswersText.textContent = hideAnswersInGrading ? "정답 전체 보이기" : "정답 전체 숨기기";

  // 워크시트와 100% 동일한 열 수(cols)와 밀도 클래스 동기화 (좌우 비율 완벽 보존)
  if (gradingGrid) {
    const pSize = Number(currentSession.pageSize) || 4;
    const cols = currentSession.cols || (pSize <= 2 ? pSize : 2);
    gradingGrid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

    gradingGrid.classList.remove("density-1x1", "density-1x2", "density-2x2", "density-2x3", "density-2x5");
    if (pSize === 1) {
      gradingGrid.classList.add("density-1x1");
    } else if (pSize === 2) {
      gradingGrid.classList.add("density-1x2");
    } else if (pSize <= 4) {
      gradingGrid.classList.add("density-2x2");
    } else if (pSize <= 6) {
      gradingGrid.classList.add("density-2x3");
    } else {
      gradingGrid.classList.add("density-2x5");
    }
  }

  gradingGrid.replaceChildren(...questions.map((q, idx) => {
    const card = document.createElement("div");
    card.className = "grading-card";
    card.id = `gradingCard_${q.id}`;

    const currentGrade = gradingResultsMap.get(q.id) || q.grade;
    const isGraded = typeof currentGrade?.isCorrect === "boolean";
    if (isGraded) {
      card.classList.toggle("is-graded-correct", currentGrade.isCorrect);
      card.classList.toggle("is-graded-wrong", !currentGrade.isCorrect);
    }
    if (!currentGradingQuestionId && !isGraded) currentGradingQuestionId = q.id;
    if (currentGradingQuestionId === q.id) card.setAttribute("aria-current", "step");

    const symbol = q.operation === "div" ? "÷" : "×";
    const answerFormatted = q.answer.toLocaleString();
    const commentValue = currentGrade?.comment || "";
    card.innerHTML = `
      <div class="card-header">
        <span class="card-order">${idx + 1}번 문제</span>
        <span class="card-level">${q.level}</span>
        <span class="grading-state-label">${isGraded ? (currentGrade.isCorrect ? "채점됨: 맞음" : "채점됨: 틀림") : "미채점"}</span>
      </div>

      <!-- 채점 비교 2단 그리드: 좌측(학생 실제 필기 + 채점자 빨간펜 첨삭) / 우측(모범 정답 및 단계별 해설) -->
      <div class="grading-comparison-grid">
        <!-- 1. 좌측: 학생 실제 손계산 필기 + 채점자 빨간 펜 직접 첨삭 가능 -->
        <div class="comparison-col student-work-col">
          <div class="col-badge student-badge">👤 학생 풀이 & ✏️ 빨간 펜 직접 첨삭</div>
          <div class="card-problem-body student-body" id="gradingStudentBody_${q.id}">
            <div class="problem-canvas-stage">
              <span class="red-pen-guide-tag">✏️ 빨간펜 첨삭 영역</span>
              ${renderProblemStageContent(q, { showGuides: false })}
              <canvas class="drawing-canvas grading-red-pen-canvas" id="gradingCanvas_${q.id}" title="빨간 펜으로 직접 첨삭(동그라미, 밑줄 등)을 작성하세요"></canvas>
            </div>
          </div>
        </div>

        <!-- 2. 우측: 올바른 단계별 정답 및 풀이 과정 (자리올림 포함) -->
        <div class="comparison-col answer-work-col ${hideAnswersInGrading ? "is-hidden-answer" : ""}">
          <div class="col-badge answer-badge">🎯 모범 정답 & 단계별 풀이 (자리올림 포함)</div>
          <div class="card-problem-body model-answer-body">
            <div class="problem-canvas-stage">
              ${renderProblemStageContent(q, { showGuides: true })}
            </div>
          </div>
        </div>
      </div>

      <!-- 원클릭 채점 버튼군 -->
      <div class="grading-actions">
        <button type="button" class="grade-btn correct-choice ${currentGrade?.isCorrect === true ? "active" : ""}" data-id="${q.id}" data-correct="true">
          <span>✔ 맞음</span>
        </button>
        <button type="button" class="grade-btn wrong-choice ${currentGrade?.isCorrect === false ? "active" : ""}" data-id="${q.id}" data-correct="false">
          <span>✖ 틀림</span>
        </button>
      </div>

      <details class="grading-explanation">
        <summary>오답 풀이 단계를 확인하기</summary>
        <p>${Number(q.operandA).toLocaleString()} ${symbol} ${Number(q.operandB).toLocaleString()}의 정답은 <strong>${answerFormatted}</strong>입니다. 위 모범 풀이에서 자리 맞춤과 중간 계산을 순서대로 비교해 보세요.</p>
      </details>

      <!-- 채점자 퀵 코멘트 칩 및 메모 입력 -->
      <div class="red-pen-zone">
        <div class="red-pen-header">
          <span>💬 빠른 코멘트 칩 & 피드백 메모</span>
        </div>
        <div class="red-pen-chips">
          <button type="button" class="red-chip-btn" data-id="${q.id}" data-text="⭕ 완벽해요!">⭕ 완벽해요!</button>
          <button type="button" class="red-chip-btn" data-id="${q.id}" data-text="⚠️ 받아올림 실수">⚠️ 받아올림 실수</button>
          <button type="button" class="red-chip-btn" data-id="${q.id}" data-text="📐 자리맞춤 확인">📐 자리맞춤 확인</button>
          <button type="button" class="red-chip-btn" data-id="${q.id}" data-text="✖ 구구단 오류">✖ 구구단 오류</button>
          <button type="button" class="red-chip-btn" data-id="${q.id}" data-text="✏️ 다시 풀어보기">✏️ 다시 풀어보기</button>
        </div>
        <input type="text" class="red-pen-input" id="redPenInput_${q.id}" data-id="${q.id}" placeholder="추가 피드백을 적어주세요 (아이패드는 왼쪽 풀이 위에 직접 펜으로 써도 됩니다)" value="${commentValue}">
      </div>
    `;

    return card;
  }));

  // 채점 뷰에서 학생 필기 캔버스 복원 및 채점자 빨간 펜 필기 활성화
  requestAnimationFrame(() => {
    if (renderRevision !== gradingRenderRevision) return;
    // 1. 먼저 autoFitProblemStages를 실행하여 수식 그리드의 transform scale을 확정
    autoFitProblemStages();

    const createdGradingInstances = [];
    questions.forEach((q) => {
      const gCanvasEl = document.querySelector(`#gradingCanvas_${q.id}`);
      if (gCanvasEl) {
        const studentStrokes = questionStrokesMap.get(q.id) || [];
        const gradingStrokes = gradingStrokesMap.get(q.id) || [];
        const gInstance = createDrawingCanvas(gCanvasEl, {
          color: "#c62828", // 기본 빨간 펜 잉크
          width: 3.0,
          readOnly: false, // 채점자가 직접 빨간 펜으로 첨삭 가능!
          profile: currentInputProfile,
          backgroundStrokes: studentStrokes,
          onStrokeChange: (strokes) => {
            gradingStrokesMap.set(q.id, strokes);
            triggerDraftSave();
          }
        });
        if (gradingStrokes.length > 0) {
          gInstance.setStrokes(gradingStrokes);
        }
        createdGradingInstances.push(gInstance);
      }
    });
    gradingCanvasInstances = createdGradingInstances;

    // 2. DOM 레이아웃 정착 후 2차 정밀 redraw로 1:1 완벽 정렬 보장
    setTimeout(() => {
      if (renderRevision !== gradingRenderRevision) {
        createdGradingInstances.forEach((instance) => instance.destroy());
        return;
      }
      autoFitProblemStages();
      createdGradingInstances.forEach((inst) => {
        inst.resize();
        inst.redraw();
      });
    }, 60);
  });

  updateGradingStatusUI();
}

function updateGradingStatusUI() {
  if (!currentSession) return;
  const status = currentSession.getGradingStatus();

  gradedCountText.textContent = `${status.graded} / ${status.total}`;
  gradedCorrectText.textContent = `정답 ${status.correct}`;
  gradedWrongText.textContent = `오답 ${status.wrong}`;
  const remaining = Math.max(0, status.total - status.graded);
  if (gradingRemainingText) gradingRemainingText.textContent = `미채점 ${remaining}`;

  finishGradingBtn.disabled = !status.allGraded;
  finishGradingBtn.setAttribute("aria-disabled", String(!status.allGraded));
  finishGradingBtn.classList.toggle("primary-action", status.allGraded);
  finishGradingBtn.style.opacity = status.allGraded ? "1" : "0.55";
  if (gradingFinishHint) {
    gradingFinishHint.textContent = status.allGraded
      ? "모든 문제의 채점이 완료되었습니다. 결과를 확인할 수 있습니다."
      : `미채점 ${remaining}문제가 남았습니다.`;
  }
}

function focusNextUngraded(currentId) {
  if (!currentSession) return;
  const questions = currentSession.questions;
  const startIndex = Math.max(0, questions.findIndex((question) => question.id === currentId));
  const ordered = [...questions.slice(startIndex + 1), ...questions.slice(0, startIndex + 1)];
  const next = ordered.find((question) => {
    const grade = gradingResultsMap.get(question.id) || question.grade;
    return typeof grade?.isCorrect !== "boolean";
  });
  currentGradingQuestionId = next?.id || null;
  document.querySelectorAll(".grading-card[aria-current]").forEach((card) => card.removeAttribute("aria-current"));
  if (!next) return;
  const card = document.querySelector(`#gradingCard_${next.id}`);
  card?.setAttribute("aria-current", "step");
  card?.scrollIntoView({ behavior: getPreferredScrollBehavior(), block: "center" });
  card?.querySelector(".grade-btn")?.focus({ preventScroll: true });
}

// 개별 문제 채점 클릭
function handleGradeClick(event) {
  const btn = event.target.closest(".grade-btn");
  if (!btn || !currentSession) return;

  const qId = btn.dataset.id;
  const isCorrect = btn.dataset.correct === "true";
  const commentInput = document.querySelector(`#redPenInput_${qId}`);
  const comment = commentInput ? commentInput.value : "";

  const gradeResult = currentSession.gradeQuestion(qId, isCorrect, comment);
  gradingResultsMap.set(qId, gradeResult.gradeData);
  triggerDraftSave();

  // 사운드 및 햅틱 효과 재생
  if (isCorrect) {
    playCorrectSound();
  } else {
    playWrongSound();
  }

  const card = document.querySelector(`#gradingCard_${qId}`);
  if (card) {
    card.classList.toggle("is-graded-correct", isCorrect);
    card.classList.toggle("is-graded-wrong", !isCorrect);

    card.querySelectorAll(".grade-btn").forEach((b) => {
      b.classList.toggle("active", b === btn);
    });
    const stateLabel = card.querySelector(".grading-state-label");
    if (stateLabel) stateLabel.textContent = isCorrect ? "채점됨: 맞음" : "채점됨: 틀림";
  }

  updateGradingStatusUI();
  focusNextUngraded(qId);
}

// 빨간 펜 코멘트 칩 클릭
function handleRedChipClick(event) {
  const chip = event.target.closest(".red-chip-btn");
  if (!chip || !currentSession) return;

  const qId = chip.dataset.id;
  const text = chip.dataset.text;
  const commentInput = document.querySelector(`#redPenInput_${qId}`);

  if (commentInput) {
    commentInput.value = text;
    const currentGrade = currentSession.questions.find((q) => q.id === qId)?.grade;
    const isCorrect = currentGrade ? currentGrade.isCorrect : (text.includes("완벽") ? true : false);
    const gradeResult = currentSession.gradeQuestion(qId, isCorrect, text);
    gradingResultsMap.set(qId, gradeResult.gradeData);
    triggerDraftSave();

    const card = document.querySelector(`#gradingCard_${qId}`);
    if (card) {
      card.classList.toggle("is-graded-correct", isCorrect);
      card.classList.toggle("is-graded-wrong", !isCorrect);
      card.querySelectorAll(".grade-btn").forEach((button) => {
        button.classList.toggle("active", button.dataset.correct === String(isCorrect));
      });
      const stateLabel = card.querySelector(".grading-state-label");
      if (stateLabel) stateLabel.textContent = isCorrect ? "채점됨: 맞음" : "채점됨: 틀림";
    }
    updateGradingStatusUI();
    focusNextUngraded(qId);
  }
}

// 빨간 펜 직접 입력 이벤트
function handleRedPenInput(event) {
  const input = event.target.closest(".red-pen-input");
  if (!input || !currentSession) return;

  const qId = input.dataset.id;
  const text = input.value;
  const currentGrade = currentSession.questions.find((q) => q.id === qId)?.grade;
  if (currentGrade) {
    const gradeResult = currentSession.gradeQuestion(qId, currentGrade.isCorrect, text);
    gradingResultsMap.set(qId, gradeResult.gradeData);
  } else {
    gradingResultsMap.set(qId, { questionId: qId, isCorrect: null, comment: text });
  }
  triggerDraftSave();
}

// 전체 정답 처리
function handleGradeAllCorrect() {
  if (!currentSession) return;
  playCorrectSound();
  currentSession.gradeAll(true);
  currentSession.questions.forEach((question) => {
    if (question.grade) gradingResultsMap.set(question.id, question.grade);
  });
  triggerDraftSave();
  renderGradingView();
}

// 정답 보이기/숨기기 토글
function handleToggleAnswers() {
  hideAnswersInGrading = !hideAnswersInGrading;
  renderGradingView();
  triggerDraftSave();
}

// 채점 완료 및 최종 성적표 보기 (IndexedDB 영구 저장 및 submission 상태 GRADED 갱신)
async function handleFinishGrading() {
  if (!currentSession) return;
  try {
    const summary = currentSession.finishGrading();
    const activeLId = getActiveLearnerId();
    // 영구 스토리지에 세션 및 스트로크 저장
    const savedRecord = await saveSession(summary, questionStrokesMap, gradingStrokesMap, { learnerId: activeLId });
    await clearDraft({ learnerId: activeLId });

    //+_+// 제출본 상태를 GRADED로 동기화
    try {
      await updateSubmissionGrading(
        `sub_${currentSession.id}`,
        gradingResultsMap,
        gradingStrokesMap,
        { status: "GRADED", completedAt: Date.now() }
      );
    } catch (_) {}

    showSessionResult(savedRecord);
  } catch (error) {
    alert(error.message);
  }
}

// ----------------------------------------------------
// 최종 결과 요약 표시
// ----------------------------------------------------
function showSessionResult(summary) {
  switchView(resultView);

  // 세션 완료 축하 팡파르 사운드 및 컨페티 파티클 발사
  playFanfareSound();
  if (confettiCanvas) {
    launchConfetti(confettiCanvas, { particleCount: 120, durationMs: 4000 });
  }

  statAccuracy.textContent = `${summary.accuracyRate}%`;
  statAccuracyDetail.textContent = `${summary.correctCount} / ${summary.totalQuestions} 문제 정답 (오답 ${summary.wrongCount})`;
  statTotalTime.textContent = formatTime(summary.totalSolveTimeMs, "korean");
  statAvgTime.textContent = `문제당 평균 ${formatTime(summary.averageSolveTimeMs, "korean")}`;
  statCorrectCount.textContent = `${summary.correctCount}개`;
  statWrongCount.textContent = `${summary.wrongCount}개`;

  // 문제별 상세 채점 결과 및 빨간 펜 코멘트 리스트 렌더링
  renderResultDetailItems(summary, currentResultViewMode);
}

let resultReviewCanvasInstances = new Map();
let currentResultSummary = null;
let currentResultViewMode = "detail"; // "compact" | "detail"

function renderResultDetailItems(summary, mode = currentResultViewMode) {
  if (!resultsDetailList || !summary) return;
  currentResultSummary = summary;
  currentResultViewMode = mode;

  //+_+// 이전 결과 캔버스 인스턴스 완전 정리
  resultReviewCanvasInstances.forEach((inst) => inst.destroy());
  resultReviewCanvasInstances.clear();

  if (resultViewCompactBtn) resultViewCompactBtn.classList.toggle("active", mode === "compact");
  if (resultViewDetailBtn) resultViewDetailBtn.classList.toggle("active", mode === "detail");

  resultsDetailList.replaceChildren(...summary.results.map((r, idx) => {
    const item = document.createElement("div");
    item.className = `result-detail-item ${mode === "compact" ? "compact-view" : ""} ${r.isCorrect ? "is-correct" : "is-wrong"}`;

    const symbol = r.operation === "div" ? "÷" : "×";
    const safeComment = escapeHtml(r.comment);
    const commentHtml = safeComment ? `<span class="comment-badge">✏️ 피드백: ${safeComment}</span>` : "";
    const canvasId = `resultReviewCanvas_${r.questionId || idx}`;

    if (mode === "compact") {
      item.innerHTML = `
        <div class="detail-item-header">
          <div class="detail-left">
            <span class="detail-order">${idx + 1}번</span>
            <span class="detail-expr">${r.operandA.toLocaleString()} ${symbol} ${r.operandB.toLocaleString()} = <strong>${r.answer.toLocaleString()}</strong></span>
            <span class="detail-badge ${r.isCorrect ? "correct" : "wrong"}">${r.isCorrect ? "✔ 정답" : "✖ 오답"}</span>
          </div>
          ${commentHtml}
        </div>
      `;
      return item;
    }

    item.innerHTML = `
      <div class="detail-item-header">
        <div class="detail-left">
          <span class="detail-order">${idx + 1}번</span>
          <span class="detail-expr">${r.operandA.toLocaleString()} ${symbol} ${r.operandB.toLocaleString()} = <strong>${r.answer.toLocaleString()}</strong></span>
          <span class="detail-badge ${r.isCorrect ? "correct" : "wrong"}">${r.isCorrect ? "✔ 정답" : "✖ 오답"}</span>
        </div>
        ${commentHtml}
      </div>
      <!-- 학생 필기 및 빨간 펜 첨삭 복원 영역 -->
      <div class="detail-review-stage">
        <div class="problem-canvas-stage">
          ${renderProblemStageContent(r, { showGuides: false })}
          <canvas class="drawing-canvas review-canvas" id="${canvasId}"></canvas>
        </div>
      </div>
    `;
    return item;
  }));

  if (mode === "detail") {
    // 캔버스에 학생 필기 + 빨간 펜 첨삭 스트로크 복원
    requestAnimationFrame(() => {
      summary.results.forEach((r, idx) => {
        const canvasId = `resultReviewCanvas_${r.questionId || idx}`;
        const canvasEl = document.querySelector(`#${canvasId}`);
        if (canvasEl) {
          const studentStrokes = r.studentStrokes || r.strokes || questionStrokesMap.get(r.questionId) || [];
          const gradingStrokes = r.gradingStrokes || gradingStrokesMap.get(r.questionId) || [];
          const canvasInst = createDrawingCanvas(canvasEl, { readOnly: true, backgroundStrokes: studentStrokes });
          resultReviewCanvasInstances.set(canvasId, canvasInst);
          if (gradingStrokes.length > 0) {
            canvasInst.setStrokes(gradingStrokes);
          }
        }
      });
    });
  }
}

// 세션 중단 처리
function handleAbortSession() {
  if (confirmModal) {
    confirmModal.showModal();
  } else if (confirm("세션을 중단하고 홈으로 돌아갈까요? (작성 중인 내용은 자동 저장됩니다)")) {
    terminateSession();
  }
}

async function terminateSession() {
  try {
    await flushDraftSave();
  } catch (err) {
    alert("임시 저장에 실패했습니다. 네트워크 및 저장소 상태를 확인한 후 다시 시도해 주세요.");
    return; // 세션 유지!
  }
  questionTimer.stop();
  activeCanvasInstances.forEach((inst) => inst.destroy());
  activeCanvasInstances.clear();
  gradingCanvasInstances.forEach((inst) => inst.destroy());
  gradingCanvasInstances = [];
  gradingRenderRevision += 1;
  currentSession = null;
  questionStrokesMap.clear();
  gradingStrokesMap.clear();
  gradingResultsMap.clear();
  updateDraftSaveStatus(DraftSaveStatus.IDLE);
  switchView(setupView);
  loadDashboardStats();
  if (confirmModal?.open) confirmModal.close();
}

function updateNetworkState() {
  if (!networkStatus) return;
  const online = Boolean(navigator.onLine);
  networkStatus.classList.toggle("is-offline", !online);
  const span = networkStatus.querySelector("span");
  if (span) span.textContent = online ? "오프라인 준비됨" : "오프라인 사용 중";
}

// ----------------------------------------------------
// Phase 5: A4 워크시트 시험지 및 정답지 인쇄/PDF 생성기 (설정된 pageSize 동적 연동 & 빈 여분 페이지 완전 차단)
// ----------------------------------------------------
function handlePrintWorksheet(isAnswerKey = false) {
  if (!currentSession) return;

  const allQuestions = currentSession.questions;
  const levelText = allQuestions[0]?.level || "연습";
  const opSymbol = allQuestions[0]?.operation === "div" ? "나눗셈" : "곱셈";

  // 사용자가 설정한 한 화면 문제 수(pageSize)와 100% 일치시켜 인쇄 페이지 분할!
  const questionsPerPage = Math.max(1, Math.min(20, Number(currentSession.pageSize) || 10));
  const totalPrintPages = Math.ceil(allQuestions.length / questionsPerPage);

  // 1. 인쇄 모드 클래스 설정
  if (isAnswerKey) {
    document.body.classList.add("print-mode-answers");
  } else {
    document.body.classList.remove("print-mode-answers");
  }

  // 2. pageSize에 따라 인쇄 페이지(.print-page) 생성
  const printPagesFragment = document.createDocumentFragment();

  for (let p = 0; p < totalPrintPages; p++) {
    const pageContainer = document.createElement("div");
    pageContainer.className = `print-page print-size-${questionsPerPage}`;

    const pageQuestions = allQuestions.slice(p * questionsPerPage, (p + 1) * questionsPerPage);

    pageContainer.innerHTML = `
      <!-- A4 상단 시험지 초슬림 1줄 인라인 헤더 -->
      <div class="print-sheet-header">
        <div class="print-header-inline">
          <span class="print-title">수학 ${opSymbol} 연산 워크시트${isAnswerKey ? " [정답지]" : ""}</span>
          <span class="print-level-tag">${levelText}</span>
          <span class="print-meta-item">이름: ____________</span>
          <span class="print-meta-item">날짜: 2026. __. __</span>
          <span class="print-meta-item">시간: __분 __초</span>
          <span class="print-meta-item">점수: _____ / 100</span>
          <span class="print-page-num">${p + 1}/${totalPrintPages}쪽</span>
        </div>
      </div>

      <!-- pageSize(4/6/8/10) 또는 커스텀 배치에 최적화된 가변 인쇄 그리드 -->
      <div class="print-grid print-grid-${questionsPerPage}" style="grid-template-columns: repeat(${currentSession.cols || 2}, 1fr);">
        ${pageQuestions.map((q, idx) => `
          <div class="worksheet-card print-card">
            <div class="card-header">
              <span class="card-order">${p * questionsPerPage + idx + 1}번</span>
              <span class="card-level">${q.level}</span>
            </div>
            <div class="card-problem-body">
              ${renderProblemStageContent(q, { showGuides: isAnswerKey })}
            </div>
          </div>
        `).join("")}
      </div>
    `;

    printPagesFragment.appendChild(pageContainer);
  }

  // 워크시트 컨테이너를 인쇄용 페이지 프래그먼트로 교체
  worksheetGrid.replaceChildren(printPagesFragment);

  // 3. 브라우저 인쇄 다이얼로그 호출
  setTimeout(() => {
    window.print();

    // 4. 인쇄 다이얼로그 종료 후 원래 현재 화면 페이지 상태로 복원
    document.body.classList.remove("print-mode-answers");
    renderCurrentWorksheetPage();
  }, 150);
}

// ----------------------------------------------------
// 이벤트 리스너 등록
// ----------------------------------------------------
if (form) {
  form.addEventListener("change", updateSummary);
  form.addEventListener("input", updateSummary);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const questions = previewQuestions();
    if (questions) {
      startSessionWithQuestions(questions, getFormConfig());
    }
  });
}

if (multiplierMode) {
  multiplierMode.addEventListener("change", updateModeInput);
}

if (startFromQueueBtn) {
  startFromQueueBtn.addEventListener("click", () => {
    if (currentQuestions) {
      startSessionWithQuestions(currentQuestions, getFormConfig());
    }
  });
}

// 펜 도구바 이벤트
colorChips.forEach((btn) => {
  btn.addEventListener("click", () => handleColorSelect(btn));
});

widthChips.forEach((btn) => {
  btn.addEventListener("click", () => handleWidthSelect(btn));
});

if (pencilOnlyToggleBtn) pencilOnlyToggleBtn.addEventListener("click", handlePencilOnlyToggle);
if (penModeBtn) penModeBtn.addEventListener("click", handlePenMode);
if (eraserToggleBtn) eraserToggleBtn.addEventListener("click", handleEraserToggle);
if (undoBtn) undoBtn.addEventListener("click", handleUndo);
if (redoBtn) redoBtn.addEventListener("click", handleRedo);
if (clearAllCanvasBtn) clearAllCanvasBtn.addEventListener("click", handleClearAllCanvas);

if (largeProblemToggleBtn) {
  const savedLargeMode = localStorage.getItem("math_canvas_large_problems") === "true";
  document.body.classList.toggle("large-problems", savedLargeMode);
  largeProblemToggleBtn.setAttribute("aria-pressed", String(savedLargeMode));
  largeProblemToggleBtn.addEventListener("click", () => {
    const enabled = !document.body.classList.contains("large-problems");
    document.body.classList.toggle("large-problems", enabled);
    largeProblemToggleBtn.setAttribute("aria-pressed", String(enabled));
    localStorage.setItem("math_canvas_large_problems", String(enabled));
    autoFitProblemStages();
  });
}

// 대시보드 및 오답 복습 이벤트 (Phase 4)
if (startMistakeSessionBtn) {
  startMistakeSessionBtn.addEventListener("click", handleStartMistakeSession);
}
if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener("click", handleClearHistory);
}

if (prevPageBtn) prevPageBtn.addEventListener("click", handlePrevPage);
if (nextPageBtn) nextPageBtn.addEventListener("click", handleNextPage);
function bindDraftRetryButton(button) {
  if (!button) return;
  button.addEventListener("click", () => {
    button.disabled = true;
    draftCoordinator.retry().catch(() => {}).finally(() => {
      button.disabled = false;
    });
  });
}
bindDraftRetryButton(retryDraftSaveBtn);
bindDraftRetryButton(retryGradingDraftSaveBtn);
if (pausePracticeBtn) {
  pausePracticeBtn.addEventListener("click", () => {
    if (confirm("현재까지 푼 연습을 중단하고 홈으로 돌아갈까요?")) {
      terminateSession();
    }
  });
}
if (submitPracticeBtn) submitPracticeBtn.addEventListener("click", handleSubmitPractice);

if (printWorksheetBtn) {
  printWorksheetBtn.addEventListener("click", () => handlePrintWorksheet(false));
}
if (printAnswerKeyBtn) {
  printAnswerKeyBtn.addEventListener("click", () => handlePrintWorksheet(true));
}

if (gradingGrid) {
  gradingGrid.addEventListener("click", (e) => {
    handleGradeClick(e);
    handleRedChipClick(e);
  });
  gradingGrid.addEventListener("input", handleRedPenInput);
}

if (toggleAnswersBtn) toggleAnswersBtn.addEventListener("click", handleToggleAnswers);
if (gradeAllCorrectBtn) gradeAllCorrectBtn.addEventListener("click", handleGradeAllCorrect);
if (finishGradingBtn) finishGradingBtn.addEventListener("click", handleFinishGrading);

if (abortSessionBtn) abortSessionBtn.addEventListener("click", handleAbortSession);
if (homeBrandLink) {
  homeBrandLink.addEventListener("click", (event) => {
    if (currentSession && currentSession.state === SessionState.PRACTICE_ACTIVE) {
      event.preventDefault();
      handleAbortSession();
    }
  });
}

if (modalCancelBtn) modalCancelBtn.addEventListener("click", () => confirmModal?.close());
if (modalConfirmBtn) modalConfirmBtn.addEventListener("click", terminateSession);

if (restartSessionBtn) {
  restartSessionBtn.addEventListener("click", () => {
    if (lastSessionConfig) {
      try {
        const questions = generateQuestionSet(lastSessionConfig);
        startSessionWithQuestions(questions, lastSessionConfig);
      } catch (e) {
        switchView(setupView);
        loadDashboardStats();
      }
    } else {
      switchView(setupView);
      loadDashboardStats();
    }
  });
}

if (goHomeBtn) {
  goHomeBtn.addEventListener("click", () => {
    navigate(ROUTES.HOME);
  });
}

window.addEventListener("online", updateNetworkState);
window.addEventListener("offline", updateNetworkState);

function updateSoundUI() {
  const muted = isSoundMuted();
  if (soundToggleBtn) {
    soundToggleBtn.classList.toggle("is-muted", muted);
  }
  if (soundIcon) {
    soundIcon.textContent = muted ? "🔇" : "🔊";
  }
  if (soundLabel) {
    soundLabel.textContent = muted ? "소리 끔" : "소리 켬";
  }
}

function handleSoundToggle() {
  toggleSound();
  updateSoundUI();
}

function updateThemeUI(themeInfo = getThemeInfo()) {
  if (themeIcon) themeIcon.textContent = themeInfo.icon;
  if (themeLabel) themeLabel.textContent = themeInfo.label;
}

function handleThemeToggle() {
  const info = cycleTheme();
  updateThemeUI(info);
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", handleThemeToggle);
}

if (soundToggleBtn) {
  soundToggleBtn.addEventListener("click", handleSoundToggle);
}

if (shortcutsHelpBtn) {
  shortcutsHelpBtn.addEventListener("click", () => {
    if (shortcutsModal) shortcutsModal.showModal();
  });
}
if (shortcutsCloseBtn) {
  shortcutsCloseBtn.addEventListener("click", () => {
    if (shortcutsModal) shortcutsModal.close();
  });
}

if (sessionDetailCloseBtn) {
  sessionDetailCloseBtn.addEventListener("click", () => {
    if (sessionDetailModal) sessionDetailModal.close();
  });
}
if (sessionDetailCloseBtnBottom) {
  sessionDetailCloseBtnBottom.addEventListener("click", () => {
    if (sessionDetailModal) sessionDetailModal.close();
  });
}

// 보기 모드 전환 리스너 (결과 화면)
if (resultViewCompactBtn) {
  resultViewCompactBtn.addEventListener("click", () => {
    if (currentResultSummary) renderResultDetailItems(currentResultSummary, "compact");
  });
}
if (resultViewDetailBtn) {
  resultViewDetailBtn.addEventListener("click", () => {
    if (currentResultSummary) renderResultDetailItems(currentResultSummary, "detail");
  });
}

// 보기 모드 전환 리스너 (과거 기록 모달)
if (modalViewCompactBtn) {
  modalViewCompactBtn.addEventListener("click", () => {
    if (currentModalSession) renderModalDetailItems(currentModalSession, "compact");
  });
}
if (modalViewDetailBtn) {
  modalViewDetailBtn.addEventListener("click", () => {
    if (currentModalSession) renderModalDetailItems(currentModalSession, "detail");
  });
}

if (calPrevMonthBtn) {
  calPrevMonthBtn.addEventListener("click", () => {
    currentCalMonth -= 1;
    if (currentCalMonth < 0) {
      currentCalMonth = 11;
      currentCalYear -= 1;
    }
    renderStudyCalendar(currentCalYear, currentCalMonth);
  });
}
if (calNextMonthBtn) {
  calNextMonthBtn.addEventListener("click", () => {
    currentCalMonth += 1;
    if (currentCalMonth > 11) {
      currentCalMonth = 0;
      currentCalYear += 1;
    }
    renderStudyCalendar(currentCalYear, currentCalMonth);
  });
}
if (calTodayBtn) {
  calTodayBtn.addEventListener("click", () => {
    const today = new Date();
    currentCalYear = today.getFullYear();
    currentCalMonth = today.getMonth();
    renderStudyCalendar(currentCalYear, currentCalMonth);
  });
}
if (closeDayDetailsBtn) {
  closeDayDetailsBtn.addEventListener("click", () => {
    if (calendarSelectedDetails) calendarSelectedDetails.hidden = true;
  });
}

if (roadmapMulTab) {
  roadmapMulTab.addEventListener("click", () => renderCurriculumRoadmap("mul"));
}
if (roadmapDivTab) {
  roadmapDivTab.addEventListener("click", () => renderCurriculumRoadmap("div"));
}

// 키보드 단축키 등록
setupKeyboardShortcuts({
  isPracticeActive: () => currentSession && currentSession.state === SessionState.PRACTICE_ACTIVE,
  isGradingActive: () => currentSession && currentSession.state === SessionState.GRADING_ACTIVE,
  onToggleHelp: () => {
    if (shortcutsModal) {
      if (shortcutsModal.open) shortcutsModal.close();
      else shortcutsModal.showModal();
    }
  },
  onPrevPage: handlePrevPage,
  onNextPage: handleNextPage,
  onTogglePencilOnly: handlePencilOnlyToggle,
  onToggleEraser: handleEraserToggle,
  onSelectColor: (idx) => {
    if (colorChips[idx]) handleColorSelect(colorChips[idx]);
  },
  onUndo: handleUndo,
  onRedo: handleRedo,
  onGradeAllCorrect: handleGradeAllCorrect,
  onToggleAnswers: handleToggleAnswers
});

const viewportController = createVisualViewportController({
  windowRef: window,
  documentRef: document,
  onChange: () => {
    autoFitProblemStages();
    activeCanvasInstances.forEach((instance) => instance.resize());
    gradingCanvasInstances.forEach((instance) => instance.resize());
  }
});

// 🌟 맞춤 추천 학습 카드 렌더링
async function renderAdaptiveRecommendCard() {
  const cardTitle = document.querySelector("#adaptiveCardTitle");
  const reasonText = document.querySelector("#adaptiveReasonText");
  const tagsContainer = document.querySelector("#adaptiveTags");
  const startBtn = document.querySelector("#startAdaptiveSessionBtn");

  if (!cardTitle || !reasonText || !startBtn) return;

  async function handleStartAdaptiveSession() {
    if (startBtn.disabled) return;
    const label = startBtn.querySelector("span");
    const originalLabel = label?.textContent || "추천 학습 시작하기";
    startBtn.disabled = true;
    startBtn.setAttribute("aria-busy", "true");
    if (label) label.textContent = "새 문제 준비 중...";

    try {
      let attempts = [];
      let mistakes = [];
      try {
        [attempts, mistakes] = await Promise.all([
          getRecentAttempts(50),
          getMistakes()
        ]);
      } catch (error) {
        console.warn("추천 학습 기록 조회 실패, 기본 추천으로 시작합니다.", error);
      }

      const weaknessAnalysis = analyzeWeaknesses(attempts, mistakes);
      const requestedStageId = weaknessAnalysis.weaknesses[0]?.stageId || "M2-2";
      let currentStageId = requestedStageId;
      let freshSession;

      try {
        freshSession = composeAdaptiveSession({
          count: 10,
          currentStageId,
          attempts,
          mistakes
        });
      } catch (error) {
        console.warn("추천 단계 생성 실패, 기본 단계로 시작합니다.", error);
        currentStageId = "M2-2";
        freshSession = composeAdaptiveSession({
          count: 10,
          currentStageId,
          attempts: [],
          mistakes: []
        });
      }

      startSessionWithQuestions(freshSession.questions, {
        operation: freshSession.questions[0]?.operation || "mul",
        count: freshSession.questions.length,
        pageSize: 4,
        cols: 2,
        rows: 2,
        mathFormat: "vertical",
        stageId: currentStageId
      });
    } catch (error) {
      console.error("추천 학습 시작 실패:", error);
      alert("추천 학습을 시작하지 못했습니다. 잠시 후 다시 눌러주세요.");
    } finally {
      startBtn.disabled = false;
      startBtn.removeAttribute("aria-busy");
      if (label) label.textContent = originalLabel;
    }
  }

  //+_+// 통계 조회가 실패해도 버튼 자체는 항상 즉시 동작하도록 먼저 연결한다.
  startBtn.onclick = handleStartAdaptiveSession;

  try {
    const attempts = await getRecentAttempts(50);
    const mistakes = await getMistakes();
    const weaknessAnalysis = analyzeWeaknesses(attempts, mistakes);
    const topWeakness = weaknessAnalysis.weaknesses[0];

    const currentStageId = topWeakness?.stageId || "M2-2";
    const composed = composeAdaptiveSession({
      count: 10,
      currentStageId,
      attempts,
      mistakes
    });

    cardTitle.textContent = topWeakness ? `${topWeakness.title} 집중 보강` : "2자리 × 1자리 표준 세로셈";
    reasonText.textContent = composed.recommendationReason;

    if (tagsContainer) {
      tagsContainer.innerHTML = `
        <span class="tag-chip">📝 10문제</span>
        <span class="tag-chip">💡 60/20/10/10 적응형</span>
        <span class="tag-chip">🎯 ${topWeakness ? "취약 기술 보강" : "표준 진도"}</span>
      `;
    }

  } catch (error) {
    console.warn("추천 카드 표시 갱신 실패, 기본 추천을 유지합니다.", error);
  }
}

//+_+// 미완료 Draft 복원 실행 헬퍼
function restoreSessionFromDraft(draft) {
  if (!draft || !draft.questions || draft.questions.length === 0) return;

  lastSessionConfig = draft.config;
  currentDraftCreatedAt = draft.createdAt || Date.now();
  currentQuestions = draft.questions;
  currentSession = createSession({ ...draft.config, sessionId: draft.sessionId }, draft.questions);
  questionStrokesMap.clear();
  gradingStrokesMap.clear();
  gradingResultsMap.clear();

  if (draft.studentStrokesMap) {
    Object.entries(draft.studentStrokesMap).forEach(([k, v]) => {
      questionStrokesMap.set(k, v);
    });
  }
  if (draft.gradingStrokesMap) {
    Object.entries(draft.gradingStrokesMap).forEach(([k, v]) => {
      gradingStrokesMap.set(k, v);
    });
  }
  if (draft.gradingResults) {
    Object.entries(draft.gradingResults).forEach(([k, v]) => gradingResultsMap.set(k, v));
  }

  if (draft.inputProfile && Object.values(InputProfile).includes(draft.inputProfile)) {
    currentInputProfile = resolveInputProfile({
      savedProfile: draft.inputProfile,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      maxTouchPoints: typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0,
      hasTouchStart: typeof window !== "undefined" && "ontouchstart" in window
    });
    updatePencilModeUI();
  }
  currentPenColor = draft.penColor || currentPenColor;
  currentPenWidth = Number(draft.penWidth) || currentPenWidth;
  currentIsEraser = Boolean(draft.isEraser);

  currentSession.start();
  currentSession.setQuestionSolveTimes(draft.perQuestionElapsedMs || {});
  currentSession.goToPage(draft.currentPageIndex || 0);
  draftCoordinator.setRevision(draft.revision || 0);

  //+_+// 단일 계약으로 복원 시간부터 정밀 흐름 시작!
  startSessionTimer(questionTimer, draft.totalElapsedMs || 0);

  if (draft.sessionState === SessionState.GRADING_ACTIVE || draft.sessionType === "grading") {
    hideAnswersInGrading = Boolean(draft.answersHidden);
    currentSession.submitPractice(draft.totalElapsedMs || 0);
    currentSession.startGrading();
    questionTimer.stop();
    Object.entries(draft.gradingResults || {}).forEach(([questionId, grade]) => {
      if (typeof grade.isCorrect === "boolean") {
        currentSession.gradeQuestion(questionId, grade.isCorrect, grade.comment || "");
      }
    });
    switchView(gradingView, false);
    renderGradingView();
  } else {
    switchView(practiceView, false);
    renderCurrentWorksheetPage();
  }
  updateToolDockUI();
}

//+_+// 🌟 미완료 Draft 복구 체크 (시작 시 모달 안내)
async function checkDraftResumeOnStartup() {
  const draftModal = document.querySelector("#draftResumeModal");
  const resumeBtn = document.querySelector("#draftResumeBtn");
  const discardBtn = document.querySelector("#draftDiscardBtn");

  try {
    const draft = await getDraft();
    if (!draft || !draft.questions || draft.questions.length === 0) return;

    if (draftModal && typeof draftModal.showModal === "function") {
      draftModal.showModal();

      if (resumeBtn) {
        resumeBtn.onclick = () => {
          draftModal.close();
          restoreSessionFromDraft(draft);
        };
      }

      if (discardBtn) {
        discardBtn.onclick = async () => {
          draftModal.close();
          await clearDraft();
        };
      }
    }
  } catch (error) {
    alert(`저장된 풀이를 복원할 수 없습니다. ${error.message || "Draft 데이터가 손상되었습니다."}`);
  }
}

//+_+// PWA 업데이트는 Draft 저장과 새 controller 확인이 모두 성공한 경우에만 적용한다.
function setupServiceWorkerUpdates() {
  if (!("serviceWorker" in navigator)) return;

  const updateBanner = document.querySelector("#updateBanner");
  const applyUpdateBtn = document.querySelector("#applyUpdateBtn");
  const dismissUpdateBtn = document.querySelector("#dismissUpdateBtn");

  if (dismissUpdateBtn && updateBanner) {
    dismissUpdateBtn.addEventListener("click", () => {
      updateBanner.hidden = true;
    });
  }

  const updateCoordinator = createUpdateCoordinator({
    flush: flushDraftSave,
    getController: () => navigator.serviceWorker.controller,
    waitForControllerChange: () => waitForServiceWorkerControllerChange(navigator.serviceWorker),
    reload: () => window.location.reload()
  });

  navigator.serviceWorker.register("./service-worker.js").then((reg) => {
    function promptUser(worker) {
      if (!worker) return;
      if (updateBanner) updateBanner.hidden = false;
      if (applyUpdateBtn) {
        applyUpdateBtn.onclick = async () => {
          if (updateCoordinator.isUpdating) return;
          applyUpdateBtn.disabled = true;
          try {
            await updateCoordinator.apply(worker);
          } catch (err) {
            alert(`업데이트를 중단했습니다. ${err.message || "저장 또는 앱 교체에 실패했습니다."}`);
          } finally {
            applyUpdateBtn.disabled = false;
          }
        };
      }
    }

    if (reg.waiting) {
      promptUser(reg.waiting);
    }

    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          promptUser(newWorker);
        }
      });
    });
  }).catch(() => {});
}

//+_+// ----------------------------------------------------
//+_+// Phase F3: 초기 부트스트랩 및 라우팅 연결
//+_+// ----------------------------------------------------
restoreFormSettings();
applyTheme(getCurrentTheme());
updateThemeUI();
updateSummary();
updateModeInput();
updateNetworkState();
updateSoundUI();
updateToolDockUI();

if (typeof document !== "undefined") {
  const isCurrentSessionActive = () => Boolean(
    currentSession && (currentSession.state === SessionState.PRACTICE_ACTIVE || currentSession.state === SessionState.GRADING_ACTIVE)
  );

  configureLearnerSessionGuard(isCurrentSessionActive);

  initLearnerView({
    isSessionActive: isCurrentSessionActive
  });

  addRouteListener(async ({ path }) => {
    if (path === ROUTES.LEARNERS) {
      await renderLearnerSelectView();
    } else if (path === ROUTES.HOME) {
      await renderLearnerHomeView();
    } else if (path === ROUTES.MATH_HOME) {
      await renderSubjectHomeView();
    } else if (path === ROUTES.MATH_ARITHMETIC) {
      switchView(setupView, false);
      loadDashboardStats();
      renderAdaptiveRecommendCard();
      renderCurriculumRoadmap();
      renderStudyCalendar(currentCalYear, currentCalMonth);
    }
    renderRouteView(path);
    await updateShellHeader();
  });

  bootstrapApp({
    isSessionActive: isCurrentSessionActive,
    hasActiveSession: (mode) => {
      if (!currentSession) return false;
      if (mode === "practice_active" || mode === "practice") return currentSession.state === SessionState.PRACTICE_ACTIVE;
      if (mode === "grading_active" || mode === "grading") return currentSession.state === SessionState.GRADING_ACTIVE;
      if (mode === "active_session") return currentSession.state === SessionState.PRACTICE_ACTIVE || currentSession.state === SessionState.GRADING_ACTIVE;
      if (mode === "result") return currentSession.state === SessionState.SESSION_COMPLETE;
      return true;
    }
  }).then(async (result) => {
    if (result.success) {
      const route = result.route;
      if (route === ROUTES.MATH_ARITHMETIC) {
        loadDashboardStats();
        renderAdaptiveRecommendCard();
        renderCurriculumRoadmap();
        renderStudyCalendar(currentCalYear, currentCalMonth);
        await checkDraftResumeOnStartup();
      } else if (route === ROUTES.MATH_PRACTICE || route === ROUTES.MATH_GRADING) {
        if (result.persistedDraft) {
          restoreSessionFromDraft(result.persistedDraft);
        }
      } else if (route === ROUTES.LEARNERS) {
        await renderLearnerSelectView();
      } else if (route === ROUTES.HOME) {
        await renderLearnerHomeView();
      } else if (route === ROUTES.MATH_HOME) {
        await renderSubjectHomeView();
      }
    }
  });

  setupServiceWorkerUpdates();
}
