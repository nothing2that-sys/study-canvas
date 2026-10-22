//+_+// Math Canvas Pro - Phase F10B Existing Math Arithmetic Adapter
//+_+// SSOT UNIFIED_CURRICULUM_ACTIVITY_PLATFORM_v2.2 및 Phase F10B 명세 준수
//+_+// - 기존 STAGE_REGISTRY 및 Generator를 SSOT로 그대로 유지하는 얇은 Adapter
//+_+// - M1~M9, D1~D6 데이터 복사/중복 구현 절대 금지

import {
  STAGE_REGISTRY,
  getAllStages,
  getStagesByOperation,
  generateStageQuestions
} from "./curriculumRegistry.js";

import {
  ActivityType,
  ResponseType,
  GradingMode,
  normalizeLearningActivity
} from "./learningActivity.js";

/**
 * 기존 Stage ID를 공통 Unified Skill 규격으로 매핑 (비복제 동적 프로젝션)
 */
export function getArithmeticStageSkill(stageId) {
  const stage = STAGE_REGISTRY[stageId];
  if (!stage) return null;

  const difficultyMap = {
    M1: 1, M2: 1, M3: 2, M4: 2, M5: 3, M6: 3, M7: 4, M8: 4, M9: 5,
    D1: 2, D2: 2, D3: 3, D4: 3, D5: 4, D6: 5
  };

  const macro = stage.macroLevelId || stage.id.split("-")[0];
  const difficulty = difficultyMap[macro] || 2;

  return Object.freeze({
    skillId: stage.id,
    subjectId: "math",
    courseId: "arithmetic",
    unitId: stage.operation === "div" ? "division" : "multiplication",
    name: stage.title || stage.name || stage.id,
    description: stage.desc || stage.description || `${stage.title || stage.name || stage.id} 연산 단계`,
    gradeBand: stage.operation === "div" ? "3_4" : "2_4",
    difficulty,
    status: "ACTIVE",
    prerequisites: [],
    legacyMacroLevelId: stage.macroLevelId,
    legacyOperation: stage.operation,
    legacyStageId: stage.id,
    generatorRef: stage.generate
  });
}

/**
 * 모든 기존 산술 단계를 Unified Skill 목록으로 반환
 */
export function getAllArithmeticSkills() {
  return getAllStages().map((stg) => getArithmeticStageSkill(stg.id));
}

/**
 * 특정 연산(mul/div)의 모든 산술 단계를 Unified Skill 목록으로 반환
 */
export function getArithmeticSkillsByOperation(operation = "mul") {
  return getStagesByOperation(operation).map((stg) => getArithmeticStageSkill(stg.id));
}

/**
 * 주어진 ID가 기존 산술 Stage인지 판별
 */
export function isArithmeticStage(stageId) {
  return Boolean(stageId && STAGE_REGISTRY[stageId]);
}

/**
 * 기존 생성된 산술 문제 객체를 LearningActivity 규격으로 래핑/적응
 */
export function adaptArithmeticQuestionToActivity(question, options = {}) {
  if (!question || typeof question !== "object") {
    throw new TypeError("적응할 산술 문제 객체가 유효하지 않습니다.");
  }

  const stageId = question.stageId || question.macroLevelId || question.level || "M1-1";
  const skill = getArithmeticStageSkill(stageId);

  return normalizeLearningActivity({
    id: question.id || question.key || `arith_${Date.now()}`,
    version: 1,
    subjectId: "math",
    courseId: "arithmetic",
    unitId: skill?.unitId || (question.operation === "div" ? "division" : "multiplication"),
    skillId: skill?.skillId || stageId,
    activityType: ActivityType.ARITHMETIC,
    responseType: ResponseType.CANVAS,
    gradingMode: GradingMode.GUARDIAN_MANUAL,
    prompt: question.prompt || `${question.operandA} ${question.operation === "div" ? "÷" : "×"} ${question.operandB}`,
    expectedAnswer: String(question.expectedAnswer !== undefined ? question.expectedAnswer : question.answer),
    explanation: question.explanation || "",
    sourceMetadata: {
      sourceType: "ARITHMETIC_GENERATOR",
      sourceId: stageId,
      license: "PROJECT_OWNED",
      attribution: "Math Canvas Pro Stage Registry",
      reviewStatus: "INTERNAL"
    },
    metadata: {
      ...question
    }
  });
}

/**
 * 특정 Stage에서 N개의 문제를 생성하고 LearningActivity 목록으로 반환
 */
export function generateArithmeticActivities(stageId, count = 10, options = {}) {
  const rawQuestions = generateStageQuestions(stageId, count, options);
  return rawQuestions.map((q) => adaptArithmeticQuestionToActivity(q, options));
}
