//+_+// Phase F15A: 분수 개념과 표현 (Fraction Concepts and Representation) 전수 검증 테스트
//+_+// 2022 개정 교육과정 [4수01-09], [4수01-10], [4수01-11], [6수01-06] 준수

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import "fake-indexeddb/auto";
import { JSDOM } from "jsdom";

import {
  FractionType,
  VisualRepresentationType,
  validateFraction,
  normalizeFraction,
  classifyFractionType,
  areFractionsEquivalent,
  compareFractions,
  simplifyFraction,
  formatFraction,
  getFractionAccessibleDescription,
  toMixedFraction,
  fromMixedFraction
} from "../public/app/js/fractionConcepts.js";

import {
  renderFractionRepresentation,
  renderPartWholeBarSVG,
  renderPartWholeGridSVG,
  renderNumberLineSVG,
  renderSymbolicFractionDOM,
  renderEquivalentPairSVG
} from "../public/app/js/fractionRepresentationView.js";

import {
  DB_VERSION,
  getDB,
  clearAllData,
  saveDraftSession,
  getDraftSession,
  clearDraftSession,
  saveSubmissionSnapshot,
  getSubmission,
  getAllSubmissions,
  updateSubmissionGrading,
  setCurrentLearnerId,
  getAllReviewItems,
  getReviewItem,
  getAllProgressAggregates
} from "../public/app/js/storage.js";

import {
  submitLearningSession,
  startSubmissionGrading,
  saveSubmissionGradingProgress,
  finalizeSubmissionGrading,
  startReviewRetry,
  resolveReviewItem
} from "../public/app/js/data/learningCommands.js";

import {
  createSession,
  SessionState
} from "../public/app/js/sessionEngine.js";

import {
  applyStudentResponseChange,
  createResponseRecord
} from "../public/app/js/responseEngine.js";

import {
  bindChoiceResponseSurface,
  syncChoiceSurfaceSelection,
  bindTextResponseSurface,
  renderChoiceActivityStage,
  renderTextActivityStage,
  renderTypedActivityStage,
  refreshScribbleCommitSurface
} from "../public/app/js/typedInteractionSurface.js";

import {
  getWorkbookCatalog,
  getWorkbookCatalogItem
} from "../public/app/js/workbookCatalog.js";

import {
  evaluateContentEligibility
} from "../public/app/js/contentEligibility.js";

import {
  resolvePracticeRoute,
  resolveLandingRoute,
  isFractionRoute
} from "../public/app/js/learningRouteResolver.js";

import {
  ROUTES
} from "../public/app/js/platform/appRouter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, "../public/app/content/packages/math-fraction-concepts-v1");
const manifest = JSON.parse(fs.readFileSync(path.join(packageDir, "manifest.json"), "utf8"));
const curriculum = JSON.parse(fs.readFileSync(path.join(packageDir, "curriculum.json"), "utf8"));
const activitiesDoc = JSON.parse(fs.readFileSync(path.join(packageDir, "activities.json"), "utf8"));
const activities = activitiesDoc.activities;

//+_+// Group 1: Package Manifest & Curriculum Specification (2022 개정 교육과정 정합성)
test("F15A-PKG-01: 패키지 매니페스트 필수 속성 및 승인 상태", () => {
  assert.equal(manifest.packageId, "math-fraction-concepts-v1");
  assert.equal(manifest.packageVersion, "1.0.1");
  assert.equal(manifest.curriculumVersion, "2022-revised");
  assert.ok(manifest.subjects.includes("math"));
  assert.equal(manifest.status, "APPROVED");
  assert.equal(manifest.sourcePolicy.defaultLicense, "PROJECT_OWNED");
  assert.equal(manifest.sourcePolicy.defaultSourceType, "PROJECT_OWNED");
});

test("F15A-PKG-02: 2022 개정 교육과정 성취기준 매핑 검증", () => {
  const standards = new Set();
  for (const skill of curriculum.skills) {
    for (const std of skill.achievementStandardIds || []) {
      standards.add(std);
    }
  }
  assert.ok(standards.has("4수01-09"), "4수01-09 양의 분수와 단위분수 포함");
  assert.ok(standards.has("4수01-10"), "4수01-10 진분수, 가분수, 대분수 포함");
  assert.ok(standards.has("4수01-11"), "4수01-11 분모가 같은 분수 크기 비교 포함");
  assert.ok(standards.has("6수01-06"), "6수01-06 크기가 같은 분수 포함");
  assert.equal(curriculum.skills.length, 5);
  const numberLineSkill = curriculum.skills.find(skill => skill.skillId === "MATH_FRACTION_NUMBER_LINE_COMPARE");
  assert.deepEqual(numberLineSkill.achievementStandardIds, ["4수01-09", "4수01-11"]);
  assert.deepEqual(activities.find(activity => activity.id === "frac_number_line_pos_001").achievementStandardIds, ["4수01-09"]);
  assert.deepEqual(activities.find(activity => activity.id === "frac_number_line_compare_002").achievementStandardIds, ["4수01-11"]);
});

test("F15A-PKG-03: 액티비티 무결성 및 응답 표면 검증 (Canvas 인스턴스 0개 원칙)", () => {
  assert.equal(activities.length, 10);
  for (const act of activities) {
    assert.ok(["CHOICE", "TEXT"].includes(act.responseType), `Activity ${act.id} responseType must be CHOICE or TEXT`);
    assert.equal(Boolean(act.usesDrawingCanvas), false, `Activity ${act.id} must not use canvas`);
    assert.ok(act.metadata.fractionRepresentation, `Activity ${act.id} must specify fractionRepresentation`);
    assert.ok(act.prompt && act.prompt.trim().length > 0);
  }
});

//+_+// Group 2: 정수 분수 데이터 모델 (Integer-only Fraction Data Model)
test("F15A-MODEL-01: 정수 분수 유효성 검사 - 분모 0 금지", () => {
  assert.equal(validateFraction({ numerator: 1, denominator: 0 }), false);
  assert.throws(() => normalizeFraction({ numerator: 1, denominator: 0 }), /분모는 0일 수 없습니다/);
  assert.throws(() => normalizeFraction({ numerator: 3, denominator: 0 }), /분모는 0일 수 없습니다/);
});

test("F15A-MODEL-02: 정수 분수 유효성 검사 - 음수 및 부동소수점 금지", () => {
  assert.throws(() => normalizeFraction({ numerator: -1, denominator: 2 }), /음수/);
  assert.throws(() => normalizeFraction({ numerator: 1, denominator: -2 }), /음수/);
  assert.throws(() => normalizeFraction({ numerator: 1.5, denominator: 2 }), /소수/);
  assert.throws(() => normalizeFraction({ numerator: 1, denominator: 2.5 }), /소수/);
  assert.throws(() => normalizeFraction({ numerator: NaN, denominator: 3 }), /NaN/);
  assert.throws(() => normalizeFraction({ numerator: 1, denominator: Infinity }), /무한대/);
});

//+_+// Rework 1: 분모 1 정책 수정 (기본 public fraction 계약에서는 denominator 1 거부)
test("F15A-MODEL-03: 분모 1 정책 - 일반 분수 계약에서 분모 1은 거절된다", () => {
  assert.equal(validateFraction({ numerator: 4, denominator: 1 }), false);
  assert.throws(() => normalizeFraction({ numerator: 4, denominator: 1 }), /최소 2 이상|분모 1/);
  assert.throws(() => normalizeFraction("4/1"), /최소 2 이상|분모 1/);

  // 내부 전용 경로만 명시적 옵션으로 denominator 1 허용 가능
  const internal = normalizeFraction({ numerator: 4, denominator: 1 }, { allowWholeAsFraction: true, minDenominator: 1 });
  assert.equal(internal.denominator, 1);
});

test("F15A-MODEL-04: 분수 유형 분류 (PROPER, IMPROPER, MIXED, UNIT)", () => {
  assert.equal(classifyFractionType({ numerator: 1, denominator: 4 }), FractionType.UNIT);
  assert.equal(classifyFractionType({ numerator: 3, denominator: 4 }), FractionType.PROPER);
  assert.equal(classifyFractionType({ numerator: 5, denominator: 4 }), FractionType.IMPROPER);
  assert.equal(classifyFractionType({ numerator: 4, denominator: 4 }), FractionType.IMPROPER);
  assert.equal(classifyFractionType({ wholeNumber: 1, numerator: 1, denominator: 4 }), FractionType.MIXED);
});

test("F15A-MODEL-05: 정수 교차곱 기반 동치 및 크기 비교 (부동소수점 오차 배제)", () => {
  assert.equal(areFractionsEquivalent({ numerator: 1, denominator: 2 }, { numerator: 2, denominator: 4 }), true);
  assert.equal(areFractionsEquivalent({ numerator: 2, denominator: 3 }, { numerator: 4, denominator: 6 }), true);
  assert.equal(areFractionsEquivalent({ numerator: 3, denominator: 5 }, { numerator: 6, denominator: 10 }), true);
  assert.equal(areFractionsEquivalent({ numerator: 1, denominator: 3 }, { numerator: 1, denominator: 4 }), false);

  assert.ok(compareFractions({ numerator: 3, denominator: 7 }, { numerator: 5, denominator: 7 }) < 0);
  assert.ok(compareFractions({ numerator: 5, denominator: 7 }, { numerator: 3, denominator: 7 }) > 0);
  assert.equal(compareFractions({ numerator: 2, denominator: 4 }, { numerator: 1, denominator: 2 }), 0);

  //+_+// 대분수 비교
  assert.ok(compareFractions({ wholeNumber: 1, numerator: 1, denominator: 3 }, { wholeNumber: 1, numerator: 2, denominator: 3 }) < 0);
  assert.ok(compareFractions({ wholeNumber: 2, numerator: 1, denominator: 4 }, { wholeNumber: 1, numerator: 3, denominator: 4 }) > 0);
});

test("F15A-MODEL-06: 대분수 변환 (toMixedFraction, fromMixedFraction, simplifyFraction)", () => {
  const mixed = toMixedFraction({ numerator: 7, denominator: 3 });
  assert.equal(mixed.whole, 2);
  assert.equal(mixed.numerator, 1);
  assert.equal(mixed.denominator, 3);

  const improper = fromMixedFraction(mixed);
  assert.equal(improper.numerator, 7);
  assert.equal(improper.denominator, 3);

  const simplified = simplifyFraction({ numerator: 6, denominator: 8 });
  assert.equal(simplified.numerator, 3);
  assert.equal(simplified.denominator, 4);
});

test("F15A-MODEL-07: 한국어 접근성 텍스트 설명 생성", () => {
  const descProper = getFractionAccessibleDescription({
    type: "PART_WHOLE_BAR",
    numerator: 3,
    denominator: 4
  });
  assert.ok(descProper.includes("4분의 3"));

  const descMixed = getFractionAccessibleDescription({
    type: "SYMBOLIC_FRACTION",
    wholeNumber: 2,
    numerator: 1,
    denominator: 3
  });
  assert.ok(descMixed.includes("2와 3분의 1"));

  const formatted = formatFraction({ numerator: 5, denominator: 6 });
  assert.equal(formatted, "5/6");
});

//+_+// Rework 1: 신규 분수 데이터 모델 실패 선행 검증 (Fail-Closed)
test("F15A-REWORK-01: 분모 1 public Fraction 거부 (denominator = 1 reject)", () => {
  assert.equal(validateFraction({ numerator: 1, denominator: 1 }), false);
  assert.throws(() => normalizeFraction({ numerator: 1, denominator: 1 }), /최소 2 이상|분모 1/);
  assert.throws(() => normalizeFraction({ numerator: 3, denominator: 1 }), /최소 2 이상|분모 1/);
  assert.throws(() => normalizeFraction("1/1"), /최소 2 이상|분모 1/);
});

test("F15A-REWORK-02: 분모 0, 소수 분모, NaN, Infinity 입력 fail-closed 거절", () => {
  assert.throws(() => normalizeFraction({ numerator: 1, denominator: 0 }), /분모는 0일 수 없습니다/);
  assert.throws(() => normalizeFraction({ numerator: 1, denominator: 2.5 }), /소수/);
  assert.throws(() => normalizeFraction({ numerator: NaN, denominator: 3 }), /NaN/);
  assert.throws(() => normalizeFraction({ numerator: Infinity, denominator: 3 }), /무한대/);
  assert.throws(() => normalizeFraction({ numerator: 3, denominator: NaN }), /NaN/);
  assert.throws(() => normalizeFraction({ numerator: 3, denominator: Infinity }), /무한대/);
});

//+_+// Group 3: 시각적 표현 렌더러 (SVG/DOM Representation Viewers & Accessibility)
test("F15A-VIEW-01: PART_WHOLE_BAR SVG 생성 및 접근성 속성", () => {
  const svg = renderPartWholeBarSVG({
    fraction: { numerator: 3, denominator: 5 },
    width: 300,
    height: 60,
    ariaLabel: "전체 5조각 중 3조각"
  });
  assert.ok(svg.includes("<svg"), "SVG 태그 포함");
  assert.ok(svg.includes('role="img"'), "role img 속성 필수");
  assert.ok(svg.includes('aria-label="전체 5조각 중 3조각"'), "aria-label 포함");
  assert.ok(svg.includes("pattern"), "색각 이상 대응 해치 패턴 포함");
  assert.ok(svg.includes('pointer-events="none"'), "포인터 이벤트 차단");
});

test("F15A-VIEW-02: PART_WHOLE_GRID SVG 생성 및 접근성 속성", () => {
  const svg = renderPartWholeGridSVG({
    fraction: { numerator: 4, denominator: 8 },
    rows: 2,
    cols: 4,
    ariaLabel: "2행 4열 그리드 중 4칸 색칠"
  });
  assert.ok(svg.includes("<svg"));
  assert.ok(svg.includes('role="img"'));
  assert.ok(svg.includes('aria-label="2행 4열 그리드 중 4칸 색칠"'));
  assert.ok(svg.includes("pattern"));
  assert.ok(svg.includes('pointer-events="none"'));
});

test("F15A-VIEW-03: NUMBER_LINE SVG 생성 및 눈금/점 렌더링", () => {
  const svg = renderNumberLineSVG({
    fractions: [{ numerator: 2, denominator: 4 }],
    min: 0,
    max: 1,
    subdivisions: 4,
    ariaLabel: "0부터 1까지 4등분한 수직선"
  });
  assert.ok(svg.includes("<svg"));
  assert.ok(svg.includes('role="img"'));
  assert.ok(svg.includes('aria-label="0부터 1까지 4등분한 수직선"'));
  assert.ok(svg.includes("<line"));
  assert.ok(svg.includes("<circle"));
  assert.ok(svg.includes('pointer-events="none"'));
});

test("F15A-VIEW-04: SYMBOLIC_FRACTION DOM 생성", () => {
  const html = renderSymbolicFractionDOM({
    fraction: { wholeNumber: 1, numerator: 2, denominator: 5 },
    ariaLabel: "1과 5분의 2"
  });
  assert.ok(html.includes("symbolic-fraction-view"));
  assert.ok(html.includes('role="img"'));
  assert.ok(html.includes('aria-label="1과 5분의 2"'));
  assert.ok(html.includes("fraction-whole"));
  assert.ok(html.includes("fraction-numerator"));
  assert.ok(html.includes("fraction-denominator"));
  assert.ok(html.includes('pointer-events: none'));
});

test("F15A-VIEW-05: EQUIVALENT_PAIR SVG 생성 및 이중 모델 비교", () => {
  const svg = renderEquivalentPairSVG({
    fractionA: { numerator: 1, denominator: 2 },
    fractionB: { numerator: 2, denominator: 4 },
    ariaLabel: "1/2과 2/4 동치 분수 비교 바"
  });
  assert.ok(svg.includes("fraction-equivalent-pair-container"));
  assert.ok(svg.includes('role="img"'));
  assert.ok(svg.includes('aria-label="1/2과 2/4 동치 분수 비교 바"'));
});

test("F15A-VIEW-06: 렌더러 결정론 (Math.random 미사용 확인) 및 fail-closed 검증", () => {
  const svg1 = renderPartWholeBarSVG({ fraction: { numerator: 2, denominator: 3 } });
  const svg2 = renderPartWholeBarSVG({ fraction: { numerator: 2, denominator: 3 } });
  assert.equal(svg1, svg2, "동일 입력 시 완벽히 동일한 SVG 문자열 생성");

  // UNKNOWN representation은 침묵 폴백 대신 명시적 fail-closed 거절
  assert.throws(() => renderFractionRepresentation({
    type: "UNKNOWN_TYPE",
    fraction: { numerator: 1, denominator: 2 }
  }), /알 수 없는|지원되지 않는|UNKNOWN/);
});

//+_+// Rework 1: 시각 표현 모델 fail-closed 검증 (silent clamp/coercion 제거)
test("F15A-REWORK-03: BAR 렌더러는 유효하지 않은 분자/분모를 fail-closed로 거부한다", () => {
  // BAR invalid numerator reject (분자 > 분모)
  assert.throws(() => renderPartWholeBarSVG({ fraction: { numerator: 5, denominator: 4 } }), /초과|유효하지 않은/);
  // BAR invalid denominator reject (분모 < 2)
  assert.throws(() => renderPartWholeBarSVG({ fraction: { numerator: 1, denominator: 1 } }), /최소 2 이상|유효하지 않은/);
});

test("F15A-REWORK-04: GRID 렌더러는 소수 rows, 0 rows, 분모 불일치를 fail-closed로 거부한다", () => {
  // GRID decimal rows reject
  assert.throws(() => renderPartWholeGridSVG({ rows: 2.5, cols: 2, fraction: { numerator: 1, denominator: 5 } }), /정수|유효하지 않은/);
  // GRID zero rows reject
  assert.throws(() => renderPartWholeGridSVG({ rows: 0, cols: 4, fraction: { numerator: 1, denominator: 4 } }), /1 이상|유효하지 않은/);
  // GRID inconsistent denominator reject (rows * cols !== denominator)
  assert.throws(() => renderPartWholeGridSVG({ rows: 2, cols: 3, fraction: { numerator: 2, denominator: 8 } }), /불일치|일치하지 않습니다/);
});

test("F15A-REWORK-05: NUMBER_LINE 렌더러는 유효하지 않은 subdivisions 및 범위 밖 마커를 fail-closed로 거부한다", () => {
  // NUMBER_LINE invalid subdivisions reject
  assert.throws(() => renderNumberLineSVG({ subdivisions: 1.5, fractions: [{ numerator: 1, denominator: 2 }] }), /정수|유효하지 않은/);
  // NUMBER_LINE marker out of range reject (markerVal > maxVal)
  assert.throws(() => renderNumberLineSVG({ maxVal: 1, subdivisions: 4, fractions: [{ numerator: 5, denominator: 4 }] }), /범위|초과/);
});

//+_+// Rework 2: NUMBER_LINE denominator / subdivisions 충돌 fail-closed 검증
test("F15A-REWORK2-01: NUMBER_LINE denominator 및 subdivisions 충돌 fail-closed 거부", () => {
  // 1. fraction.denominator = 3 + subdivisions = 4 -> reject
  assert.throws(() => renderNumberLineSVG({
    subdivisions: 4,
    fraction: { numerator: 2, denominator: 3 }
  }), /일치하지 않습니다|불일치|충돌/);

  // 2. fraction.denominator = 4 + subdivisions = 4 -> pass
  const passSvg1 = renderNumberLineSVG({
    subdivisions: 4,
    fraction: { numerator: 2, denominator: 4 }
  });
  assert.ok(passSvg1.includes("<svg"));

  // 3. fraction.denominator only -> pass
  const passSvg2 = renderNumberLineSVG({
    fraction: { numerator: 2, denominator: 5 }
  });
  assert.ok(passSvg2.includes("<svg"));

  // 4. subdivisions only with markerNumerator -> pass
  const passSvg3 = renderNumberLineSVG({
    subdivisions: 6,
    markerNumerator: 3
  });
  assert.ok(passSvg3.includes("<svg"));
});

test("F15A-REWORK-06: EQUIVALENT_PAIR 및 알 수 없는 표현 타입 fail-closed 거부", () => {
  // EQUIVALENT_PAIR invalid side reject
  assert.throws(() => renderEquivalentPairSVG({ fractionA: { numerator: 1, denominator: 2 }, fractionB: { numerator: 1, denominator: 1 } }), /최소 2 이상|유효하지 않은/);
  // UNKNOWN representation reject
  assert.throws(() => renderFractionRepresentation({ type: "UNKNOWN_TYPE", fraction: { numerator: 1, denominator: 2 } }), /지원되지 않는|알 수 없는|UNKNOWN/);
});

//+_+// Group 4: 스토리지, 임시저장, 제출 스냅샷, 학부모 채점, 복습 사이클
test("F15A-STORAGE-01: DB_VERSION은 8을 엄격히 유지하며 신규 스토어를 추가하지 않는다", async () => {
  assert.equal(DB_VERSION, 8);
  const db = await getDB();
  const storeNames = Array.from(db.objectStoreNames);
  //+_+// 기존 12개 스토어 불변 확인
  assert.ok(storeNames.includes("draftSessions"));
  assert.ok(storeNames.includes("submissions"));
  assert.ok(storeNames.includes("reviewItems"));
  assert.ok(storeNames.includes("progressAggregates"));
  assert.equal(storeNames.length, 12);
});

test("F15A-STORAGE-02: 분수 세션 임시저장 및 복원 수명주기", async () => {
  await clearAllData();
  setCurrentLearnerId("learner-f15-a");

  const draftData = {
    id: "current_draft_learner-f15-a",
    sessionId: "session-fraction-001",
    learnerId: "learner-f15-a",
    subjectId: "math",
    questions: [activities[0]],
    responseRecords: {
      [activities[0].id]: {
        questionId: activities[0].id,
        responseType: "CHOICE",
        value: "choice_3",
        updatedAt: Date.now()
      }
    },
    savedAt: Date.now()
  };

  await saveDraftSession(draftData);
  const retrieved = await getDraftSession();
  assert.ok(retrieved);
  assert.equal(retrieved.responseRecords[activities[0].id].value, "choice_3");

  await clearDraftSession();
  const afterClear = await getDraftSession();
  assert.equal(afterClear, null);
});

test("F15A-STORAGE-03: 제출 스냅샷 불변성 및 답변 잠금", async () => {
  await clearAllData();
  setCurrentLearnerId("learner-f15-a");

  const submissionData = {
    sessionId: "session-fraction-001",
    learnerId: "learner-f15-a",
    subjectId: "math",
    questions: [activities[0]],
    responseSnapshots: { [activities[0].id]: { value: "choice_3" } },
    status: "PARENT_GRADING_PENDING",
    submittedAt: Date.now()
  };

  await saveSubmissionSnapshot(submissionData);
  const sub = await getSubmission("sub_session-fraction-001");
  assert.ok(sub);
  assert.equal(sub.status, "PARENT_GRADING_PENDING");
  assert.equal(sub.responseSnapshots[activities[0].id].value, "choice_3");
});

test("F15A-STORAGE-04: 보호자 채점 결정 반영", async () => {
  await clearAllData();
  setCurrentLearnerId("learner-f15-a");

  const submissionData = {
    sessionId: "session-fraction-002",
    learnerId: "learner-f15-a",
    subjectId: "math",
    questions: [activities[1]],
    responseSnapshots: { [activities[1].id]: { value: "1/4" } },
    status: "PARENT_GRADING_PENDING",
    submittedAt: Date.now()
  };

  await saveSubmissionSnapshot(submissionData);

  //+_+// 보호자 오답 채점 기록 반영
  await updateSubmissionGrading("sub_session-fraction-002", {
    [activities[1].id]: {
      isCorrect: false,
      gradingDecision: "INCORRECT",
      score: 0,
      feedback: "단위분수는 분모가 작을수록 큽니다."
    }
  });

  const updatedSub = await getSubmission("sub_session-fraction-002");
  assert.ok(updatedSub);
  assert.equal(updatedSub.gradingResults[activities[1].id].gradingDecision, "INCORRECT");
  assert.equal(updatedSub.gradingResults[activities[1].id].feedback, "단위분수는 분모가 작을수록 큽니다.");
});

test("F15A-STORAGE-05: 다중 학습자 격리 검증 (Learner A vs Learner B)", async () => {
  await clearAllData();

  //+_+// Learner A 활동
  setCurrentLearnerId("learner-f15-alpha");
  await saveSubmissionSnapshot({
    sessionId: "session-alpha-001",
    learnerId: "learner-f15-alpha",
    subjectId: "math",
    questions: [activities[0]],
    submittedAt: Date.now()
  });

  //+_+// Learner B 활동
  setCurrentLearnerId("learner-f15-beta");
  const bSubmissions = await getAllSubmissions();
  assert.equal(bSubmissions.length, 0, "Learner B는 Learner A의 제출물을 조회할 수 없음");

  const aSubmissions = await getAllSubmissions({ learnerId: "learner-f15-alpha" });
  assert.equal(aSubmissions.length, 1);
});

//+_+// Group 5: 학년 적합성 및 워크북 통합
test("F15A-WORKBOOK-01: 분수 워크북 정의 및 에디션 불변성", () => {
  const catalog = getWorkbookCatalog();
  const fractionWorkbooks = catalog.filter((wb) => wb.definition.subjectId === "math" && wb.definition.workbookId.startsWith("math-fraction-"));
  assert.equal(fractionWorkbooks.length, 3);

  const itemG3 = getWorkbookCatalogItem("math-fraction-g3");
  const itemG4 = getWorkbookCatalogItem("math-fraction-g4");
  const itemG5 = getWorkbookCatalogItem("math-fraction-g5");

  assert.ok(itemG3, "3학년 분수 워크북 존재");
  assert.ok(itemG4, "4학년 분수 워크북 존재");
  assert.ok(itemG5, "5학년 분수 워크북 존재");

  assert.equal(itemG3.definition.gradeLevel, 3);
  assert.equal(itemG4.definition.gradeLevel, 4);
  assert.equal(itemG5.definition.gradeLevel, 5);

  assert.equal(itemG3.edition.pages.length, 3);
  assert.equal(itemG4.edition.pages.length, 2);
  assert.equal(itemG5.edition.pages.length, 2);

  //+_+// 워크북 페이지 액티비티 매핑 유효성
  const allActIds = new Set(activities.map((a) => a.id));
  for (const item of [itemG3, itemG4, itemG5]) {
    for (const p of item.edition.pages) {
      if (p.activityRefs) {
        for (const ref of p.activityRefs) {
          assert.ok(allActIds.has(ref.activityId), `Workbook page activity ${ref.activityId} must exist in package`);
        }
      }
    }
  }
});

test("F15A-ELIGIBILITY-01: 학년 적격성 평가 (Grade Level Eligibility)", () => {
  const profileG3 = { id: "learner-g3", schoolGrade: 3, curriculumVersion: "2022-revised" };
  const profileG4 = { id: "learner-g4", schoolGrade: 4, curriculumVersion: "2022-revised" };

  const actG3 = activities.find((a) => a.id === "frac_part_whole_bar_001");
  const actG4 = activities.find((a) => a.id === "frac_types_identify_001");

  const resG3toG3 = evaluateContentEligibility({ learner: profileG3, content: actG3 });
  assert.equal(resG3toG3.eligible, true);

  const resG3toG4 = evaluateContentEligibility({ learner: profileG3, content: actG4 });
  assert.equal(typeof resG3toG4.eligible, "boolean");
});

//+_+// Group 6: 라우터 및 네비게이션 가드
test("F15A-ROUTER-01: 분수 학습 라우트 정의 및 가드 확인", () => {
  assert.equal(ROUTES.MATH_FRACTION, "/math/fraction");
  assert.equal(ROUTES.MATH_FRACTION_PRACTICE, "/math/fraction/practice");

  assert.ok(isFractionRoute("/math/fraction"));
  assert.ok(isFractionRoute("/math/fraction/practice"));
  assert.ok(!isFractionRoute("/math/measurement"));

  const landing = resolveLandingRoute({ subjectId: "math", courseId: "fraction" });
  assert.equal(landing, "/math/fraction");

  const practice = resolvePracticeRoute({ subjectId: "math", courseId: "fraction" });
  assert.equal(practice, "/math/fraction/practice");
});

//+_+// Group 7: 오프라인 캐시 및 Service Worker 등록 무결성
test("F15A-SW-01: 서비스 워커 프리캐시 항목에 신규 분수 모듈 및 리소스 포함", () => {
  const swPath = path.resolve(__dirname, "../public/app/service-worker.js");
  const swContent = fs.readFileSync(swPath, "utf8");

  assert.ok(swContent.includes("./js/fractionConcepts.js"), "fractionConcepts.js 캐시 목록 포함");
  assert.ok(swContent.includes("./js/fractionRepresentationView.js"), "fractionRepresentationView.js 캐시 목록 포함");
  assert.ok(swContent.includes("./content/packages/math-fraction-concepts-v1/manifest.json"), "manifest.json 캐시 목록 포함");
  assert.ok(swContent.includes("./content/packages/math-fraction-concepts-v1/curriculum.json"), "curriculum.json 캐시 목록 포함");
  assert.ok(swContent.includes("./content/packages/math-fraction-concepts-v1/activities.json"), "activities.json 캐시 목록 포함");
});

//+_+// Rework 1 Group 8: 실제 DOM 상호작용 검증 (CHOICE 및 TEXT 풀이, Draft 저장/복원, 제출 및 Lock)
function createMockElement(tag, attrs = {}) {
  const listeners = new Map();
  const classes = new Set();
  const el = {
    tagName: tag.toUpperCase(),
    value: attrs.value || "",
    checked: Boolean(attrs.checked),
    disabled: Boolean(attrs.disabled),
    innerHTML: "",
    dataset: {},
    classList: {
      add(c) { classes.add(c); },
      remove(c) { classes.delete(c); },
      toggle(c, force) {
        if (force !== undefined) {
          if (force) classes.add(c); else classes.delete(c);
        } else {
          if (classes.has(c)) classes.delete(c); else classes.add(c);
        }
      },
      contains(c) { return classes.has(c); }
    },
    addEventListener(event, fn) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(fn);
    },
    dispatchEvent(eventObj) {
      const fns = listeners.get(eventObj.type) || [];
      for (const fn of fns) fn(eventObj);
    },
    closest(selector) {
      if (selector === ".typed-choice-item" && el.card) return el.card;
      return null;
    }
  };
  return el;
}

test("F15A-REWORK-07: Fraction CHOICE Activity 실제 DOM 상호작용 (선택, Draft 저장, 복원, 제출 Lock)", async () => {
  await clearAllData();
  setCurrentLearnerId("learner-rework-choice");

  const act = activities.find((a) => a.id === "frac_part_whole_bar_001");
  assert.ok(act);
  assert.equal(act.responseType, "CHOICE");

  // 시각 표현 DOM 생성 검증
  const visualHtml = renderFractionRepresentation(act);
  assert.ok(visualHtml.includes("<svg"));
  assert.ok(visualHtml.includes('role="img"'));

  // 세션 생성
  const session = createSession({
    subjectId: "math",
    courseId: "fraction",
    moduleId: "fraction",
    skillId: act.skillId,
    learnerId: "learner-rework-choice"
  }, [act]);
  session.start();

  const responseRecordsMap = new Map();

  // CHOICE DOM 트리 구성
  const radios = act.choices.map((c) => {
    const radio = createMockElement("input", { value: c.id, checked: false });
    const card = createMockElement("label");
    radio.card = card;
    return radio;
  });

  const mockRoot = {
    querySelectorAll(sel) {
      if (sel.includes(`input[name="choice_${act.id}"]`)) return radios;
      return [];
    }
  };

  // Surface 바인딩
  bindChoiceResponseSurface(mockRoot, act.id, (selectedChoiceId) => {
    applyStudentResponseChange(session, responseRecordsMap, act, selectedChoiceId);
  });

  // 1. 학생이 3번째 선택지 (3/4, choice_3) 클릭 시뮬레이션
  const targetRadio = radios[2];
  targetRadio.checked = true;
  targetRadio.dispatchEvent({ type: "change", target: targetRadio });

  // 선택 상태가 DOM 및 ResponseRecord에 반영되었는지 검증
  assert.equal(targetRadio.card.classList.contains("selected-choice"), true);
  assert.equal(radios[0].card.classList.contains("selected-choice"), false);
  assert.equal(responseRecordsMap.get(act.id).value, "choice_3");

  // 2. Draft 저장
  const draftPayload = {
    id: "current_draft_learner-rework-choice",
    sessionId: session.id,
    learnerId: "learner-rework-choice",
    subjectId: "math",
    courseId: "fraction",
    questions: [act],
    responseRecords: Object.fromEntries(responseRecordsMap.entries()),
    savedAt: Date.now()
  };
  await saveDraftSession(draftPayload);

  // 3. Draft 재진입 복원 시뮬레이션
  const restored = await getDraftSession();
  assert.ok(restored);
  assert.equal(restored.responseRecords[act.id].value, "choice_3");

  // 4. 세션 제출
  const submission = {
    sessionId: session.id,
    learnerId: "learner-rework-choice",
    subjectId: "math",
    courseId: "fraction",
    questions: [act],
    responseSnapshots: { [act.id]: { value: "choice_3" } },
    status: "PARENT_GRADING_PENDING",
    submittedAt: Date.now()
  };
  await saveSubmissionSnapshot(submission);
  session.startSubmitting();
  session.submitPractice(1000);
  session.setPendingGrading();

  // 5. 제출 후 Lock 검증: 세션 상태가 잠겨 응답 변경 거절
  assert.throws(() => {
    applyStudentResponseChange(session, responseRecordsMap, act, "choice_1");
  }, /수정할 수 없습니다|Locked|PARENT_GRADING_PENDING/i);

  // DOM Disabled 잠금 상태 반영
  radios.forEach((r) => { r.disabled = true; });
  radios[0].checked = true;
  radios[0].dispatchEvent({ type: "change", target: radios[0] });
  // 잠겨있으므로 responseRecordsMap은 여전히 choice_3 유지
  assert.equal(responseRecordsMap.get(act.id).value, "choice_3");
});

test("F15A-REWORK-08: Fraction TEXT Activity 실제 DOM 상호작용 (입력, Draft 저장, 복원, 제출 Lock)", async () => {
  await clearAllData();
  setCurrentLearnerId("learner-rework-text");

  const act = activities.find((a) => a.id === "frac_equiv_text_002");
  assert.ok(act);
  assert.equal(act.responseType, "TEXT");

  // 시각 표현 DOM 생성 검증
  const visualHtml = renderFractionRepresentation(act);
  assert.ok(visualHtml.includes("<svg"));

  // 세션 생성
  const session = createSession({
    subjectId: "math",
    courseId: "fraction",
    moduleId: "fraction",
    skillId: act.skillId,
    learnerId: "learner-rework-text"
  }, [act]);
  session.start();

  const responseRecordsMap = new Map();

  // TEXT DOM 요소 구성
  const inputEl = createMockElement("input", { value: "" });

  // 1. 학생 입력 시뮬레이션 ("2/4")
  inputEl.value = "2/4";
  applyStudentResponseChange(session, responseRecordsMap, act, inputEl.value);
  assert.equal(responseRecordsMap.get(act.id).value, "2/4");

  // 2. Draft 저장
  const draftPayload = {
    id: "current_draft_learner-rework-text",
    sessionId: session.id,
    learnerId: "learner-rework-text",
    subjectId: "math",
    courseId: "fraction",
    questions: [act],
    responseRecords: Object.fromEntries(responseRecordsMap.entries()),
    savedAt: Date.now()
  };
  await saveDraftSession(draftPayload);

  // 3. Draft 재진입 복원
  const restored = await getDraftSession();
  assert.ok(restored);
  assert.equal(restored.responseRecords[act.id].value, "2/4");

  // 4. 제출
  await saveSubmissionSnapshot({
    sessionId: session.id,
    learnerId: "learner-rework-text",
    subjectId: "math",
    courseId: "fraction",
    questions: [act],
    responseSnapshots: { [act.id]: { value: "2/4" } },
    status: "PARENT_GRADING_PENDING",
    submittedAt: Date.now()
  });
  session.startSubmitting();
  session.submitPractice(1000);
  session.setPendingGrading();

  // 5. 제출 후 Lock 검증
  assert.throws(() => {
    applyStudentResponseChange(session, responseRecordsMap, act, "1/2");
  }, /수정할 수 없습니다|Locked|PARENT_GRADING_PENDING/i);
});

//+_+// Phase F15A Rework 3: 표준 JSDOM Acceptance 및 Production Renderer/Binding 검증
//+_+// ============================================================================

test("F15A-REWORK3-DOM-01: Fraction CHOICE Activity 표준 JSDOM 기반 Acceptance (Production renderer HTML mount, radio/label click/change event, Production binding handler, mutual exclusivity, selected-choice class, ResponseRecord sync, Draft save/restore, submitLearningSession, disabled/Lock)", async () => {
  await clearAllData();
  setCurrentLearnerId("learner-dom-choice");

  const act = activities.find((a) => a.id === "frac_part_whole_bar_001");
  assert.ok(act);
  assert.equal(act.responseType, "CHOICE");

  // 1. 학습 세션 생성
  const session = createSession({
    subjectId: "math",
    courseId: "fraction",
    moduleId: "fraction",
    skillId: act.skillId,
    learnerId: "learner-dom-choice"
  }, [act]);
  session.start();

  // 2. Production renderer 경로 실행 (직접 마크업 조립 금지, 실제 프로덕션 렌더러 호출)
  const renderedHtml = renderChoiceActivityStage(act, { session });
  assert.ok(renderedHtml.includes("typed-activity-stage"), "Production renderer 마크업 생성 확인");
  assert.ok(renderedHtml.includes(`choice_${act.id}`), "Production radio group 이름 포함");

  // 3. 실제 표준 DOM 구현체 (JSDOM)에 mount
  const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="stage-root">${renderedHtml}</div></body></html>`);
  const { window } = dom;
  const { document } = window;

  const labels = Array.from(document.querySelectorAll(".typed-choice-item"));
  const radios = Array.from(document.querySelectorAll(`input[name="choice_${act.id}"]`));
  assert.equal(labels.length, act.choices.length, "선택지 라벨 수 일치");
  assert.equal(radios.length, act.choices.length, "라디오 인풋 수 일치");

  const responseRecordsMap = new Map();
  let draftTriggerCount = 0;

  // 4. Production CHOICE binding 실행
  bindChoiceResponseSurface(document, act.id, (selectedChoiceId) => {
    applyStudentResponseChange(session, responseRecordsMap, act, selectedChoiceId);
    draftTriggerCount += 1;
  });

  // 5. 학생이 3번째 선택지 (3/4, choice_3) 라벨/라디오를 실제 click
  const targetLabel = labels[2];
  const targetRadio = radios[2];
  targetRadio.click();

  // 실제 DOM 상태, 라디오 checked, selected-choice 클래스, ResponseRecord 갱신 검증
  assert.equal(targetRadio.checked, true, "3번째 라디오 선택됨");
  assert.equal(radios[0].checked, false, "1번째 라디오 미선택");
  assert.equal(radios[1].checked, false, "2번째 라디오 미선택");
  assert.equal(targetLabel.classList.contains("selected-choice"), true, "선택된 라벨에 selected-choice 클래스 반영");
  assert.equal(labels[0].classList.contains("selected-choice"), false, "타 라벨에 selected-choice 미적용");
  assert.equal(responseRecordsMap.get(act.id).value, "choice_3", "ResponseRecord에 choice_3 동기화");
  assert.equal(draftTriggerCount, 1, "선택 변경 시 드래프트 저장 트리거");

  // 6. 다른 선택지 (2번째 choice_2) 클릭하여 상호배타성 및 클래스 토글 검증
  radios[1].click();
  assert.equal(radios[1].checked, true, "2번째 라디오 선택됨");
  assert.equal(targetRadio.checked, false, "동일 name 라디오 상호배타성에 의해 이전 라디오 해제");
  assert.equal(labels[1].classList.contains("selected-choice"), true, "2번째 라벨 selected-choice 부여");
  assert.equal(targetLabel.classList.contains("selected-choice"), false, "이전 3번째 라벨 selected-choice 제거");
  assert.equal(responseRecordsMap.get(act.id).value, "choice_2");
  assert.equal(draftTriggerCount, 2);

  // 다시 3번째로 복원
  targetRadio.click();
  assert.equal(targetRadio.checked, true);
  assert.equal(responseRecordsMap.get(act.id).value, "choice_3");

  // 7. Draft 저장 및 복원 검증
  const draftPayload = {
    id: "current_draft_learner-dom-choice",
    sessionId: session.id,
    learnerId: "learner-dom-choice",
    subjectId: "math",
    courseId: "fraction",
    questions: [act],
    responseRecords: Object.fromEntries(responseRecordsMap.entries()),
    savedAt: Date.now()
  };
  await saveDraftSession(draftPayload);

  const restoredDraft = await getDraftSession({ learnerId: "learner-dom-choice" });
  assert.ok(restoredDraft);
  assert.equal(restoredDraft.responseRecords[act.id].value, "choice_3");

  // 8. submitLearningSession 공통 프로덕션 커맨드로 제출
  const sub = await submitLearningSession({
    session,
    learnerId: "learner-dom-choice",
    responseSnapshots: responseRecordsMap,
    totalSolveTimeMs: 1500
  });

  assert.ok(sub);
  assert.equal(sub.status, "PARENT_GRADING_PENDING");
  assert.equal(sub.responseSnapshots[act.id].value, "choice_3");

  // 제출 후 Draft 자동 정리 확인
  const postSubmitDraft = await getDraftSession({ learnerId: "learner-dom-choice" });
  assert.equal(postSubmitDraft, null, "제출 성공 후 Draft는 완전히 제거되어야 함");

  // 9. 제출 후 Session 상태에 따른 Production renderer disabled 속성 및 Lock 검증
  const lockedHtml = renderChoiceActivityStage(act, { session, responseRecord: responseRecordsMap.get(act.id) });
  assert.ok(lockedHtml.includes("disabled"), "제출 완료 세션 렌더링 시 disabled 포함 확인");

  radios.forEach((r) => { r.disabled = true; });
  radios[0].click();
  assert.equal(responseRecordsMap.get(act.id).value, "choice_3", "disabled 라디오 클릭 무시");

  assert.throws(() => {
    applyStudentResponseChange(session, responseRecordsMap, act, "choice_1");
  }, /수정할 수 없습니다|Locked|PARENT_GRADING_PENDING/i);
});

test("F15A-REWORK3-DOM-02: Fraction TEXT Activity 표준 JSDOM 기반 Acceptance (Production renderer HTML mount, Production bindTextResponseSurface, focus, input, change, compositionstart/end, IME composing 중 조기 commit 차단, triggerDraftSave 연결, submitLearningSession, disabled/Lock)", async () => {
  await clearAllData();
  setCurrentLearnerId("learner-dom-text");

  const act = activities.find((a) => a.id === "frac_equiv_text_002");
  assert.ok(act);
  assert.equal(act.responseType, "TEXT");

  // 1. 학습 세션 생성
  const session = createSession({
    subjectId: "math",
    courseId: "fraction",
    moduleId: "fraction",
    skillId: act.skillId,
    learnerId: "learner-dom-text"
  }, [act]);
  session.start();

  // 2. Production renderer 경로 실행
  const renderedHtml = renderTextActivityStage(act, { session });
  assert.ok(renderedHtml.includes("typed-activity-stage"), "Production renderer 마크업 생성");
  assert.ok(renderedHtml.includes(`id="textInput_${act.id}"`), "Production text input ID 포함");

  // 3. 실제 표준 DOM 구현체 (JSDOM)에 mount
  const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="stage-root">${renderedHtml}</div></body></html>`);
  const { window } = dom;
  const { document, Event, CompositionEvent } = window;

  const inputEl = document.querySelector(`#textInput_${act.id}`);
  assert.ok(inputEl, "JSDOM에서 실제 input element 조회 확인");

  const responseRecordsMap = new Map();
  let draftSaveCount = 0;
  let scribbleRefreshed = false;

  // 4. Production bindTextResponseSurface 바인딩 (테스트에서 직접 addEventListener("input") 작성 금지)
  const boundEl = bindTextResponseSurface(
    document,
    act.id,
    (value) => {
      applyStudentResponseChange(session, responseRecordsMap, act, value);
    },
    {
      onDraftTrigger: () => {
        draftSaveCount += 1;
      },
      scheduleFrame: (callback) => {
        scribbleRefreshed = true;
        callback();
      }
    }
  );
  assert.equal(boundEl, inputEl, "Production text binder가 동일 element 반환");

  // 5. focus 이벤트 검증
  let focused = false;
  inputEl.addEventListener("focus", () => { focused = true; });
  inputEl.focus();
  assert.equal(focused, true, "inputEl focus 정상 동작");

  // 6. Windows Chrome / Korean IME compositionstart/compositionend 검증
  // 6-a: compositionstart 발생 (조합 시작)
  inputEl.dispatchEvent(new CompositionEvent("compositionstart"));
  assert.equal(inputEl.dataset.isComposing, "true", "조합 중 플래그 활성화");

  // 6-b: IME 조합 중 input 이벤트 발생 -> 조기 commit 차단 검증
  inputEl.value = "2";
  inputEl.dispatchEvent(new Event("input", { bubbles: true }));
  assert.equal(responseRecordsMap.has(act.id), false, "IME 조합 중에는 ResponseRecord 조기 commit 없음");
  assert.equal(draftSaveCount, 0, "조합 중 draft 저장 트리거 차단");

  // 6-c: compositionend 발생 -> 최종 값 commit 및 draft save 트리거 검증
  inputEl.value = "2/4";
  inputEl.dispatchEvent(new CompositionEvent("compositionend", { data: "2/4" }));
  assert.equal(inputEl.dataset.isComposing, "false", "조합 완료 플래그 해제");
  assert.equal(responseRecordsMap.get(act.id)?.value, "2/4", "compositionend 후 학생 응답 정상 반영");
  assert.equal(draftSaveCount, 1, "compositionend 후 draft 저장 트리거 1회 호출");
  assert.equal(scribbleRefreshed, true, "iPad Scribble/잔상 refresh 표면 동기화 호출 확인");

  // 7. 일반 change 이벤트 검증
  inputEl.value = "2/4";
  inputEl.dispatchEvent(new Event("change", { bubbles: true }));

  // 6. Draft 저장 및 복원
  const draftPayload = {
    id: "current_draft_learner-dom-text",
    sessionId: session.id,
    learnerId: "learner-dom-text",
    subjectId: "math",
    courseId: "fraction",
    questions: [act],
    responseRecords: Object.fromEntries(responseRecordsMap.entries()),
    savedAt: Date.now()
  };
  await saveDraftSession(draftPayload);

  const restoredDraft = await getDraftSession({ learnerId: "learner-dom-text" });
  assert.ok(restoredDraft);
  assert.equal(restoredDraft.responseRecords[act.id].value, "2/4");

  // 7. submitLearningSession 제출
  const sub = await submitLearningSession({
    session,
    learnerId: "learner-dom-text",
    responseSnapshots: responseRecordsMap,
    totalSolveTimeMs: 2000
  });

  assert.ok(sub);
  assert.equal(sub.status, "PARENT_GRADING_PENDING");
  assert.equal(sub.responseSnapshots[act.id].value, "2/4");

  // 8. disabled 및 수정 잠금 (Lock)
  const lockedHtml = renderTextActivityStage(act, { session, responseRecord: responseRecordsMap.get(act.id) });
  assert.ok(lockedHtml.includes("disabled"), "제출 완료 세션 렌더링 시 input disabled 확인");

  inputEl.disabled = true;
  assert.throws(() => {
    applyStudentResponseChange(session, responseRecordsMap, act, "1/2");
  }, /수정할 수 없습니다|Locked|PARENT_GRADING_PENDING/i);
});

test("F15A-REWORK3-DOM-03: Fraction 시각 표현 요소(pointer-events: none) 및 접근성 실제 DOM 검증 (DOM 구조 및 속성 검증, 브라우저 CSS layout hit-test는 E2E 범위로 분리)", () => {
  // 1. 모든 분수 표현 타입 렌더러 결과에 pointer-events: none 및 접근성 속성 포함 확인
  const partWholeHtml = renderPartWholeBarSVG({ denominator: 4, numerator: 3 });
  const gridHtml = renderPartWholeGridSVG({ rows: 2, cols: 3, denominator: 6, numerator: 2 });
  const lineHtml = renderNumberLineSVG({ subdivisions: 5, fraction: { numerator: 2, denominator: 5 } });
  const pairHtml = renderEquivalentPairSVG({
    pair1: { type: "PART_WHOLE_BAR", denominator: 2, numerator: 1 },
    pair2: { type: "PART_WHOLE_BAR", denominator: 4, numerator: 2 }
  });
  const symHtml = renderSymbolicFractionDOM({ denominator: 4, numerator: 3 });

  for (const html of [partWholeHtml, gridHtml, lineHtml, pairHtml, symHtml]) {
    assert.ok(html.includes("pointer-events: none"), "시각 요소에 pointer-events: none 속성 필수");
    assert.ok(html.includes('role="img"'), "스크린리더 접근성을 위한 role='img' 필수");
    assert.ok(html.includes("aria-label"), "한국어 접근성 aria-label 필수");
  }

  // 2. 실제 표준 DOM(JSDOM)에서 Production 마크업 내 시각 표현과 상호작용 입력 요소의 공존 및 이벤트 도달 검증
  // 주의: JSDOM은 브라우저의 레이아웃 CSS hit-test(픽셀 좌표 기반 포인터 디스패치) 엔진을 포함하지 않으므로,
  // 실제 스타일 속성 및 DOM 트리 공존성을 검증하며, 완전한 브라우저 hit-test는 browser/iPad E2E 검증 범위로 명시 분리한다.
  const act = activities.find((a) => a.id === "frac_part_whole_bar_001");
  const fullHtml = renderChoiceActivityStage(act, {});
  const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="mount">${fullHtml}</div></body></html>`);
  const { document } = dom.window;

  const visualContainer = document.querySelector(".fraction-visual-container");
  assert.ok(visualContainer, "시각 표현 컨테이너 존재");
  assert.ok(
    visualContainer.getAttribute("style")?.includes("pointer-events: none"),
    "시각 표현 컨테이너에 pointer-events: none 스타일 적용"
  );

  const svgEl = visualContainer.querySelector("svg");
  assert.ok(svgEl, "SVG 요소 존재");
  assert.equal(svgEl.getAttribute("role"), "img", "접근성 role='img' 속성 확인");
  assert.ok(svgEl.getAttribute("aria-label")?.length > 0, "접근성 aria-label 확인");
  assert.equal(svgEl.getAttribute("pointer-events"), "none", "SVG pointer-events 속성 확인");

  // 시각 표현 컨테이너와 상호작용 라디오 버튼이 동일 스테이지에서 충돌 없이 이벤트 도달 가능함 검증
  const radio = document.querySelector(`input[name="choice_${act.id}"]`);
  assert.ok(radio, "상호작용 라디오 버튼 존재");
  let clicked = false;
  radio.addEventListener("click", () => { clicked = true; });
  radio.click();
  assert.equal(clicked, true, "상호작용 라디오에 클릭 이벤트 정상 전달");
});

test("F15A-REWORK2-E2E-01: Fraction Activity 전체 라이프사이클 E2E (Activity -> ResponseRecord -> Draft 저장/복원 -> Submission Snapshot -> PARENT_GRADING_PENDING -> Guardian Grading Start -> Guardian WRONG -> Finalize -> ReviewItem 생성 -> Review Retry Start -> Retry Draft -> Retry Submit -> Guardian Re-grade -> Review resolve -> ProgressAggregate 확인)", async () => {
  await clearAllData();
  const learnerId = "learner-f15a-e2e-full";
  setCurrentLearnerId(learnerId);

  const act = activities.find((a) => a.id === "frac_part_whole_bar_001");
  assert.ok(act);
  assert.equal(act.courseId, "fraction");

  // Step 1: 세션 시작 및 ResponseRecord 작성 (학생 오답: choice_1)
  const session = createSession({
    subjectId: "math",
    courseId: "fraction",
    moduleId: "fraction",
    skillId: act.skillId,
    learnerId
  }, [act]);
  session.start();

  const responseRecordsMap = new Map();
  applyStudentResponseChange(session, responseRecordsMap, act, "choice_1");
  assert.equal(responseRecordsMap.get(act.id).value, "choice_1");

  // Step 2: Draft 저장 및 복원
  await saveDraftSession({
    id: `current_draft_${learnerId}`,
    sessionId: session.id,
    learnerId,
    subjectId: "math",
    courseId: "fraction",
    questions: [act],
    responseRecords: Object.fromEntries(responseRecordsMap.entries()),
    savedAt: Date.now()
  });

  const restoredDraft = await getDraftSession({ learnerId });
  assert.ok(restoredDraft);
  assert.equal(restoredDraft.responseRecords[act.id].value, "choice_1");

  // Step 3: 공통 프로덕션 커맨드 submitLearningSession 제출
  const origSub = await submitLearningSession({
    session,
    learnerId,
    responseSnapshots: responseRecordsMap,
    totalSolveTimeMs: 1800
  });

  assert.ok(origSub);
  assert.equal(origSub.status, "PARENT_GRADING_PENDING");
  assert.equal(origSub.responseSnapshots[act.id].value, "choice_1");

  const origSnapshotCopy = JSON.parse(JSON.stringify(origSub.responseSnapshots));

  // Step 4: 보호자 채점 시작 (startSubmissionGrading -> GRADING_ACTIVE)
  await startSubmissionGrading(origSub.id, { learnerId });
  const gradingActiveSub = await getSubmission(origSub.id, { learnerId });
  assert.equal(gradingActiveSub.status, "GRADING_ACTIVE");

  // Step 5: 보호자 오답 판정 기록 및 확정 (finalizeSubmissionGrading -> GRADED)
  await saveSubmissionGradingProgress(origSub.id, {
    [act.id]: {
      decision: "WRONG",
      isCorrect: false,
      comment: "전체 4칸 중 색칠된 3칸을 세어야 합니다."
    }
  }, new Map(), { learnerId });

  const finalizedOrig = await finalizeSubmissionGrading(origSub.id, { learnerId });
  assert.equal(finalizedOrig.submission.status, "GRADED");

  // Step 6: ReviewItem 생성 확인 (unresolved, reasonCode: WRONG, courseId: fraction)
  const reviewItems = await getAllReviewItems({ learnerId });
  assert.equal(reviewItems.length, 1);
  const revItem = reviewItems[0];
  assert.equal(revItem.state, "unresolved");
  assert.equal(revItem.reasonCode, "WRONG");
  assert.equal(revItem.courseId, "fraction");
  assert.equal(revItem.subjectId, "math");

  // Step 7: 바로 다시 풀기 (startReviewRetry -> retrying)
  const { retrySession, reviewItem: retryingItem } = await startReviewRetry(revItem.id, { learnerId });
  assert.ok(retrySession);
  assert.equal(retryingItem.state, "retrying");
  assert.equal(retrySession.questions[0].reviewItemId, revItem.id);

  // Step 8: Retry Session에서 올바른 답변 작성 (choice_3)
  retrySession.start();
  assert.equal(retrySession.state, SessionState.PRACTICE_ACTIVE);
  const retryResponseMap = new Map();
  applyStudentResponseChange(retrySession, retryResponseMap, retrySession.questions[0], "choice_3");
  assert.equal(retryResponseMap.get(act.id).value, "choice_3");

  // Step 9: Retry Draft 저장 및 복원
  await saveDraftSession({
    id: `current_draft_${learnerId}`,
    sessionId: retrySession.id,
    learnerId,
    subjectId: "math",
    courseId: "fraction",
    questions: retrySession.questions,
    responseRecords: retryResponseMap,
    savedAt: Date.now()
  });

  const restoredRetryDraft = await getDraftSession({ learnerId });
  assert.ok(restoredRetryDraft);
  assert.equal(restoredRetryDraft.responseRecords[act.id].value, "choice_3");

  // Step 10: Retry 제출 (submitLearningSession -> review_pending 전이)
  const retrySub = await submitLearningSession({
    session: retrySession,
    learnerId,
    responseSnapshots: retryResponseMap,
    reviewItemId: revItem.id,
    totalSolveTimeMs: 1200
  });

  assert.ok(retrySub);
  assert.notEqual(retrySub.id, origSub.id);
  assert.equal(retrySub.status, "PARENT_GRADING_PENDING");
  assert.equal(retrySub.responseSnapshots[act.id].value, "choice_3");

  const midReviewItem = await getReviewItem(revItem.id, { learnerId });
  assert.equal(midReviewItem.state, "review_pending", "재풀이 제출 시 review_pending으로 자동 전이");

  // Step 11: 보호자 재채점 (startSubmissionGrading -> saveSubmissionGradingProgress -> finalizeSubmissionGrading)
  await startSubmissionGrading(retrySub.id, { learnerId });
  await saveSubmissionGradingProgress(retrySub.id, {
    [act.id]: {
      decision: "CORRECT",
      isCorrect: true,
      comment: "3/4로 바르게 고쳤습니다!"
    }
  }, new Map(), { learnerId });

  const finalizedRetry = await finalizeSubmissionGrading(retrySub.id, { learnerId });
  assert.equal(finalizedRetry.submission.status, "GRADED");

  // Step 12: ReviewItem 해결 (resolveReviewItem -> resolved)
  const resolvedItem = await resolveReviewItem(revItem.id, { learnerId });
  assert.equal(resolvedItem.state, "resolved");
  assert.ok(resolvedItem.resolvedAt > 0);

  // Step 13: 최종 ProgressAggregate 공식 통계 확인
  const aggregates = await getAllProgressAggregates({ learnerId });
  assert.ok(aggregates.length > 0);
  const fractionAgg = aggregates.find((a) => a.courseId === "fraction");
  assert.ok(fractionAgg, "분수 코스 집계 존재");
  assert.equal(fractionAgg.correctCount, 1);
  assert.equal(fractionAgg.incorrectCount, 1);

  // Step 14: 원본 Submission Snapshot 불변성 (deepEqual)
  const reloadedOrig = await getSubmission(origSub.id, { learnerId });
  assert.deepEqual(reloadedOrig.responseSnapshots, origSnapshotCopy, "재풀이 완료 후에도 원본 제출 스냅샷은 엄격히 불변(deepEqual)이어야 함");
});

test("F15A-REWORK2-E2E-02: 원본 Submission Snapshot 불변성, 자동 채점 배제, Guardian GradeDecision 공식 Progress 단일 SSOT 검증", async () => {
  await clearAllData();
  const learnerId = "learner-f15a-ssot";
  setCurrentLearnerId(learnerId);

  const act = activities.find((a) => a.id === "frac_types_identify_001");
  assert.ok(act);

  const session = createSession({
    subjectId: "math",
    courseId: "fraction",
    moduleId: "fraction",
    skillId: act.skillId,
    learnerId
  }, [act]);
  session.start();

  // 학생이 기대 정답("choice_2")을 입력
  const responseMap = new Map();
  applyStudentResponseChange(session, responseMap, act, "choice_2");

  const sub = await submitLearningSession({
    session,
    learnerId,
    responseSnapshots: responseMap
  });

  // 보호자 채점 전: 학생 답안이 정답과 같아도 ProgressAggregate는 절대 자동 생성되지 않음
  const preGradingAggs = await getAllProgressAggregates({ learnerId });
  assert.equal(preGradingAggs.length, 0, "보호자 채점 전에는 자동 채점으로 ProgressAggregate를 생성하지 않는다");

  // 보호자가 명시적으로 CORRECT 판정을 내리고 finalize해야만 공식 Progress 생성
  await startSubmissionGrading(sub.id, { learnerId });
  await saveSubmissionGradingProgress(sub.id, {
    [act.id]: { decision: "CORRECT", isCorrect: true, comment: "정확합니다." }
  }, new Map(), { learnerId });
  await finalizeSubmissionGrading(sub.id, { learnerId });

  const postGradingAggs = await getAllProgressAggregates({ learnerId });
  assert.equal(postGradingAggs.length, 1, "보호자 확정 후에만 ProgressAggregate 생성");
  assert.equal(postGradingAggs[0].correctCount, 1);
  assert.equal(postGradingAggs[0].gradedAttemptCount, 1);
});

test("F15A-REWORK2-E2E-03: 다중 학습자 데이터 격리 및 분수(fraction)와 타 코스 Progress 분리 검증", async () => {
  await clearAllData();

  // 1. Learner Alpha 분수 학습 진행 및 오답 확정
  const learnerAlpha = "learner-alpha-fraction";
  setCurrentLearnerId(learnerAlpha);

  const fracAct = activities.find((a) => a.id === "frac_part_whole_bar_001");
  const sessAlpha = createSession({ subjectId: "math", courseId: "fraction", learnerId: learnerAlpha }, [fracAct]);
  sessAlpha.start();
  const mapAlpha = new Map();
  applyStudentResponseChange(sessAlpha, mapAlpha, fracAct, "choice_1");
  const subAlpha = await submitLearningSession({ session: sessAlpha, learnerId: learnerAlpha, responseSnapshots: mapAlpha });
  await startSubmissionGrading(subAlpha.id, { learnerId: learnerAlpha });
  await saveSubmissionGradingProgress(subAlpha.id, { [fracAct.id]: { decision: "WRONG", isCorrect: false } }, new Map(), { learnerId: learnerAlpha });
  await finalizeSubmissionGrading(subAlpha.id, { learnerId: learnerAlpha });

  // 2. Learner Beta 조회 시 격리 확인
  const learnerBeta = "learner-beta-fraction";
  setCurrentLearnerId(learnerBeta);

  const betaReviewItems = await getAllReviewItems({ learnerId: learnerBeta });
  assert.equal(betaReviewItems.length, 0, "Learner Beta는 Learner Alpha의 ReviewItem을 볼 수 없음");

  const betaAggs = await getAllProgressAggregates({ learnerId: learnerBeta });
  assert.equal(betaAggs.length, 0, "Learner Beta는 Learner Alpha의 ProgressAggregate를 볼 수 없음");

  const betaDraft = await getDraftSession({ learnerId: learnerBeta });
  assert.equal(betaDraft, null, "Learner Beta는 Learner Alpha의 Draft를 볼 수 없음");

  // 3. Learner Alpha 타 코스(arithmetic) 진행 및 코스 격리 확인
  setCurrentLearnerId(learnerAlpha);
  const arithAct = {
    id: "arith_add_001",
    subjectId: "math",
    courseId: "arithmetic",
    unitId: "add",
    level: "M1",
    operation: "mul",
    operandA: 2,
    operandB: 3,
    answer: 6,
    expectedAnswer: 6,
    responseType: "TEXT"
  };
  const sessArith = createSession({ subjectId: "math", courseId: "arithmetic", learnerId: learnerAlpha }, [arithAct]);
  sessArith.start();
  const mapArith = new Map();
  applyStudentResponseChange(sessArith, mapArith, arithAct, "6");
  const subArith = await submitLearningSession({ session: sessArith, learnerId: learnerAlpha, responseSnapshots: mapArith });
  await startSubmissionGrading(subArith.id, { learnerId: learnerAlpha });
  await saveSubmissionGradingProgress(subArith.id, { [arithAct.id]: { decision: "CORRECT", isCorrect: true } }, new Map(), { learnerId: learnerAlpha });
  await finalizeSubmissionGrading(subArith.id, { learnerId: learnerAlpha });

  // 4. Learner Alpha의 ProgressAggregate에서 fraction과 arithmetic이 혼합되지 않고 분리되어 있는지 검증
  const alphaAggs = await getAllProgressAggregates({ learnerId: learnerAlpha });
  assert.equal(alphaAggs.length, 2, "fraction과 arithmetic 코스가 독립적으로 집계됨");

  const fracAgg = alphaAggs.find((a) => a.courseId === "fraction");
  const arithAgg = alphaAggs.find((a) => a.courseId === "arithmetic");

  assert.ok(fracAgg, "분수 ProgressAggregate 분리 존재");
  assert.ok(arithAgg, "연산 ProgressAggregate 분리 존재");
  assert.equal(fracAgg.incorrectCount, 1);
  assert.equal(fracAgg.correctCount, 0);
  assert.equal(arithAgg.correctCount, 1);
  assert.equal(arithAgg.incorrectCount, 0);
});

//+_+// Group 8: Phase F15A Rework 4 - TEXT Scribble Refresh SSOT 및 중복 호출 제거 회귀 테스트
test("F15A-R4-TEXT-01: 일반 TEXT input 1회 발생 시 onInput 1회, onDraftTrigger 1회, Scribble refresh outer frame 1회 스케줄링 검증 (중복 scheduling 금지)", () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><input id="textInput_frac_r4_01" class="typed-text-input" /></body></html>');
  const inputEl = dom.window.document.getElementById("textInput_frac_r4_01");

  let onInputCallCount = 0;
  let onDraftTriggerCallCount = 0;
  let outerFrameCount = 0;
  const frameQueue = [];

  const mockScheduleFrame = (fn) => {
    outerFrameCount++;
    frameQueue.push(fn);
  };

  bindTextResponseSurface(
    dom.window.document,
    "frac_r4_01",
    (value) => {
      onInputCallCount++;
    },
    {
      onDraftTrigger: () => {
        onDraftTriggerCallCount++;
      },
      scheduleFrame: mockScheduleFrame
    }
  );

  inputEl.value = "2/3";
  inputEl.dispatchEvent(new dom.window.Event("input", { bubbles: true }));

  assert.equal(onInputCallCount, 1, "onInput은 정확히 1회 호출되어야 함");
  assert.equal(onDraftTriggerCallCount, 1, "onDraftTrigger는 정확히 1회 호출되어야 함");
  assert.equal(outerFrameCount, 1, "Scribble refresh outer frame은 중복 없이 정확히 1회만 스케줄링되어야 함");
  assert.equal(inputEl.classList.contains("scribble-commit-refresh"), true, "Scribble refresh 클래스가 추가되어 있어야 함");

  // Drain frame queue to verify 2-stage RAF completion and class removal
  assert.equal(frameQueue.length, 1);
  const outerCallback = frameQueue.shift();
  outerCallback();
  assert.equal(frameQueue.length, 1);
  const innerCallback = frameQueue.shift();
  innerCallback();
  assert.equal(inputEl.classList.contains("scribble-commit-refresh"), false, "2단계 프레임 완료 후 refresh 클래스가 제거되어야 함");
});

test("F15A-R4-TEXT-02: IME compositionstart -> composing input -> compositionend 흐름에서 조합 중 commit 0회 및 종료 시 최종 commit/draft/refresh 각 1회 검증", () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><input id="textInput_frac_r4_02" class="typed-text-input" /></body></html>');
  const inputEl = dom.window.document.getElementById("textInput_frac_r4_02");

  let onInputCallCount = 0;
  let onDraftTriggerCallCount = 0;
  let outerFrameCount = 0;
  const frameQueue = [];

  const mockScheduleFrame = (fn) => {
    outerFrameCount++;
    frameQueue.push(fn);
  };

  bindTextResponseSurface(
    dom.window.document,
    "frac_r4_02",
    (value) => {
      onInputCallCount++;
    },
    {
      onDraftTrigger: () => {
        onDraftTriggerCallCount++;
      },
      scheduleFrame: mockScheduleFrame
    }
  );

  // 1. compositionstart
  inputEl.dispatchEvent(new dom.window.CompositionEvent("compositionstart", { bubbles: true }));
  assert.equal(inputEl.dataset.isComposing, "true");

  // 2. composing input events (typing intermediate characters)
  inputEl.value = "ㄱ";
  inputEl.dispatchEvent(new dom.window.InputEvent("input", { bubbles: true, isComposing: true }));
  inputEl.value = "가";
  inputEl.dispatchEvent(new dom.window.InputEvent("input", { bubbles: true, isComposing: true }));

  assert.equal(onInputCallCount, 0, "조합 중에는 onInput 호출이 없어야 함 (0회)");
  assert.equal(onDraftTriggerCallCount, 0, "조합 중에는 onDraftTrigger 호출이 없어야 함 (0회)");
  assert.equal(outerFrameCount, 0, "조합 중에는 Scribble refresh 스케줄링이 없어야 함 (0회)");

  // 3. compositionend with final committed value
  inputEl.value = "3/4";
  inputEl.dispatchEvent(new dom.window.CompositionEvent("compositionend", { bubbles: true, data: "3/4" }));

  assert.equal(inputEl.dataset.isComposing, "false");
  assert.equal(onInputCallCount, 1, "compositionend에서 최종 commit onInput은 정확히 1회 호출되어야 함");
  assert.equal(onDraftTriggerCallCount, 1, "compositionend에서 onDraftTrigger는 정확히 1회 호출되어야 함");
  assert.equal(outerFrameCount, 1, "compositionend에서 Scribble refresh outer frame은 정확히 1회 스케줄링되어야 함");
  assert.equal(inputEl.classList.contains("scribble-commit-refresh"), true);

  // Drain frame queue
  const outerCallback = frameQueue.shift();
  outerCallback();
  const innerCallback = frameQueue.shift();
  innerCallback();
  assert.equal(inputEl.classList.contains("scribble-commit-refresh"), false);
});

test("F15A-R4-TEXT-03: Production app.js와 shared binder 연결 구조 및 동일 event당 refresh 1회 보장 검증", () => {
  // 1. Production app.js 정적 계약 검증:
  // app.js는 bindTextResponseSurface를 사용하고, 그 콜백 내에서 applyStudentResponseChange만 호출하며,
  // 중복 refreshScribbleCommitSurface를 직접 호출하지 않는다.
  const appSource = fs.readFileSync(new URL("../public/app/js/app.js", import.meta.url), "utf8");
  assert.match(appSource, /bindTextResponseSurface\s*\(\s*document,\s*q\.id/);
  assert.doesNotMatch(appSource, /applyStudentResponseChange[\s\S]*?refreshScribbleCommitSurface/);

  // 2. Production wiring과 동일한 데이터 구조 및 binder 연결 검증
  const testAct = activities.find((a) => a.id === "frac_equiv_text_002") || {
    id: "frac_equiv_text_002",
    subjectId: "math",
    courseId: "fraction",
    moduleId: "fraction",
    skillId: "SKILL_FRACTION_EQUIV",
    responseType: "TEXT",
    answer: "2/4"
  };

  const session = createSession({
    subjectId: "math",
    courseId: "fraction",
    moduleId: "fraction",
    skillId: "SKILL_FRACTION_EQUIV",
    learnerId: "learner-r4-text"
  }, [testAct]);
  session.start();

  const questionResponseRecordsMap = new Map();
  const dom = new JSDOM(`<!DOCTYPE html><html><body><input id="textInput_${testAct.id}" class="typed-text-input" /></body></html>`);
  const inputEl = dom.window.document.getElementById(`textInput_${testAct.id}`);

  let draftSavedCount = 0;
  let outerFrameCount = 0;
  const mockScheduleFrame = (fn) => {
    outerFrameCount++;
  };

  // Production app.js lines 1839-1860와 동일한 wiring (shared binder + response mutation guard)
  bindTextResponseSurface(
    dom.window.document,
    testAct.id,
    (value) => {
      try {
        applyStudentResponseChange(session, questionResponseRecordsMap, testAct, value);
      } catch (err) {
        console.warn("[app] 학생 응답 변경 거절 (Session Locked):", err);
      }
    },
    {
      onDraftTrigger: () => {
        draftSavedCount++;
      },
      scheduleFrame: mockScheduleFrame
    }
  );

  // Event 1: 1회 input 이벤트 발생
  inputEl.value = "2/4";
  inputEl.dispatchEvent(new dom.window.Event("input", { bubbles: true }));

  assert.equal(questionResponseRecordsMap.get(testAct.id)?.value, "2/4", "ResponseRecord에 학생 응답 정상 저장");
  assert.equal(draftSavedCount, 1, "드래프트 저장 트리거 1회");
  assert.equal(outerFrameCount, 1, "전체 파이프라인에서 refresh scheduling은 중복 없이 정확히 1회만 발생");

  // Event 2: 1회 compositionend 이벤트 발생
  inputEl.value = "3/6";
  inputEl.dispatchEvent(new dom.window.CompositionEvent("compositionend", { bubbles: true, data: "3/6" }));

  assert.equal(questionResponseRecordsMap.get(testAct.id)?.value, "3/6", "ResponseRecord에 최종 IME 응답 정상 저장");
  assert.equal(draftSavedCount, 2, "드래프트 저장 트리거 총 2회");
  assert.equal(outerFrameCount, 2, "compositionend 포함 refresh scheduling은 정확히 2회 (각 이벤트당 1회)");
});

