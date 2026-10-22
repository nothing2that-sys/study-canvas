/**
 * Math Canvas Pro - 세부 기술 단계(Stage Registry) 및 특성 제약 문제 생성기 (Milestone D)
 * SSOT Section 195~209 명세 준수
 * - Macro Level (M1~M9, D1~D6) 및 Skill Stage (M1-1, M2-1, D1-1 등) 정의
 * - 받아올림, 부분곱, 0 포함, 내려쓰기, 몫 0 등 Feature 기반 제약 생성
 */

import { randomInt, fisherYates, digitCount, digitBounds, questionKey } from "./mathGen.js";

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `stg_q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ----------------------------------------------------
// 곱셈 세부 특성 계산
// ----------------------------------------------------
export function analyzeMultiplicationFeatures(operandA, operandB) {
  const topDigits = String(operandA).split("").reverse().map(Number);
  const bottomDigits = String(operandB).split("").reverse().map(Number);
  const aDigits = topDigits.length;
  const bDigits = bottomDigits.length;

  let totalCarries = 0;
  let maxCarryInSingleStep = 0;
  let multiCarryCount = 0;

  for (const bottom of bottomDigits) {
    let carry = 0;
    let stepCarries = 0;
    for (const top of topDigits) {
      const value = (top * bottom) + carry;
      if (value >= 10) {
        stepCarries += 1;
        totalCarries += 1;
      }
      carry = Math.floor(value / 10);
    }
    if (stepCarries >= 2) multiCarryCount += 1;
    if (stepCarries > maxCarryInSingleStep) maxCarryInSingleStep = stepCarries;
  }

  const hasZero = String(operandA).includes("0") || String(operandB).includes("0");
  const partialProducts = bottomDigits.map(b => operandA * b);

  return {
    operandADigits: aDigits,
    operandBDigits: bDigits,
    carries: totalCarries,
    maxCarryInSingleStep,
    requiresMultiCarry: multiCarryCount > 0,
    partialProductCount: bDigits,
    hasZero,
    partialProducts
  };
}

// ----------------------------------------------------
// 나눗셈 세부 특성 계산
// ----------------------------------------------------
export function analyzeDivisionFeatures(dividend, divisor) {
  const quotient = Math.floor(dividend / divisor);
  const remainder = dividend % divisor;
  const dvdStr = String(dividend);
  const dvrStr = String(divisor);
  const qStr = String(quotient);

  const dividendDigits = dvdStr.length;
  const divisorDigits = dvrStr.length;
  const quotientDigits = qStr.length;

  const hasZeroInQuotient = qStr.includes("0");
  const intermediateRemainderCount = 0; // 세부 단계별 나머지 발생 횟수

  return {
    dividendDigits,
    divisorDigits,
    quotientDigits,
    hasZeroInQuotient,
    divisionStepCount: quotientDigits,
    hasRemainder: remainder > 0,
    trailingZero: dividend % 10 === 0 || divisor % 10 === 0
  };
}

// ----------------------------------------------------
// Stage Registry 정의
// ----------------------------------------------------
export const STAGE_REGISTRY = {
  // 곱셈 Stages
  "M1-1": {
    id: "M1-1",
    macroLevelId: "M1",
    operation: "mul",
    order: 1,
    title: "구구단 기초 (2~5단)",
    desc: "2단부터 5단까지의 기초 구구단 곱셈",
    constraints: { aMin: 2, aMax: 5, bMin: 2, bMax: 9 },
    generate: (rand = Math.random) => {
      const a = randomInt(2, 5, rand);
      const b = randomInt(2, 9, rand);
      return createMultiplicationStageQuestion(a, b, "M1-1", "M1");
    }
  },
  "M1-2": {
    id: "M1-2",
    macroLevelId: "M1",
    operation: "mul",
    order: 2,
    title: "구구단 심화 (6~9단)",
    desc: "6단부터 9단까지의 높은 수 구구단 곱셈",
    constraints: { aMin: 6, aMax: 9, bMin: 2, bMax: 9 },
    generate: (rand = Math.random) => {
      const a = randomInt(6, 9, rand);
      const b = randomInt(2, 9, rand);
      return createMultiplicationStageQuestion(a, b, "M1-2", "M1");
    }
  },
  "M2-1": {
    id: "M2-1",
    macroLevelId: "M2",
    operation: "mul",
    order: 3,
    title: "두 자리 × 한 자리 (올림 없음)",
    desc: "일의 자리 곱에서 받아올림이 발생하지 않는 2자리×1자리",
    constraints: { maxCarries: 0 },
    generate: (rand = Math.random) => {
      let a, b, feat;
      for (let i = 0; i < 500; i++) {
        a = randomInt(11, 44, rand);
        b = randomInt(2, 4, rand);
        feat = analyzeMultiplicationFeatures(a, b);
        if (feat.carries === 0) break;
      }
      return createMultiplicationStageQuestion(a, b, "M2-1", "M2");
    }
  },
  "M2-2": {
    id: "M2-2",
    macroLevelId: "M2",
    operation: "mul",
    order: 4,
    title: "두 자리 × 한 자리 (올림 1회)",
    desc: "일의 자리에서 십의 자리로 1회 받아올림이 있는 곱셈",
    constraints: { exactCarries: 1 },
    generate: (rand = Math.random) => {
      let a, b, feat;
      for (let i = 0; i < 500; i++) {
        a = randomInt(12, 98, rand);
        b = randomInt(2, 9, rand);
        feat = analyzeMultiplicationFeatures(a, b);
        if (feat.carries === 1) break;
      }
      return createMultiplicationStageQuestion(a, b, "M2-2", "M2");
    }
  },
  "M2-3": {
    id: "M2-3",
    macroLevelId: "M2",
    operation: "mul",
    order: 5,
    title: "두 자리 × 한 자리 (연속 올림)",
    desc: "일의 자리와 십의 자리에서 연속으로 올림수가 생기는 세로셈",
    constraints: { minCarries: 2 },
    generate: (rand = Math.random) => {
      let a, b, feat;
      for (let i = 0; i < 500; i++) {
        a = randomInt(35, 99, rand);
        b = randomInt(4, 9, rand);
        feat = analyzeMultiplicationFeatures(a, b);
        if (feat.carries >= 2) break;
      }
      return createMultiplicationStageQuestion(a, b, "M2-3", "M2");
    }
  },
  "M3-1": {
    id: "M3-1",
    macroLevelId: "M3",
    operation: "mul",
    order: 6,
    title: "세 자리 × 한 자리 (기본 세로셈)",
    desc: "3자리 수와 1자리 수의 표준 세로셈 연산",
    generate: (rand = Math.random) => {
      const a = randomInt(112, 998, rand);
      const b = randomInt(2, 9, rand);
      return createMultiplicationStageQuestion(a, b, "M3-1", "M3");
    }
  },
  "M5-1": {
    id: "M5-1",
    macroLevelId: "M5",
    operation: "mul",
    order: 7,
    title: "두 자리 × 두 자리 (부분곱 기초)",
    desc: "2줄 부분곱을 구하고 자릿수를 맞추어 더하는 곱셈",
    generate: (rand = Math.random) => {
      const a = randomInt(12, 98, rand);
      const b = randomInt(12, 98, rand);
      return createMultiplicationStageQuestion(a, b, "M5-1", "M5");
    }
  },

  // 나눗셈 Stages
  "D1-1": {
    id: "D1-1",
    macroLevelId: "D1",
    operation: "div",
    order: 101,
    title: "나눗셈 기초 (몫 2~5)",
    desc: "구구단 범위 내 1자리 수 나누기 (몫 2~5)",
    generate: (rand = Math.random) => {
      const dvr = randomInt(2, 4, rand);
      const q = randomInt(2, 5, rand);
      const dvd = dvr * q;
      return createDivisionStageQuestion(dvd, dvr, q, "D1-1", "D1");
    }
  },
  "D1-2": {
    id: "D1-2",
    macroLevelId: "D1",
    operation: "div",
    order: 102,
    title: "나눗셈 기초 (몫 6~9)",
    desc: "구구단 범위 내 1자리 수 나누기 (몫 6~9)",
    generate: (rand = Math.random) => {
      const dvr = randomInt(2, 9, rand);
      const q = randomInt(6, 9, rand);
      const dvd = dvr * q;
      return createDivisionStageQuestion(dvd, dvr, q, "D1-2", "D1");
    }
  },
  "D2-1": {
    id: "D2-1",
    macroLevelId: "D2",
    operation: "div",
    order: 103,
    title: "두 자리 ÷ 한 자리 (내림 없음)",
    desc: "각 자릿수가 나누어떨어져 내림이 없는 2자리÷1자리",
    generate: (rand = Math.random) => {
      let dvd, dvr, q;
      for (let i = 0; i < 500; i++) {
        dvr = randomInt(2, 4, rand);
        const tens = randomInt(1, Math.floor(9 / dvr), rand) * dvr;
        const ones = randomInt(1, Math.floor(9 / dvr), rand) * dvr;
        dvd = tens * 10 + ones;
        q = dvd / dvr;
        if (digitCount(dvd) === 2 && dvd % dvr === 0) break;
      }
      return createDivisionStageQuestion(dvd, dvr, q, "D2-1", "D2");
    }
  },
  "D2-2": {
    id: "D2-2",
    macroLevelId: "D2",
    operation: "div",
    order: 104,
    title: "두 자리 ÷ 한 자리 (내림 1회)",
    desc: "십의 자리에서 내림이 발생하고 몫이 2자리인 나눗셈",
    generate: (rand = Math.random) => {
      let dvd, dvr, q;
      for (let i = 0; i < 500; i++) {
        dvr = randomInt(2, 9, rand);
        q = randomInt(11, Math.floor(99 / dvr), rand);
        dvd = dvr * q;
        if (digitCount(dvd) === 2 && Math.floor(dvd / 10) % dvr !== 0) break;
      }
      return createDivisionStageQuestion(dvd, dvr, q, "D2-2", "D2");
    }
  },
  "D3-1": {
    id: "D3-1",
    macroLevelId: "D3",
    operation: "div",
    order: 105,
    title: "세 자리 ÷ 한 자리 (표준 세로셈)",
    desc: "3자리 수 나누기 1자리 수 표준 세로셈 연산",
    //+_+// 3자리 피제수(100~999) 범위 보장
    generate: (rand = Math.random) => {
      let dvd, dvr, q;
      for (let i = 0; i < 500; i++) {
        dvr = randomInt(2, 9, rand);
        const minQ = Math.ceil(100 / dvr);
        const maxQ = Math.floor(999 / dvr);
        q = randomInt(minQ, maxQ, rand);
        dvd = dvr * q;
        if (digitCount(dvd) === 3 && dvd % dvr === 0) break;
      }
      return createDivisionStageQuestion(dvd, dvr, q, "D3-1", "D3");
    }
  }
};

function createMultiplicationStageQuestion(operandA, operandB, stageId, macroLevelId) {
  const feat = analyzeMultiplicationFeatures(operandA, operandB);
  const qKey = questionKey("mul", operandA, operandB);
  return {
    id: makeId(),
    key: qKey,
    questionKey: qKey,
    operation: "mul",
    macroLevelId,
    stageId,
    level: macroLevelId,
    operandA,
    operandB,
    answer: operandA * operandB,
    expectedAnswer: operandA * operandB,
    features: feat,
    mathFormat: "vertical"
  };
}

function createDivisionStageQuestion(dividend, divisor, quotient, stageId, macroLevelId) {
  const feat = analyzeDivisionFeatures(dividend, divisor);
  const qKey = questionKey("div", dividend, divisor);
  return {
    id: makeId(),
    key: qKey,
    questionKey: qKey,
    operation: "div",
    macroLevelId,
    stageId,
    level: macroLevelId,
    operandA: dividend,
    operandB: divisor,
    answer: quotient,
    expectedAnswer: quotient,
    features: feat,
    mathFormat: "vertical"
  };
}

/**
 * 특정 Stage에서 N개의 문제를 생성
 */
export function generateStageQuestions(stageId, count = 10, options = {}) {
  const stage = STAGE_REGISTRY[stageId];
  if (!stage) {
    throw new Error(`존재하지 않는 Stage ID입니다: ${stageId}`);
  }

  const rand = options.random || Math.random;
  const questions = [];
  const unique = new Map();
  const attemptLimit = count * 200;
  let attempts = 0;

  while (unique.size < count && attempts < attemptLimit) {
    attempts += 1;
    const q = stage.generate(rand);
    if (!unique.has(q.key)) {
      unique.set(q.key, q);
    }
  }

  if (unique.size < count) {
    const baseItems = Array.from(unique.values());
    while (questions.length < count && baseItems.length > 0) {
      questions.push(...fisherYates(baseItems, rand).map((q) => ({ ...q, id: makeId() })));
    }
    return questions.slice(0, count);
  }

  return Array.from(unique.values()).slice(0, count);
}

/**
 * 전체 Stage 목록 반환
 */
export function getAllStages() {
  return Object.values(STAGE_REGISTRY).sort((a, b) => a.order - b.order);
}

/**
 * 특정 연산(mul/div)의 Stage 목록 반환
 */
export function getStagesByOperation(operation = "mul") {
  return getAllStages().filter(s => s.operation === operation);
}
