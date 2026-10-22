//+_+// Phase F15A: 분수 데이터 모델 및 정수 연산 기반 무결성 검증 SSOT
//+_+// - 부동소수점(float) 저장 및 비교 절대 금지
//+_+// - 정수 분자(numerator), 분모(denominator), 자연수(wholeNumber) 논리 모델
//+_+// - 정수 교차 곱(cross multiplication)을 통한 엄밀한 동치 비교
//+_+// - fail-closed 입력 및 메타데이터 정규화

export const FractionType = Object.freeze({
  PROPER: "PROPER",         // 진분수 (0 < numerator < denominator)
  IMPROPER: "IMPROPER",     // 가분수 (numerator >= denominator)
  MIXED: "MIXED",           // 대분수 (wholeNumber > 0 && 0 < numerator < denominator)
  UNIT: "UNIT"              // 단위분수 (numerator === 1 && denominator > 1)
});

export const VisualRepresentationType = Object.freeze({
  PART_WHOLE_BAR: "PART_WHOLE_BAR",
  PART_WHOLE_GRID: "PART_WHOLE_GRID",
  NUMBER_LINE: "NUMBER_LINE",
  SYMBOLIC_FRACTION: "SYMBOLIC_FRACTION",
  EQUIVALENT_PAIR: "EQUIVALENT_PAIR"
});

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
 * 분수 객체 유효성 검증
 * @param {Object} fraction - { numerator, denominator, wholeNumber, whole }
 * @param {Object} [options] - { minDenominator: 1, throwOnError: false }
 * @returns {boolean}
 */
export function validateFraction(fraction, options = {}) {
  const throwErr = options.throwOnError !== undefined ? options.throwOnError : false;

  const fail = (msg) => {
    if (throwErr) throw new Error(msg);
    return false;
  };

  if (!fraction || typeof fraction !== "object") {
    return fail("분수 객체가 올바르지 않습니다.");
  }

  const wholeNumber = fraction.wholeNumber !== undefined ? fraction.wholeNumber : (fraction.whole !== undefined ? fraction.whole : 0);
  const { numerator, denominator } = fraction;

  if (typeof numerator !== "number" || typeof denominator !== "number" || typeof wholeNumber !== "number") {
    return fail("분수 성분은 숫자여야 합니다.");
  }

  if (Number.isNaN(numerator) || Number.isNaN(denominator) || Number.isNaN(wholeNumber)) {
    return fail("분수 성분에 NaN이 포함될 수 없습니다.");
  }

  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || !Number.isFinite(wholeNumber)) {
    return fail("분수 성분에 무한대(Infinity)가 포함될 수 없습니다.");
  }

  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || !Number.isInteger(wholeNumber)) {
    return fail("분수 성분은 정수여야 하며 소수(float)는 허용되지 않습니다.");
  }

  if (numerator < 0 || denominator < 0 || wholeNumber < 0) {
    return fail("음수 분수는 초등 교육과정에서 허용되지 않습니다.");
  }

  if (denominator === 0) {
    return fail("분모는 0일 수 없습니다.");
  }

  //+_+// Phase F15A Rework 1: 기본 분모 계약은 2 이상 (denominator >= 2).
  //+_+// 내부 rational 연산 등 명시적 옵션(allowWholeAsFraction: true 또는 minDenominator: 1) 지정 시에만 1 허용
  const minDenom = options.allowWholeAsFraction ? 1 : (options.minDenominator !== undefined ? options.minDenominator : 2);
  if (denominator < minDenom) {
    return fail(`분모는 최소 ${minDenom} 이상이어야 합니다.`);
  }

  return true;
}

/**
 * 분수 객체 정규화
 * @param {string|Object} input - '3/4', '1 1/2' 또는 { numerator, denominator, wholeNumber }
 * @param {Object} [options]
 * @returns {{ numerator: number, denominator: number, wholeNumber: number }}
 */
export function normalizeFraction(input, options = {}) {
  if (!input) {
    throw new TypeError("분수 입력값이 비어 있습니다.");
  }

  if (typeof input === "object") {
    const rawNum = Number(input.numerator);
    const rawDenom = Number(input.denominator);
    const rawWhole = input.wholeNumber !== undefined ? Number(input.wholeNumber) : (input.whole !== undefined ? Number(input.whole) : 0);

    const candidate = {
      numerator: rawNum,
      denominator: rawDenom,
      wholeNumber: rawWhole
    };

    // 검증 시 오류 발생 옵션 전달
    validateFraction(candidate, { ...options, throwOnError: true });

    return candidate;
  }

  if (typeof input === "string") {
    const trimmed = input.trim().replace(/\s+/g, " ");
    
    // 대분수 형태: "1 1/2" 또는 "1과 1/2"
    const mixedMatch = trimmed.match(/^(\d+)(?:\s+|과\s*)(\d+)\s*[/／]\s*(\d+)$/);
    if (mixedMatch) {
      const candidate = {
        wholeNumber: parseInt(mixedMatch[1], 10),
        numerator: parseInt(mixedMatch[2], 10),
        denominator: parseInt(mixedMatch[3], 10)
      };
      validateFraction(candidate, { ...options, throwOnError: true });
      return candidate;
    }

    // 진분수 / 가분수 형태: "3/4" 또는 "3／4"
    const simpleMatch = trimmed.match(/^(\d+)\s*[/／]\s*(\d+)$/);
    if (simpleMatch) {
      const candidate = {
        wholeNumber: 0,
        numerator: parseInt(simpleMatch[1], 10),
        denominator: parseInt(simpleMatch[2], 10)
      };
      validateFraction(candidate, { ...options, throwOnError: true });
      return candidate;
    }

    // 단일 정수 형태: "0" 또는 "1" 등
    const intMatch = trimmed.match(/^(\d+)$/);
    if (intMatch) {
      const whole = parseInt(intMatch[1], 10);
      return {
        wholeNumber: whole,
        numerator: 0,
        denominator: 2 // 최소 기본 분모
      };
    }

    throw new Error(`지원되지 않는 분수 문자열 형식입니다: "${input}"`);
  }

  throw new TypeError(`분수 입력 타입이 올바르지 않습니다: ${typeof input}`);
}

//+_+// Phase F15A Rework 1: 내부 유리수 연산용 헬퍼 (자연수 분모 1 허용 경로 명시적 분리)
export function normalizeRationalInternal(input) {
  return normalizeFraction(input, { allowWholeAsFraction: true, minDenominator: 1 });
}

/**
 * 분수의 가분수 총 분자(total improper numerator) 계산
 * @param {Object} fraction
 * @returns {number}
 */
export function toImproperNumerator(fraction) {
  const norm = normalizeFraction(fraction);
  return norm.wholeNumber * norm.denominator + norm.numerator;
}

/**
 * 분수 유형 분류 (PROPER, IMPROPER, MIXED, UNIT)
 * @param {Object} fraction
 * @returns {string}
 */
export function classifyFractionType(fraction) {
  const norm = normalizeFraction(fraction);
  if (norm.wholeNumber > 0) {
    return FractionType.MIXED;
  }
  if (norm.numerator === 1 && norm.denominator > 1) {
    return FractionType.UNIT;
  }
  if (norm.numerator < norm.denominator) {
    return FractionType.PROPER;
  }
  return FractionType.IMPROPER;
}

/**
 * 기약분수로 약분
 * @param {Object} fraction
 * @returns {{ wholeNumber: number, numerator: number, denominator: number }}
 */
export function simplifyFraction(fraction) {
  const norm = normalizeFraction(fraction);
  const divisor = gcd(norm.numerator, norm.denominator);
  return {
    wholeNumber: norm.wholeNumber,
    numerator: norm.numerator / divisor,
    denominator: norm.denominator / divisor
  };
}

/**
 * 가분수를 대분수 형식으로 변환
 * @param {Object} fraction
 * @returns {{ whole: number, wholeNumber: number, numerator: number, denominator: number }}
 */
export function toMixedFraction(fraction) {
  const norm = normalizeFraction(fraction);
  const totalNum = norm.wholeNumber * norm.denominator + norm.numerator;
  const whole = Math.floor(totalNum / norm.denominator);
  const remNum = totalNum % norm.denominator;
  return {
    whole,
    wholeNumber: whole,
    numerator: remNum,
    denominator: norm.denominator
  };
}

/**
 * 대분수를 가분수 형식으로 변환
 * @param {Object} fraction
 * @returns {{ wholeNumber: number, numerator: number, denominator: number }}
 */
export function fromMixedFraction(fraction) {
  const norm = normalizeFraction(fraction);
  const totalNum = norm.wholeNumber * norm.denominator + norm.numerator;
  return {
    wholeNumber: 0,
    numerator: totalNum,
    denominator: norm.denominator
  };
}

/**
 * 정수 교차 곱 기반 동치 판정 (부동소수점 배제)
 * a/b == c/d <=> a * d === b * c
 * @param {Object|string} f1
 * @param {Object|string} f2
 * @returns {boolean}
 */
export function areFractionsEquivalent(f1, f2) {
  const norm1 = normalizeFraction(f1);
  const norm2 = normalizeFraction(f2);

  const totalNum1 = norm1.wholeNumber * norm1.denominator + norm1.numerator;
  const totalNum2 = norm2.wholeNumber * norm2.denominator + norm2.numerator;

  return totalNum1 * norm2.denominator === totalNum2 * norm1.denominator;
}

/**
 * 정수 교차 곱 기반 크기 비교
 * @param {Object|string} f1
 * @param {Object|string} f2
 * @returns {-1|0|1}
 */
export function compareFractions(f1, f2) {
  const norm1 = normalizeFraction(f1);
  const norm2 = normalizeFraction(f2);

  const left = (norm1.wholeNumber * norm1.denominator + norm1.numerator) * norm2.denominator;
  const right = (norm2.wholeNumber * norm2.denominator + norm2.numerator) * norm1.denominator;

  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * 학생 텍스트 입력 정규화 (전각 슬래시, 공백 정규화)
 * @param {string} raw
 * @returns {string}
 */
export function normalizeStudentFractionAnswer(raw) {
  if (raw === null || raw === undefined) return "";
  return String(raw)
    .trim()
    .replace(/[／⁄]/g, "/")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ");
}

/**
 * 분수 문자열 또는 한국어 표기 생성
 * @param {Object|string} fraction
 * @param {Object} [options] - { format: 'slash' | 'korean' | 'spoken' }
 * @returns {string}
 */
export function formatFraction(fraction, options = {}) {
  const norm = normalizeFraction(fraction);
  const fmt = options.format || "slash";

  if (fmt === "korean" || fmt === "spoken") {
    if (norm.wholeNumber > 0 && norm.numerator > 0) {
      return `${norm.wholeNumber}와 ${norm.denominator}분의 ${norm.numerator}`;
    }
    if (norm.wholeNumber > 0 && norm.numerator === 0) {
      return `${norm.wholeNumber}`;
    }
    return `${norm.denominator}분의 ${norm.numerator}`;
  }

  if (norm.wholeNumber > 0 && norm.numerator > 0) {
    return `${norm.wholeNumber} ${norm.numerator}/${norm.denominator}`;
  }
  if (norm.wholeNumber > 0 && norm.numerator === 0) {
    return `${norm.wholeNumber}`;
  }
  return `${norm.numerator}/${norm.denominator}`;
}

/**
 * 분수 시각 표현용 접근성 레이블(aria-label) 생성
 * @param {Object} spec - 시각 표현 사양 { type, numerator, denominator, wholeNumber, totalParts, filledParts }
 * @returns {string}
 */
export function getFractionAccessibleDescription(spec) {
  if (!spec || typeof spec !== "object") return "분수 그림";

  const num = spec.numerator ?? spec.filledParts ?? 0;
  const denom = spec.denominator ?? spec.totalParts ?? 2;
  const whole = spec.wholeNumber ?? 0;

  switch (spec.type) {
    case "PART_WHOLE_BAR":
    case "PART_WHOLE_GRID":
      return `전체를 같은 크기의 ${denom}부분으로 나눈 것 중 ${num}부분 (${denom}분의 ${num})`;
    case "NUMBER_LINE":
      if (whole > 0) {
        return `수직선에서 ${whole}와 ${denom}분의 ${num}의 위치`;
      }
      return `0부터 1까지를 ${denom}등분한 수직선에서 ${denom}분의 ${num}의 위치`;
    case "EQUIVALENT_PAIR":
      return `크기가 같은 두 분수의 시각적 비교`;
    case "SYMBOLIC_FRACTION":
    default:
      if (whole > 0) {
        return `대분수 ${whole}와 ${denom}분의 ${num}`;
      }
      return `분수 ${denom}분의 ${num}`;
  }
}
