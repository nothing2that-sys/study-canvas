//+_+// Phase F15B: 분수 연산 문제 생성기 (Fraction Operation Problem Generator)
//+_+// - 초등 4~5학년 교육과정 9대 레벨 엄격 준수 (난이도 누수 방지)
//+_+// - 결정론적 생성 및 동일 세션 내 중복 방지 (Deduplication)
//+_+// - 음수 결과 원천 차단
//+_+// - 5, 10, 20문제 동적 생성 지원

import {
  gcd,
  lcm,
  addFractions,
  subtractFractions,
  findCommonDenominator,
  reduceFraction,
  formatFractionText,
  generateStepByStepExplanation,
  compareFractions
} from "./fractionOperations.js";

export const FractionOperationLevel = Object.freeze({
  SAME_DENOM_PROPER_ADD: 1,       // 1. 동분모 진분수 덧셈 (합 < 1)
  SAME_DENOM_IMPROPER_ADD: 2,     // 2. 동분모 진분수 덧셈 (합 >= 1)
  SAME_DENOM_SUB: 3,              // 3. 동분모 분수 뺄셈 (결과 >= 0)
  MIXED_SAME_DENOM_ADD: 4,        // 4. 대분수 동분모 덧셈
  MIXED_SAME_DENOM_SUB: 5,        // 5. 대분수 동분모 뺄셈
  COMMON_DENOMINATOR: 6,          // 6. 이분모 분수의 통분
  UNLIKE_DENOM_PROPER_ADD: 7,     // 7. 이분모 진분수 덧셈
  UNLIKE_DENOM_PROPER_SUB: 8,     // 8. 이분모 진분수 뺄셈
  MIXED_UNLIKE_DENOM: 9           // 9. 이분모 대분수 연산
});

/**
 * 결정론적 PRNG (시드 기반 난수 생성기)
 */
function createPrng(seed = 123456789) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * 정수 난수 생성
 */
function randInt(prng, min, max) {
  return Math.floor(prng() * (max - min + 1)) + min;
}

/**
 * 문제 서명 생성 (중복 방지용)
 */
function getProblemSignature(op, f1, f2) {
  const s1 = formatFractionText(f1);
  const s2 = formatFractionText(f2);
  if (op === "ADD") {
    return [s1, s2].sort().join("+");
  }
  if (op === "SUB") {
    return `${s1}-${s2}`;
  }
  return `${s1}~${s2}`;
}

/**
 * 분수 연산 문제 집합 생성
 * @param {Object} options
 * @param {number} [options.level=1] - FractionOperationLevel
 * @param {number} [options.count=10] - 생성할 문제 수 (5, 10, 20 등)
 * @param {number} [options.seed] - 재현용 시드
 * @returns {Array<Object>} 생성된 문제 목록
 */
export function generateFractionOperationProblems(options = {}) {
  const level = options.level || FractionOperationLevel.SAME_DENOM_PROPER_ADD;
  const count = options.count || 10;
  const prng = createPrng(options.seed || (Date.now() ^ 0x9e3779b9));

  const problems = [];
  const signatures = new Set();

  let attempts = 0;
  const maxAttempts = count * 200;

  while (problems.length < count && attempts < maxAttempts) {
    attempts++;
    let prob = null;

    switch (level) {
      // Level 1: 동분모 진분수 덧셈 (합 < 1)
      case FractionOperationLevel.SAME_DENOM_PROPER_ADD: {
        const d = randInt(prng, 3, 10);
        const n1 = randInt(prng, 1, d - 2);
        const maxN2 = d - 1 - n1;
        if (maxN2 < 1) continue;
        const n2 = randInt(prng, 1, maxN2);

        const f1 = { wholeNumber: 0, numerator: n1, denominator: d };
        const f2 = { wholeNumber: 0, numerator: n2, denominator: d };
        const res = addFractions(f1, f2);

        prob = {
          op: "ADD",
          f1,
          f2,
          result: res,
          explanation: generateStepByStepExplanation("ADD", f1, f2)
        };
        break;
      }

      // Level 2: 동분모 진분수 덧셈 (합 >= 1)
      case FractionOperationLevel.SAME_DENOM_IMPROPER_ADD: {
        const d = randInt(prng, 3, 10);
        const n1 = randInt(prng, 2, d - 1);
        const minN2 = d - n1;
        const n2 = randInt(prng, minN2, d - 1);

        const f1 = { wholeNumber: 0, numerator: n1, denominator: d };
        const f2 = { wholeNumber: 0, numerator: n2, denominator: d };
        const res = addFractions(f1, f2);

        prob = {
          op: "ADD",
          f1,
          f2,
          result: res,
          explanation: generateStepByStepExplanation("ADD", f1, f2)
        };
        break;
      }

      // Level 3: 동분모 뺄셈 (결과 >= 0)
      case FractionOperationLevel.SAME_DENOM_SUB: {
        const d = randInt(prng, 3, 10);
        const n1 = randInt(prng, 2, d);
        const n2 = randInt(prng, 1, n1);

        const f1 = { wholeNumber: 0, numerator: n1, denominator: d };
        const f2 = { wholeNumber: 0, numerator: n2, denominator: d };
        const res = subtractFractions(f1, f2);

        prob = {
          op: "SUB",
          f1,
          f2,
          result: res,
          explanation: generateStepByStepExplanation("SUB", f1, f2)
        };
        break;
      }

      // Level 4: 대분수 동분모 덧셈
      case FractionOperationLevel.MIXED_SAME_DENOM_ADD: {
        const d = randInt(prng, 3, 8);
        const w1 = randInt(prng, 1, 3);
        const w2 = randInt(prng, 1, 3);
        const n1 = randInt(prng, 1, d - 1);
        const n2 = randInt(prng, 1, d - 1);

        const f1 = { wholeNumber: w1, numerator: n1, denominator: d };
        const f2 = { wholeNumber: w2, numerator: n2, denominator: d };
        const res = addFractions(f1, f2);

        prob = {
          op: "ADD",
          f1,
          f2,
          result: res,
          explanation: generateStepByStepExplanation("ADD", f1, f2)
        };
        break;
      }

      // Level 5: 대분수 동분모 뺄셈
      case FractionOperationLevel.MIXED_SAME_DENOM_SUB: {
        const d = randInt(prng, 3, 8);
        const w1 = randInt(prng, 2, 4);
        const w2 = randInt(prng, 1, w1 - 1);
        const n1 = randInt(prng, 1, d - 1);
        const n2 = randInt(prng, 1, d - 1);

        const f1 = { wholeNumber: w1, numerator: n1, denominator: d };
        const f2 = { wholeNumber: w2, numerator: n2, denominator: d };
        if (w1 * d + n1 < w2 * d + n2) continue;

        const res = subtractFractions(f1, f2);

        prob = {
          op: "SUB",
          f1,
          f2,
          result: res,
          explanation: generateStepByStepExplanation("SUB", f1, f2)
        };
        break;
      }

      // Level 6: 이분모 분수의 통분
      case FractionOperationLevel.COMMON_DENOMINATOR: {
        const d1 = randInt(prng, 2, 6);
        let d2 = randInt(prng, 2, 6);
        if (d1 === d2) {
          d2 = d1 === 6 ? 5 : d1 + 1;
        }
        const n1 = randInt(prng, 1, d1 - 1);
        const n2 = randInt(prng, 1, d2 - 1);

        const f1 = { wholeNumber: 0, numerator: n1, denominator: d1 };
        const f2 = { wholeNumber: 0, numerator: n2, denominator: d2 };
        const common = findCommonDenominator(f1, f2);

        prob = {
          op: "COMMON_DENOM",
          f1,
          f2,
          result: common,
          explanation: generateStepByStepExplanation("COMMON_DENOM", f1, f2)
        };
        break;
      }

      // Level 7: 이분모 진분수 덧셈
      case FractionOperationLevel.UNLIKE_DENOM_PROPER_ADD: {
        const d1 = randInt(prng, 2, 8);
        let d2 = randInt(prng, 2, 8);
        if (d1 === d2) {
          d2 = d1 === 8 ? 7 : d1 + 1;
        }
        const n1 = randInt(prng, 1, d1 - 1);
        const n2 = randInt(prng, 1, d2 - 1);

        const f1 = { wholeNumber: 0, numerator: n1, denominator: d1 };
        const f2 = { wholeNumber: 0, numerator: n2, denominator: d2 };
        const res = addFractions(f1, f2);

        prob = {
          op: "ADD",
          f1,
          f2,
          result: res,
          explanation: generateStepByStepExplanation("ADD", f1, f2)
        };
        break;
      }

      // Level 8: 이분모 진분수 뺄셈
      case FractionOperationLevel.UNLIKE_DENOM_PROPER_SUB: {
        let d1 = randInt(prng, 2, 8);
        let d2 = randInt(prng, 2, 8);
        if (d1 === d2) {
          d2 = d1 === 8 ? 7 : d1 + 1;
        }
        let n1 = randInt(prng, 1, d1 - 1);
        let n2 = randInt(prng, 1, d2 - 1);

        // n1/d1 > n2/d2 보장
        if (n1 * d2 < n2 * d1) {
          const tN = n1; n1 = n2; n2 = tN;
          const tD = d1; d1 = d2; d2 = tD;
        }

        const f1 = { wholeNumber: 0, numerator: n1, denominator: d1 };
        const f2 = { wholeNumber: 0, numerator: n2, denominator: d2 };
        const res = subtractFractions(f1, f2);

        prob = {
          op: "SUB",
          f1,
          f2,
          result: res,
          explanation: generateStepByStepExplanation("SUB", f1, f2)
        };
        break;
      }

      // Level 9: 이분모 대분수 연산
      case FractionOperationLevel.MIXED_UNLIKE_DENOM:
      default: {
        const isAdd = randInt(prng, 0, 1) === 1;
        const d1 = randInt(prng, 2, 6);
        let d2 = randInt(prng, 2, 6);
        if (d1 === d2) d2 = d1 === 6 ? 5 : d1 + 1;

        const w1 = randInt(prng, 1, 3);
        const w2 = randInt(prng, 1, 2);
        const n1 = randInt(prng, 1, d1 - 1);
        const n2 = randInt(prng, 1, d2 - 1);

        const f1 = { wholeNumber: w1, numerator: n1, denominator: d1 };
        const f2 = { wholeNumber: w2, numerator: n2, denominator: d2 };

        if (isAdd) {
          const res = addFractions(f1, f2);
          prob = {
            op: "ADD",
            f1,
            f2,
            result: res,
            explanation: generateStepByStepExplanation("ADD", f1, f2)
          };
        } else {
          const cmp = compareFractions(f1, f2);
          if (cmp === 0) continue;
          const bigger = cmp > 0 ? f1 : f2;
          const smaller = cmp > 0 ? f2 : f1;
          const res = subtractFractions(bigger, smaller);
          prob = {
            op: "SUB",
            f1: bigger,
            f2: smaller,
            result: res,
            explanation: generateStepByStepExplanation("SUB", bigger, smaller)
          };
        }
        break;
      }
    }

    if (!prob) continue;

    const sig = getProblemSignature(prob.op, prob.f1, prob.f2);
    if (!signatures.has(sig)) {
      signatures.add(sig);
      problems.push(prob);
    }
  }

  return problems;
}

/**
 * 연산 문제로부터 표준 LearningActivity 객체 생성
 * @param {Object} problem
 * @param {number} index
 * @param {string} [responseType="TEXT"]
 * @returns {Object} LearningActivity
 */
export function createFractionOperationActivity(problem, index, responseType = "TEXT") {
  const id = `frac_op_${index + 1}`;
  const opSymbol = problem.op === "ADD" ? "+" : (problem.op === "SUB" ? "-" : "과");
  const prompt = problem.op === "COMMON_DENOM"
    ? `다음 두 분수를 통분하세요: ${formatFractionText(problem.f1)} ${opSymbol} ${formatFractionText(problem.f2)}`
    : `다음 계산을 하세요: ${formatFractionText(problem.f1)} ${opSymbol} ${formatFractionText(problem.f2)}`;

  const expectedAnswer = problem.op === "COMMON_DENOM"
    ? `${formatFractionText(problem.result.converted1)}, ${formatFractionText(problem.result.converted2)}`
    : formatFractionText(problem.result);

  return {
    id,
    activityType: responseType === "CHOICE" ? "MULTIPLE_CHOICE" : "SHORT_ANSWER",
    responseType,
    gradingMode: "GUARDIAN_MANUAL",
    prompt,
    expectedAnswer,
    explanation: problem.explanation?.summary || "",
    metadata: {
      fractionOperation: {
        type: problem.op === "ADD" ? "FRACTION_OPERATION_ADD" : (problem.op === "SUB" ? "FRACTION_OPERATION_SUB" : "FRACTION_COMMON_DENOMINATOR"),
        f1: problem.f1,
        f2: problem.f2,
        result: problem.result
      }
    }
  };
}
