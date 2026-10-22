//+_+// Phase F15B: 분수 연산(Fraction Operations) 도메인 로직 SSOT
//+_+// - 정수 분자/분모 기반 정밀 유리수 연산 (부동소수점 float 배제)
//+_+// - 유클리드 호제법 기반 gcd, lcm, 통분, 약분
//+_+// - 안전 정수(Number.isSafeInteger) 및 음수 결과 fail-closed 차단
//+_+// - 유연한 TEXT 입력 파싱 ("3/5", "1 2/5", "1_2/5", 전각 슬래시 등)

import {
  validateFraction,
  normalizeFraction,
  toImproperNumerator,
  toMixedFraction as toMixedFractionBase
} from "./fractionConcepts.js";

/**
 * 최대공약수 (유클리드 호제법)
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/**
 * 최소공배수
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function lcm(a, b) {
  if (a === 0 || b === 0) return 0;
  const absA = Math.abs(a);
  const absB = Math.abs(b);
  const g = gcd(absA, absB);
  const result = (absA / g) * absB;
  if (!Number.isSafeInteger(result)) {
    throw new Error("안전 정수 범위를 초과했습니다 (lcm overflow).");
  }
  return result;
}

/**
 * 정수 안전성 검사
 * @param  {...number} nums
 */
function assertSafeIntegers(...nums) {
  for (const n of nums) {
    if (typeof n !== "number" || !Number.isSafeInteger(n)) {
      throw new Error(`안전 정수 범위를 초과했습니다: ${n}`);
    }
  }
}

/**
 * 가분수 표현 객체로 변환
 * @param {Object} fraction
 * @returns {{ wholeNumber: number, numerator: number, denominator: number }}
 */
export function toImproperFraction(fraction) {
  const norm = normalizeFraction(fraction, { minDenominator: 1 });
  const totalNum = norm.wholeNumber * norm.denominator + norm.numerator;
  assertSafeIntegers(totalNum, norm.denominator);
  return {
    wholeNumber: 0,
    numerator: totalNum,
    denominator: norm.denominator
  };
}

/**
 * 대분수 표현 객체로 변환
 * @param {Object} fraction
 * @returns {{ whole: number, wholeNumber: number, numerator: number, denominator: number }}
 */
export function toMixedFraction(fraction) {
  return toMixedFractionBase(fraction);
}

/**
 * 기약분수로 약분
 * @param {Object} fraction
 * @returns {{ wholeNumber: number, numerator: number, denominator: number }}
 */
export function reduceFraction(fraction) {
  const norm = normalizeFraction(fraction, { minDenominator: 1 });
  const totalNum = norm.wholeNumber * norm.denominator + norm.numerator;
  if (totalNum === 0) {
    return {
      wholeNumber: 0,
      numerator: 0,
      denominator: 1
    };
  }

  const divisor = gcd(totalNum, norm.denominator);
  const reducedNum = totalNum / divisor;
  const reducedDenom = norm.denominator / divisor;

  if (norm.wholeNumber > 0 && reducedNum >= reducedDenom) {
    const whole = Math.floor(reducedNum / reducedDenom);
    const rem = reducedNum % reducedDenom;
    return {
      wholeNumber: whole,
      numerator: rem,
      denominator: rem === 0 ? 1 : reducedDenom
    };
  }

  return {
    wholeNumber: 0,
    numerator: reducedNum,
    denominator: reducedDenom
  };
}

/**
 * 두 분수의 덧셈 (동분모 및 이분모)
 * @param {Object} f1
 * @param {Object} f2
 * @returns {{ wholeNumber: number, numerator: number, denominator: number }}
 */
export function addFractions(f1, f2) {
  const imp1 = toImproperFraction(f1);
  const imp2 = toImproperFraction(f2);

  assertSafeIntegers(imp1.numerator, imp1.denominator, imp2.numerator, imp2.denominator);

  const commonDenom = lcm(imp1.denominator, imp2.denominator);
  const mult1 = commonDenom / imp1.denominator;
  const mult2 = commonDenom / imp2.denominator;

  const num1 = imp1.numerator * mult1;
  const num2 = imp2.numerator * mult2;
  const sumNum = num1 + num2;

  assertSafeIntegers(num1, num2, sumNum, commonDenom);

  return {
    wholeNumber: 0,
    numerator: sumNum,
    denominator: commonDenom
  };
}

/**
 * 두 분수의 뺄셈 (동분모 및 이분모)
 * @param {Object} f1
 * @param {Object} f2
 * @returns {{ wholeNumber: number, numerator: number, denominator: number }}
 */
export function subtractFractions(f1, f2) {
  const imp1 = toImproperFraction(f1);
  const imp2 = toImproperFraction(f2);

  assertSafeIntegers(imp1.numerator, imp1.denominator, imp2.numerator, imp2.denominator);

  const commonDenom = lcm(imp1.denominator, imp2.denominator);
  const mult1 = commonDenom / imp1.denominator;
  const mult2 = commonDenom / imp2.denominator;

  const num1 = imp1.numerator * mult1;
  const num2 = imp2.numerator * mult2;
  const diffNum = num1 - num2;

  if (diffNum < 0) {
    throw new Error("음수 분수 결과는 초등 교육과정에서 허용되지 않습니다.");
  }

  assertSafeIntegers(num1, num2, diffNum, commonDenom);

  return {
    wholeNumber: 0,
    numerator: diffNum,
    denominator: commonDenom
  };
}

/**
 * 두 분수의 공통분모(최소공배수) 및 통분 결과 계산
 * @param {Object} f1
 * @param {Object} f2
 * @returns {{ lcmDenominator: number, converted1: Object, converted2: Object }}
 */
export function findCommonDenominator(f1, f2) {
  const imp1 = toImproperFraction(f1);
  const imp2 = toImproperFraction(f2);

  const commonDenom = lcm(imp1.denominator, imp2.denominator);
  const mult1 = commonDenom / imp1.denominator;
  const mult2 = commonDenom / imp2.denominator;

  return {
    lcmDenominator: commonDenom,
    converted1: {
      wholeNumber: 0,
      numerator: imp1.numerator * mult1,
      denominator: commonDenom
    },
    converted2: {
      wholeNumber: 0,
      numerator: imp2.numerator * mult2,
      denominator: commonDenom
    }
  };
}

/**
 * 분수를 특정 분모로 변환 (통분용)
 * @param {Object} fraction
 * @param {number} targetDenominator
 * @returns {{ wholeNumber: number, numerator: number, denominator: number }}
 */
export function convertToDenominator(fraction, targetDenominator) {
  const imp = toImproperFraction(fraction);
  if (targetDenominator % imp.denominator !== 0) {
    throw new Error(`목표 분모는 기존 분모의 배수여야 합니다: ${targetDenominator} % ${imp.denominator} !== 0`);
  }
  const multiplier = targetDenominator / imp.denominator;
  const newNum = imp.numerator * multiplier;
  assertSafeIntegers(newNum, targetDenominator);
  return {
    wholeNumber: 0,
    numerator: newNum,
    denominator: targetDenominator
  };
}

/**
 * 정수 교차 곱 기반 동치 판정
 * @param {Object|string} f1
 * @param {Object|string} f2
 * @returns {boolean}
 */
export function areEquivalentFractions(f1, f2) {
  const imp1 = toImproperFraction(typeof f1 === "string" ? parseFractionText(f1) : f1);
  const imp2 = toImproperFraction(typeof f2 === "string" ? parseFractionText(f2) : f2);
  return imp1.numerator * imp2.denominator === imp2.numerator * imp1.denominator;
}

/**
 * 정수 교차 곱 기반 크기 비교
 * @param {Object|string} f1
 * @param {Object|string} f2
 * @returns {-1|0|1}
 */
export function compareFractions(f1, f2) {
  const imp1 = toImproperFraction(typeof f1 === "string" ? parseFractionText(f1) : f1);
  const imp2 = toImproperFraction(typeof f2 === "string" ? parseFractionText(f2) : f2);
  const left = imp1.numerator * imp2.denominator;
  const right = imp2.numerator * imp1.denominator;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * 학생 TEXT 입력 파싱 (진분수, 가분수, 대분수, 정수, invalid fail-safe)
 * @param {string} text
 * @returns {{ wholeNumber: number, numerator: number, denominator: number }|null}
 */
export function parseFractionText(text) {
  if (text === null || text === undefined) return null;
  const trimmed = String(text).trim().replace(/[／⁄]/g, "/").replace(/\s+/g, " ");
  if (!trimmed) return null;

  // 1. 대분수: "1 2/5", "1_2/5", "1과 2/5", "1과2/5"
  const mixedMatch = trimmed.match(/^(\d+)(?:[\s_]+|과\s*)(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) {
    const wholeNumber = parseInt(mixedMatch[1], 10);
    const numerator = parseInt(mixedMatch[2], 10);
    const denominator = parseInt(mixedMatch[3], 10);
    if (denominator <= 0) return null;
    return { wholeNumber, numerator, denominator };
  }

  // 2. 진분수 / 가분수: "3/5"
  const simpleMatch = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (simpleMatch) {
    const numerator = parseInt(simpleMatch[1], 10);
    const denominator = parseInt(simpleMatch[2], 10);
    if (denominator <= 0) return null;
    return { wholeNumber: 0, numerator, denominator };
  }

  // 3. 단일 정수: "2"
  const intMatch = trimmed.match(/^(\d+)$/);
  if (intMatch) {
    const wholeNumber = parseInt(intMatch[1], 10);
    return { wholeNumber, numerator: 0, denominator: 1 };
  }

  return null;
}

/**
 * 분수 객체를 표준 텍스트로 포맷
 * @param {Object} fraction
 * @param {Object} [options] - { format: 'slash' | 'mixed' }
 * @returns {string}
 */
export function formatFractionText(fraction, options = {}) {
  if (!fraction) return "";
  const whole = fraction.wholeNumber || fraction.whole || 0;
  const num = fraction.numerator || 0;
  const denom = fraction.denominator || 1;

  if (whole > 0 && num > 0) {
    return `${whole} ${num}/${denom}`;
  }
  if (whole > 0 && num === 0) {
    return `${whole}`;
  }
  return `${num}/${denom}`;
}

/**
 * 단계별 연산 설명 (Step-by-Step Explanation) 결정론적 생성
 * @param {'ADD'|'SUB'|'COMMON_DENOM'} op
 * @param {Object} f1
 * @param {Object} f2
 * @param {Object} [options]
 * @returns {{ summary: string, steps: string[] }}
 */
export function generateStepByStepExplanation(op, f1, f2, options = {}) {
  const norm1 = normalizeFraction(f1, { minDenominator: 1 });
  const norm2 = normalizeFraction(f2, { minDenominator: 1 });
  const steps = [];

  if (op === "COMMON_DENOM") {
    const common = findCommonDenominator(norm1, norm2);
    steps.push(`1. 두 분모 ${norm1.denominator}와 ${norm2.denominator}의 최소공배수를 구합니다: 공통분모 = ${common.lcmDenominator}`);
    steps.push(`2. ${formatFractionText(norm1)}의 분모와 분자에 각각 ${common.lcmDenominator / norm1.denominator}를 곱합니다: ${formatFractionText(common.converted1)}`);
    steps.push(`3. ${formatFractionText(norm2)}의 분모와 분자에 각각 ${common.lcmDenominator / norm2.denominator}를 곱합니다: ${formatFractionText(common.converted2)}`);
    return {
      summary: `통분 결과: ${formatFractionText(common.converted1)}, ${formatFractionText(common.converted2)}`,
      steps
    };
  }

  const isSameDenom = norm1.denominator === norm2.denominator;
  let targetDenom = norm1.denominator;
  let work1 = norm1;
  let work2 = norm2;

  if (!isSameDenom) {
    const common = findCommonDenominator(norm1, norm2);
    targetDenom = common.lcmDenominator;
    steps.push(`1. 분모 ${norm1.denominator}와 ${norm2.denominator}의 최소공배수 ${targetDenom}을 구합니다.`);
    steps.push(`2. 두 분수를 통분합니다: ${formatFractionText(norm1)} = ${formatFractionText(common.converted1)}, ${formatFractionText(norm2)} = ${formatFractionText(common.converted2)}`);
    work1 = common.converted1;
    work2 = common.converted2;
  } else {
    steps.push(`1. 분모가 ${targetDenom}으로 같으므로 분모는 유지합니다.`);
  }

  const imp1 = toImproperFraction(work1);
  const imp2 = toImproperFraction(work2);

  if (op === "ADD") {
    const sumNum = imp1.numerator + imp2.numerator;
    steps.push(`${steps.length + 1}. 분자끼리 더합니다: ${imp1.numerator} + ${imp2.numerator} = ${sumNum}`);
    const rawResult = { wholeNumber: 0, numerator: sumNum, denominator: targetDenom };
    const reduced = reduceFraction(rawResult);
    const mixed = toMixedFraction(rawResult);

    let summary = `계산 결과는 ${formatFractionText(rawResult)}입니다.`;
    if (mixed.wholeNumber > 0 && mixed.numerator > 0) {
      summary += ` (대분수: ${formatFractionText(mixed)})`;
    }
    if (reduced.numerator !== rawResult.numerator) {
      summary += ` (기약분수: ${formatFractionText(reduced)})`;
    }

    return { summary, steps };
  }

  if (op === "SUB") {
    const diffNum = imp1.numerator - imp2.numerator;
    steps.push(`${steps.length + 1}. 분자끼리 뺍니다: ${imp1.numerator} - ${imp2.numerator} = ${diffNum}`);
    const rawResult = { wholeNumber: 0, numerator: diffNum, denominator: targetDenom };
    const reduced = reduceFraction(rawResult);

    let summary = `계산 결과는 ${formatFractionText(rawResult)}입니다.`;
    if (reduced.numerator !== rawResult.numerator) {
      summary += ` (기약분수: ${formatFractionText(reduced)})`;
    }

    return { summary, steps };
  }

  return { summary: "계산 완료", steps };
}
