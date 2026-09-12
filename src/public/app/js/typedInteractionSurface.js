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
