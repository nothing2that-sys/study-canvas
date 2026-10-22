//+_+// Cross-Phase Presentation Label Adapter
// 학생 화면에 내부 식별자(skillId, stageId, topicId, enum 등)나 undefined가 노출되지 않도록 사용자용 라벨로 변환

export const PRACTICE_MODE_LABELS = Object.freeze({
  STUDY_CARD: "새 단어 익히기",
  MEANING_CHOICE: "뜻 고르기",
  REVERSE_CHOICE: "단어 찾기",
  SPELLING_RECALL: "철자 떠올리기",
  CONTEXT_APPLICATION: "문맥에서 익히기"
});

const INTERNAL_EXACT_IDENTIFIERS = new Set([
  "undefined",
  "null",
  "skillId",
  "stageId",
  "macroLevelId",
  "activityType",
  "responseType",
  "MULTIPLE_CHOICE",
  "SHORT_ANSWER",
  "ARITHMETIC",
  "CANVAS",
  "TEXT",
  "CHOICE",
  "GUARDIAN_MANUAL",
  "AUTO",
  "STUDY_CARD",
  "MEANING_CHOICE",
  "REVERSE_CHOICE",
  "SPELLING_RECALL",
  "CONTEXT_APPLICATION",
  // English Vocabulary package raw topic IDs
  "school",
  "family",
  "daily",
  "weather",
  "food",
  "places",
  "hobbies",
  "health",
  "nature",
  "technology",
  "environment",
  "society"
]);

/**
 * 주어진 문자열이 시스템 내부 식별자(접두사/접미사/enum/raw ID)인지 검사
 * @param {unknown} value
 * @returns {boolean}
 */
export function isInternalIdentifier(value) {
  if (value === null || value === undefined) return true;
  const s = String(value).trim();
  if (!s || s === "undefined" || s === "null") return true;
  if (INTERNAL_EXACT_IDENTIFIERS.has(s)) return true;
  // KO_*, EN_*, MATH_* 형태의 내부 식별자 접두사 차단
  if (/^(KO|EN|MATH)_[A-Za-z0-9_]+$/i.test(s)) return true;
  // *_CARD, *_CHOICE, *_RECALL, *_APPLICATION 형태의 내부 모드 enum 차단
  if (/^[A-Z0-9_]+_(CARD|CHOICE|RECALL|APPLICATION)$/.test(s)) return true;
  return false;
}

/**
 * 학생 화면에 표시할 문제 단계명을 사용자용 문자열로 변환
 * @param {object} [activity] - 문항/활동 객체
 * @param {object} [sessionConfig] - 세션 설정 객체
 * @returns {string} 사용자 친화적 라벨 (fallback: "연습")
 */
export function getActivityDisplayLabel(activity = {}, sessionConfig = {}) {
  const candidates = [
    activity?.displayLabel,
    activity?.stageLabel,
    activity?.skillTitle,
    activity?.skillName,
    activity?.level,
    sessionConfig?.displayLabel,
    sessionConfig?.stageLabel,
    sessionConfig?.skillTitle,
    sessionConfig?.skillName
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim() && !isInternalIdentifier(candidate)) {
      return candidate.trim();
    }
  }

  const subjectId = String(activity?.subjectId || sessionConfig?.subjectId || "").trim().toLowerCase();
  if (subjectId === "korean") return "국어 학습";
  if (subjectId === "english") return "영어 학습";
  if (subjectId === "math") return "수학 연습";
  return "연습";
}

/**
 * Practice Mode enum을 사용자 친화적 한글 라벨로 변환
 * @param {string} mode
 * @returns {string}
 */
export function getPracticeModeLabel(mode) {
  return PRACTICE_MODE_LABELS[mode] || "단어 익히기";
}
