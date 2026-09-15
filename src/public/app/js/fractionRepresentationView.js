//+_+// Phase F15A: 분수 시각 표현(Fraction Representation) 렌더러 SSOT
//+_+// - Canvas drawing이 아닌 순수 SVG / DOM 기반 prompt visualization
//+_+// - 결정론적 렌더링 (Math.random() 배제, spec 기반 완전 결정론)
//+_+// - 시각 모델: PART_WHOLE_BAR, PART_WHOLE_GRID, NUMBER_LINE, SYMBOLIC_FRACTION, EQUIVALENT_PAIR
//+_+// - 색상 단독 구별 금지 (빗금 패턴 + 명확한 테두리) 및 스크린리더 접근성(aria-label, role="img")
//+_+// - pointer-events: none 으로 답안 Surface(CHOICE/TEXT) 이벤트 가로채기 원천 차단

import {
  validateFraction,
  getFractionAccessibleDescription,
  formatFraction
} from "./fractionConcepts.js";

/**
 * 빗금 해치 패턴 정의 SVG defs 생성
 * @param {string} patternId
 * @returns {string}
 */
function createHatchPatternDef(patternId) {
  return `
    <defs>
      <pattern id="${patternId}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="#1a73e8" stroke-width="2.5" />
      </pattern>
    </defs>
  `;
}

/**
 * PART_WHOLE_BAR: 막대 분수 렌더러
 * @param {Object} spec
 * @returns {string} SVG HTML
 */
export function renderPartWholeBar(spec) {
  const f = spec.fraction || spec;
  const denom = Math.max(2, Number(f.denominator || f.totalParts || 2));
  const num = Math.max(0, Number(f.numerator || f.filledParts || 0));
  const width = spec.width || 320;
  const height = spec.height || 64;
  const padding = 10;
  const barWidth = width - padding * 2;
  const barHeight = height - padding * 2;
  const partWidth = barWidth / denom;

  const patternId = `bar_hatch_${denom}_${num}_${Math.abs(width * 31 + height)}`;
  const accessibleDesc = spec.ariaLabel || getFractionAccessibleDescription({ ...f, type: "PART_WHOLE_BAR" });

  let partsSvg = "";
  for (let i = 0; i < denom; i++) {
    const x = padding + i * partWidth;
    const isFilled = i < num;
    partsSvg += `
      <rect x="${x.toFixed(1)}" y="${padding}" width="${partWidth.toFixed(1)}" height="${barHeight}"
            fill="${isFilled ? "#e8f0fe" : "#ffffff"}"
            stroke="#1a73e8" stroke-width="2" />
      ${isFilled ? `
        <rect x="${x.toFixed(1)}" y="${padding}" width="${partWidth.toFixed(1)}" height="${barHeight}"
              fill="url(#${patternId})" opacity="0.45" />
      ` : ""}
    `;
  }

  return `
    <div class="fraction-visual-container fraction-bar-container" style="display: flex; justify-content: center; margin: 0.5rem 0; pointer-events: none;">
      <svg role="img" aria-label="${escapeAttr(accessibleDesc)}" pointer-events="none"
           viewBox="0 0 ${width} ${height}" width="100%" max-width="${width}px" style="max-width: ${width}px; height: auto; display: block;"
           xmlns="http://www.w3.org/2000/svg">
        ${createHatchPatternDef(patternId)}
        <rect x="${padding}" y="${padding}" width="${barWidth}" height="${barHeight}" rx="4"
              fill="#ffffff" stroke="#1a73e8" stroke-width="2" />
        ${partsSvg}
      </svg>
    </div>
  `;
}

/**
 * PART_WHOLE_GRID: 격자 분수 렌더러
 * @param {Object} spec
 * @returns {string} SVG HTML
 */
export function renderPartWholeGrid(spec) {
  const f = spec.fraction || spec;
  const rows = Math.max(1, Number(spec.rows || f.rows || 2));
  const cols = Math.max(1, Number(spec.cols || f.cols || 3));
  const denom = rows * cols;
  const num = Math.min(denom, Math.max(0, Number(f.numerator || f.filledParts || 0)));

  const width = spec.width || 240;
  const height = spec.height || 120;
  const padding = 10;
  const gridWidth = width - padding * 2;
  const gridHeight = height - padding * 2;
  const cellWidth = gridWidth / cols;
  const cellHeight = gridHeight / rows;

  const patternId = `grid_hatch_${rows}_${cols}_${num}`;
  const accessibleDesc = spec.ariaLabel || getFractionAccessibleDescription({ ...f, type: "PART_WHOLE_GRID", denominator: denom, numerator: num });

  let cellsSvg = "";
  let cellCount = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isFilled = cellCount < num;
      const x = padding + c * cellWidth;
      const y = padding + r * cellHeight;

      cellsSvg += `
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cellWidth.toFixed(1)}" height="${cellHeight.toFixed(1)}"
              fill="${isFilled ? "#e8f0fe" : "#ffffff"}"
              stroke="#1a73e8" stroke-width="2" />
        ${isFilled ? `
          <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cellWidth.toFixed(1)}" height="${cellHeight.toFixed(1)}"
                fill="url(#${patternId})" opacity="0.45" />
        ` : ""}
      `;
      cellCount++;
    }
  }

  return `
    <div class="fraction-visual-container fraction-grid-container" style="display: flex; justify-content: center; margin: 0.5rem 0; pointer-events: none;">
      <svg role="img" aria-label="${escapeAttr(accessibleDesc)}" pointer-events="none"
           viewBox="0 0 ${width} ${height}" width="100%" style="max-width: ${width}px; height: auto; display: block;"
           xmlns="http://www.w3.org/2000/svg">
        ${createHatchPatternDef(patternId)}
        <rect x="${padding}" y="${padding}" width="${gridWidth}" height="${gridHeight}" rx="4"
              fill="#ffffff" stroke="#1a73e8" stroke-width="2" />
        ${cellsSvg}
      </svg>
    </div>
  `;
}

/**
 * NUMBER_LINE: 수직선 분수 렌더러
 * @param {Object} spec
 * @returns {string} SVG HTML
 */
export function renderNumberLine(spec) {
  const f = (spec.fractions && spec.fractions[0]) || spec.fraction || spec;
  const maxVal = Math.max(1, Number(spec.maxVal || spec.max || spec.rangeEnd || 1));
  const denom = Math.max(2, Number(f.denominator || spec.subdivisions || 4));
  const num = Number(f.numerator !== undefined ? f.numerator : (spec.markerNumerator ?? 1));
  const whole = Number(f.wholeNumber || f.whole || 0);
  const targetVal = whole + num / denom;

  const width = spec.width || 340;
  const height = spec.height || 90;
  const paddingX = 30;
  const paddingY = 45;
  const axisY = paddingY;
  const lineStartX = paddingX;
  const lineEndX = width - paddingX;
  const lineWidth = lineEndX - lineStartX;

  const totalSteps = maxVal * denom;
  const stepWidth = lineWidth / totalSteps;

  const accessibleDesc = spec.ariaLabel || getFractionAccessibleDescription({
    type: "NUMBER_LINE",
    denominator: denom,
    numerator: num,
    wholeNumber: whole
  });

  let ticksSvg = "";
  // 눈금 및 숫자 렌더링
  for (let i = 0; i <= totalSteps; i++) {
    const x = lineStartX + i * stepWidth;
    const isMajor = i % denom === 0;
    const tickHeight = isMajor ? 16 : 8;
    const y1 = axisY - tickHeight / 2;
    const y2 = axisY + tickHeight / 2;

    ticksSvg += `<line x1="${x.toFixed(1)}" y1="${y1}" x2="${x.toFixed(1)}" y2="${y2}" stroke="${isMajor ? "#202124" : "#5f6368"}" stroke-width="${isMajor ? 2.5 : 1.5}" />`;

    if (isMajor) {
      const intVal = i / denom;
      ticksSvg += `
        <text x="${x.toFixed(1)}" y="${axisY + 24}" font-size="14" font-weight="bold" fill="#202124" text-anchor="middle">
          ${intVal}
        </text>
      `;
    }
  }

  // 마커 위치 계산
  const markerX = lineStartX + (targetVal * denom) * stepWidth;
  const markerLabel = spec.markerLabel || "▼";

  let markerSvg = "";
  if (spec.showMarker !== false && markerX >= lineStartX && markerX <= lineEndX + 1) {
    markerSvg = `
      <!-- 마커 점 및 화살표 -->
      <circle cx="${markerX.toFixed(1)}" cy="${axisY}" r="5" fill="#d93025" stroke="#ffffff" stroke-width="1.5" />
      <text x="${markerX.toFixed(1)}" y="${axisY - 14}" font-size="16" font-weight="bold" fill="#d93025" text-anchor="middle">
        ${escapeAttr(markerLabel)}
      </text>
    `;
  }

  return `
    <div class="fraction-visual-container fraction-number-line-container" style="display: flex; justify-content: center; margin: 0.5rem 0; pointer-events: none;">
      <svg role="img" aria-label="${escapeAttr(accessibleDesc)}" pointer-events="none"
           viewBox="0 0 ${width} ${height}" width="100%" style="max-width: ${width}px; height: auto; display: block;"
           xmlns="http://www.w3.org/2000/svg">
        <!-- 수직선 주 축 -->
        <line x1="${lineStartX}" y1="${axisY}" x2="${lineEndX}" y2="${axisY}" stroke="#202124" stroke-width="2.5" />
        <!-- 눈금 -->
        ${ticksSvg}
        <!-- 목표 마커 -->
        ${markerSvg}
      </svg>
    </div>
  `;
}

/**
 * EQUIVALENT_PAIR: 동치 분수 쌍 시각 렌더러
 * @param {Object} spec
 * @returns {string} HTML
 */
export function renderEquivalentPair(spec) {
  const pair1 = spec.pair1 || spec.fractionA || { type: "PART_WHOLE_BAR", numerator: 1, denominator: 2 };
  const pair2 = spec.pair2 || spec.fractionB || { type: "PART_WHOLE_BAR", numerator: 2, denominator: 4 };

  const desc1 = getFractionAccessibleDescription(pair1);
  const desc2 = getFractionAccessibleDescription(pair2);
  const accessibleDesc = spec.ariaLabel || `크기가 같은 두 분수 비교: ${desc1}와 ${desc2}`;

  const renderSingle = (p) => {
    if (p.type === "PART_WHOLE_GRID") return renderPartWholeGrid({ ...p, width: spec.width || 280, height: 60 });
    if (p.type === "NUMBER_LINE") return renderNumberLine({ ...p, width: spec.width || 320, height: 70 });
    return renderPartWholeBar({ ...p, width: spec.width || 320, height: 50 });
  };

  return `
    <div class="fraction-visual-container fraction-equivalent-pair-container"
         role="img" aria-label="${escapeAttr(accessibleDesc)}"
         style="display: flex; flex-direction: column; align-items: center; gap: 0.4rem; margin: 0.5rem 0; pointer-events: none;">
      <div class="pair-item pair-item-1" style="width: 100%; max-width: 320px;">
        ${renderSingle(pair1)}
      </div>
      <div class="pair-divider" style="font-size: 1.1rem; font-weight: bold; color: #5f6368;">↕ 크기 비교</div>
      <div class="pair-item pair-item-2" style="width: 100%; max-width: 320px;">
        ${renderSingle(pair2)}
      </div>
    </div>
  `;
}

/**
 * SYMBOLIC_FRACTION: 기호 분수 표기 렌더러 (HTML/CSS)
 * @param {Object} spec
 * @returns {string} HTML
 */
export function renderSymbolicFraction(spec) {
  const f = spec.fraction || spec;
  const num = f.numerator !== undefined ? f.numerator : 1;
  const denom = f.denominator !== undefined ? f.denominator : 2;
  const whole = f.wholeNumber !== undefined ? f.wholeNumber : (f.whole !== undefined ? f.whole : 0);
  const accessibleDesc = spec.ariaLabel || getFractionAccessibleDescription({ type: "SYMBOLIC_FRACTION", numerator: num, denominator: denom, wholeNumber: whole });

  return `
    <span class="symbolic-fraction-view" role="img" aria-label="${escapeAttr(accessibleDesc)}"
          style="display: inline-flex; align-items: center; vertical-align: middle; margin: 0 0.35rem; font-weight: bold; pointer-events: none;">
      ${whole > 0 ? `<span class="fraction-whole" style="font-size: 1.3rem; margin-right: 0.25rem;">${whole}</span>` : ""}
      <span class="fraction-stack" style="display: inline-flex; flex-direction: column; align-items: center; text-align: center; line-height: 1;">
        <span class="fraction-numerator" style="font-size: 1rem; padding: 0 0.25rem;">${num}</span>
        <span class="fraction-bar" style="display: block; width: 100%; height: 2px; background: currentColor; margin: 2px 0;"></span>
        <span class="fraction-denominator" style="font-size: 1rem; padding: 0 0.25rem;">${denom}</span>
      </span>
    </span>
  `;
}

/**
 * 범용 분수 시각 표현 진입점
 * @param {Object} activityOrSpec - Activity 객체(activity.metadata.fractionRepresentation) 또는 시각화 spec
 * @returns {string} HTML 문자열
 */
export function renderFractionRepresentation(activityOrSpec) {
  if (!activityOrSpec) return "";

  const spec = activityOrSpec.metadata?.fractionRepresentation ||
               activityOrSpec.fractionRepresentation ||
               (activityOrSpec.type ? activityOrSpec : null);

  if (!spec || typeof spec !== "object") return "";

  switch (spec.type) {
    case "PART_WHOLE_BAR":
      return renderPartWholeBar(spec);
    case "PART_WHOLE_GRID":
      return renderPartWholeGrid(spec);
    case "NUMBER_LINE":
      return renderNumberLine(spec);
    case "EQUIVALENT_PAIR":
      return renderEquivalentPair(spec);
    case "SYMBOLIC_FRACTION":
      return renderSymbolicFraction(spec);
    default:
      return `<div class="fraction-visual-container fraction-fallback" role="img" aria-label="분수 시각화"></div>`;
  }
}

//+_+// 명시적 렌더러 별칭 내보내기
export const renderPartWholeBarSVG = renderPartWholeBar;
export const renderPartWholeGridSVG = renderPartWholeGrid;
export const renderNumberLineSVG = renderNumberLine;
export const renderSymbolicFractionDOM = renderSymbolicFraction;
export const renderEquivalentPairSVG = renderEquivalentPair;

function escapeAttr(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
