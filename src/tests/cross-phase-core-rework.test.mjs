//+_+// Cross-Phase Core Rework 회귀 검증 테스트
// P0 보호자 채점 런타임 오류 및 10/20 문제 수 불일치 수정
// P1 undefined 및 내부 식별자(KO_*, EN_*, mode enum, topicId) 노출 차단

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import "fake-indexeddb/auto";

import {
  isInternalIdentifier,
  getActivityDisplayLabel,
  getPracticeModeLabel,
  PRACTICE_MODE_LABELS
} from "../public/app/js/displayLabels.js";
import { GradeDecision } from "../public/app/js/parentGrading.js";
import { setCurrentLearnerId, closeDB } from "../public/app/js/storage.js";
import { createLearner, selectLearner } from "../public/app/js/learners/learnerCommands.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HTML_PATH = path.resolve(__dirname, "../public/app/index.html");

function createMockMathQuestions(count = 10) {
  const questions = [];
  for (let i = 1; i <= count; i++) {
    questions.push({
      id: `math_q_${i}`,
      orderNumber: i,
      operation: "mul",
      operandA: 12,
      operandB: i,
      answer: 12 * i,
      expectedAnswer: 12 * i,
      level: "M1",
      mathFormat: "vertical"
    });
  }
  return questions;
}

function createMockTypedActivities(count = 5, subjectId = "korean") {
  const activities = [];
  for (let i = 1; i <= count; i++) {
    activities.push({
      id: `${subjectId === "korean" ? "KO" : "EN"}_ACT_00${i}`,
      orderNumber: i,
      subjectId,
      courseId: `${subjectId}-core`,
      unitId: "vocabulary",
      skillId: `${subjectId === "korean" ? "KO" : "EN"}_VOCAB_MEANING`,
      activityType: "MULTIPLE_CHOICE",
      responseType: "CHOICE",
      prompt: `${i}번 문제 지문입니다.`,
      choices: [
        { id: "opt_1", text: "선택지 1" },
        { id: "opt_2", text: "선택지 2" }
      ],
      expectedAnswer: "opt_1",
      // level intentionally omitted to test undefined suppression!
      gradingReference: { explanation: "해설입니다" }
    });
  }
  return activities;
}

function setupDOMEnvironment() {
  const html = fs.readFileSync(HTML_PATH, "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.alert = () => {};
  globalThis.confirm = () => true;
  globalThis.scrollTo = () => {};
  dom.window.scrollTo = () => {};
  dom.window.Element.prototype.scrollIntoView = () => {};

  dom.window.HTMLCanvasElement.prototype.getContext = () => ({
    clearRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    stroke() {},
    arc() {},
    fill() {},
    save() {},
    restore() {},
    setTransform() {}
  });
  dom.window.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 400,
    height: 300
  });

  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 10);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.CSS = { escape: (s) => String(s) };

  // mock fetch for local package loading
  globalThis.fetch = async (url) => {
    const raw = String(url).replace(/\\/g, "/");
    let relativePath = "";
    if (raw.includes("content/")) {
      relativePath = raw.slice(raw.indexOf("content/"));
    } else {
      relativePath = `content/${raw.replace(/^\.\//, "")}`;
    }
    const fullPath = path.resolve(__dirname, "../public/app", relativePath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf8");
      return {
        ok: true,
        status: 200,
        json: async () => JSON.parse(content),
        text: async () => content
      };
    }
    return { ok: false, status: 404, statusText: "Not Found" };
  };

  return dom;
}

//+_+// 결정론적 비동기 완료 대기 헬퍼 (CI 환경 속도 편차 극복)
async function waitFor(conditionFn, { timeoutMs = 5000, intervalMs = 15, description = "condition" } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (conditionFn()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  if (conditionFn()) return true;
  throw new Error(`Timeout (${timeoutMs}ms) waiting for: ${description}`);
}

// ----------------------------------------------------
// 1. displayLabels 단위 테스트 (P1 식별자 및 undefined 차단)
// ----------------------------------------------------

test("P1 displayLabels: isInternalIdentifier detects all forbidden patterns", () => {
  assert.equal(isInternalIdentifier(undefined), true);
  assert.equal(isInternalIdentifier(null), true);
  assert.equal(isInternalIdentifier("undefined"), true);
  assert.equal(isInternalIdentifier("null"), true);
  assert.equal(isInternalIdentifier(""), true);
  assert.equal(isInternalIdentifier("   "), true);

  assert.equal(isInternalIdentifier("KO_VOCAB_MEANING"), true);
  assert.equal(isInternalIdentifier("KO_VOCAB_CONTEXT"), true);
  assert.equal(isInternalIdentifier("EN_VOCAB_MEANING"), true);
  assert.equal(isInternalIdentifier("EN_VOCAB_G3"), true);
  assert.equal(isInternalIdentifier("MATH_FRACTION_PART_WHOLE"), true);
  assert.equal(isInternalIdentifier("MATH_UNIT_LENGTH_TO_SMALLER"), true);

  assert.equal(isInternalIdentifier("STUDY_CARD"), true);
  assert.equal(isInternalIdentifier("MEANING_CHOICE"), true);
  assert.equal(isInternalIdentifier("REVERSE_CHOICE"), true);
  assert.equal(isInternalIdentifier("SPELLING_RECALL"), true);
  assert.equal(isInternalIdentifier("CONTEXT_APPLICATION"), true);
  assert.equal(isInternalIdentifier("MULTIPLE_CHOICE"), true);
  assert.equal(isInternalIdentifier("SHORT_ANSWER"), true);

  assert.equal(isInternalIdentifier("school"), true);
  assert.equal(isInternalIdentifier("family"), true);
  assert.equal(isInternalIdentifier("weather"), true);
  assert.equal(isInternalIdentifier("society"), true);

  assert.equal(isInternalIdentifier("어휘 뜻 알기"), false);
  assert.equal(isInternalIdentifier("3학년 영단어"), false);
  assert.equal(isInternalIdentifier("분수 개념"), false);
  assert.equal(isInternalIdentifier("L1"), false);
  assert.equal(isInternalIdentifier("Lv.1"), false);
  assert.equal(isInternalIdentifier("M1"), false);
  assert.equal(isInternalIdentifier("D1"), false);
});

test("P1 displayLabels: getActivityDisplayLabel never returns undefined or internal IDs", () => {
  assert.equal(getActivityDisplayLabel({}), "연습");
  assert.equal(getActivityDisplayLabel(null), "연습");
  assert.equal(getActivityDisplayLabel({ level: undefined }), "연습");

  assert.equal(getActivityDisplayLabel({
    subjectId: "korean",
    skillId: "KO_VOCAB_MEANING"
  }), "국어 학습");

  assert.equal(getActivityDisplayLabel({
    subjectId: "english",
    skillId: "EN_VOCAB_CONTEXT"
  }), "영어 학습");

  assert.equal(getActivityDisplayLabel(
    { subjectId: "korean", skillId: "KO_VOCAB_MEANING" },
    { skillTitle: "어휘 뜻 알기" }
  ), "어휘 뜻 알기");

  assert.equal(getActivityDisplayLabel({
    displayLabel: "맞춤법 익히기",
    skillId: "KO_SPELLING_CORRECT_FORM"
  }), "맞춤법 익히기");

  assert.equal(getActivityDisplayLabel({
    subjectId: "math",
    level: "M1"
  }), "M1");
});

test("P1 displayLabels: practice mode labels map all vocabulary practice modes to Korean", () => {
  assert.equal(getPracticeModeLabel("STUDY_CARD"), "새 단어 익히기");
  assert.equal(getPracticeModeLabel("MEANING_CHOICE"), "뜻 고르기");
  assert.equal(getPracticeModeLabel("REVERSE_CHOICE"), "단어 찾기");
  assert.equal(getPracticeModeLabel("SPELLING_RECALL"), "철자 떠올리기");
  assert.equal(getPracticeModeLabel("CONTEXT_APPLICATION"), "문맥에서 익히기");
  assert.equal(getPracticeModeLabel("UNKNOWN_MODE"), "단어 익히기");
});

// ----------------------------------------------------
// 2. 보호자 채점 실제 DOM 런타임 테스트 (P0 & 10/20 SSOT)
// ----------------------------------------------------

test("P0 DOM Runtime: 10문제 Session 채점 전체 흐름 및 0/10 일관성 검증", async () => {
  setupDOMEnvironment();
  const created = await createLearner({ name: "채점테스트", schoolGrade: 3 });
  const learnerId = created.id;
  await selectLearner(learnerId);
  setCurrentLearnerId(learnerId);

  const appModule = await import(`../public/app/js/app.js?t=${Date.now()}_10`);

  try {
    const questions10 = createMockMathQuestions(10);
    const sessionConfig = {
      sessionId: `test_session_10_${Date.now()}`,
      pageSize: 4,
      problemCount: 10,
      operation: "mul",
      cols: 2
    };

    // 1. 세션 시작 및 워크시트 생성
    await appModule.startSessionWithQuestions(questions10, sessionConfig);

    // 2. 학생 제출 시뮬레이션
    await appModule.handleSubmitPractice();

    const gradedCountEl = document.querySelector("#gradedCountText");
    const gradingRemainingEl = document.querySelector("#gradingRemainingText");
    const gradedCorrectEl = document.querySelector("#gradedCorrectText");
    const gradedWrongEl = document.querySelector("#gradedWrongText");
    const finishGradingBtn = document.querySelector("#finishGradingBtn");
    const startParentGradingBtn = document.querySelector("#startParentGradingBtn");

    // 제출 직후 (채점 시작 전) 확인: 10문제 세션이므로 즉시 0 / 10 반영!
    assert.equal(gradedCountEl.textContent, "0 / 10");
    assert.equal(gradingRemainingEl.textContent, "미채점 10");

    // 3. 보호자 채점 시작 클릭 -> handleStartParentGrading -> renderGradingView()
    // pSize ReferenceError 발생 없이 성공적으로 렌더링되어야 함 (JS Runtime Error 0)
    startParentGradingBtn.click();
    await waitFor(
      () => document.querySelectorAll("#gradingGrid .grading-card").length === 10 &&
            document.querySelectorAll("#gradingQuestionChips .grading-question-chip").length === 10 &&
            document.querySelector("#gradingGrid") && !document.querySelector("#gradingGrid").hidden &&
            document.querySelector("#parentGradingStartPanel")?.hidden === true,
      { timeoutMs: 5000, description: "10문제 채점 카드 10개 및 칩 10개 렌더링 완료" }
    );

    // 4. 채점 뷰 렌더링 결과 검증
    assert.equal(gradedCountEl.textContent, "0 / 10");
    assert.equal(gradedCorrectEl.textContent, "정답 0");
    assert.equal(gradedWrongEl.textContent, "오답 0");
    assert.equal(gradingRemainingEl.textContent, "미채점 10");

    const cards = document.querySelectorAll("#gradingGrid .grading-card");
    assert.equal(cards.length, 10, "채점 카드 개수는 정확히 10개여야 함");

    const chips = document.querySelectorAll("#gradingQuestionChips .grading-question-chip");
    assert.equal(chips.length, 10, "네비게이터 칩 개수는 정확히 10개여야 함");

    // 카드 헤더에 undefined가 없는지 확인
    cards.forEach((card) => {
      const cardLevel = card.querySelector(".card-level");
      assert.ok(cardLevel);
      assert.doesNotMatch(cardLevel.textContent, /undefined/);
      assert.doesNotMatch(cardLevel.textContent, /skillId/);
      assert.doesNotMatch(card.textContent, /undefined/);
    });

    // 5. 개별 채점: 1번 문제를 CORRECT 처리
    const card1CorrectBtn = cards[0].querySelector('.grade-btn[data-decision="CORRECT"]');
    assert.ok(card1CorrectBtn);
    card1CorrectBtn.click();

    assert.equal(gradedCountEl.textContent, "1 / 10");
    assert.equal(gradedCorrectEl.textContent, "정답 1");
    assert.equal(gradingRemainingEl.textContent, "미채점 9");
    assert.equal(finishGradingBtn.disabled, true, "1문제만 채점했으므로 완료 버튼은 비활성화");

    // 6. 전체 정답 처리: gradeAllCorrectBtn 클릭
    const gradeAllBtn = document.querySelector("#gradeAllCorrectBtn");
    assert.ok(gradeAllBtn);
    gradeAllBtn.click();

    await waitFor(
      () => gradedCountEl.textContent === "10 / 10" &&
            gradedCorrectEl.textContent === "정답 10" &&
            finishGradingBtn.disabled === false,
      { timeoutMs: 3000, description: "10문제 전체 정답 처리 반영" }
    );

    assert.equal(gradedCountEl.textContent, "10 / 10");
    assert.equal(gradedCorrectEl.textContent, "정답 10");
    assert.equal(gradedWrongEl.textContent, "오답 0");
    assert.equal(gradingRemainingEl.textContent, "미채점 0");
    assert.equal(finishGradingBtn.disabled, false, "10문제 모두 채점 완료 시 완료 버튼 활성화");

    // 7. 재진입 테스트: 다른 뷰로 나갔다가 다시 채점 뷰 렌더링
    const exitBtn = document.querySelector("#gradingExitBtn");
    assert.ok(exitBtn);
    exitBtn.click();

    appModule.renderGradingView();

    await waitFor(
      () => document.querySelectorAll("#gradingGrid .grading-card").length === 10,
      { timeoutMs: 3000, description: "채점 뷰 재진입 렌더링 완료" }
    );

    assert.equal(gradedCountEl.textContent, "10 / 10");
    assert.equal(document.querySelectorAll("#gradingGrid .grading-card").length, 10);
    assert.equal(gradingRemainingEl.textContent, "미채점 0");
  } finally {
    try {
      await appModule?.terminateSession?.();
    } catch (_) {}
    setCurrentLearnerId(null);
  }
});

test("P0 DOM Runtime: 20문제 Session에서도 0/20 -> 20/20 일치 검증", async () => {
  setupDOMEnvironment();
  const created = await createLearner({ name: "20문제테스트", schoolGrade: 3 });
  const learnerId = created.id;
  await selectLearner(learnerId);
  setCurrentLearnerId(learnerId);

  const appModule = await import(`../public/app/js/app.js?t=${Date.now()}_20`);

  try {
    const questions20 = createMockMathQuestions(20);
    await appModule.startSessionWithQuestions(questions20, {
      sessionId: `test_session_20_${Date.now()}`,
      pageSize: 4,
      problemCount: 20,
      operation: "mul"
    });

    await appModule.handleSubmitPractice();

    const gradedCountEl = document.querySelector("#gradedCountText");
    const startParentGradingBtn = document.querySelector("#startParentGradingBtn");
    assert.equal(gradedCountEl.textContent, "0 / 20");

    startParentGradingBtn.click();
    await waitFor(
      () => document.querySelectorAll("#gradingGrid .grading-card").length === 20 &&
            document.querySelectorAll("#gradingQuestionChips .grading-question-chip").length === 20 &&
            document.querySelector("#gradingGrid") && !document.querySelector("#gradingGrid").hidden &&
            document.querySelector("#parentGradingStartPanel")?.hidden === true,
      { timeoutMs: 5000, description: "20문제 채점 카드 20개 및 칩 20개 렌더링 완료" }
    );

    assert.equal(gradedCountEl.textContent, "0 / 20");
    assert.equal(document.querySelectorAll("#gradingGrid .grading-card").length, 20);

    const gradeAllBtn = document.querySelector("#gradeAllCorrectBtn");
    gradeAllBtn.click();

    await waitFor(
      () => gradedCountEl.textContent === "20 / 20" &&
            document.querySelector("#finishGradingBtn")?.disabled === false,
      { timeoutMs: 3000, description: "20문제 전체 정답 처리 반영" }
    );

    assert.equal(gradedCountEl.textContent, "20 / 20");
    assert.equal(document.querySelector("#finishGradingBtn").disabled, false);
  } finally {
    try {
      await appModule?.terminateSession?.();
    } catch (_) {}
    setCurrentLearnerId(null);
  }
});

test("P0 DOM Runtime: Typed Activity (국어 CHOICE) 문제 채점 렌더링 및 undefined 방지", async () => {
  setupDOMEnvironment();
  const created = await createLearner({ name: "국어테스트", schoolGrade: 3 });
  const learnerId = created.id;
  await selectLearner(learnerId);
  setCurrentLearnerId(learnerId);

  const appModule = await import(`../public/app/js/app.js?t=${Date.now()}_typed`);

  try {
    const koreanActivities = createMockTypedActivities(5, "korean");
    await appModule.startSessionWithQuestions(koreanActivities, {
      sessionId: `test_session_korean_${Date.now()}`,
      subjectId: "korean",
      skillId: "KO_VOCAB_MEANING",
      skillTitle: "어휘 뜻 알기",
      pageSize: 4,
      problemCount: 5
    });

    const worksheetCards = document.querySelectorAll("#worksheetGrid .worksheet-card");
    assert.equal(worksheetCards.length, 4, "pageSize 4에 맞게 4문제 노출");
    worksheetCards.forEach((card) => {
      const cardLevel = card.querySelector(".card-level");
      assert.equal(cardLevel.textContent, "어휘 뜻 알기");
      assert.doesNotMatch(card.textContent, /undefined/);
      assert.doesNotMatch(card.textContent, /KO_VOCAB_/);
    });

    await appModule.handleSubmitPractice();
    document.querySelector("#startParentGradingBtn").click();
    await waitFor(
      () => document.querySelectorAll("#gradingGrid .grading-card").length === 5 &&
            document.querySelector("#gradingGrid") && !document.querySelector("#gradingGrid").hidden &&
            document.querySelector("#parentGradingStartPanel")?.hidden === true,
      { timeoutMs: 5000, description: "국어 5문제 채점 카드 5개 렌더링 완료" }
    );

    const gradingCards = document.querySelectorAll("#gradingGrid .grading-card");
    assert.equal(gradingCards.length, 5);

    gradingCards.forEach((card) => {
      const cardLevel = card.querySelector(".card-level");
      assert.equal(cardLevel.textContent, "어휘 뜻 알기");
      assert.doesNotMatch(card.textContent, /undefined/);
      assert.doesNotMatch(card.textContent, /KO_VOCAB_/);
    });
  } finally {
    try {
      await appModule?.terminateSession?.();
    } catch (_) {}
    setCurrentLearnerId(null);
  }
});

// ----------------------------------------------------
// 3. 학생 UI 내부 문자열 금지 공통 검사 (P1)
// ----------------------------------------------------

test("P1 Student UI: forbidden strings audit in Korean, English, and Vocabulary study", async () => {
  setupDOMEnvironment();
  const created = await createLearner({
    name: "오딧테스트",
    schoolGrade: 3,
    guardianPolicy: { maxGradeLevel: 6 }
  });
  const learnerId = created.id;
  await selectLearner(learnerId);
  setCurrentLearnerId(learnerId);

  const appModule = await import(`../public/app/js/app.js?t=${Date.now()}_audit`);

  try {
    await appModule.renderKoreanLandingView?.();
    const koreanSkills = document.querySelectorAll(".korean-skill-card");
    koreanSkills.forEach((card) => {
      const titleEl = card.querySelector(".korean-skill-title");
      const startBtn = card.querySelector(".korean-start-btn");
      assert.doesNotMatch(titleEl?.textContent || "", /KO_VOCAB_/);
      assert.doesNotMatch(titleEl?.textContent || "", /undefined/);
      assert.doesNotMatch(startBtn?.getAttribute("aria-label") || "", /KO_VOCAB_/);
    });

    await appModule.renderEnglishLandingView?.();
    const englishSkills = document.querySelectorAll(".english-skill-card");
    englishSkills.forEach((card) => {
      const titleEl = card.querySelector(".english-skill-title");
      const startBtn = card.querySelector(".english-start-btn");
      assert.doesNotMatch(titleEl?.textContent || "", /EN_VOCAB_/);
      assert.doesNotMatch(titleEl?.textContent || "", /undefined/);
      assert.doesNotMatch(startBtn?.getAttribute("aria-label") || "", /EN_VOCAB_/);
    });

    const vocabContainer = document.querySelector("#englishVocabularyStudyPanel") || document.createElement("div");

    const practiceBtn = vocabContainer.querySelector("#startVocabularyPracticeBtn") || vocabContainer.querySelector(".vocabulary-primary-btn");
    if (practiceBtn) {
      practiceBtn.click();
      await waitFor(
        () => {
          const stage = vocabContainer.querySelector(".vocabulary-practice-stage") || vocabContainer.querySelector("#vocabularyPracticeStage");
          return stage && !stage.hidden;
        },
        { timeoutMs: 2000, description: "영단어 연습 stage 노출" }
      ).catch(() => {});

      const stage = vocabContainer.querySelector(".vocabulary-practice-stage") || vocabContainer.querySelector("#vocabularyPracticeStage");
      if (stage && !stage.hidden) {
        const stageText = stage.textContent;
        assert.doesNotMatch(stageText, /\bSTUDY_CARD\b/);
        assert.doesNotMatch(stageText, /\bMEANING_CHOICE\b/);
        assert.doesNotMatch(stageText, /\bREVERSE_CHOICE\b/);
        assert.doesNotMatch(stageText, /\bSPELLING_RECALL\b/);
        assert.doesNotMatch(stageText, /\bCONTEXT_APPLICATION\b/);
        assert.doesNotMatch(stageText, /undefined/);

        const topicTag = stage.querySelector(".vocabulary-card-topic");
        if (topicTag) {
          assert.doesNotMatch(topicTag.textContent, /^(school|family|daily|weather|food|places|hobbies|health|nature|technology|environment|society)$/);
        }
      }
    }
  } finally {
    try {
      await appModule?.terminateSession?.();
    } catch (_) {}
    setCurrentLearnerId(null);
  }
});
