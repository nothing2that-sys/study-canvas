/**
 * Math Canvas Pro - 세로셈 단계별 해설 및 정답 분해 엔진
 * 곱셈 부분곱(Partial Products) 및 나눗셈 단계별(Quotient Steps) 수치 생성
 */

export function getMultiplicationSteps(operandA, operandB) {
  const a = Number(operandA);
  const b = Number(operandB);
  const bDigits = String(b).split("").reverse().map(Number); // [1의자리, 10의자리, ...]

  const partialProducts = bDigits.map((digit, index) => {
    const rawProduct = a * digit;
    const placeValue = 10 ** index;
    const shiftedProduct = rawProduct * placeValue;
    return {
      digit,
      digitPosition: index,
      placeValue,
      rawProduct,
      shiftedProduct,
      rawProductStr: String(rawProduct),
      shiftedProductStr: String(shiftedProduct),
      carries: computeCarriesForDigit(a, digit)
    };
  });

  const finalResult = a * b;

  return {
    type: "multiplication",
    operandA: a,
    operandB: b,
    partialProducts,
    primaryCarries: computeCarriesForDigit(a, bDigits[0]), // 1의 자리 곱셈 올림수
    result: finalResult,
    resultStr: String(finalResult)
  };
}

function computeCarriesForDigit(operandA, multiplierDigit) {
  const aStr = String(operandA);
  const m = Number(multiplierDigit);
  const carries = new Array(aStr.length).fill(0);

  let currentCarry = 0;
  for (let i = aStr.length - 1; i >= 0; i--) {
    const digit = Number(aStr[i]);
    const prod = (digit * m) + currentCarry;
    const nextCarry = Math.floor(prod / 10);
    if (i > 0) {
      carries[i - 1] = nextCarry;
    }
    currentCarry = nextCarry;
  }
  return carries;
}

export function getDivisionSteps(dividend, divisor) {
  const dvd = Number(dividend);
  const dvr = Number(divisor);
  const quotient = Math.floor(dvd / dvr);
  const remainder = dvd % dvr;

  const dvdDigits = String(dvd).split("").map(Number);
  const steps = [];

  let currentPartial = 0;
  let currentQuotientStr = "";

  for (let i = 0; i < dvdDigits.length; i += 1) {
    currentPartial = (currentPartial * 10) + dvdDigits[i];

    if (currentPartial >= dvr || currentQuotientStr.length > 0 || i === dvdDigits.length - 1) {
      const qDigit = Math.floor(currentPartial / dvr);
      currentQuotientStr += String(qDigit);
      const multiplyVal = qDigit * dvr;
      const stepRemainder = currentPartial - multiplyVal;
      const bringDown = i + 1 < dvdDigits.length ? dvdDigits[i + 1] : null;

      steps.push({
        stepIndex: steps.length,
        quotientDigit: qDigit,
        partialDividend: currentPartial,
        multiplyValue: multiplyVal,
        remainder: stepRemainder,
        bringDownDigit: bringDown,
        multiplyValueStr: String(multiplyVal),
        remainderStr: String(stepRemainder)
      });

      currentPartial = stepRemainder;
    }
  }

  return {
    type: "division",
    dividend: dvd,
    divisor: dvr,
    quotient,
    quotientStr: String(quotient),
    remainder,
    steps
  };
}
