import {isUsableEligibilityActivity} from './aiReviewPolicy.js';
//+_+// Phase F10A: 통합 학습 플랫폼 타당성 검증 (LearningActivity 공통 모델)
//+_+// SSOT UNIFIED_CURRICULUM_ACTIVITY_PLATFORM_v2.2 및 Phase F10A 명세 준수
//+_+// - 기존 수학 연산과 공존 가능한 최소 Activity 계약 정의
//+_+// - activityType과 responseType 분리 (TEXT, CHOICE, CANVAS)
//+_+// - 자동 채점 배제 및 Guardian Manual 채점 지원용 expectedAnswer 유지

import {
  normalizeSchoolGrade,
  normalizeSemester,
  normalizeDifficulty
} from "./contentEligibility.js";

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

//+_+// Phase F12 Rework: 학습 세션 및 검증용 기본 문제 수 SSOT
export const DEFAULT_PROBLEM_COUNT = 20;

//+_+// Phase F10B: 출처 유형(SourceType) 및 검수 상태(ReviewStatus) 표준 열거형
export const SourceType = Object.freeze({
  INTERNAL_FIXTURE: "INTERNAL_FIXTURE",
  PROJECT_OWNED: "PROJECT_OWNED",
  EXTERNAL: "EXTERNAL",
  ARITHMETIC_GENERATOR: "ARITHMETIC_GENERATOR"
});

export const ReviewStatus = Object.freeze({
  INTERNAL: "INTERNAL",
  DRAFT: "DRAFT",
  VERIFIED: "VERIFIED",
  AUTO_VALIDATED: "AUTO_VALIDATED",
  REVIEWED: "REVIEWED",
  APPROVED: "APPROVED"
});

const VALID_ACTIVITY_TYPES = new Set(Object.values(ActivityType));
const VALID_RESPONSE_TYPES = new Set(Object.values(ResponseType));
const VALID_SOURCE_TYPES = new Set(Object.values(SourceType));
const VALID_REVIEW_STATUSES = new Set(Object.values(ReviewStatus));

export function resolveActivityResponseType(activity) {
  const explicitType = String(activity?.responseType || "").trim().toUpperCase();
  if (explicitType) {
    if (!VALID_RESPONSE_TYPES.has(explicitType)) {
      throw new Error(`유효하지 않은 responseType입니다: ${activity?.responseType}`);
    }
    return explicitType;
  }

  const activityType = String(activity?.activityType || "").trim().toUpperCase();
  if (activityType === ActivityType.SHORT_ANSWER) return ResponseType.TEXT;
  if (activityType === ActivityType.MULTIPLE_CHOICE) return ResponseType.CHOICE;

  //+_+// responseType 도입 이전의 수학 연산 문제는 기존 Canvas 입력을 유지한다
  return ResponseType.CANVAS;
}

export function usesDrawingCanvas(activity) {
  return resolveActivityResponseType(activity) === ResponseType.CANVAS;
}

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
  const courseId = input.courseId ? String(input.courseId).trim() : null;
  const unitId = input.unitId ? String(input.unitId).trim() : null;
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

  //+_+// Phase F10B: Static Content Package 참조 메타데이터 및 출처 메타데이터
  let contentRef = null;
  if (input.contentRef && typeof input.contentRef === "object") {
    const pkgId = String(input.contentRef.packageId || "").trim();
    const actId = String(input.contentRef.contentId || input.contentRef.activityId || id).trim();
    const pkgVer = String(input.contentRef.packageVersion || "1.0.0").trim();
    const cntVer = Number(input.contentRef.contentVersion || 1);
    if (!pkgId) {
      throw new Error("contentRef에는 packageId가 필수입니다.");
    }
    if (!pkgVer) {
      throw new Error("contentRef에는 packageVersion이 필수입니다.");
    }
    if (!actId) {
      throw new Error("contentRef에는 contentId가 필수입니다.");
    }
    if (!Number.isFinite(cntVer) || cntVer < 1) {
      throw new Error("contentRef에는 1 이상의 contentVersion이 필수입니다.");
    }
    contentRef = {
      packageId: pkgId,
      packageVersion: pkgVer,
      contentId: actId,
      contentVersion: cntVer
    };
  }

  let sourceMetadata = null;
  if (input.sourceMetadata && typeof input.sourceMetadata === "object") {
    const rawSourceType = String(input.sourceMetadata.sourceType || "").trim();
    if (!VALID_SOURCE_TYPES.has(rawSourceType)) {
      throw new Error(`유효하지 않은 sourceType입니다: ${input.sourceMetadata.sourceType}`);
    }

    const sourceId = String(input.sourceMetadata.sourceId || input.id || "").trim();
    if (!sourceId) {
      throw new Error("sourceMetadata에는 sourceId가 필수입니다.");
    }

    const license = String(input.sourceMetadata.license || "").trim();
    if (!license) {
      throw new Error("sourceMetadata에는 비어있지 않은 license가 필수입니다.");
    }

    const rawReviewStatus = String(input.sourceMetadata.reviewStatus || "").trim();
    if (!VALID_REVIEW_STATUSES.has(rawReviewStatus)) {
      throw new Error(`유효하지 않은 reviewStatus입니다: ${input.sourceMetadata.reviewStatus}`);
    }

    sourceMetadata = {
      sourceType: rawSourceType,
      sourceId,
      license,
      attribution: input.sourceMetadata.attribution ? String(input.sourceMetadata.attribution).trim() : null,
      retrievedAt: input.sourceMetadata.retrievedAt ? String(input.sourceMetadata.retrievedAt).trim() : null,
      reviewer: input.sourceMetadata.reviewer ? String(input.sourceMetadata.reviewer).trim() : null,
      reviewStatus: rawReviewStatus
    };
  }

  return {
    id,
    version: Math.max(1, Number(input.version) || 1),
    subjectId,
    courseId,
    unitId,
    moduleId,
    skillId,
    activityType: rawActivityType,
    responseType: rawResponseType,
    gradingMode: input.gradingMode || GradingMode.GUARDIAN_MANUAL,
    prompt,
    expectedAnswer: input.expectedAnswer !== undefined ? String(input.expectedAnswer) : null,
    choices,
    explanation: input.explanation ? String(input.explanation) : "",
    gradingReference: input.gradingReference && typeof input.gradingReference === "object" ? { ...input.gradingReference } : null,
    contentRef,
    sourceMetadata,
    gradeLevel: normalizeSchoolGrade(input.gradeLevel, { allowUnset: true }),
    semester: normalizeSemester(input.semester, { allowUnset: true }),
    difficulty: typeof input.difficulty === "string"
      ? normalizeDifficulty(input.difficulty, { allowUnset: true })
      : (input.difficulty ?? null),
    curriculumVersion: input.curriculumVersion ? String(input.curriculumVersion).trim() : null,
    achievementStandardIds: Array.isArray(input.achievementStandardIds)
      ? input.achievementStandardIds.map((id) => String(id).trim()).filter(Boolean)
      : [],
    reviewStatus: input.reviewStatus ? String(input.reviewStatus).trim().toUpperCase() : (sourceMetadata?.reviewStatus || null),
    metadata: input.metadata && typeof input.metadata === "object" ? { ...input.metadata } : {}
  };
}

//+_+// 신규 추천용 Activity가 학년 노출 심사에 필요한 계약을 충족하는지 검증
export function assertActivityEligibilityMetadata(activity) {
  const normalized = normalizeLearningActivity(activity);
  if (normalized.gradeLevel === null || normalized.semester === null || !normalized.curriculumVersion || normalized.achievementStandardIds.length === 0) {
    throw new Error(`LearningActivity(${normalized.id})에 학년·학기·교육과정 메타데이터가 필요합니다.`);
  }
  if (typeof normalized.difficulty !== "string") {
    throw new Error(`LearningActivity(${normalized.id})에 표준 난이도 메타데이터가 필요합니다.`);
  }
  if (!isUsableEligibilityActivity(normalized)) {
    throw new Error(`LearningActivity(${normalized.id})은 APPROVED 상태여야 합니다.`);
  }
  return normalized;
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
