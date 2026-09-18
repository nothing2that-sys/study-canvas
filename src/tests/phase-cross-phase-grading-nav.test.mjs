import test from "node:test";
import assert from "node:assert/strict";

import {
  renderChoiceActivityStage,
  renderTextActivityStage,
  renderTypedActivityStage
} from "../public/app/js/typedInteractionSurface.js";
import {
  getGuardianFeedbackPresets,
  FeedbackCategory
} from "../public/app/js/guardianFeedbackPresets.js";
import {
  getNavigationHierarchy
} from "../public/app/js/navigationHierarchy.js";
import { ROUTES } from "../public/app/js/platform/appRouter.js";

// ============================================================================
// Requirement A: Guardian Grading Choice/Text Read-Only & Annotation Layer
// ============================================================================
test("Cross-Phase Grading UX: Choice stage in readOnly mode is non-interactive and highlights student choice", () => {
  const mockActivity = {
    id: "choice_q1",
    prompt: "다음 중 진분수를 고르시오.",
    choices: [
      { id: "c1", label: "1/2" },
      { id: "c2", label: "3/2" },
      { id: "c3", label: "5/4" },
      { id: "c4", label: "7/3" }
    ],
    expectedAnswer: "c1"
  };

  const html = renderChoiceActivityStage(mockActivity, {
    readOnly: true,
    responseRecord: { value: "c2" }
  });

  // 1. Read-only and non-interactive class & styling
  assert.match(html, /grading-choice-read-only/, "Should have grading-choice-read-only class");
  assert.match(html, /is-read-only/, "Should have is-read-only class");
  assert.match(html, /pointer-events:\s*none/, "Should have pointer-events: none style");
  assert.match(html, /user-select:\s*none/, "Should have user-select: none style");

  // 2. All inputs must be disabled
  assert.match(html, /disabled/, "Radio input should be disabled");

  // 3. Student selection must be marked and tagged
  assert.match(html, /is-student-selected/, "Student selected option must have is-student-selected class");
  assert.match(html, /student-selection-tag/, "Student selected option must show student-selection-tag");
  assert.match(html, /학생 선택/, "Selection tag must display '학생 선택'");
});

test("Cross-Phase Grading UX: Text stage in readOnly mode is disabled", () => {
  const mockActivity = {
    id: "text_q1",
    prompt: "빈칸에 알맞은 수를 쓰시오.",
    expectedAnswer: "12"
  };

  const html = renderTextActivityStage(mockActivity, {
    readOnly: true,
    initialValue: "10"
  });

  assert.match(html, /disabled/, "Text input must be disabled in readOnly mode");
  assert.match(html, /is-read-only/, "Text container must have is-read-only class");
});

// ============================================================================
// Requirement B: Subject-Aware Guardian Feedback Presets
// ============================================================================
test("Cross-Phase Feedback Presets: Math presets contain domain-specific terms", () => {
  const presets = getGuardianFeedbackPresets("math");
  assert.ok(Array.isArray(presets));
  assert.ok(presets.length >= 5, "Math presets should have at least 5 options");

  const texts = presets.map((p) => p.text);
  assert.ok(texts.some((t) => t.includes("통분") || t.includes("약분") || t.includes("분모")), "Must contain fraction terms");
  assert.ok(texts.some((t) => t.includes("받아올림") || t.includes("자리맞춤")), "Must contain arithmetic terms");
});

test("Cross-Phase Feedback Presets: Korean presets contain domain-specific terms", () => {
  const presets = getGuardianFeedbackPresets("korean");
  assert.ok(Array.isArray(presets));
  assert.ok(presets.length >= 5, "Korean presets should have at least 5 options");

  const texts = presets.map((p) => p.text);
  assert.ok(texts.some((t) => t.includes("받침") || t.includes("맞춤법") || t.includes("띄어쓰기")), "Must contain Korean orthography terms");
  assert.ok(texts.some((t) => t.includes("글씨") || t.includes("획순")), "Must contain stroke order terms");

  // Must NOT leak math-specific terms
  assert.ok(!texts.some((t) => t.includes("구구단") || t.includes("통분")), "Must not leak math terms into Korean");
});

test("Cross-Phase Feedback Presets: English presets contain domain-specific terms", () => {
  const presets = getGuardianFeedbackPresets("english");
  assert.ok(Array.isArray(presets));
  assert.ok(presets.length >= 5, "English presets should have at least 5 options");

  const texts = presets.map((p) => p.text);
  assert.ok(texts.some((t) => t.includes("스펠링") || t.includes("대소문자") || t.includes("파닉스")), "Must contain English phonics/spelling terms");

  // Must NOT leak math-specific terms
  assert.ok(!texts.some((t) => t.includes("구구단") || t.includes("받아올림")), "Must not leak math terms into English");
});

test("Cross-Phase Feedback Presets: Unknown subject gracefully falls back to Common presets", () => {
  const presets = getGuardianFeedbackPresets("unknown_subject_xyz");
  assert.ok(Array.isArray(presets));
  assert.ok(presets.length >= 3);
  assert.ok(presets.some((p) => p.text.includes("완벽해요") || p.text.includes("참 잘했어요")));
});

// ============================================================================
// Requirement C: Cross-Phase Global Learning Navigation
// ============================================================================
test("Cross-Phase Navigation: Korean Core Practice correctly defines semantic hierarchy", () => {
  const hierarchy = getNavigationHierarchy(ROUTES.KOREAN_CORE_PRACTICE);
  assert.equal(hierarchy.homeRoute, ROUTES.HOME);
  assert.equal(hierarchy.parentRoute, ROUTES.KOREAN_CORE);
  assert.equal(hierarchy.parentLabel, "국어 기초");
  assert.deepEqual(
    hierarchy.breadcrumbs.map((b) => b.label),
    ["홈", "국어", "국어 기초", "문제풀이"]
  );
});

test("Cross-Phase Navigation: English Core Practice correctly defines semantic hierarchy", () => {
  const hierarchy = getNavigationHierarchy(ROUTES.ENGLISH_CORE_PRACTICE);
  assert.equal(hierarchy.homeRoute, ROUTES.HOME);
  assert.equal(hierarchy.parentRoute, ROUTES.ENGLISH_CORE);
  assert.equal(hierarchy.parentLabel, "영어 기초");
  assert.deepEqual(
    hierarchy.breadcrumbs.map((b) => b.label),
    ["홈", "영어", "영어 기초", "문제풀이"]
  );
});

test("Cross-Phase Navigation: Math Fraction Practice correctly defines semantic hierarchy", () => {
  const hierarchy = getNavigationHierarchy(ROUTES.MATH_FRACTION_PRACTICE);
  assert.equal(hierarchy.homeRoute, ROUTES.HOME);
  assert.equal(hierarchy.parentRoute, ROUTES.MATH_FRACTION);
  assert.equal(hierarchy.parentLabel, "분수");
  assert.deepEqual(
    hierarchy.breadcrumbs.map((b) => b.label),
    ["홈", "수학", "분수", "문제풀이"]
  );
});

test("Cross-Phase Navigation: Guardian Grading correctly returns to Home", () => {
  const hierarchy = getNavigationHierarchy(ROUTES.MATH_GRADING);
  assert.equal(hierarchy.homeRoute, ROUTES.HOME);
  assert.equal(hierarchy.parentRoute, ROUTES.HOME);
  assert.equal(hierarchy.parentLabel, "홈");
});

test("Cross-Phase Navigation: Dynamic workbook context customizes breadcrumbs", () => {
  const hierarchy = getNavigationHierarchy(ROUTES.WORKBOOK_DETAIL, {
    workbookTitle: "기적의 분수 마스터 1단계"
  });
  assert.equal(hierarchy.parentRoute, ROUTES.BOOKSHELF);
  const lastCrumb = hierarchy.breadcrumbs[hierarchy.breadcrumbs.length - 1];
  assert.equal(lastCrumb.label, "기적의 분수 마스터 1단계");
});

test("Cross-Phase Navigation DOM: updateGlobalLearningNav controls topbar nav visibility and target routes", async () => {
  // Create mock DOM structure — nav container is now topbarNavActions (inside topbar)
  const elements = {
    topbarNavActions: { hidden: false },
    globalNavHomeBtn: { dataset: {} },
    globalNavUpBtn: { disabled: false, dataset: {}, title: "" }
  };

  const fakeDocument = {
    getElementById: (id) => elements[id] || null
  };

  const { updateGlobalLearningNav } = await import("../public/app/js/navigationHierarchy.js");

  // 1. On Home route, topbar nav must be hidden
  updateGlobalLearningNav(ROUTES.HOME, {}, { documentRef: fakeDocument });
  assert.equal(elements.topbarNavActions.hidden, true, "Topbar nav must be hidden on HOME");

  // 2. On Learners route, topbar nav must be hidden
  updateGlobalLearningNav(ROUTES.LEARNERS, {}, { documentRef: fakeDocument });
  assert.equal(elements.topbarNavActions.hidden, true, "Topbar nav must be hidden on LEARNERS");

  // 3. On Math Fraction Practice route, topbar nav must be visible, Up pointing to /math/fractions
  updateGlobalLearningNav(ROUTES.MATH_FRACTION_PRACTICE, {}, { documentRef: fakeDocument });
  assert.equal(elements.topbarNavActions.hidden, false, "Topbar nav must be visible on practice");
  assert.equal(elements.globalNavHomeBtn.dataset.targetRoute, ROUTES.HOME);
  assert.equal(elements.globalNavUpBtn.dataset.targetRoute, ROUTES.MATH_FRACTION);
  assert.equal(elements.globalNavUpBtn.disabled, false);

  // 4. On Guardian Grading route, Up must point to Home
  updateGlobalLearningNav(ROUTES.MATH_GRADING, {}, { documentRef: fakeDocument });
  assert.equal(elements.topbarNavActions.hidden, false);
  assert.equal(elements.globalNavUpBtn.dataset.targetRoute, ROUTES.HOME);
});

// ============================================================================
// Study Canvas Branding Verification
// ============================================================================
test("Branding: navigationHierarchy module exports are intact after Study Canvas rework", () => {
  // The navigation hierarchy data must still be intact (breadcrumbs data preserved)
  const hierarchy = getNavigationHierarchy(ROUTES.MATH_FRACTION_PRACTICE);
  assert.equal(hierarchy.homeRoute, ROUTES.HOME);
  assert.ok(Array.isArray(hierarchy.breadcrumbs), "Breadcrumbs array must still be present in hierarchy data");
  assert.equal(hierarchy.breadcrumbs.length, 4, "MATH_FRACTION_PRACTICE must have 4-item breadcrumb data");
  // parentRoute and parentLabel must be intact for Up button logic
  assert.equal(hierarchy.parentRoute, ROUTES.MATH_FRACTION, "Up button target must be MATH_FRACTION");
  assert.equal(hierarchy.parentLabel, "분수");
});

test("Branding: Decimal domain hierarchy also intact after rework", () => {
  const hierarchy = getNavigationHierarchy(ROUTES.MATH_DECIMAL_PRACTICE);
  assert.equal(hierarchy.parentRoute, ROUTES.MATH_DECIMAL, "Decimal Up target must be MATH_DECIMAL");
  assert.equal(hierarchy.parentLabel, "소수");
  assert.ok(Array.isArray(hierarchy.breadcrumbs));
});

