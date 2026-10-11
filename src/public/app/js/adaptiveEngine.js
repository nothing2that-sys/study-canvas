/**
 * Math Canvas Pro - 적응형 추천 세션 엔진 (Milestone F)
 * SSOT Section 207~215 명세 준수
 * - 60/20/10/10 세션 구성 (현재 단계 60%, 취약 기술 20%, 오답 변형 10%, 이전 복습 10%)
 * - Similar Question Generator (오답 변형 문제 생성 및 연결)
 * - 학습자 맞춤형 추천 이유 생성
 */

import { generateStageQuestions, STAGE_REGISTRY, getAllStages, analyzeMultiplicationFeatures } from "./curriculumRegistry.js";
import { analyzeWeaknesses } from "./masteryEngine.js";
import { randomInt, questionKey } from "./mathGen.js";
import { resolveActivityResponseType, ResponseType } from "./learningActivity.js";

// Only the legacy arithmetic registry is eligible for this recommendation card.
// F16D review-only content keeps autoRecommend=false; never coerce it into mul/div.
export function resolveAdaptiveStageId(stageId, record = {}) {
  if (STAGE_REGISTRY[stageId]) return stageId;
  const stages = getAllStages().filter(stage => stage.macroLevelId === stageId);
  if (!stages.length) return null;
  const a = record.operandA, b = record.operandB;
  if (Number.isSafeInteger(a) && a > 0 && Number.isSafeInteger(b) && b > 0) {
    if (stageId === "M2") {
      const carries = analyzeMultiplicationFeatures(a, b).carries;
      return carries === 0 ? "M2-1" : carries === 1 ? "M2-2" : "M2-3";
    }
    if (stageId === "D2") return Math.floor(a / 10) % b === 0 ? "D2-1" : "D2-2";
  }
  return stages[0].id;
}

function adaptiveRecord(record, requireOperands = false) {
  if (!record || (record.subjectId && record.subjectId !== "math") ||
      (record.courseId && record.courseId !== "arithmetic")) return null;
  try {
    if (resolveActivityResponseType(record) !== ResponseType.CANVAS) return null;
  } catch (_) { return null; }
  const stageId = resolveAdaptiveStageId(record.stageId || record.macroLevelId || record.level, record);
  if (!stageId) return null;
  const operation = STAGE_REGISTRY[stageId].operation;
  if (record.operation && record.operation !== operation) return null;
  if (requireOperands && (![record.operandA, record.operandB].every(n => Number.isSafeInteger(n) && n > 0) ||
      (operation === "div" && record.operandA % record.operandB !== 0))) return null;
  return { ...record, stageId, operation };
}

export function analyzeAdaptiveWeaknesses(attempts = [], mistakes = []) {
  return analyzeWeaknesses(attempts.map(a => adaptiveRecord(a)).filter(Boolean),
    mistakes.map(m => adaptiveRecord(m, true)).filter(Boolean));
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `adp_q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * 오답과 동일한 수학적 특성을 공유하는 변형 문제 생성 (Similar Question)
 */
export function generateSimilarQuestion(wrongQuestion, rand = Math.random) {
  if (!wrongQuestion) throw new Error("변형을 생성할 원본 문제가 없습니다.");
  wrongQuestion = adaptiveRecord(wrongQuestion, true);
  if (!wrongQuestion) throw new Error("연산 추천에 사용할 수 없는 오답입니다.");
  const op = wrongQuestion.operation || "mul";
  const origA = Number(wrongQuestion.operandA);
  const origB = Number(wrongQuestion.operandB);
  const stageId = wrongQuestion.stageId || wrongQuestion.level || "M2-2";
  const stage = STAGE_REGISTRY[stageId];

  let newA, newB, answer;

  if (stage && typeof stage.generate === "function") {
    // Stage 생성기를 활용하되 원본 문제와 동일한 문제는 제외
    for (let i = 0; i < 200; i++) {
      const candidate = stage.generate(rand);
      if (candidate.operandA !== origA || candidate.operandB !== origB) {
        return {
          ...candidate,
          id: makeId(),
          sourceType: "variant",
          sourceWrongAnswerId: wrongQuestion.id || wrongQuestion.key,
          similarToQuestionKey: wrongQuestion.questionKey || wrongQuestion.key
        };
      }
    }
  }

  // Fallback 변형 생성
  if (op === "mul") {
    const aLen = String(origA).length;
    const bLen = String(origB).length;
    newA = randomInt(10 ** (aLen - 1), (10 ** aLen) - 1, rand);
    newB = randomInt(10 ** (bLen - 1), (10 ** bLen) - 1, rand);
    answer = newA * newB;
  } else {
    newB = Math.max(2, origB);
    const q = randomInt(2, 9, rand);
    newA = newB * q;
    answer = q;
  }

  const qKey = questionKey(op, newA, newB);
  return {
    id: makeId(),
    key: qKey,
    questionKey: qKey,
    operation: op,
    macroLevelId: wrongQuestion.macroLevelId || stageId,
    stageId,
    level: wrongQuestion.level || stageId,
    operandA: newA,
    operandB: newB,
    answer,
    expectedAnswer: answer,
    sourceType: "variant",
    sourceWrongAnswerId: wrongQuestion.id || wrongQuestion.key,
    similarToQuestionKey: wrongQuestion.questionKey || wrongQuestion.key,
    mathFormat: wrongQuestion.mathFormat || "vertical"
  };
}

/**
 * 60 / 20 / 10 / 10 적응형 맞춤 세션 구성
 */
export function composeAdaptiveSession(options = {}) {
  const targetCount = Number(options.count) || 10;
  const requestedStageId = options.currentStageId || "M2-1";
  const sourceRecord = (options.attempts || []).find(a => a.stageId === requestedStageId || a.macroLevelId === requestedStageId);
  const currentStageId = resolveAdaptiveStageId(requestedStageId, sourceRecord);
  if (!currentStageId) throw new Error(`연산 추천에 사용할 수 없는 단계입니다: ${requestedStageId}`);
  const operation = STAGE_REGISTRY[currentStageId].operation;
  const attempts = (options.attempts || []).map(a => adaptiveRecord(a)).filter(a => a && a.operation === operation);
  const mistakes = (options.mistakes || []).map(m => adaptiveRecord(m, true)).filter(m => m && m.operation === operation);
  const rand = options.random || Math.random;

  // 비율 계산: 60% 현재 단계, 20% 취약 기술, 10% 오답 변형, 10% 이전 복습
  const currentCount = Math.max(1, Math.round(targetCount * 0.6));
  const weaknessCount = Math.max(0, Math.round(targetCount * 0.2));
  const variantCount = Math.max(0, Math.round(targetCount * 0.1));
  const reviewCount = Math.max(0, targetCount - currentCount - weaknessCount - variantCount);

  const composedQuestions = [];
  const usedKeys = new Set();

  function addQuestion(q) {
    if (q && !usedKeys.has(q.key)) {
      usedKeys.add(q.key);
      composedQuestions.push(q);
      return true;
    }
    return false;
  }

  // 1. 현재 학습 단계 문제 60%
  const currentStageQuestions = generateStageQuestions(currentStageId, currentCount * 2, { random: rand });
  for (const q of currentStageQuestions) {
    if (composedQuestions.length >= currentCount) break;
    addQuestion({ ...q, sourceType: "normal" });
  }

  // 2. 최근 취약 기술 문제 20%
  const weaknessAnalysis = analyzeWeaknesses(attempts, mistakes);
  const topWeakness = weaknessAnalysis.weaknesses[0];
  const weaknessStageId = topWeakness?.stageId || currentStageId;
  const weaknessQuestions = generateStageQuestions(weaknessStageId, weaknessCount * 2, { random: rand });
  let addedWeakness = 0;
  for (const q of weaknessQuestions) {
    if (addedWeakness >= weaknessCount) break;
    if (addQuestion({ ...q, sourceType: "weakness" })) {
      addedWeakness += 1;
    }
  }

  // 3. 미해결 오답 변형 문제 10%
  let addedVariants = 0;
  for (const m of mistakes) {
    if (addedVariants >= variantCount) break;
    //+_+// 앞 단계 문제와 key가 겹치면 제한 횟수 안에서 새 변형을 다시 생성한다.
    for (let attempt = 0; attempt < 20 && addedVariants < variantCount; attempt += 1) {
      try {
        const variant = generateSimilarQuestion(m, rand);
        if (addQuestion(variant)) addedVariants += 1;
      } catch (_) {
        break;
      }
    }
  }

  // 4. 이전 완료 단계 복습 문제 10%
  const allStages = getAllStages().filter(stage => stage.operation === operation).map(stage => stage.id);
  const currentStageIdx = allStages.indexOf(currentStageId);
  const reviewStageId = currentStageIdx > 0 ? allStages[currentStageIdx - 1] : currentStageId;
  const reviewQuestions = generateStageQuestions(reviewStageId, reviewCount * 2, { random: rand });
  for (const q of reviewQuestions) {
    if (composedQuestions.length >= targetCount) break;
    addQuestion({ ...q, sourceType: "review" });
  }

  // 부족한 문제 수는 현재 단계 문제로 보충
  if (composedQuestions.length < targetCount) {
    const filler = generateStageQuestions(currentStageId, targetCount - composedQuestions.length, { random: rand });
    filler.forEach(q => composedQuestions.push(q));
  }

  // 번호 부여
  const finalQuestions = composedQuestions.slice(0, targetCount).map((q, idx) => ({
    ...q,
    orderNumber: idx + 1
  }));

  const currentStageDef = STAGE_REGISTRY[currentStageId];
  const recommendationReason = generateAdaptiveRecommendationReason(
    currentStageDef?.title || currentStageId,
    topWeakness,
    mistakes.length
  );

  return {
    questions: finalQuestions,
    stageId: currentStageId,
    recommendationReason,
    composition: {
      normalCount: finalQuestions.filter(q => q.sourceType === "normal").length,
      weaknessCount: finalQuestions.filter(q => q.sourceType === "weakness").length,
      variantCount: finalQuestions.filter(q => q.sourceType === "variant").length,
      reviewCount: finalQuestions.filter(q => q.sourceType === "review").length
    }
  };
}

/**
 * 학습자 맞춤형 추천 이유 문구 생성
 */
export function generateAdaptiveRecommendationReason(stageTitle, topWeakness, mistakeCount) {
  let reason = `현재 학습 단계인 '${stageTitle}' 중심 맞춤 세션을 추천합니다.`;

  if (topWeakness && topWeakness.wrongCount > 0) {
    reason += ` 최근 '${topWeakness.title}'에서 ${topWeakness.wrongCount}회 오답이 발생하여 복습 문제가 포함되었습니다.`;
  }
  if (mistakeCount > 0) {
    reason += ` 미해결 오답을 보완할 수 있는 변형 문제를 함께 준비했습니다.`;
  }

  return reason;
}

