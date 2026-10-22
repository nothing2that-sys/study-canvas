//+_+// Math Canvas Pro - 과목별 보호자 채점 피드백 프리셋 SSOT
//+_+// Cross-Phase Grading UX Rework

export const FeedbackCategory = Object.freeze({
  COMMON: "COMMON",
  MATH: "MATH",
  KOREAN: "KOREAN",
  ENGLISH: "ENGLISH"
});

export const COMMON_FEEDBACK_PRESETS = Object.freeze([
  { id: "common_perfect", text: "⭕ 완벽해요!", label: "⭕ 완벽해요!", category: FeedbackCategory.COMMON },
  { id: "common_retry", text: "✏️ 다시 풀어보기", label: "✏️ 다시 풀어보기", category: FeedbackCategory.COMMON },
  { id: "common_check_again", text: "🔍 다시 한번 확인해 보세요", label: "🔍 다시 한번 확인해 보세요", category: FeedbackCategory.COMMON },
  { id: "common_think_more", text: "💭 조금만 더 생각해 보세요", label: "💭 조금만 더 생각해 보세요", category: FeedbackCategory.COMMON }
]);

export const MATH_FEEDBACK_PRESETS = Object.freeze([
  { id: "math_carry", text: "⚠️ 받아올림 실수", label: "⚠️ 받아올림 실수", category: FeedbackCategory.MATH },
  { id: "math_alignment", text: "📐 자리맞춤 확인", label: "📐 자리맞춤 확인", category: FeedbackCategory.MATH },
  { id: "math_times_table", text: "✖ 구구단 오류", label: "✖ 구구단 오류", category: FeedbackCategory.MATH },
  { id: "math_fraction_reduction", text: "➗ 약분/통분 확인", label: "➗ 약분/통분 확인", category: FeedbackCategory.MATH },
  { id: "math_fraction_parts", text: "🔢 분모/분자 확인", label: "🔢 분모/분자 확인", category: FeedbackCategory.MATH },
  { id: "math_unit", text: "📏 단위 확인", label: "📏 단위 확인", category: FeedbackCategory.MATH }
]);

export const DECIMAL_FEEDBACK_PRESETS = Object.freeze([
  { id: "decimal_point", text: "🔍 소수점 위치 확인", label: "🔍 소수점 위치 확인", category: FeedbackCategory.MATH },
  { id: "decimal_place_value", text: "📐 자릿값 다시 확인", label: "📐 자릿값 다시 확인", category: FeedbackCategory.MATH },
  { id: "decimal_alignment", text: "📏 소수점 자리맞춤 확인", label: "📏 소수점 자리맞춤 확인", category: FeedbackCategory.MATH },
  { id: "decimal_carry_borrow", text: "⚠️ 받아올림/받아내림 확인", label: "⚠️ 받아올림/받아내림 확인", category: FeedbackCategory.MATH },
  { id: "decimal_calc_process", text: "✏️ 계산 과정 다시 확인", label: "✏️ 계산 과정 다시 확인", category: FeedbackCategory.MATH }
]);

export const KOREAN_FEEDBACK_PRESETS = Object.freeze([
  { id: "korean_final_consonant", text: "📝 받침 확인", label: "📝 받침 확인", category: FeedbackCategory.KOREAN },
  { id: "korean_spacing", text: "📐 띄어쓰기 확인", label: "📐 띄어쓰기 확인", category: FeedbackCategory.KOREAN },
  { id: "korean_spelling", text: "✏️ 맞춤법 확인", label: "✏️ 맞춤법 확인", category: FeedbackCategory.KOREAN },
  { id: "korean_stroke_order", text: "✍️ 글씨/획순 바르게", label: "✍️ 글씨/획순 바르게", category: FeedbackCategory.KOREAN },
  { id: "korean_context", text: "📖 문맥 다시 확인", label: "📖 문맥 다시 확인", category: FeedbackCategory.KOREAN }
]);

export const ENGLISH_FEEDBACK_PRESETS = Object.freeze([
  { id: "english_spelling", text: "✏️ 스펠링/철자 오류", label: "✏️ 스펠링/철자 오류", category: FeedbackCategory.ENGLISH },
  { id: "english_case", text: "🔤 대소문자 구분", label: "🔤 대소문자 구분", category: FeedbackCategory.ENGLISH },
  { id: "english_phonics", text: "🔊 파닉스 규칙", label: "🔊 파닉스 규칙", category: FeedbackCategory.ENGLISH },
  { id: "english_vocab", text: "💡 단어 뜻 확인", label: "💡 단어 뜻 확인", category: FeedbackCategory.ENGLISH },
  { id: "english_punctuation", text: "📌 문장 부호 확인", label: "📌 문장 부호 확인", category: FeedbackCategory.ENGLISH }
]);

/**
 * 과목 및 문맥에 적합한 보호자 피드백 프리셋 목록 단일 SSOT 반환
 * @param {Object|string} [params] 문자열 subjectId 또는 옵션 객체
 * @param {string} [params.subjectId="math"]
 * @param {string} [params.courseId]
 * @param {string} [params.activityType]
 * @returns {Array<{ id: string, text: string, label: string, category: string }>}
 */
export function getGuardianFeedbackPresets(params = {}) {
  const subjectId = typeof params === "string" ? params : (params?.subjectId || "math");
  const courseId = typeof params === "object" ? String(params?.courseId || "").toLowerCase() : "";
  const normSubject = String(subjectId || "math").trim().toLowerCase();

  let subjectPresets = MATH_FEEDBACK_PRESETS;
  if (normSubject === "korean") {
    subjectPresets = KOREAN_FEEDBACK_PRESETS;
  } else if (normSubject === "english") {
    subjectPresets = ENGLISH_FEEDBACK_PRESETS;
  } else if (normSubject === "math") {
    if (courseId === "decimal") {
      subjectPresets = DECIMAL_FEEDBACK_PRESETS;
    } else {
      subjectPresets = MATH_FEEDBACK_PRESETS;
    }
  } else {
    // 알 수 없는 과목의 경우 공통 프리셋만 안전 제공
    return [...COMMON_FEEDBACK_PRESETS];
  }

  // 공통 칭찬/재시도 프리셋 + 과목/도메인 특화 프리셋
  return [
    COMMON_FEEDBACK_PRESETS[0], // 완벽해요!
    ...subjectPresets,
    COMMON_FEEDBACK_PRESETS[1]  // 다시 풀어보기
  ];
}
