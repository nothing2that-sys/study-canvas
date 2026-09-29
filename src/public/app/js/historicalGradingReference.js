// Saved question snapshots remain unchanged. This rule only corrects the guardian display
// for the exact 1.0.0 activity whose second acceptable answer was established in 1.0.1.
export function getGradingReferenceForDisplay(question) {
  const reference = question?.gradingReference || {};
  const ref = question?.contentRef;
  if (ref?.packageId !== "korean-core-v1" || ref.packageVersion !== "1.0.0" ||
      ref.contentId !== "KO_ACT_SENTENCE_CORRECTION_017" || ref.contentVersion !== 1 ||
      question?.id !== "KO_ACT_SENTENCE_CORRECTION_017") {
    return reference;
  }

  return {
    ...reference,
    acceptableAnswers: [
      "교장 선생님의 말씀이 있겠습니다.",
      "교장 선생님의 말씀이 있으시겠습니다."
    ],
    explanation: "간접 높임은 문맥에 따라 ‘있겠습니다’ 또는 ‘있으시겠습니다’로 표현할 수 있습니다. ‘말씀이 계시겠습니다’는 쓰지 않습니다."
  };
}
