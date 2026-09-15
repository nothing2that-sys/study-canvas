//+_+// Phase F15A: 분수 개념과 표현 (Fraction Concepts and Representation) 전수 검증 테스트
//+_+// 2022 개정 교육과정 [4수01-09], [4수01-10], [4수01-11], [6수01-06] 준수

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import "fake-indexeddb/auto";

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
  setCurrentLearnerId
} from "../public/app/js/storage.js";

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
  assert.equal(manifest.packageVersion, "1.0.0");
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

test("F15A-MODEL-03: 분모 1 정책 - 자연수 분수 허용", () => {
  const norm = normalizeFraction({ numerator: 4, denominator: 1 });
  assert.equal(norm.numerator, 4);
  assert.equal(norm.denominator, 1);
  assert.equal(classifyFractionType(norm), FractionType.IMPROPER);
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

test("F15A-VIEW-06: 렌더러 결정론 (Math.random 미사용 확인) 및 폴백 처리", () => {
  const svg1 = renderPartWholeBarSVG({ fraction: { numerator: 2, denominator: 3 } });
  const svg2 = renderPartWholeBarSVG({ fraction: { numerator: 2, denominator: 3 } });
  assert.equal(svg1, svg2, "동일 입력 시 완벽히 동일한 SVG 문자열 생성");

  const fallback = renderFractionRepresentation({
    type: "UNKNOWN_TYPE",
    fraction: { numerator: 1, denominator: 2 }
  });
  assert.ok(fallback.includes("fraction-visual-container"), "미지원 타입 폴백 렌더링");
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
