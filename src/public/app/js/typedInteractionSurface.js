//+_+// Math Canvas Pro - Typed Questions (CHOICE / TEXT) Interaction & Renderer Surface
//+_+// Phase F10A / F13-R1 / F15A SSOT

import { escapeHtml, SessionState } from "./sessionEngine.js";
import { renderFractionRepresentation } from "./fractionRepresentationView.js";
import { renderDecimalRepresentation } from "./decimalRepresentationView.js";
import { ResponseType, resolveActivityResponseType } from "./learningActivity.js";
import { getGradingReferenceForDisplay } from "./historicalGradingReference.js";

export function syncChoiceSurfaceSelection(radios, selectedRadio) {
  radios.forEach((candidate) => {
    candidate.closest?.(".typed-choice-item")?.classList?.toggle("selected-choice", candidate === selectedRadio);
  });
}

export function bindChoiceResponseSurface(root, questionId, onSelection) {
  if (!root || typeof root.querySelectorAll !== "function") return [];
  if (typeof onSelection !== "function") {
    throw new TypeError("CHOICE 응답 처리 함수가 필요합니다.");
  }

  const radios = Array.from(root.querySelectorAll(`input[name="choice_${questionId}"]`));
  radios.forEach((radio) => {
    radio.addEventListener("change", (event) => {
      const selectedRadio = event?.target || radio;
      if (!selectedRadio.checked || selectedRadio.disabled) return;
      syncChoiceSurfaceSelection(radios, selectedRadio);
      onSelection(selectedRadio.value, selectedRadio);
    });
  });
  return radios;
}

export function bindTextResponseSurface(root, questionId, onInput, options = {}) {
  if (!root || typeof root.querySelector !== "function") return null;
  if (typeof onInput !== "function") {
    throw new TypeError("TEXT 응답 처리 함수가 필요합니다.");
  }

  const inputEl = root.querySelector(`#textInput_${questionId}`);
  if (!inputEl) return null;

  let isComposing = false;
  const scheduleFrame = options.scheduleFrame || globalThis.requestAnimationFrame;
  const onDraftTrigger = typeof options.onDraftTrigger === "function" ? options.onDraftTrigger : null;

  inputEl.addEventListener("compositionstart", () => {
    isComposing = true;
    inputEl.dataset.isComposing = "true";
  });

  inputEl.addEventListener("compositionend", (e) => {
    isComposing = false;
    inputEl.dataset.isComposing = "false";
    onInput(e?.target?.value ?? inputEl.value, inputEl);
    onDraftTrigger?.();
    refreshScribbleCommitSurface(inputEl, scheduleFrame);
  });

  inputEl.addEventListener("input", (e) => {
    if (isComposing || e?.isComposing || inputEl.dataset.isComposing === "true") {
      return;
    }
    onInput(e?.target?.value ?? inputEl.value, inputEl);
    onDraftTrigger?.();
    refreshScribbleCommitSurface(inputEl, scheduleFrame);
  });

  inputEl.addEventListener("change", (e) => {
    onInput(e?.target?.value ?? inputEl.value, inputEl);
    onDraftTrigger?.();
  });

  return inputEl;
}

export function refreshScribbleCommitSurface(inputElement, scheduleFrame = globalThis.requestAnimationFrame) {
  if (!inputElement?.classList) return false;
  inputElement.classList.add("scribble-commit-refresh");
  const schedule = typeof scheduleFrame === "function"
    ? scheduleFrame
    : (callback) => globalThis.setTimeout(callback, 0);
  schedule(() => {
    //+_+// iPadOS Scribble 변환 프레임을 먼저 합성한 뒤 다음 프레임에 임시 레이어를 해제해 Pencil 잔상을 제거한다.
    void inputElement.offsetWidth;
    schedule(() => {
      inputElement.classList.remove("scribble-commit-refresh");
    });
  });
  return true;
}

export function renderTextActivityStage(q, options = {}) {
  const isShowGuides = Boolean(options.showGuides);
  const promptText = escapeHtml(q.prompt || q.question || "");
  const expectedAns = escapeHtml(String(q.expectedAnswer !== undefined ? q.expectedAnswer : (q.answer !== undefined ? q.answer : "")));
  const acceptableAnswers = getGradingReferenceForDisplay(q).acceptableAnswers;
  const alternativeAnswers = Array.isArray(acceptableAnswers)
    ? acceptableAnswers.filter((answer) => String(answer) !== String(q.expectedAnswer))
    : [];
  //+_+// Phase F15A / F15C: 분수 및 소수 시각 표현 (SVG/DOM)
  const visualHtml = renderFractionRepresentation(q) || renderDecimalRepresentation(q);

  if (isShowGuides) {
    return `
      <div class="typed-activity-stage typed-model-answer" style="padding: 1rem; font-size: 1.1rem; line-height: 1.6;">
        ${visualHtml}
        <div class="typed-activity-prompt" style="font-weight: 600; margin-bottom: 0.75rem;">${promptText}</div>
        <div class="typed-expected-badge" style="background: #e6f4ea; color: #137333; padding: 0.5rem 0.75rem; border-radius: 6px; display: inline-block;">
          🎯 ${q.subjectId === "korean" && q.gradingMode === "GUARDIAN_MANUAL" ? "모범 답안 예시" : "기준 정답"}: <strong>${expectedAns}</strong>
        </div>
        ${alternativeAnswers.length ? `<div class="typed-acceptable-answers">허용 답안: ${alternativeAnswers.map((answer) => escapeHtml(String(answer))).join(" / ")}</div>` : ""}
      </div>
    `;
  }

  const savedRecord = options.responseRecord || options.responseSnapshots?.[q.id] || options.questionResponseRecordsMap?.get?.(q.id) || options.currentSubmission?.responseSnapshots?.[q.id];
  const studentVal = escapeHtml(String(savedRecord?.value || ""));
  const session = options.session;
  const isLocked = Boolean(options.isLocked || options.readOnly || (session && session.state !== SessionState.PRACTICE_ACTIVE && session.state !== SessionState.SUBMITTING));
  const isKorean = q.subjectId === "korean" || session?.config?.subjectId === "korean";
  const isEnglish = q.subjectId === "english" || session?.config?.subjectId === "english";
  const isTextSubject = isKorean || isEnglish;
  const inputModeAttr = isTextSubject ? 'inputmode="text"' : 'inputmode="numeric"';

  return `
    <div class="typed-activity-stage ${isLocked ? "is-read-only" : ""}" style="padding: 1rem; font-size: 1.1rem; line-height: 1.6; ${isLocked ? "pointer-events: none; user-select: none;" : ""}">
      ${visualHtml}
      <div class="typed-activity-prompt" style="font-weight: 600; margin-bottom: 0.75rem;">${promptText}</div>
      <div class="typed-input-area" style="margin-top: 0.5rem;">
        <label for="textInput_${escapeHtml(q.id)}" class="sr-only">답안 입력</label>
        <input type="text"
               ${inputModeAttr}
               class="typed-text-input"
               id="textInput_${escapeHtml(q.id)}"
               data-question-id="${escapeHtml(q.id)}"
               value="${studentVal}"
               placeholder="답을 입력하세요"
               style="width: 100%; max-width: ${isTextSubject ? "480px" : "320px"}; padding: 0.5rem 0.75rem; font-size: 1.1rem; border: 2px solid #ccc; border-radius: 6px;"
               ${isLocked ? "disabled" : ""} />
      </div>
    </div>
  `;
}

export function renderChoiceActivityStage(q, options = {}) {
  const isShowGuides = Boolean(options.showGuides);
  const promptText = escapeHtml(q.prompt || q.question || "");
  const expectedChoiceId = String(q.expectedAnswer !== undefined ? q.expectedAnswer : (q.answer !== undefined ? q.answer : ""));
  const choices = Array.isArray(q.choices) ? q.choices : [];
  //+_+// Phase F15A / F15C: 분수 및 소수 시각 표현 (SVG/DOM)
  const visualHtml = renderFractionRepresentation(q) || renderDecimalRepresentation(q);

  const savedRecord = options.responseRecord || options.responseSnapshots?.[q.id] || options.questionResponseRecordsMap?.get?.(q.id) || options.currentSubmission?.responseSnapshots?.[q.id];
  const studentChoiceId = String(savedRecord?.value || "");
  const session = options.session;
  const isLocked = Boolean(options.isLocked || options.readOnly || (session && session.state !== SessionState.PRACTICE_ACTIVE && session.state !== SessionState.SUBMITTING));

  const isReadOnly = Boolean(options.readOnly || isLocked);

  return `
    <div class="typed-activity-stage ${isReadOnly ? "grading-choice-read-only is-read-only" : ""}" style="padding: 1rem; font-size: 1.1rem; line-height: 1.6; ${isReadOnly ? "pointer-events: none; user-select: none;" : ""}">
      ${visualHtml}
      <div class="typed-activity-prompt" style="font-weight: 600; margin-bottom: 0.75rem;">${promptText}</div>
      <div class="typed-choices-list" role="radiogroup" aria-label="선택지" style="display: flex; flex-direction: column; gap: 0.5rem; ${isReadOnly ? "pointer-events: none;" : ""}">
        ${choices.map((c) => {
          const cId = escapeHtml(String(c.id));
          const cLabel = escapeHtml(String(c.label || c.text || c.id));
          const isExpected = isShowGuides && (String(c.id) === expectedChoiceId);
          const isStudentSelected = !isShowGuides && (String(c.id) === studentChoiceId);
          let itemStyle = "";
          if (isExpected) {
            itemStyle = "background: #e6f4ea; border: 2px solid #34a853;";
          } else if (isStudentSelected) {
            itemStyle = "background: #e8f0fe; border: 2px solid #1a73e8; font-weight: bold;";
          } else if (isReadOnly) {
            itemStyle = "opacity: 0.65; border: 1px solid #dadce0;";
          }
          if (isReadOnly) {
            itemStyle += " cursor: default; pointer-events: none;";
          }

          return `
            <label class="typed-choice-item choice-label ${isReadOnly ? "is-read-only" : ""} ${isExpected ? "expected-choice is-expected-choice" : ""} ${isStudentSelected ? "selected-choice is-student-selected" : ""}"
                   style="${itemStyle}">
              <input type="radio"
                     name="choice_${escapeHtml(q.id)}"
                     value="${cId}"
                     data-question-id="${escapeHtml(q.id)}"
                     ${String(c.id) === (isShowGuides ? expectedChoiceId : studentChoiceId) ? "checked" : ""}
                     ${isLocked || isShowGuides ? "disabled" : ""}
                     style="${isReadOnly ? "pointer-events: none;" : ""}" />
              ${isStudentSelected && isReadOnly ? `<span class="student-selection-tag" style="display: inline-block; background: #1a73e8; color: #fff; font-size: 0.75rem; font-weight: bold; padding: 2px 6px; border-radius: 4px; margin-right: 6px; vertical-align: middle;">학생 선택</span>` : ""}
              <span>${cLabel}</span>
            </label>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

export function renderTypedActivityStage(q, options = {}) {
  const responseType = resolveActivityResponseType(q);
  if (responseType === ResponseType.TEXT) {
    return renderTextActivityStage(q, options);
  }
  if (responseType === ResponseType.CHOICE) {
    return renderChoiceActivityStage(q, options);
  }
  throw new Error(`지원되지 않는 typed activity 타입입니다: ${responseType}`);
}
