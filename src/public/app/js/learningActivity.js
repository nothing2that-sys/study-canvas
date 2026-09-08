//+_+// Phase F10A: 통합 학습 플랫폼 타당성 검증 (LearningActivity 공통 모델)
//+_+// SSOT UNIFIED_CURRICULUM_ACTIVITY_PLATFORM_v2.2 및 Phase F10A 명세 준수
//+_+// - 기존 수학 연산과 공존 가능한 최소 Activity 계약 정의
//+_+// - activityType과 responseType 분리 (TEXT, CHOICE, CANVAS)
//+_+// - 자동 채점 배제 및 Guardian Manual 채점 지원용 expectedAnswer 유지

export const ActivityType = Object.freeze({
  SHORT_ANSWER: "SHORT_ANSWER",
  MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
  ARITHMETIC: "ARITHMETIC"
});

export const ResponseType = Object.freeze({
  CANVAS: "CANVAS",
  TEXT: "TEXT",
  CHOICE: "CHOICE"
});

export const GradingMode = Object.freeze({
  GUARDIAN_MANUAL: "GUARDIAN_MANUAL"
});

const VALID_ACTIVITY_TYPES = new Set(Object.values(ActivityType));
const VALID_RESPONSE_TYPES = new Set(Object.values(ResponseType));

//+_+// F10A 범위 외 미지원 responseType 식별용 (ORDERING, MATCHING 등은 엄격 거절)
const UNSUPPORTED_RESPONSE_TYPES = new Set([
  "ORDERING",
  "MATCHING",
  "LISTENING",
  "SPEAKING",
  "PASSAGE_READING",
  "WRITING",
  "VISUAL_REASONING"
]);

export function normalizeLearningActivity(input) {
  if (!input || typeof input !== "object") {
    throw new TypeError("LearningActivity 데이터가 유효하지 않습니다.");
  }

  const id = String(input.id || "").trim();
  if (!id) {
    throw new Error("LearningActivity에는 고유한 id가 필요합니다.");
  }

  const rawResponseType = String(input.responseType || "").trim().toUpperCase();
  if (UNSUPPORTED_RESPONSE_TYPES.has(rawResponseType)) {
    throw new Error(`지원되지 않는 responseType입니다 (F10A 범위 외): ${rawResponseType}`);
  }
  if (!VALID_RESPONSE_TYPES.has(rawResponseType)) {
    throw new Error(`유효하지 않은 responseType입니다: ${input.responseType}`);
  }

  const rawActivityType = String(input.activityType || "").trim().toUpperCase();
  if (!VALID_ACTIVITY_TYPES.has(rawActivityType)) {
    throw new Error(`유효하지 않은 activityType입니다: ${input.activityType}`);
  }

  const subjectId = String(input.subjectId || "math").trim().toLowerCase();
  const moduleId = String(input.moduleId || "general").trim().toLowerCase();
  const skillId = String(input.skillId || "").trim();
  if (!skillId) {
    throw new Error("LearningActivity에는 skillId가 필요합니다.");
  }

  const prompt = String(input.prompt || input.question || "").trim();

  let choices = null;
  if (rawResponseType === ResponseType.CHOICE || rawActivityType === ActivityType.MULTIPLE_CHOICE) {
    if (!Array.isArray(input.choices) || input.choices.length < 2) {
      throw new Error("CHOICE 활동에는 2개 이상의 선택지(choices)가 필요합니다.");
    }
    choices = input.choices.map((c, index) => {
      const choiceId = String(c.id || `choice_${index}`).trim();
      const label = String(c.label ?? c.text ?? choiceId).trim();
      return { id: choiceId, label };
    });
  }

  return {
    id,
    version: Math.max(1, Number(input.version) || 1),
    subjectId,
    moduleId,
    skillId,
    activityType: rawActivityType,
    responseType: rawResponseType,
    gradingMode: input.gradingMode || GradingMode.GUARDIAN_MANUAL,
    prompt,
    expectedAnswer: input.expectedAnswer !== undefined ? String(input.expectedAnswer) : null,
    choices,
    explanation: input.explanation ? String(input.explanation) : "",
    metadata: input.metadata && typeof input.metadata === "object" ? { ...input.metadata } : {}
  };
}

//+_+// ============================================================================
//+_+// Phase F10A 검증용 표준 Fixture 정의 (정식 교육 콘텐츠 구축이 아닌 Feasibility용)
//+_+// ============================================================================

//+_+// Fixture B: 수학 TEXT Fixture (길이 단위 변환)
export const FIXTURE_MATH_TEXT_ACTIVITY = Object.freeze(normalizeLearningActivity({
  id: "fixture_math_unit_length_001",
  version: 1,
  subjectId: "math",
  moduleId: "measurement",
  skillId: "MATH_MEASUREMENT_LENGTH_FIXTURE",
  activityType: ActivityType.SHORT_ANSWER,
  responseType: ResponseType.TEXT,
  gradingMode: GradingMode.GUARDIAN_MANUAL,
  prompt: "3m는 몇 cm인가요?",
  expectedAnswer: "300",
  explanation: "1m는 100cm이므로 3m는 300cm입니다."
}));

//+_+// Fixture C: 국어 CHOICE Fixture (띄어쓰기)
export const FIXTURE_KOREAN_CHOICE_ACTIVITY = Object.freeze(normalizeLearningActivity({
  id: "fixture_ko_spacing_001",
  version: 1,
  subjectId: "korean",
  moduleId: "spacing",
  skillId: "KO_SPACING_FIXTURE",
  activityType: ActivityType.MULTIPLE_CHOICE,
  responseType: ResponseType.CHOICE,
  gradingMode: GradingMode.GUARDIAN_MANUAL,
  prompt: "다음 중 바르게 쓴 문장을 고르세요.",
  choices: [
    { id: "choice_a", label: "나는 혼자서도 할수 있다." },
    { id: "choice_b", label: "나는 혼자서도 할 수 있다." }
  ],
  expectedAnswer: "choice_b",
  explanation: "'수'는 의존명사이므로 앞말과 띄어 씁니다."
}));

//+_+// Fixture D: 영어 CHOICE Fixture (기초 어휘)
export const FIXTURE_ENGLISH_CHOICE_ACTIVITY = Object.freeze(normalizeLearningActivity({
  id: "fixture_en_vocab_001",
  version: 1,
  subjectId: "english",
  moduleId: "vocabulary",
  skillId: "EN_VOCAB_FIXTURE",
  activityType: ActivityType.MULTIPLE_CHOICE,
  responseType: ResponseType.CHOICE,
  gradingMode: GradingMode.GUARDIAN_MANUAL,
  prompt: "happy의 뜻을 고르세요.",
  choices: [
    { id: "choice_a", label: "슬픈" },
    { id: "choice_b", label: "기쁜" },
    { id: "choice_c", label: "화난" },
    { id: "choice_d", label: "피곤한" }
  ],
  expectedAnswer: "choice_b",
  explanation: "happy는 '기쁜, 행복한'이라는 뜻입니다."
}));
