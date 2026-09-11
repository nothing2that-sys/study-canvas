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
