import { getGradingReferenceForDisplay } from "./historicalGradingReference.js";

// Present a saved answer without exposing a choice identifier or modifying its snapshot.
export function getQuestionAnswerDisplay(question = {}) {
  const answer = question.expectedAnswer ?? question.answer ?? "";
  const choice = question.choices?.find(item => String(item.id) === String(answer));
  if (choice) return String(choice.label ?? choice.text ?? choice.value ?? choice.id);
  const reference = getGradingReferenceForDisplay(question);
  const display = reference.displayAnswer ?? reference.correctAnswer ?? answer;
  return typeof display === "number" ? display.toLocaleString("ko-KR") : String(display);
}
