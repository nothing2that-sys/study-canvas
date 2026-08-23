export const REFERENCE_CURRICULUM = {
  mul: [
    { level: 1, code: "M1", name: "구구단 기초", example: "7 × 8", aDigits: 1, bDigits: 1, desc: "기초 한자리 구구단 연산", score: 1 },
    { level: 2, code: "M2", name: "2자리 입문", example: "27 × 4", aDigits: 2, bDigits: 1, desc: "두자리 × 한자리 세로셈과 올림수 1회", score: 2 },
    { level: 3, code: "M3", name: "3자리 기본", example: "348 × 6", aDigits: 3, bDigits: 1, desc: "세자리 × 한자리 연속 올림수 세로셈", score: 3 },
    { level: 4, code: "M5", name: "2자리 표준", example: "48 × 37", aDigits: 2, bDigits: 2, desc: "두자리 × 두자리 2줄 부분곱 합산", score: 4 },
    { level: 5, code: "M6", name: "3자리 심화", example: "264 × 58", aDigits: 3, bDigits: 2, desc: "세자리 × 두자리 큰 수 부분곱 세로셈", score: 5 },
    { level: 6, code: "M9", name: "복합 마스터", example: "742 × 369", aDigits: 3, bDigits: 3, desc: "세자리 × 세자리 3줄 부분곱 완전 정복", score: 6 }
  ],
  div: [
    { level: 1, code: "D1", name: "나눗셈 기초", example: "8 ÷ 2", dividendDigits: 1, divisorDigits: 1, desc: "구구단 역연산과 1자리 나눗셈 기초", score: 1 },
    { level: 2, code: "D2", name: "2자리 입문", example: "72 ÷ 4", dividendDigits: 2, divisorDigits: 1, desc: "두자리 ÷ 한자리 내림과 세로셈 기호", score: 2 },
    { level: 3, code: "D3", name: "3자리 기본", example: "348 ÷ 6", dividendDigits: 3, divisorDigits: 1, desc: "세자리 ÷ 한자리 단계별 뺄셈과 몫 구하기", score: 3 },
    { level: 4, code: "D4", name: "2자리 제수 입문", example: "92 ÷ 23", dividendDigits: 2, divisorDigits: 2, desc: "두자리 ÷ 두자리 어림셈과 1자리 몫 찾기", score: 4 },
    { level: 5, code: "D5", name: "2자리 제수 표준", example: "864 ÷ 24", dividendDigits: 3, divisorDigits: 2, desc: "세자리 ÷ 두자리 표준 세로셈 연산", score: 5 },
    { level: 6, code: "D6", name: "고난도 마스터", example: "936 ÷ 104", dividendDigits: 3, divisorDigits: 3, desc: "3자리 제수 및 큰 수의 나눗셈 완전 정복", score: 6 }
  ]
};

export function mapToRefLevel(operation, aDigits, bDigits) {
  const op = operation === "div" ? "div" : "mul";
  const list = REFERENCE_CURRICULUM[op];
  const a = Math.max(1, Number(aDigits) || 1);
  const b = Math.max(1, Number(bDigits) || 1);

  if (op === "mul") {
    const directMatch = list.find((item) => item.aDigits === a && item.bDigits === b);
    if (directMatch) return { ...directMatch, isExact: true, totalLevels: 6 };

    let score = 1;
    if (a === 1 && b === 1) score = 1;
    else if ((a === 2 && b === 1) || (a === 1 && b === 2)) score = 2;
    else if ((a === 3 && b === 1) || (a === 1 && b === 3)) score = 3;
    else if (a === 2 && b === 2) score = 4;
    else if ((a === 3 && b === 2) || (a === 2 && b === 3)) score = 5;
    else if (a >= 3 && b >= 3) score = 6;
    else score = Math.min(6, Math.max(1, Math.round((a + b) / 1.1)));

    const nearest = list.find((item) => item.level === score) || list[list.length - 1];
    return {
      level: score,
      code: `M${a}x${b}`,
      name: `${a}자리 × ${b}자리 커스텀`,
      example: `${"9".repeat(a)} × ${"9".repeat(b)}`,
      desc: `전체 로드맵 중 Lv.${score} (${nearest.name}) 수준에 해당`,
      score,
      isExact: false,
      totalLevels: 6
    };
  } else {
    const directMatch = list.find((item) => item.dividendDigits === a && item.divisorDigits === b);
    if (directMatch) return { ...directMatch, isExact: true, totalLevels: 6 };

    let score = 1;
    if (a <= 1 && b <= 1) score = 1;
    else if (a === 2 && b === 1) score = 2;
    else if (a === 3 && b === 1) score = 3;
    else if (a === 2 && b === 2) score = 4;
    else if (a === 3 && b === 2) score = 5;
    else if (a >= 3 && b >= 3) score = 6;
    else score = Math.min(6, Math.max(1, Math.round((a + b) / 1.1)));

    const nearest = list.find((item) => item.level === score) || list[list.length - 1];
    return {
      level: score,
      code: `D${a}÷${b}`,
      name: `${a}자리 ÷ ${b}자리 커스텀`,
      example: `${"9".repeat(a)} ÷ ${"9".repeat(b)}`,
      desc: `전체 로드맵 중 Lv.${score} (${nearest.name}) 수준에 해당`,
      score,
      isExact: false,
      totalLevels: 6
    };
  }
}

const LEVELS = {
  mul: {
    "1x1": "M1", "2x1": "M2", "3x1": "M3",
    "1x2": "M4", "2x2": "M5", "3x2": "M6",
    "1x3": "M7", "2x3": "M8", "3x3": "M9"
  },
  div: {
    "1x1": "D1", "2x1": "D2", "3x1": "D3",
    "2x2": "D4", "3x2": "D5", "3x3": "D6"
  }
};

const MULTIPLICATION_PROFILES = {
  easy: [[2, 1], [3, 1]],
  normal: [[2, 2], [3, 2]],
  hard: [[3, 3]]
};

const DIVISION_PROFILES = {
  easy: { dividendDigits: [2, 3], divisorDigits: [1], quotientDigits: [1, 2] },
  normal: { dividendDigits: [3], divisorDigits: [2], quotientDigits: [1, 2] },
  hard: { dividendDigits: [3], divisorDigits: [2, 3], quotientDigits: [1, 2] }
};

export function randomInt(min, max, random = Math.random) {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new RangeError("올바른 정수 범위가 필요합니다.");
  }
  return Math.floor(random() * (max - min + 1)) + min;
}

export function fisherYates(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index, random);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function digitCount(value) {
  return Math.abs(Math.trunc(value)).toString().length;
}

export function digitBounds(digits, allowZeroOne = false) {
  if (!Number.isInteger(digits) || digits < 1 || digits > 6) {
    throw new RangeError("자릿수는 1에서 6 사이여야 합니다.");
  }
  if (digits === 1) return { min: allowZeroOne ? 0 : 2, max: 9 };
  return { min: 10 ** (digits - 1), max: (10 ** digits) - 1 };
}

export function questionKey(operation, operandA, operandB) {
  return `${operation}:${operandA}:${operandB}`;
}

function choose(items, random) {
  return items[randomInt(0, items.length - 1, random)];
}

function countCarries(operandA, operandB) {
  const topDigits = String(operandA).split("").reverse().map(Number);
  const bottomDigits = String(operandB).split("").reverse().map(Number);
  let carries = 0;
  for (const bottom of bottomDigits) {
    let carry = 0;
    for (const top of topDigits) {
      const value = (top * bottom) + carry;
      if (value >= 10) carries += 1;
      carry = Math.floor(value / 10);
    }
  }
  return carries;
}

function arrangeForVariety(items, fixedOperandB, random) {
  const pool = fisherYates(items, random);
  const ordered = [];
  while (pool.length > 0) {
    const recent = ordered.slice(-5);
    let candidateIndex = pool.findIndex((candidate) => {
      const sameA = recent.filter((item) => item.operandA === candidate.operandA).length;
      const sameB = recent.filter((item) => item.operandB === candidate.operandB).length;
      return sameA < 2 && (fixedOperandB || sameB < 2);
    });
    if (candidateIndex < 0) candidateIndex = 0;
    ordered.push(pool.splice(candidateIndex, 1)[0]);
  }
  return ordered;
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random()}`;
}

function multiplicationQuestion(operandA, operandB) {
  const aDigits = digitCount(operandA);
  const bDigits = digitCount(operandB);
  const carries = countCarries(operandA, operandB);
  return {
    id: makeId(),
    key: questionKey("mul", operandA, operandB),
    operation: "mul",
    operandA,
    operandB,
    answer: operandA * operandB,
    level: LEVELS.mul[`${aDigits}x${bDigits}`] ?? `M${aDigits}-${bDigits}`,
    difficultyScore: (aDigits * 10) + (bDigits * 12) + (carries * 2),
    features: {
      operandADigits: aDigits,
      operandBDigits: bDigits,
      carries,
      partialProductCount: bDigits,
      hasZero: String(operandA).includes("0") || String(operandB).includes("0")
    }
  };
}

function multiplicationCombos(config) {
  if (typeof config.difficulty === "string" && config.difficulty.startsWith("ref_")) {
    const lvl = Number(config.difficulty.replace("ref_", "")) || 1;
    const refItem = REFERENCE_CURRICULUM.mul[lvl - 1] || REFERENCE_CURRICULUM.mul[0];
    return [[refItem.aDigits, refItem.bDigits]];
  }
  if (config.difficulty === "custom" || (config.aDigits && config.bDigits)) {
    const a = Number(config.aDigits) || 2;
    const b = Number(config.bDigits) || 1;
    return [[a, b]];
  }
  return MULTIPLICATION_PROFILES[config.difficulty] ?? MULTIPLICATION_PROFILES.easy;
}

function createMultiplier(config, bDigits, random) {
  const mode = config.multiplierMode ?? "random";
  if (mode === "fixed") {
    const fixed = Number(config.fixedMultiplier);
    if (!Number.isInteger(fixed) || fixed < 2) throw new RangeError("고정 숫자는 2 이상이어야 합니다.");
    return fixed;
  }
  const bounds = digitBounds(bDigits, config.allowZeroOne);
  if (mode === "multiple") {
    const base = Number(config.multipleBase);
    if (!Number.isInteger(base) || base < 2) throw new RangeError("배수 기준은 2 이상이어야 합니다.");
    const first = Math.ceil(bounds.min / base) * base;
    if (first > bounds.max) throw new RangeError("선택한 자릿수에 해당 배수가 없습니다.");
    const lastIndex = Math.floor((bounds.max - first) / base);
    return first + (randomInt(0, lastIndex, random) * base);
  }
  return randomInt(bounds.min, bounds.max, random);
}

//+_+// 후보 문제 수 사전 계산 함수
export function calculateCandidateCapacity(operation, options = {}) {
  const op = operation === "div" ? "div" : "mul";
  if (op === "mul") {
    const mode = options.multiplierMode ?? "random";
    const combos = multiplicationCombos(options);
    let totalCap = 0;
    for (const [aDigits, bDigits] of combos) {
      const aBounds = digitBounds(aDigits, options.allowZeroOne);
      const aCount = aBounds.max - aBounds.min + 1;
      let bCount;
      if (mode === "fixed") {
        bCount = 1;
      } else if (mode === "multiple") {
        const base = Number(options.multipleBase) || 2;
        const bBounds = digitBounds(bDigits, options.allowZeroOne);
        const first = Math.ceil(bBounds.min / base) * base;
        const last = Math.floor(bBounds.max / base) * base;
        bCount = first <= last ? Math.floor((last - first) / base) + 1 : 0;
      } else {
        const bBounds = digitBounds(bDigits, options.allowZeroOne);
        bCount = bBounds.max - bBounds.min + 1;
      }
      totalCap += aCount * bCount;
    }
    return totalCap;
  } else {
    // 나눗셈 후보 수 계산
    const profile = divisionProfile(options);
    let count = 0;
    const maxDividendLimit = options.maxDividend || (10 ** Math.max(...profile.dividendDigits) - 1);
    for (const dvrDigits of profile.divisorDigits) {
      const dvrBounds = digitBounds(dvrDigits, false);
      for (const qDigits of profile.quotientDigits) {
        const qBounds = digitBounds(qDigits, false);
        const minQ = Math.max(2, qBounds.min);
        for (let dvr = dvrBounds.min; dvr <= dvrBounds.max; dvr++) {
          for (let q = minQ; q <= qBounds.max; q++) {
            const dvd = dvr * q;
            if (dvd > maxDividendLimit) continue;
            const dvdDigits = digitCount(dvd);
            if (profile.dividendDigits.includes(dvdDigits) && dvd !== dvr && q !== 1) {
              count++;
            }
          }
        }
      }
    }
    return count;
  }
}

export function generateMultiplicationSet(options = {}) {
  const config = { count: 20, difficulty: "easy", multiplierMode: "random", ...options };
  const count = Number(config.count);
  if (!Number.isInteger(count) || count < 1 || count > 500) throw new RangeError("문제 수는 1에서 500 사이여야 합니다.");
  const random = config.random ?? Math.random;
  const combos = multiplicationCombos(config);
  const candidateCapacity = calculateCandidateCapacity("mul", config);
  const unique = new Map();
  const targetCandidates = Math.min(candidateCapacity, Math.max(count, Math.min(count * 2, 50)));
  const attemptLimit = Math.max(targetCandidates * 100, 3000);
  let attempts = 0;

  while (unique.size < targetCandidates && attempts < attemptLimit) {
    attempts += 1;
    const [aDigits, bDigits] = choose(combos, random);
    const aBounds = digitBounds(aDigits, config.allowZeroOne);
    const operandA = randomInt(aBounds.min, aBounds.max, random);
    const operandB = createMultiplier(config, bDigits, random);
    const question = multiplicationQuestion(operandA, operandB);
    unique.set(question.key, question);
  }

  let result;
  let repetitionPolicy = "none";
  let uniqueCount = unique.size;
  let repeatedCount = 0;

  if (unique.size < count) {
    if (config.strictUnique) {
      throw new Error(`조건에 맞는 고유 문제는 ${unique.size}개뿐입니다. 문제 수나 조건을 조정해 주세요.`);
    }
    repetitionPolicy = "spaced";
    const baseItems = [...unique.values()];
    const repeated = [];
    while (repeated.length < count) {
      repeated.push(...fisherYates(baseItems, random).map((q) => ({ ...q, id: makeId() })));
    }
    result = repeated.slice(0, count);
    repeatedCount = count - uniqueCount;
  } else {
    result = arrangeForVariety([...unique.values()], config.multiplierMode === "fixed", random).slice(0, count);
    uniqueCount = count;
  }

  const meta = {
    requestedCount: count,
    generatedCount: result.length,
    uniqueCount,
    repeatedCount,
    candidateCapacity,
    repetitionPolicy
  };

  result.meta = meta;
  return result;
}

function divisionQuestion(dividend, divisor, quotient) {
  const dividendDigits = digitCount(dividend);
  const divisorDigits = digitCount(divisor);
  const quotientDigits = digitCount(quotient);
  return {
    id: makeId(),
    key: questionKey("div", dividend, divisor),
    operation: "div",
    operandA: dividend,
    operandB: divisor,
    answer: quotient,
    level: LEVELS.div[`${dividendDigits}x${divisorDigits}`] ?? `D${dividendDigits}-${divisorDigits}`,
    difficultyScore: (dividendDigits * 10) + (divisorDigits * 14) + (quotientDigits * 8),
    features: {
      dividendDigits,
      divisorDigits,
      quotientDigits,
      divisionStepCount: quotientDigits,
      trailingZero: dividend % 10 === 0 || divisor % 10 === 0
    }
  };
}

function divisionProfile(config) {
  if (typeof config.difficulty === "string" && config.difficulty.startsWith("ref_")) {
    const lvl = Number(config.difficulty.replace("ref_", "")) || 1;
    const refItem = REFERENCE_CURRICULUM.div[lvl - 1] || REFERENCE_CURRICULUM.div[0];
    const divDigits = refItem.dividendDigits;
    const dvrDigits = refItem.divisorDigits;
    const maxQDigits = Math.max(1, divDigits - dvrDigits + 1);
    const qDigits = Array.from({ length: maxQDigits }, (_, i) => i + 1);
    return {
      dividendDigits: [divDigits],
      divisorDigits: [dvrDigits],
      quotientDigits: qDigits
    };
  }
  if (config.difficulty === "custom" || (config.dividendDigits && config.divisorDigits)) {
    const divDigits = Number(config.dividendDigits) || 3;
    const dvrDigits = Number(config.divisorDigits) || 1;
    const maxQDigits = Math.max(1, divDigits - dvrDigits + 1);
    const qDigits = config.quotientDigits ? [Number(config.quotientDigits)] : Array.from({ length: maxQDigits }, (_, i) => i + 1);
    return {
      dividendDigits: [divDigits],
      divisorDigits: [dvrDigits],
      quotientDigits: qDigits
    };
  }
  return DIVISION_PROFILES[config.difficulty] ?? DIVISION_PROFILES.easy;
}

export function generateDivisionSet(options = {}) {
  const config = { count: 20, difficulty: "easy", ...options };
  const count = Number(config.count);
  if (!Number.isInteger(count) || count < 1 || count > 500) throw new RangeError("문제 수는 1에서 500 사이여야 합니다.");
  const random = config.random ?? Math.random;
  const profile = divisionProfile(config);
  const candidateCapacity = calculateCandidateCapacity("div", config);
  const maxDividendLimit = config.maxDividend || (10 ** Math.max(...profile.dividendDigits) - 1);
  const maxTrailingZero = Math.floor(count * 0.2);
  const unique = new Map();
  let trailingZeroCount = 0;
  let attempts = 0;
  const targetCandidates = Math.min(candidateCapacity, count);
  const attemptLimit = Math.max(targetCandidates * 500, 5000);

  while (unique.size < targetCandidates && attempts < attemptLimit) {
    attempts += 1;
    const divisorDigits = choose(profile.divisorDigits, random);
    const quotientDigits = choose(profile.quotientDigits, random);
    const divisorBounds = digitBounds(divisorDigits, false);
    const quotientBounds = digitBounds(quotientDigits, false);
    const divisor = randomInt(divisorBounds.min, divisorBounds.max, random);
    const quotient = randomInt(Math.max(2, quotientBounds.min), quotientBounds.max, random);
    const dividend = divisor * quotient;
    const desiredDividendDigits = choose(profile.dividendDigits, random);
    if (dividend > maxDividendLimit || digitCount(dividend) !== desiredDividendDigits) continue;
    if (dividend === divisor || quotient === 1) continue;
    const question = divisionQuestion(dividend, divisor, quotient);
    if (unique.has(question.key)) continue;
    if (question.features.trailingZero && trailingZeroCount >= maxTrailingZero) continue;
    if (question.features.trailingZero) trailingZeroCount += 1;
    unique.set(question.key, question);
  }

  let result;
  let repetitionPolicy = "none";
  let uniqueCount = unique.size;
  let repeatedCount = 0;

  if (unique.size < count) {
    // D1 또는 후보 부족 시 spaced repetition 허용 (strictUnique 옵션이 아닌 경우)
    if (config.strictUnique) {
      throw new Error(`조건에 맞는 고유 문제는 ${unique.size}개뿐입니다. 문제 수나 조건을 조정해 주세요.`);
    }
    if (unique.size === 0) {
      throw new Error("주어진 조건에 맞는 문제를 생성할 수 없습니다.");
    }
    repetitionPolicy = "spaced";
    const baseItems = [...unique.values()];
    const repeated = [];
    while (repeated.length < count) {
      repeated.push(...fisherYates(baseItems, random).map((q) => ({ ...q, id: makeId() })));
    }
    result = repeated.slice(0, count);
    repeatedCount = count - uniqueCount;
  } else {
    result = arrangeForVariety([...unique.values()], false, random).slice(0, count);
    uniqueCount = count;
  }

  const meta = {
    requestedCount: count,
    generatedCount: result.length,
    uniqueCount,
    repeatedCount,
    candidateCapacity,
    repetitionPolicy
  };

  result.meta = meta;
  return result;
}

export function generateQuestionSet(options = {}) {
  if (options.operation === "div") return generateDivisionSet(options);
  return generateMultiplicationSet(options);
}

export const difficultyProfiles = Object.freeze({ multiplication: MULTIPLICATION_PROFILES, division: DIVISION_PROFILES });
