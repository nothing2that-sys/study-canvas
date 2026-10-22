//+_+// Phase F15C: 소수 문제 생성기 (Decimal Problem Generator) SSOT
//+_+// - 2022 개정 초등 교육과정 기반 9개 학습 레벨 체계
//+_+// - 시드(seed) 기반 결정론적 생성 (Math.random() 배제)
//+_+// - 동일 세션 내 중복 방지 (교환법칙 서명 반영)
//+_+// - 5 / 10 / 20 문제 수 계약 완벽 지원

import {
  parseDecimal,
  formatDecimal,
  normalizeDecimal,
  addDecimals,
  subtractDecimals,
  multiplyDecimals,
  divideDecimals,
  compareDecimals,
  getDigitAtPlace,
  getPlaceValue,
  DecimalPlace
} from "./decimalDomain.js";

export const DecimalLevel = Object.freeze({
  LEVEL_1_TENTHS: 1,            // 0.1 단위 소수 개념
  LEVEL_2_HUNDREDTHS: 2,        // 0.01 단위 소수 개념
  LEVEL_3_THOUSANDTHS: 3,       // 0.001 단위 소수 개념
  LEVEL_4_PLACE_VALUE: 4,       // 자릿값과 읽기/쓰기
  LEVEL_5_COMPARE: 5,           // 소수 크기 비교
  LEVEL_6_ADDITION: 6,          // 소수 덧셈
  LEVEL_7_SUBTRACTION: 7,       // 소수 뺄셈
  LEVEL_8_MULTIPLICATION: 8,    // 소수 곱셈
  LEVEL_9_DIVISION: 9           // 소수 나눗셈
});

/**
 * 결정론적 의사난수 생성기 (mulberry32)
 */
function createPrng(seed) {
  let s = (Math.abs(Number(seed) || 12345) ^ 0xdeadbeef) >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(prng, min, max) {
  return min + Math.floor(prng() * (max - min + 1));
}

function pickRandom(prng, arr) {
  return arr[Math.floor(prng() * arr.length)];
}

function shuffle(prng, arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 단일 문제 생성기 내부 팩토리
 */
function generateProblemByLevel(level, prng, index) {
  const probId = `dec_gen_L${level}_${index}_${Math.floor(prng() * 1000000)}`;

  switch (level) {
    // Level 1: 0.1 단위 개념
    case DecimalLevel.LEVEL_1_TENTHS: {
      const tenths = randInt(prng, 1, 9);
      const decStr = `0.${tenths}`;
      const isGrid = prng() < 0.5;

      const prompt = isGrid
        ? `10등분한 바에서 색칠된 부분을 소수로 나타내세요.`
        : `1을 10등분한 것 중 ${tenths}개는 소수로 얼마인가요?`;

      return {
        id: probId,
        subjectId: "math",
        courseId: "decimal",
        moduleId: "concepts",
        unitId: "tenths",
        skillId: "MATH_DECIMAL_TENTHS",
        skillTitle: "0.1 단위 소수",
        activityType: "SHORT_ANSWER",
        responseType: "TEXT",
        prompt,
        expectedAnswer: decStr,
        metadata: {
          problemSignature: `L1_tenths_${tenths}`,
          decimalRepresentation: isGrid ? {
            type: "DECIMAL_GRID",
            value: decStr,
            gridType: "bar"
          } : null
        }
      };
    }

    // Level 2: 0.01 단위 개념
    case DecimalLevel.LEVEL_2_HUNDREDTHS: {
      const hundredths = randInt(prng, 1, 99);
      const decStr = `0.${String(hundredths).padStart(2, "0")}`;

      return {
        id: probId,
        subjectId: "math",
        courseId: "decimal",
        moduleId: "concepts",
        unitId: "hundredths",
        skillId: "MATH_DECIMAL_HUNDREDTHS",
        skillTitle: "0.01 단위 소수",
        activityType: "SHORT_ANSWER",
        responseType: "TEXT",
        prompt: `1을 100등분한 모눈에서 ${hundredths}칸을 소수로 나타내세요.`,
        expectedAnswer: decStr,
        metadata: {
          problemSignature: `L2_hundredths_${hundredths}`,
          decimalRepresentation: {
            type: "DECIMAL_GRID",
            value: decStr,
            gridType: "10x10"
          }
        }
      };
    }

    // Level 3: 0.001 단위 개념
    case DecimalLevel.LEVEL_3_THOUSANDTHS: {
      const thousandths = randInt(prng, 1, 999);
      const decStr = `0.${String(thousandths).padStart(3, "0")}`;

      return {
        id: probId,
        subjectId: "math",
        courseId: "decimal",
        moduleId: "concepts",
        unitId: "thousandths",
        skillId: "MATH_DECIMAL_THOUSANDTHS",
        skillTitle: "0.001 단위 소수",
        activityType: "SHORT_ANSWER",
        responseType: "TEXT",
        prompt: `1을 1000등분한 것 중 ${thousandths}개를 소수로 바르게 쓰세요.`,
        expectedAnswer: decStr,
        metadata: {
          problemSignature: `L3_thousandths_${thousandths}`
        }
      };
    }

    // Level 4: 자릿값과 읽기/쓰기
    case DecimalLevel.LEVEL_4_PLACE_VALUE: {
      const whole = randInt(prng, 1, 15);
      const frac = randInt(prng, 10, 99);
      const decStr = `${whole}.${frac}`;
      const dec = parseDecimal(decStr);

      const places = [
        { place: DecimalPlace.TENTHS, label: "소수 첫째 자리" },
        { place: DecimalPlace.HUNDREDTHS, label: "소수 둘째 자리" }
      ];
      const target = pickRandom(prng, places);
      const digit = getDigitAtPlace(dec, target.place);
      const val = formatDecimal(getPlaceValue(dec, target.place));

      const askDigit = prng() < 0.5;
      const prompt = askDigit
        ? `${decStr}에서 ${target.label}의 숫자는 무엇인가요?`
        : `${decStr}에서 ${target.label}의 숫자 ${digit}이 나타내는 실제 값은 얼마인가요?`;
      const expectedAnswer = askDigit ? String(digit) : val;

      return {
        id: probId,
        subjectId: "math",
        courseId: "decimal",
        moduleId: "concepts",
        unitId: "place_value",
        skillId: "MATH_DECIMAL_PLACE_VALUE",
        skillTitle: "소수의 자릿값",
        activityType: "SHORT_ANSWER",
        responseType: "TEXT",
        prompt,
        expectedAnswer,
        metadata: {
          problemSignature: `L4_pv_${decStr}_${target.place}_${askDigit ? 'digit' : 'val'}`,
          decimalRepresentation: {
            type: "DECIMAL_PLACE_VALUE",
            value: decStr,
            highlightPlace: target.place
          }
        }
      };
    }

    // Level 5: 소수 크기 비교
    case DecimalLevel.LEVEL_5_COMPARE: {
      let v1 = (randInt(prng, 1, 99) / 100).toFixed(prng() < 0.5 ? 1 : 2);
      let v2 = (randInt(prng, 1, 99) / 100).toFixed(prng() < 0.5 ? 1 : 2);
      if (prng() < 0.2) {
        // 동치 소수 케이스 (0.5 vs 0.50)
        v1 = "0.5";
        v2 = "0.50";
      }
      const cmp = compareDecimals(parseDecimal(v1), parseDecimal(v2));
      const symbol = cmp > 0 ? ">" : (cmp < 0 ? "<" : "=");

      const choices = [
        { id: ">", label: ">" },
        { id: "<", label: "<" },
        { id: "=", label: "=" }
      ];

      return {
        id: probId,
        subjectId: "math",
        courseId: "decimal",
        moduleId: "compare",
        unitId: "compare",
        skillId: "MATH_DECIMAL_COMPARE",
        skillTitle: "소수 크기 비교",
        activityType: "MULTIPLE_CHOICE",
        responseType: "CHOICE",
        prompt: `두 소수의 크기를 비교하여 알맞은 부호를 고르세요: ${v1} [ ? ] ${v2}`,
        expectedAnswer: symbol,
        choices,
        metadata: {
          problemSignature: `L5_cmp_${v1}_${v2}`,
          decimalRepresentation: {
            type: "DECIMAL_COMPARE",
            value1: v1,
            value2: v2
          }
        }
      };
    }

    // Level 6: 소수 덧셈
    case DecimalLevel.LEVEL_6_ADDITION: {
      const u1 = randInt(prng, 5, 45);
      const u2 = randInt(prng, 5, 45);
      const s1 = prng() < 0.5 ? 1 : 2;
      const s2 = prng() < 0.5 ? 1 : 2;

      const d1 = parseDecimal((u1 / (10 ** s1)).toFixed(s1));
      const d2 = parseDecimal((u2 / (10 ** s2)).toFixed(s2));
      const sum = addDecimals(d1, d2);

      // 교환법칙 서명: 작은 값을 앞에 둔 순서로 서명 통일
      const v1Str = formatDecimal(d1);
      const v2Str = formatDecimal(d2);
      const sortedPair = [v1Str, v2Str].sort().join("+");

      return {
        id: probId,
        subjectId: "math",
        courseId: "decimal",
        moduleId: "operations",
        unitId: "addition",
        skillId: "MATH_DECIMAL_ADD",
        skillTitle: "소수 덧셈",
        activityType: "SHORT_ANSWER",
        responseType: "TEXT",
        prompt: `소수의 덧셈을 계산하세요: ${v1Str} + ${v2Str}`,
        expectedAnswer: formatDecimal(sum),
        metadata: {
          problemSignature: `L6_add_${sortedPair}`,
          decimalOperation: {
            type: "DECIMAL_OPERATION",
            operation: "+",
            value1: v1Str,
            value2: v2Str
          }
        }
      };
    }

    // Level 7: 소수 뺄셈
    case DecimalLevel.LEVEL_7_SUBTRACTION: {
      let u1 = randInt(prng, 20, 80);
      let u2 = randInt(prng, 10, 60);
      if (u1 <= u2) u1 = u2 + randInt(prng, 5, 20);

      const d1 = parseDecimal((u1 / 10).toFixed(1));
      const d2 = parseDecimal((u2 / 10).toFixed(1));
      const diff = subtractDecimals(d1, d2);

      const v1Str = formatDecimal(d1);
      const v2Str = formatDecimal(d2);

      return {
        id: probId,
        subjectId: "math",
        courseId: "decimal",
        moduleId: "operations",
        unitId: "subtraction",
        skillId: "MATH_DECIMAL_SUB",
        skillTitle: "소수 뺄셈",
        activityType: "SHORT_ANSWER",
        responseType: "TEXT",
        prompt: `소수의 뺄셈을 계산하세요: ${v1Str} - ${v2Str}`,
        expectedAnswer: formatDecimal(diff),
        metadata: {
          problemSignature: `L7_sub_${v1Str}_${v2Str}`,
          decimalOperation: {
            type: "DECIMAL_OPERATION",
            operation: "-",
            value1: v1Str,
            value2: v2Str
          }
        }
      };
    }

    // Level 8: 소수 곱셈
    case DecimalLevel.LEVEL_8_MULTIPLICATION: {
      const u1 = randInt(prng, 11, 45);
      const u2 = randInt(prng, 2, 9);
      const d1 = parseDecimal((u1 / 10).toFixed(1));
      const d2 = parseDecimal((u2 / 10).toFixed(1));
      const prod = multiplyDecimals(d1, d2);

      const v1Str = formatDecimal(d1);
      const v2Str = formatDecimal(d2);
      const sortedPair = [v1Str, v2Str].sort().join("*");

      return {
        id: probId,
        subjectId: "math",
        courseId: "decimal",
        moduleId: "operations",
        unitId: "multiplication",
        skillId: "MATH_DECIMAL_MUL",
        skillTitle: "소수 곱셈",
        activityType: "SHORT_ANSWER",
        responseType: "TEXT",
        prompt: `소수의 곱셈을 계산하세요: ${v1Str} × ${v2Str}`,
        expectedAnswer: formatDecimal(normalizeDecimal(prod)),
        metadata: {
          problemSignature: `L8_mul_${sortedPair}`,
          decimalOperation: {
            type: "DECIMAL_OPERATION",
            operation: "×",
            value1: v1Str,
            value2: v2Str
          }
        }
      };
    }

    // Level 9: 소수 나눗셈 (유한소수 결과 보장)
    case DecimalLevel.LEVEL_9_DIVISION: {
      const quotient = randInt(prng, 2, 8);
      const divisorInt = randInt(prng, 2, 6);
      const divisor = parseDecimal((divisorInt / 10).toFixed(1));
      const dividend = multiplyDecimals(divisor, { unscaledValue: quotient, scale: 0 });

      const v1Str = formatDecimal(dividend);
      const v2Str = formatDecimal(divisor);

      return {
        id: probId,
        subjectId: "math",
        courseId: "decimal",
        moduleId: "operations",
        unitId: "division",
        skillId: "MATH_DECIMAL_DIV",
        skillTitle: "소수 나눗셈",
        activityType: "SHORT_ANSWER",
        responseType: "TEXT",
        prompt: `소수의 나눗셈을 계산하세요: ${v1Str} ÷ ${v2Str}`,
        expectedAnswer: String(quotient),
        metadata: {
          problemSignature: `L9_div_${v1Str}_${v2Str}`,
          decimalOperation: {
            type: "DECIMAL_OPERATION",
            operation: "÷",
            value1: v1Str,
            value2: v2Str
          }
        }
      };
    }

    default:
      throw new Error(`지원되지 않는 소수 레벨입니다: ${level}`);
  }
}

/**
 * 결정론적 소수 문제 세트 생성 진입점
 * @param {Object} options - { level: number, count: number, seed?: number }
 * @returns {Array<Object>}
 */
export function generateDecimalProblemSet({ level = 1, count = 20, seed = 12345 } = {}) {
  const prng = createPrng(seed);
  const problems = [];
  const seenSignatures = new Set();
  let attempts = 0;
  const maxAttempts = count * 20;

  while (problems.length < count && attempts < maxAttempts) {
    attempts += 1;
    const prob = generateProblemByLevel(level, prng, attempts);
    const sig = prob.metadata?.problemSignature || prob.id;

    if (!seenSignatures.has(sig)) {
      seenSignatures.add(sig);
      problems.push(prob);
    }
  }

  return problems;
}
