//+_+// Phase F15C: 소수 시각 표현 (Decimal Representation) 렌더러 SSOT
//+_+// - Canvas drawing이 아닌 순수 SVG / DOM 기반 프롬프트 시각화
//+_+// - 완전 결정론적 렌더링 (비결정적 난수 배제)
//+_+// - 시각 모델: DECIMAL_GRID, DECIMAL_NUMBER_LINE, DECIMAL_PLACE_VALUE, DECIMAL_COMPARE, DECIMAL_OPERATION
//+_+// - 스크린리더 접근성 (role="img", aria-label)
//+_+// - pointer-events: none 으로 학생 답안 입력 가로채기 원천 차단

import {
  parseDecimal,
  formatDecimal,
  getDigitAtPlace,
  DecimalPlace
} from "./decimalDomain.js";

/**
 * 속성 이스케이프 유틸리티
 */
function escapeAttr(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * 소수 시각화 사양(spec) 정규화
 * @param {Object} spec
 * @returns {Object}
 */
export function normalizeDecimalRepresentationSpec(spec) {
  if (!spec || typeof spec !== "object") {
    throw new Error("유효하지 않은 소수 시각 표현 사양(spec)입니다.");
  }

  const validTypes = new Set([
    "DECIMAL_GRID",
    "DECIMAL_NUMBER_LINE",
    "DECIMAL_PLACE_VALUE",
    "DECIMAL_COMPARE",
    "DECIMAL_OPERATION"
  ]);

  if (!spec.type || !validTypes.has(spec.type)) {
    throw new Error(`지원되지 않거나 알 수 없는 소수 시각 표현 타입입니다: ${spec.type}`);
  }

  return { ...spec };
}

/**
 * 1. DECIMAL_GRID: 10x10 격자 (100칸) 또는 10등분 바 시각화
 */
function renderDecimalGrid(spec) {
  const dec = parseDecimal(spec.value, { throwOnError: true });
  const isHundredths = spec.gridType === "10x10" || dec.scale >= 2;
  const totalCells = isHundredths ? 100 : 10;
  const filledCount = isHundredths
    ? Math.min(100, Math.round(dec.unscaledValue * (10 ** (2 - dec.scale))))
    : Math.min(10, Math.round(dec.unscaledValue * (10 ** (1 - dec.scale))));

  const label = `소수 격자 표현: 전체 ${totalCells}칸 중 ${filledCount}칸 색칠 (값: ${formatDecimal(dec)})`;

  if (!isHundredths) {
    // 10등분 바 (수평)
    const barWidth = 240;
    const barHeight = 36;
    const cellWidth = barWidth / 10;
    let rects = "";
    for (let i = 0; i < 10; i++) {
      const isFilled = i < filledCount;
      const fill = isFilled ? "#1a73e8" : "#ffffff";
      rects += `<rect x="${i * cellWidth}" y="0" width="${cellWidth}" height="${barHeight}" fill="${fill}" stroke="#70757a" stroke-width="1.5" />`;
    }
    return `
      <div class="decimal-visual-container" style="display: flex; justify-content: center; margin: 12px 0; pointer-events: none;">
        <svg role="img" aria-label="${escapeAttr(label)}" width="${barWidth + 20}" height="${barHeight + 30}" viewBox="0 0 ${barWidth + 20} ${barHeight + 30}" xmlns="http://www.w3.org/2000/svg" style="pointer-events: none; max-width: 100%;">
          <g transform="translate(10, 10)">
            ${rects}
          </g>
        </svg>
      </div>
    `.trim();
  }

  // 10x10 그리드 (100칸)
  const cellSize = 18;
  const gridSize = cellSize * 10;
  let cells = "";
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const idx = r * 10 + c;
      const isFilled = idx < filledCount;
      const fill = isFilled ? "#1a73e8" : "#ffffff";
      cells += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}" fill="${fill}" stroke="#dadce0" stroke-width="1" />`;
    }
  }

  return `
    <div class="decimal-visual-container" style="display: flex; justify-content: center; margin: 12px 0; pointer-events: none;">
      <svg role="img" aria-label="${escapeAttr(label)}" width="${gridSize + 20}" height="${gridSize + 20}" viewBox="0 0 ${gridSize + 20} ${gridSize + 20}" xmlns="http://www.w3.org/2000/svg" style="pointer-events: none; max-width: 100%;">
        <g transform="translate(10, 10)">
          <rect x="0" y="0" width="${gridSize}" height="${gridSize}" fill="none" stroke="#202124" stroke-width="2" />
          ${cells}
        </g>
      </svg>
    </div>
  `.trim();
}

/**
 * 2. DECIMAL_NUMBER_LINE: 수직선 시각화
 */
function renderDecimalNumberLine(spec) {
  const minDec = parseDecimal(spec.min !== undefined ? spec.min : "0", { throwOnError: true });
  const maxDec = parseDecimal(spec.max !== undefined ? spec.max : "1", { throwOnError: true });
  const stepDec = parseDecimal(spec.step !== undefined ? spec.step : "0.1", { throwOnError: true });

  const width = 320;
  const height = 70;
  const lineY = 32;
  const startX = 20;
  const endX = width - 20;
  const lineLength = endX - startX;

  const minVal = minDec.unscaledValue / (10 ** minDec.scale);
  const maxVal = maxDec.unscaledValue / (10 ** maxDec.scale);
  const stepVal = stepDec.unscaledValue / (10 ** stepDec.scale);
  const range = maxVal - minVal;

  const points = Array.isArray(spec.points) ? spec.points : [];
  const label = `소수 수직선 표현: ${formatDecimal(minDec)}부터 ${formatDecimal(maxDec)}까지`;

  let ticks = "";
  const numSteps = Math.round(range / stepVal);
  for (let i = 0; i <= numSteps; i++) {
    const currentVal = minVal + i * stepVal;
    const x = startX + (i / numSteps) * lineLength;
    const isMajor = i === 0 || i === numSteps || i % 5 === 0;
    const tickH = isMajor ? 12 : 6;
    ticks += `<line x1="${x}" y1="${lineY - tickH / 2}" x2="${x}" y2="${lineY + tickH / 2}" stroke="#3c4043" stroke-width="${isMajor ? 2 : 1}" />`;
    if (isMajor) {
      ticks += `<text x="${x}" y="${lineY + 20}" text-anchor="middle" font-size="11" fill="#3c4043">${currentVal.toFixed(stepDec.scale)}</text>`;
    }
  }

  let plottedPoints = "";
  for (const pt of points) {
    const ptDec = parseDecimal(pt.value);
    if (!ptDec) continue;
    const ptVal = ptDec.unscaledValue / (10 ** ptDec.scale);
    const fraction = (ptVal - minVal) / range;
    const px = startX + fraction * lineLength;
    plottedPoints += `
      <circle cx="${px}" cy="${lineY}" r="5" fill="#d93025" stroke="#ffffff" stroke-width="1.5" />
      <text x="${px}" y="${lineY - 10}" text-anchor="middle" font-size="11" font-weight="bold" fill="#d93025">${escapeAttr(pt.label || formatDecimal(ptDec))}</text>
    `;
  }

  return `
    <div class="decimal-visual-container" style="display: flex; justify-content: center; margin: 12px 0; pointer-events: none;">
      <svg role="img" aria-label="${escapeAttr(label)}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="pointer-events: none; max-width: 100%;">
        <line x1="${startX}" y1="${lineY}" x2="${endX}" y2="${lineY}" stroke="#202124" stroke-width="2" />
        ${ticks}
        ${plottedPoints}
      </svg>
    </div>
  `.trim();
}

/**
 * 3. DECIMAL_PLACE_VALUE: 자릿값 표 DOM 표현
 */
function renderDecimalPlaceValue(spec) {
  const dec = parseDecimal(spec.value, { throwOnError: true });
  const highlight = spec.highlightPlace || null;

  const places = [
    { key: DecimalPlace.TENS, label: "십의 자리", digit: getDigitAtPlace(dec, DecimalPlace.TENS) },
    { key: DecimalPlace.ONES, label: "일의 자리", digit: getDigitAtPlace(dec, DecimalPlace.ONES) },
    { key: "DOT", label: "소수점", digit: "." },
    { key: DecimalPlace.TENTHS, label: "소수 첫째 자리", digit: getDigitAtPlace(dec, DecimalPlace.TENTHS) },
    { key: DecimalPlace.HUNDREDTHS, label: "소수 둘째 자리", digit: getDigitAtPlace(dec, DecimalPlace.HUNDREDTHS) },
    { key: DecimalPlace.THOUSANDTHS, label: "소수 셋째 자리", digit: getDigitAtPlace(dec, DecimalPlace.THOUSANDTHS) }
  ];

  const headers = places.map((p) => `<th style="padding: 6px 10px; border: 1px solid #dadce0; background: ${p.key === highlight ? '#e8f0fe' : '#f8f9fa'}; font-size: 12px;">${p.label}</th>`).join("");
  const cells = places.map((p) => `<td style="padding: 10px; text-align: center; border: 1px solid #dadce0; font-size: 16px; font-weight: bold; color: ${p.key === highlight ? '#1a73e8' : '#202124'}; background: ${p.key === highlight ? '#f1f8ff' : '#ffffff'};">${p.digit}</td>`).join("");

  return `
    <div class="decimal-place-value-container" style="display: flex; justify-content: center; margin: 12px 0; pointer-events: none;">
      <table style="border-collapse: collapse; text-align: center; border: 2px solid #70757a; border-radius: 6px; overflow: hidden;" role="img" aria-label="자릿값 표: ${formatDecimal(dec)}">
        <thead>
          <tr>${headers}</tr>
        </thead>
        <tbody>
          <tr>${cells}</tr>
        </tbody>
      </table>
    </div>
  `.trim();
}

/**
 * 4. DECIMAL_COMPARE: 두 소수 크기 비교 시각화
 */
function renderDecimalCompare(spec) {
  const d1 = parseDecimal(spec.value1, { throwOnError: true });
  const d2 = parseDecimal(spec.value2, { throwOnError: true });

  const label = `소수 크기 비교: ${formatDecimal(d1)}와 ${formatDecimal(d2)}`;

  return `
    <div class="decimal-compare-container" style="display: flex; align-items: center; justify-content: center; gap: 16px; margin: 12px 0; font-size: 18px; font-weight: bold; pointer-events: none;" role="img" aria-label="${escapeAttr(label)}">
      <div style="padding: 8px 16px; background: #e8f0fe; border: 2px solid #1a73e8; border-radius: 8px; color: #1a73e8;">${formatDecimal(d1)}</div>
      <div style="width: 42px; height: 42px; border: 2px dashed #70757a; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; color: #70757a;">?</div>
      <div style="padding: 8px 16px; background: #e6f4ea; border: 2px solid #137333; border-radius: 8px; color: #137333;">${formatDecimal(d2)}</div>
    </div>
  `.trim();
}

/**
 * 5. DECIMAL_OPERATION: 세로셈 자리맞춤 시각화
 */
function renderDecimalOperation(spec) {
  const op = spec.operation || "+";
  const v1 = formatDecimal(parseDecimal(spec.value1, { throwOnError: true }));
  const v2 = formatDecimal(parseDecimal(spec.value2, { throwOnError: true }));

  return `
    <div class="decimal-operation-container" style="display: flex; justify-content: center; margin: 12px 0; pointer-events: none;">
      <div style="font-family: monospace; font-size: 20px; line-height: 1.5; border: 1px solid #dadce0; padding: 12px 24px; border-radius: 8px; background: #fafafa;" role="img" aria-label="세로셈: ${v1} ${op} ${v2}">
        <div style="text-align: right;">${v1}</div>
        <div style="text-align: right; border-bottom: 2px solid #202124; padding-bottom: 4px;"><span style="float: left; margin-right: 12px;">${op}</span>${v2}</div>
      </div>
    </div>
  `.trim();
}

/**
 * 범용 소수 시각 표현 진입점 (Fail-Closed)
 * @param {Object} activityOrSpec
 * @returns {string} HTML 마크업
 */
export function renderDecimalRepresentation(activityOrSpec) {
  if (!activityOrSpec) return "";

  let spec = activityOrSpec.metadata?.decimalRepresentation ||
             activityOrSpec.metadata?.decimalOperation ||
             activityOrSpec.decimalRepresentation ||
             activityOrSpec.decimalOperation;

  if (!spec) {
    if (activityOrSpec.responseType || activityOrSpec.subjectId || activityOrSpec.choices || activityOrSpec.questionKey) {
      return "";
    }
    if (activityOrSpec.type) {
      spec = activityOrSpec;
    } else {
      return "";
    }
  }

  if (!spec) return "";

  const normSpec = normalizeDecimalRepresentationSpec(spec);

  switch (normSpec.type) {
    case "DECIMAL_GRID":
      return renderDecimalGrid(normSpec);
    case "DECIMAL_NUMBER_LINE":
      return renderDecimalNumberLine(normSpec);
    case "DECIMAL_PLACE_VALUE":
      return renderDecimalPlaceValue(normSpec);
    case "DECIMAL_COMPARE":
      return renderDecimalCompare(normSpec);
    case "DECIMAL_OPERATION":
      return renderDecimalOperation(normSpec);
    default:
      throw new Error(`지원되지 않는 소수 시각화 타입입니다: ${normSpec.type}`);
  }
}
