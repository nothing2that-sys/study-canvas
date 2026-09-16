//+_+// Phase F14 영단어 카드, 반복 복습과 Check Session 화면

import { loadPackage, loadPackageResource } from "./contentPackageLoader.js";
import { evaluateContentEligibility } from "./contentEligibility.js";
import { getAllProgressAggregates, getVocabularyMemoryStates, saveVocabularyMemoryState } from "./storage.js";
import {
  VocabularyPracticeMode,
  VocabularyPracticeRating,
  applyVocabularyPracticeRating,
  buildVocabularyPracticeQueue,
  createVocabularyCheckActivities,
  createVocabularyPracticePrompt,
  resolveVocabularyPracticeMode,
  selectVocabularyWords,
  validateVocabularyCatalog
} from "./englishVocabularyStudy.js";
import { PRACTICE_MODE_LABELS, getPracticeModeLabel } from "./displayLabels.js";

export { PRACTICE_MODE_LABELS, getPracticeModeLabel };

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizePracticeText(value) {
  return String(value || "").trim().toLocaleLowerCase("en-US");
}

function getDefaultGrade(learner) {
  const grade = Number(learner?.schoolGrade);
  return Number.isInteger(grade) && grade >= 3 && grade <= 6 ? grade : 3;
}

function createEligibilityContent(word) {
  return {
    ...word,
    status: "ACTIVE",
    reviewStatus: word.sourceMetadata.reviewStatus,
    prerequisites: []
  };
}

export async function initEnglishVocabularyStudy({ container, learner, onStartCheck, onPracticeStart, initialGradeLevel = null, initialTopicId = "ALL" } = {}) {
  if (!container) return null;
  const [, resource] = await Promise.all([
    loadPackage("english-vocabulary-v1"),
    loadPackageResource("english-vocabulary-v1", "words")
  ]);
  const catalog = validateVocabularyCatalog(resource);
  const allWords = catalog.words;
  const requestedGrade = Number(initialGradeLevel);
  const preferredGrade = Number.isInteger(requestedGrade) ? requestedGrade : getDefaultGrade(learner);
  const gradeAccess = [3, 4, 5, 6].map((grade) => {
    const example = allWords.find((word) => word.gradeLevel === grade);
    const eligibility = evaluateContentEligibility({
      learner,
      policy: learner?.guardianPolicy,
      content: createEligibilityContent(example),
      requestedMode: "NEW"
    });
    return { grade, eligibility };
  });
  const accessibleGrades = gradeAccess.filter((item) => item.eligibility.eligible).map((item) => item.grade);
  const topicTitleMap = new Map((resource?.topics || []).map((t) => [t.topicId, t.title]));
  let gradeLevel = accessibleGrades.includes(preferredGrade) ? preferredGrade : (accessibleGrades[0] || null);
  let topicId = String(initialTopicId || "ALL");
  let queue = [];
  let queueIndex = 0;
  let currentPrompt = null;
  let answerRevealed = false;

  const gradeOptions = gradeAccess.map(({ grade, eligibility }) => {
    const locked = !eligibility.eligible;
    return `<option value="${grade}" ${grade === gradeLevel ? "selected" : ""} ${locked ? "disabled" : ""}>${grade}학년${locked ? " 잠김" : ""}</option>`;
  }).join("");

  container.innerHTML = `
    <div class="vocabulary-study-toolbar">
      <label>학년<select id="vocabularyGradeSelect">${gradeLevel === null ? '<option value="" selected>보호자 설정 필요</option>' : ""}${gradeOptions}</select></label>
      <label>주제<select id="vocabularyTopicSelect"><option value="ALL">전체 주제</option></select></label>
      <span id="vocabularyDueSummary" class="vocabulary-due-summary" aria-live="polite"></span>
    </div>
    <div class="vocabulary-study-actions">
      <button type="button" id="startVocabularyPracticeBtn" class="vocabulary-primary-btn">카드와 복습 시작</button>
      <button type="button" id="startVocabularyCheckBtn" class="vocabulary-secondary-btn">확인 학습 12문제</button>
    </div>
    <div id="vocabularyPracticeStage" class="vocabulary-practice-stage" hidden aria-live="polite"></div>
  `;

  const gradeSelect = container.querySelector("#vocabularyGradeSelect") || container.querySelector(".vocabulary-study-toolbar select");
  const topicSelect = container.querySelector("#vocabularyTopicSelect") || container.querySelectorAll(".vocabulary-study-toolbar select")[1];
  const dueSummary = container.querySelector("#vocabularyDueSummary") || container.querySelector(".vocabulary-due-summary");
  const stage = container.querySelector("#vocabularyPracticeStage") || container.querySelector(".vocabulary-practice-stage");
  const practiceButton = container.querySelector("#startVocabularyPracticeBtn") || container.querySelector(".vocabulary-primary-btn");
  const checkButton = container.querySelector("#startVocabularyCheckBtn") || container.querySelector(".vocabulary-secondary-btn");
  if (practiceButton) practiceButton.disabled = gradeLevel === null;
  if (checkButton) checkButton.disabled = gradeLevel === null;

  function renderTopics() {
    if (gradeLevel === null) {
      topicSelect.innerHTML = '<option value="ALL">사용 가능한 학년 없음</option>';
      topicSelect.disabled = true;
      return;
    }
    topicSelect.disabled = false;
    const topics = resource.topics.filter((topic) => Number(topic.gradeLevel) === gradeLevel);
    if (topicId !== "ALL" && !topics.some((topic) => topic.topicId === topicId)) topicId = "ALL";
    topicSelect.innerHTML = `<option value="ALL" ${topicId === "ALL" ? "selected" : ""}>전체 주제</option>${topics.map((topic) => `<option value="${escapeHtml(topic.topicId)}" ${topic.topicId === topicId ? "selected" : ""}>${escapeHtml(topic.title)}</option>`).join("")}`;
  }

  function showVocabularyError(message) {
    stage.hidden = false;
    let alert = stage.querySelector(".vocabulary-error-message");
    if (!alert) {
      stage.insertAdjacentHTML("afterbegin", '<p class="vocabulary-error-message" role="alert"></p>');
      alert = stage.querySelector(".vocabulary-error-message");
    }
    alert.textContent = message;
  }

  async function refreshSummary() {
    if (gradeLevel === null) {
      dueSummary.textContent = "보호자 설정에서 영어 학년 범위를 허용해 주세요.";
      return false;
    }
    try {
      const [states, aggregates] = await Promise.all([
        getVocabularyMemoryStates({ learnerId: learner.id }),
        getAllProgressAggregates({ learnerId: learner.id, subjectId: "english" })
      ]);
      const eligibleWordIds = new Set(selectVocabularyWords({ words: allWords, gradeLevel, topicId }).map((word) => word.wordId));
      const dueCount = states.filter((state) => eligibleWordIds.has(state.wordId) && state.dueAt !== null && state.dueAt <= Date.now()).length;
      const masteredCount = states.filter((state) => eligibleWordIds.has(state.wordId) && state.memoryStatus === "MASTERED").length;
      const official = aggregates.find((item) => item.levelId === `EN_VOCAB_CHECK_G${gradeLevel}`);
      const officialText = official && official.gradedAttemptCount > 0 ? ` · 확인 정답률 ${Math.round(official.accuracy)}%` : "";
      dueSummary.textContent = `복습 예정 ${dueCount}개 · 익힘 ${masteredCount}개${officialText}`;
      return true;
    } catch (error) {
      dueSummary.textContent = "학습 현황을 불러오지 못했습니다. 다시 시도해 주세요.";
      return false;
    }
  }

  function showRatingButtons(item) {
    const controls = stage.querySelector(".vocabulary-rating-controls");
    if (!controls) return;
    controls.hidden = false;
    controls.querySelectorAll("button[data-rating]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (button.dataset.saving === "true") return;
        const ratingButtons = Array.from(controls.querySelectorAll("button[data-rating]"));
        ratingButtons.forEach((candidate) => { candidate.disabled = true; });
        button.dataset.saving = "true";
        try {
          const updated = applyVocabularyPracticeRating(item.state, button.dataset.rating, { now: Date.now() });
          await saveVocabularyMemoryState(updated, { learnerId: learner.id });
          queueIndex += 1;
          await refreshSummary();
          renderCurrentCard();
        } catch (error) {
          ratingButtons.forEach((candidate) => { candidate.disabled = false; });
          delete button.dataset.saving;
          showVocabularyError("복습 상태를 저장하지 못했습니다. 같은 평가를 다시 눌러 주세요.");
        }
      });
    });
  }

  function revealPracticeAnswer(item, selectedValue = null) {
    if (answerRevealed) return;
    answerRevealed = true;
    const feedback = stage.querySelector(".vocabulary-practice-feedback");
    const isCorrect = selectedValue === null
      ? null
      : normalizePracticeText(selectedValue) === normalizePracticeText(currentPrompt.expectedAnswer);
    feedback.hidden = false;
    feedback.innerHTML = `${isCorrect === null ? "" : `<strong>${isCorrect ? "연습 정답" : "다시 확인"}</strong>`}<p>${escapeHtml(item.word.headword)} · ${escapeHtml(item.word.meanings.join(", "))}</p><p>${escapeHtml(item.word.exampleSentence)}</p><p>${escapeHtml(item.word.exampleMeaning)}</p>`;
    stage.querySelectorAll("button[data-choice], input, .vocabulary-answer-check").forEach((control) => { control.disabled = true; });
    showRatingButtons(item);
  }

  function renderCurrentCard() {
    if (queueIndex >= queue.length) {
      stage.innerHTML = `<div class="vocabulary-session-complete"><h3>이번 복습을 마쳤어요</h3><p>예정일이 되면 다시 복습 목록에 나타납니다.</p><button type="button" class="vocabulary-secondary-btn" id="closeVocabularyPracticeBtn">닫기</button></div>`;
      stage.querySelector("#closeVocabularyPracticeBtn")?.addEventListener("click", () => { stage.hidden = true; });
      return;
    }

    const item = queue[queueIndex];
    const mode = resolveVocabularyPracticeMode(item.state);
    currentPrompt = createVocabularyPracticePrompt(item.word, mode, { words: allWords });
    answerRevealed = false;
    const progress = `${queueIndex + 1} / ${queue.length}`;
    const modeLabel = getPracticeModeLabel(mode);
    const topicLabel = topicTitleMap.get(item.word.topicId) || "어휘 학습";
    let responseHtml = "";
    if (currentPrompt.responseType === "NONE") {
      responseHtml = `<button type="button" class="vocabulary-primary-btn vocabulary-reveal-answer">뜻과 예문 보기</button>`;
    } else if (currentPrompt.responseType === "TEXT") {
      responseHtml = `<div class="vocabulary-text-response"><label for="vocabularySpellingInput">영어 단어</label><input id="vocabularySpellingInput" type="text" autocomplete="off" autocapitalize="none" spellcheck="false"><button type="button" class="vocabulary-primary-btn vocabulary-answer-check">확인</button></div>`;
    } else {
      responseHtml = `<div class="vocabulary-choice-grid">${currentPrompt.choices.map((choice) => `<button type="button" data-choice="${escapeHtml(choice.id)}">${escapeHtml(choice.label)}</button>`).join("")}</div>`;
    }
    stage.innerHTML = `
      <div class="vocabulary-card-head"><span>${progress}</span><span>${escapeHtml(modeLabel)}</span></div>
      <article class="vocabulary-study-card"><p class="vocabulary-card-topic">${escapeHtml(topicLabel)}</p><h3>${escapeHtml(currentPrompt.prompt)}</h3>${responseHtml}</article>
      <div class="vocabulary-practice-feedback" hidden></div>
      <div class="vocabulary-rating-controls" hidden aria-label="기억 상태 선택">
        <p>이 단어가 얼마나 기억났나요?</p>
        <button type="button" data-rating="${VocabularyPracticeRating.AGAIN}">다시</button>
        <button type="button" data-rating="${VocabularyPracticeRating.HARD}">어려움</button>
        <button type="button" data-rating="${VocabularyPracticeRating.GOOD}">알겠음</button>
        <button type="button" data-rating="${VocabularyPracticeRating.EASY}">쉬움</button>
      </div>
    `;

    stage.querySelector(".vocabulary-reveal-answer")?.addEventListener("click", () => revealPracticeAnswer(item));
    stage.querySelectorAll("button[data-choice]").forEach((button) => {
      button.addEventListener("click", () => revealPracticeAnswer(item, button.dataset.choice));
    });
    stage.querySelector(".vocabulary-answer-check")?.addEventListener("click", () => {
      revealPracticeAnswer(item, stage.querySelector("#vocabularySpellingInput")?.value);
    });
  }

  gradeSelect.addEventListener("change", async () => {
    if (!gradeSelect.value) return;
    gradeLevel = Number(gradeSelect.value);
    topicId = "ALL";
    renderTopics();
    await refreshSummary();
  });
  topicSelect.addEventListener("change", async () => {
    topicId = topicSelect.value;
    await refreshSummary();
  });
  practiceButton.addEventListener("click", async () => {
    if (gradeLevel === null) return;
    practiceButton.disabled = true;
    try {
      const states = await getVocabularyMemoryStates({ learnerId: learner.id });
      const eligibleWords = selectVocabularyWords({ words: allWords, gradeLevel, topicId });
      queue = buildVocabularyPracticeQueue({ words: eligibleWords, memoryStates: states, learnerId: learner.id, now: Date.now(), limit: 12 });
      queueIndex = 0;
      stage.hidden = false;
      if (queue.length === 0) {
        stage.innerHTML = `<div class="vocabulary-session-complete"><h3>지금 복습할 단어가 없어요</h3><p>다음 예정일에 다시 확인해 주세요.</p></div>`;
        return;
      }
      onPracticeStart?.({ gradeLevel, topicId });
      renderCurrentCard();
    } catch (error) {
      showVocabularyError("복습 데이터를 불러오지 못했습니다. 다시 시도해 주세요.");
    } finally {
      practiceButton.disabled = gradeLevel === null;
    }
  });
  checkButton.addEventListener("click", () => {
    if (gradeLevel === null) return;
    const activities = createVocabularyCheckActivities({ words: allWords, gradeLevel, topicId, count: 12, seed: Date.now() });
    onStartCheck?.({ activities, gradeLevel, topicId });
  });

  renderTopics();
  await refreshSummary();
  return { packageId: catalog.packageId, wordCount: catalog.wordCount, gradeLevel };
}
