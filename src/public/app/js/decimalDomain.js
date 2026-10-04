//+_+// Phase F15C: 소수 도메인 모델 및 정밀 10진수 연산 SSOT
//+_+// - 부동소수점(float) 연산 및 float 동치 비교 배제
//+_+// - 정수 스케일 모델: { unscaledValue: number, scale: number }
//+_+// - 유한소수 정밀 연산 및 나눗셈 유한성 검증 (순환소수/무한소수 차단)
//+_+// - Safe Integer 가드 (Number.isSafeInteger)

export const DecimalPlace = Object.freeze({
  THOUSANDS: "THOUSANDS",       // 천의 자리 (1000)
  HUNDREDS: "HUNDREDS",         // 백의 자리 (100)
  TENS: "TENS",                 // 십의 자리 (10)
  ONES: "ONES",                 // 일의 자리 (1)
  TENTHS: "TENTHS",             // 소수 첫째 자리 (0.1)
  HUNDREDTHS: "HUNDREDTHS",     // 소수 둘째 자리 (0.01)
  THOUSANDTHS: "THOUSANDTHS"    // 소수 셋째 자리 (0.001)
});

/**
 * 정수 안전성 검사
 * @param  {...number} nums
 */
export function assertSafeIntegers(...nums) {
  for (const n of nums) {
    if (typeof n !== "number" || !Number.isSafeInteger(n)) {
      throw new Error(`안전 정수 범위를 초과했습니다: ${n}`);
    }
  }
}

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
 * 10의 거듭제곱 계산 (안전 정수 검증 포함)
 * @param {number} exp
 * @returns {number}
 */
export function safePowerOf10(exp) {
  if (exp < 0) throw new Error("음수 지수는 지원하지 않습니다.");
  if (exp === 0) return 1;
  let res = 1;
  for (let i = 0; i < exp; i++) {
    res *= 10;
    if (!Number.isSafeInteger(res)) {
      throw new Error(`10의 거듭제곱 오버플로 (10^${exp})`);
    }
  }
  return res;
}

/**
 * 한국어 및 다양한 입력 환경의 숫자/소수점 정규화
 * @param {string} str
 * @returns {string}
 */
function normalizeInputString(str) {
  if (typeof str !== "string") return "";
  return str
    .trim()
    // 전각 소수점 정규화
    .replace(/[．。]/g, ".")
    // 전각 숫자 정규화 (０~９ -> 0~9)
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

/**
 * 소수 문자열 또는 객체 파싱 (Fail-Closed)
 * @param {string|number|Object} input
 * @param {Object} [options] - { throwOnError: false }
 * @returns {{ unscaledValue: number, scale: number } | null}
 */
export function parseDecimal(input, options = {}) {
  const throwErr = Boolean(options.throwOnError);

  const fail = (msg) => {
    if (throwErr) throw new Error(msg);
    return null;
  };

  if (input === null || input === undefined) {
    return fail("소수 입력이 비어 있습니다.");
  }

  // 이미 Decimal 객체인 경우
  if (typeof input === "object" && typeof input.unscaledValue === "number" && typeof input.scale === "number") {
    if (!Number.isSafeInteger(input.unscaledValue) || input.unscaledValue < 0 || !Number.isSafeInteger(input.scale) || input.scale < 0) {
      return fail("유효하지 않은 Decimal 객체입니다.");
    }
    return {
      unscaledValue: input.unscaledValue,
      scale: input.scale
    };
  }

  const rawStr = normalizeInputString(String(input));
  if (!rawStr) {
    return fail("유효한 숫자 문자열이 아닙니다.");
  }

  // 초등 수학 범위: 음수 배제, 양수 및 0만 허용
  if (rawStr.startsWith("-") || rawStr.startsWith("+")) {
    return fail("부호 기호는 지원하지 않습니다.");
  }

  // 소수점 유효성 검사 (정확히 0개 또는 1개의 소수점)
  if (!/^\d+(\.\d+)?$/.test(rawStr)) {
    return fail(`유효하지 않은 소수 포맷입니다: ${rawStr}`);
  }

  const parts = rawStr.split(".");
  const intPartStr = parts[0];
  const fracPartStr = parts[1] || "";

  const scale = fracPartStr.length;
  const digitsStr = intPartStr + fracPartStr;

  const unscaled = Number(digitsStr);
  if (!Number.isSafeInteger(unscaled)) {
    return fail(`안전 정수 범위를 초과하는 소수입니다: ${rawStr}`);
  }

  return {
    unscaledValue: unscaled,
    scale
  };
}

/**
 * 소수 문자열 포맷팅
 * @param {Object} dec - { unscaledValue, scale }
 * @param {Object} [options] - { preserveTrailingZeros: false }
 * @returns {string}
 */
export function formatDecimal(dec, options = {}) {
  if (!dec) return "";
  const preserveTrailing = Boolean(options.preserveTrailingZeros);

  let target = dec;
  if (!preserveTrailing) {
    target = normalizeDecimal(dec);
  }

  const { unscaledValue, scale } = target;
  if (scale === 0) {
    return String(unscaledValue);
  }

  const str = String(unscaledValue).padStart(scale + 1, "0");
  const intPart = str.slice(0, str.length - scale);
  const fracPart = str.slice(str.length - scale);

  return `${intPart}.${fracPart}`;
}

/**
 * 후행 0을 제거하여 가장 간결한 표준 형태로 정규화
 * (예: unscaled 50, scale 2 -> unscaled 5, scale 1)
 * @param {Object} dec
 * @returns {{ unscaledValue: number, scale: number }}
 */
export function normalizeDecimal(dec) {
  if (!dec) return { unscaledValue: 0, scale: 0 };
  let u = dec.unscaledValue;
  let s = dec.scale;

  if (u === 0) {
    return { unscaledValue: 0, scale: 0 };
  }

  while (s > 0 && u % 10 === 0) {
    u /= 10;
    s -= 1;
  }

  return { unscaledValue: u, scale: s };
}

/**
 * 두 소수의 수치적 동치 여부 검증 (0.5 === 0.50)
 * @param {Object|string} a
 * @param {Object|string} b
 * @returns {boolean}
 */
export function areEquivalentDecimals(a, b) {
  const d1 = parseDecimal(a);
  const d2 = parseDecimal(b);
  if (!d1 || !d2) return false;

  const n1 = normalizeDecimal(d1);
  const n2 = normalizeDecimal(d2);

  return n1.unscaledValue === n2.unscaledValue && n1.scale === n2.scale;
}

/**
 * 두 소수의 스케일(소수점 자릿수)을 동일하게 맞춤
 * @param {Object} d1
 * @param {Object} d2
 * @returns {{ u1: number, u2: number, scale: number }}
 */
export function alignDecimalScales(d1, d2) {
  const dec1 = parseDecimal(d1, { throwOnError: true });
  const dec2 = parseDecimal(d2, { throwOnError: true });

  const maxScale = Math.max(dec1.scale, dec2.scale);
  const factor1 = safePowerOf10(maxScale - dec1.scale);
  const factor2 = safePowerOf10(maxScale - dec2.scale);

  const u1 = dec1.unscaledValue * factor1;
  const u2 = dec2.unscaledValue * factor2;

  assertSafeIntegers(u1, u2);

  return { u1, u2, scale: maxScale };
}

/**
 * 두 소수의 크기 비교 (-1, 0, 1)
 * @param {Object|string} a
 * @param {Object|string} b
 * @returns {number} -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareDecimals(a, b) {
  const { u1, u2 } = alignDecimalScales(a, b);
  if (u1 < u2) return -1;
  if (u1 > u2) return 1;
  return 0;
}

/**
 * 소수 덧셈 (정수 연산 기반)
 * @param {Object|string} a
 * @param {Object|string} b
 * @returns {{ unscaledValue: number, scale: number }}
 */
export function addDecimals(a, b) {
  const { u1, u2, scale } = alignDecimalScales(a, b);
  const sum = u1 + u2;
  assertSafeIntegers(sum);
  return { unscaledValue: sum, scale };
}

/**
 * 소수 뺄셈 (정수 연산 기반, 초등 범위 음수 차단)
 * @param {Object|string} a
 * @param {Object|string} b
 * @returns {{ unscaledValue: number, scale: number }}
 */
export function subtractDecimals(a, b) {
  const { u1, u2, scale } = alignDecimalScales(a, b);
  if (u1 < u2) {
    throw new Error("작은 수에서 큰 수를 뺄 수 없습니다 (음수 결과 차단).");
  }
  const diff = u1 - u2;
  assertSafeIntegers(diff);
  return { unscaledValue: diff, scale };
}

/**
 * 소수 곱셈 (정수 연산 기반)
 * (u1 * u2, scale1 + scale2)
 * @param {Object|string} a
 * @param {Object|string} b
 * @returns {{ unscaledValue: number, scale: number }}
 */
export function multiplyDecimals(a, b) {
  const dec1 = parseDecimal(a, { throwOnError: true });
  const dec2 = parseDecimal(b, { throwOnError: true });

  const product = dec1.unscaledValue * dec2.unscaledValue;
  const totalScale = dec1.scale + dec2.scale;

  assertSafeIntegers(product, totalScale);

  return {
    unscaledValue: product,
    scale: totalScale
  };
}

/**
 * 소수 나눗셈 (정수 연산 기반, 초등 유한소수만 정확히 계산)
 * @param {Object|string} a
 * @param {Object|string} b
 * @param {Object} [options]
 * @returns {{ unscaledValue: number, scale: number }}
 */
export function divideDecimals(a, b, options = {}) {
  const dec1 = parseDecimal(a, { throwOnError: true });
  const dec2 = parseDecimal(b, { throwOnError: true });

  if (dec2.unscaledValue === 0) {
    throw new Error("0으로 나눌 수 없습니다 (Divide by zero).");
  }

  // 1. 소수점 제거를 위한 정수 배율 맞춤
  // a / b = (u1 / 10^s1) / (u2 / 10^s2) = (u1 * 10^s2) / (u2 * 10^s1)
  const maxScale = Math.max(dec1.scale, dec2.scale);
  const factor1 = safePowerOf10(maxScale - dec1.scale);
  const factor2 = safePowerOf10(maxScale - dec2.scale);

  let num = dec1.unscaledValue * factor1;
  let den = dec2.unscaledValue * factor2;

  assertSafeIntegers(num, den);

  // 2. 기약분수로 약분하여 분모의 소인수 검사 (2와 5만 허용되어야 유한소수)
  const g = gcd(num, den);
  num /= g;
  den /= g;

  let tempDen = den;
  while (tempDen % 2 === 0) tempDen /= 2;
  while (tempDen % 5 === 0) tempDen /= 5;

  if (tempDen !== 1) {
    throw new Error("초등 교육과정 범위를 벗어나는 유한소수가 아닌 무한소수(순환소수)입니다.");
  }

  // 3. 분모를 10의 거듭제곱으로 확장
  let currentScale = 0;
  while (den !== 1 && currentScale < 10) {
    if (den % 10 === 0) {
      den /= 10;
      currentScale += 1;
    } else if (den % 2 === 0) {
      num *= 5;
      den /= 2;
      currentScale += 1;
    } else if (den % 5 === 0) {
      num *= 2;
      den /= 5;
      currentScale += 1;
    }
    assertSafeIntegers(num);
  }

  // 4. 추가 정수 몫 처리
  const quotient = Math.floor(num / den);
  const rem = num % den;
  if (rem !== 0) {
    throw new Error("나눗셈 변환 중 유효하지 않은 나머지가 발생했습니다.");
  }

  return normalizeDecimal({
    unscaledValue: quotient,
    scale: currentScale
  });
}

/**
 * 소수의 특정 자릿수 값 추출
 * @param {Object|string} dec
 * @param {string} place - DecimalPlace enum
 * @returns {number} 0~9
 */
export function getDigitAtPlace(dec, place) {
  const d = parseDecimal(dec, { throwOnError: true });
  const str = formatDecimal(d, { preserveTrailingZeros: true });
  const [intPart, fracPart = ""] = str.split(".");

  switch (place) {
    case DecimalPlace.THOUSANDS:
      return intPart.length >= 4 ? Number(intPart[intPart.length - 4]) : 0;
    case DecimalPlace.HUNDREDS:
      return intPart.length >= 3 ? Number(intPart[intPart.length - 3]) : 0;
    case DecimalPlace.TENS:
      return intPart.length >= 2 ? Number(intPart[intPart.length - 2]) : 0;
    case DecimalPlace.ONES:
      return intPart.length >= 1 ? Number(intPart[intPart.length - 1]) : 0;
    case DecimalPlace.TENTHS:
      return fracPart.length >= 1 ? Number(fracPart[0]) : 0;
    case DecimalPlace.HUNDREDTHS:
      return fracPart.length >= 2 ? Number(fracPart[1]) : 0;
    case DecimalPlace.THOUSANDTHS:
      return fracPart.length >= 3 ? Number(fracPart[2]) : 0;
    default:
      return 0;
  }
}

/**
 * 소수의 특정 자릿값이 나타내는 수치 반환
 * (예: 12.305에서 TENTHS는 0.3, THOUSANDTHS는 0.005)
 * @param {Object|string} dec
 * @param {string} place
 * @returns {{ unscaledValue: number, scale: number }}
 */
export function getPlaceValue(dec, place) {
  const digit = getDigitAtPlace(dec, place);
  switch (place) {
    case DecimalPlace.THOUSANDS:
      return { unscaledValue: digit * 1000, scale: 0 };
    case DecimalPlace.HUNDREDS:
      return { unscaledValue: digit * 100, scale: 0 };
    case DecimalPlace.TENS:
      return { unscaledValue: digit * 10, scale: 0 };
    case DecimalPlace.ONES:
      return { unscaledValue: digit, scale: 0 };
    case DecimalPlace.TENTHS:
      return { unscaledValue: digit, scale: 1 };
    case DecimalPlace.HUNDREDTHS:
      return { unscaledValue: digit, scale: 2 };
    case DecimalPlace.THOUSANDTHS:
      return { unscaledValue: digit, scale: 3 };
    default:
      return { unscaledValue: 0, scale: 0 };
  }
}

/**
 * 소수를 기약분수로 변환
 * @param {Object|string} dec
 * @returns {{ numerator: number, denominator: number }}
 */
export function toFraction(dec) {
  const d = parseDecimal(dec, { throwOnError: true });
  const den = safePowerOf10(d.scale);
  const num = d.unscaledValue;
  const g = gcd(num, den);
  return {
    numerator: num / g,
    denominator: den / g
  };
}

/**
 * 기약분수를 유한소수로 변환 (유한소수가 아니면 throw)
 * @param {Object} fraction - { numerator, denominator }
 * @returns {{ unscaledValue: number, scale: number }}
 */
export function fromFraction(fraction) {
  if (!fraction || !Number.isSafeInteger(fraction.numerator) || fraction.numerator < 0
      || !Number.isSafeInteger(fraction.denominator) || fraction.denominator <= 0) {
    throw new Error("올바른 분수 객체가 아닙니다.");
  }
  return divideDecimals(
    { unscaledValue: fraction.numerator, scale: 0 },
    { unscaledValue: fraction.denominator, scale: 0 }
  );
}

/**
 * 단계별 풀이 설명 생성기 (완전 결정론적)
 * @param {string} operation - "ADD" | "SUBTRACT" | "MULTIPLY" | "DIVIDE"
 * @param {Object|string} a
 * @param {Object|string} b
 * @returns {{ steps: string[], result: string }}
 */
export function generateDecimalExplanation(operation, a, b) {
  const d1 = parseDecimal(a, { throwOnError: true });
  const d2 = parseDecimal(b, { throwOnError: true });
  const s1 = formatDecimal(d1);
  const s2 = formatDecimal(d2);

  const steps = [];
  let resultDec = null;

  switch (operation) {
    case "ADD": {
      resultDec = addDecimals(d1, d2);
      const aligned = alignDecimalScales(d1, d2);
      steps.push("1. 소수점을 기준으로 자릿수를 맞춥니다.");
      steps.push(`2. 소수점 자릿수를 ${aligned.scale}자리로 맞추어 ${aligned.u1}과 ${aligned.u2}의 덧셈으로 계산합니다.`);
      steps.push(`3. ${aligned.u1} + ${aligned.u2} = ${aligned.u1 + aligned.u2}`);
      steps.push(`4. 결과에 소수점을 찍어 ${formatDecimal(resultDec)}을 구합니다.`);
      break;
    }
    case "SUBTRACT": {
      resultDec = subtractDecimals(d1, d2);
      const aligned = alignDecimalScales(d1, d2);
      steps.push("1. 소수점을 맞추어 자릿수를 정렬합니다.");
      steps.push(`2. 자연수 뺄셈과 같이 ${aligned.u1}에서 ${aligned.u2}를 뺍니다.`);
      steps.push(`3. ${aligned.u1} - ${aligned.u2} = ${aligned.u1 - aligned.u2}`);
      steps.push(`4. 소수점을 내려찍어 결과는 ${formatDecimal(resultDec)}입니다.`);
      break;
    }
    case "MULTIPLY": {
      resultDec = multiplyDecimals(d1, d2);
      steps.push(`1. 소수점을 생각하지 않고 자연수의 곱셈을 합니다: ${d1.unscaledValue} × ${d2.unscaledValue} = ${d1.unscaledValue * d2.unscaledValue}`);
      steps.push(`2. 곱하는 두 수의 소수 자릿수의 합을 구합니다: ${d1.scale}자리 + ${d2.scale}자리 = ${resultDec.scale}자리`);
      steps.push(`3. 계산한 결과의 오른쪽 끝에서부터 소수점을 ${resultDec.scale}자리 옮겨 찍습니다.`);
      steps.push(`4. 최종 결과는 ${formatDecimal(resultDec)}입니다.`);
      break;
    }
    case "DIVIDE": {
      resultDec = divideDecimals(d1, d2);
      steps.push(`1. 나누는 수(${s2})의 소수점을 오른쪽으로 옮겨 자연수로 만듭니다.`);
      steps.push(`2. 나뉠 수(${s1})의 소수점도 같은 자릿수만큼 오른쪽으로 옮깁니다.`);
      steps.push("3. 자연수의 나눗셈과 같은 방법으로 계산합니다.");
      steps.push(`4. 몫의 소수점을 나뉠 수의 옮긴 소수점 위치에 맞추어 찍습니다.`);
      steps.push(`5. 최종 결과는 ${formatDecimal(resultDec)}입니다.`);
      break;
    }
    default:
      throw new Error(`지원되지 않는 연산입니다: ${operation}`);
  }

  return {
    steps,
    result: formatDecimal(resultDec)
  };
}
