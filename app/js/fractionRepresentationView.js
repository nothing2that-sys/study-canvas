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
 * 분수 시각화 사양(spec) 정규화 및 fail-closed 중앙 검증기 SSOT
 * @param {Object} spec
 * @returns {Object} 정규화 및 검증 완료된 spec
 */
export function normalizeFractionRepresentationSpec(spec) {
  if (!spec || typeof spec !== "object") {
    throw new Error("유효하지 않은 분수 시각 표현 사양(spec)입니다.");
  }

  const validTypes = new Set([
    "PART_WHOLE_BAR",
    "PART_WHOLE_GRID",
    "NUMBER_LINE",
    "SYMBOLIC_FRACTION",
    "EQUIVALENT_PAIR",
    "FRACTION_OPERATION_ADD",
    "FRACTION_OPERATION_SUB",
    "FRACTION_COMMON_DENOMINATOR"
  ]);

  if (!spec.type || !validTypes.has(spec.type)) {
    throw new Error(`지원되지 않거나 알 수 없는 분수 시각 표현 타입입니다: ${spec.type}`);
  }

  // 0. FRACTION OPERATIONS (ADD, SUB, COMMON_DENOMINATOR)
  if (spec.type === "FRACTION_OPERATION_ADD" || spec.type === "FRACTION_OPERATION_SUB" || spec.type === "FRACTION_COMMON_DENOMINATOR") {
    return { ...spec };
  }

  // 1. EQUIVALENT_PAIR
  if (spec.type === "EQUIVALENT_PAIR") {
    const pair1 = spec.pair1 || spec.fractionA;
    const pair2 = spec.pair2 || spec.fractionB;
    if (!pair1 || !pair2) {
      throw new Error("EQUIVALENT_PAIR는 두 개의 비교 분수(pair1/fractionA, pair2/fractionB)가 모두 필요합니다.");
    }
    const normPair1 = normalizeFractionRepresentationSpec({
      ...pair1,
      type: pair1.type || "PART_WHOLE_BAR"
    });
    const normPair2 = normalizeFractionRepresentationSpec({
      ...pair2,
      type: pair2.type || "PART_WHOLE_BAR"
    });
    return {
      ...spec,
      type: "EQUIVALENT_PAIR",
      pair1: normPair1,
      pair2: normPair2
    };
  }

  // 2. NUMBER_LINE
  if (spec.type === "NUMBER_LINE") {
    const fractionObj = (spec.fractions && spec.fractions[0]) || spec.fraction;
    
    //+_+// Phase F15A Rework 2: subdivisions 유효성 및 fraction.denominator 충돌 검증 (fail-closed)
    const hasSpecSubdiv = spec.subdivisions !== undefined;
    if (hasSpecSubdiv) {
      if (typeof spec.subdivisions !== "number" || Number.isNaN(spec.subdivisions) || !Number.isFinite(spec.subdivisions) || !Number.isInteger(spec.subdivisions) || spec.subdivisions < 2) {
        throw new Error(`NUMBER_LINE subdivisions(분모)는 2 이상의 정수여야 합니다. 입력값: ${spec.subdivisions}`);
      }
    }

    const hasFractionDenom = fractionObj ? fractionObj.denominator !== undefined : (spec.denominator !== undefined);
    const fractionDenomVal = fractionObj ? fractionObj.denominator : spec.denominator;

    if (hasSpecSubdiv && hasFractionDenom && spec.subdivisions !== fractionDenomVal) {
      throw new Error(`NUMBER_LINE subdivisions(${spec.subdivisions})와 fraction.denominator(${fractionDenomVal})가 일치하지 않습니다 (불일치 충돌 거절).`);
    }

    const denom = hasSpecSubdiv ? spec.subdivisions : fractionDenomVal;
    const num = spec.markerNumerator !== undefined ? spec.markerNumerator : (fractionObj?.numerator !== undefined ? fractionObj.numerator : (spec.numerator !== undefined ? spec.numerator : 1));
    const whole = fractionObj?.wholeNumber !== undefined ? fractionObj.wholeNumber : (fractionObj?.whole !== undefined ? fractionObj.whole : (spec.wholeNumber || spec.whole || 0));
    const maxVal = spec.maxVal !== undefined ? spec.maxVal : (spec.max !== undefined ? spec.max : (spec.rangeEnd !== undefined ? spec.rangeEnd : 1));

    if (typeof denom !== "number" || Number.isNaN(denom) || !Number.isFinite(denom) || !Number.isInteger(denom) || denom < 2) {
      throw new Error(`NUMBER_LINE subdivisions(분모)는 2 이상의 정수여야 합니다. 입력값: ${denom}`);
    }
    if (typeof num !== "number" || Number.isNaN(num) || !Number.isFinite(num) || !Number.isInteger(num) || num < 0) {
      throw new Error(`NUMBER_LINE 분자(markerNumerator)는 0 이상의 정수여야 합니다. 입력값: ${num}`);
    }
    if (typeof whole !== "number" || Number.isNaN(whole) || !Number.isFinite(whole) || !Number.isInteger(whole) || whole < 0) {
      throw new Error(`NUMBER_LINE wholeNumber는 0 이상의 정수여야 합니다. 입력값: ${whole}`);
    }
    if (typeof maxVal !== "number" || Number.isNaN(maxVal) || !Number.isFinite(maxVal) || !Number.isInteger(maxVal) || maxVal < 1) {
      throw new Error(`NUMBER_LINE maxVal은 1 이상의 정수여야 합니다. 입력값: ${maxVal}`);
    }

    const targetVal = whole + num / denom;
    if (targetVal < 0 || targetVal > maxVal) {
      throw new Error(`NUMBER_LINE 마커 위치(${targetVal})가 유효 범위(0 ~ ${maxVal})를 벗어났습니다.`);
    }

    return {
      ...spec,
      type: "NUMBER_LINE",
      denominator: denom,
      numerator: num,
      wholeNumber: whole,
      maxVal,
      targetVal,
      subdivisions: denom
    };
  }

  // 3. PART_WHOLE_BAR / PART_WHOLE_GRID / SYMBOLIC_FRACTION 분수 기본 성분 검증
  const f = spec.fraction || spec;
  const num = f.numerator !== undefined ? f.numerator : (f.filledParts !== undefined ? f.filledParts : null);
  const denom = f.denominator !== undefined ? f.denominator : (f.totalParts !== undefined ? f.totalParts : null);
  const whole = f.wholeNumber !== undefined ? f.wholeNumber : (f.whole !== undefined ? f.whole : 0);

  if (num === null || denom === null) {
    throw new Error("분수 시각화에 분자(numerator)와 분모(denominator)가 반드시 지정되어야 합니다.");
  }
  if (typeof num !== "number" || typeof denom !== "number" || typeof whole !== "number") {
    throw new Error("분수 성분은 숫자여야 합니다.");
  }
  if (Number.isNaN(num) || Number.isNaN(denom) || Number.isNaN(whole)) {
    throw new Error("분수 성분에 NaN이 포함될 수 없습니다.");
  }
  if (!Number.isFinite(num) || !Number.isFinite(denom) || !Number.isFinite(whole)) {
    throw new Error("분수 성분에 Infinity가 포함될 수 없습니다.");
  }
  if (!Number.isInteger(num) || !Number.isInteger(denom) || !Number.isInteger(whole)) {
    throw new Error("분수 성분은 정수여야 합니다.");
  }
  if (num < 0 || denom < 0 || whole < 0) {
    throw new Error("분수 성분은 음수일 수 없습니다.");
  }
  if (denom < 2) {
    throw new Error(`분수 시각 표현의 분모는 최소 2 이상이어야 합니다. 입력값: ${denom}`);
  }

  if (spec.type === "PART_WHOLE_BAR") {
    if (num > denom) {
      throw new Error(`막대 분수의 분자(${num})는 분모(${denom})를 초과할 수 없습니다.`);
    }
    return {
      ...spec,
      type: "PART_WHOLE_BAR",
      numerator: num,
      denominator: denom,
      wholeNumber: whole
    };
  }

  if (spec.type === "PART_WHOLE_GRID") {
    const rows = spec.rows !== undefined ? spec.rows : f.rows;
    const cols = spec.cols !== undefined ? spec.cols : f.cols;
    if (rows === undefined || cols === undefined) {
      throw new Error("PART_WHOLE_GRID는 rows와 cols가 반드시 지정되어야 합니다.");
    }
    if (typeof rows !== "number" || typeof cols !== "number") {
      throw new Error("GRID의 rows와 cols는 숫자여야 합니다.");
    }
    if (Number.isNaN(rows) || Number.isNaN(cols) || !Number.isFinite(rows) || !Number.isFinite(cols) || !Number.isInteger(rows) || !Number.isInteger(cols)) {
      throw new Error("GRID의 rows와 cols는 정수여야 합니다.");
    }
    if (rows < 1 || cols < 1) {
      throw new Error("GRID의 rows와 cols는 1 이상의 양의 정수여야 합니다.");
    }
    if (rows * cols !== denom) {
      throw new Error(`GRID의 rows(${rows}) * cols(${cols}) = ${rows * cols} 은 분모(${denom})와 일치하지 않습니다.`);
    }
    if (num > denom) {
      throw new Error(`격자 분수의 색칠된 칸수(${num})는 전체 칸수(${denom})를 초과할 수 없습니다.`);
    }
    return {
      ...spec,
      type: "PART_WHOLE_GRID",
      numerator: num,
      denominator: denom,
      wholeNumber: whole,
      rows,
      cols
    };
  }

  if (spec.type === "SYMBOLIC_FRACTION") {
    return {
      ...spec,
      type: "SYMBOLIC_FRACTION",
      numerator: num,
      denominator: denom,
      wholeNumber: whole
    };
  }

  throw new Error(`지원되지 않는 분수 시각화 타입입니다: ${spec.type}`);
}

/**
 * PART_WHOLE_BAR: 막대 분수 렌더러 (fail-closed)
 * @param {Object} spec
 * @returns {string} SVG HTML
 */
export function renderPartWholeBar(spec) {
  const normSpec = normalizeFractionRepresentationSpec({ ...spec, type: spec.type || "PART_WHOLE_BAR" });
  const denom = normSpec.denominator;
  const num = normSpec.numerator;
  const width = normSpec.width || 320;
  const height = normSpec.height || 64;
  const padding = 10;
  const barWidth = width - padding * 2;
  const barHeight = height - padding * 2;
  const partWidth = barWidth / denom;

  const patternId = `bar_hatch_${denom}_${num}_${Math.abs(width * 31 + height)}`;
  const accessibleDesc = normSpec.ariaLabel || getFractionAccessibleDescription({
    type: "PART_WHOLE_BAR",
    numerator: num,
    denominator: denom,
    wholeNumber: normSpec.wholeNumber
  });

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
 * PART_WHOLE_GRID: 격자 분수 렌더러 (fail-closed)
 * @param {Object} spec
 * @returns {string} SVG HTML
 */
export function renderPartWholeGrid(spec) {
  const normSpec = normalizeFractionRepresentationSpec({ ...spec, type: spec.type || "PART_WHOLE_GRID" });
  const rows = normSpec.rows;
  const cols = normSpec.cols;
  const denom = normSpec.denominator;
  const num = normSpec.numerator;

  const width = normSpec.width || 240;
  const height = normSpec.height || 120;
  const padding = 10;
  const gridWidth = width - padding * 2;
  const gridHeight = height - padding * 2;
  const cellWidth = gridWidth / cols;
  const cellHeight = gridHeight / rows;

  const patternId = `grid_hatch_${rows}_${cols}_${num}`;
  const accessibleDesc = normSpec.ariaLabel || getFractionAccessibleDescription({
    type: "PART_WHOLE_GRID",
    denominator: denom,
    numerator: num,
    wholeNumber: normSpec.wholeNumber
  });

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
 * NUMBER_LINE: 수직선 분수 렌더러 (fail-closed)
 * @param {Object} spec
 * @returns {string} SVG HTML
 */
export function renderNumberLine(spec) {
  const normSpec = normalizeFractionRepresentationSpec({ ...spec, type: spec.type || "NUMBER_LINE" });
  const maxVal = normSpec.maxVal;
  const denom = normSpec.denominator;
  const num = normSpec.numerator;
  const whole = normSpec.wholeNumber;
  const targetVal = normSpec.targetVal;

  const width = normSpec.width || 340;
  const height = normSpec.height || 90;
  const paddingX = 30;
  const paddingY = 45;
  const axisY = paddingY;
  const lineStartX = paddingX;
  const lineEndX = width - paddingX;
  const lineWidth = lineEndX - lineStartX;

  const totalSteps = maxVal * denom;
  const stepWidth = lineWidth / totalSteps;

  const accessibleDesc = normSpec.ariaLabel || getFractionAccessibleDescription({
    type: "NUMBER_LINE",
    denominator: denom,
    numerator: num,
    wholeNumber: whole
  });

  let ticksSvg = "";
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

  const markerX = lineStartX + (targetVal * denom) * stepWidth;
  const markerLabel = normSpec.markerLabel || "▼";

  let markerSvg = "";
  if (normSpec.showMarker !== false && markerX >= lineStartX && markerX <= lineEndX + 1) {
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
        <line x1="${lineStartX}" y1="${axisY}" x2="${lineEndX}" y2="${axisY}" stroke="#202124" stroke-width="2.5" />
        ${ticksSvg}
        ${markerSvg}
      </svg>
    </div>
  `;
}

/**
 * EQUIVALENT_PAIR: 동치 분수 쌍 시각 렌더러 (fail-closed)
 * @param {Object} spec
 * @returns {string} HTML
 */
export function renderEquivalentPair(spec) {
  const normSpec = normalizeFractionRepresentationSpec({ ...spec, type: spec.type || "EQUIVALENT_PAIR" });
  const pair1 = normSpec.pair1;
  const pair2 = normSpec.pair2;

  const desc1 = getFractionAccessibleDescription(pair1);
  const desc2 = getFractionAccessibleDescription(pair2);
  const accessibleDesc = normSpec.ariaLabel || `크기가 같은 두 분수 비교: ${desc1}와 ${desc2}`;

  const renderSingle = (p) => {
    if (p.type === "PART_WHOLE_GRID") return renderPartWholeGrid({ ...p, width: normSpec.width || 280, height: 60 });
    if (p.type === "NUMBER_LINE") return renderNumberLine({ ...p, width: normSpec.width || 320, height: 70 });
    return renderPartWholeBar({ ...p, width: normSpec.width || 320, height: 50 });
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
 * SYMBOLIC_FRACTION: 기호 분수 표기 렌더러 (HTML/CSS, fail-closed)
 * @param {Object} spec
 * @returns {string} HTML
 */
export function renderSymbolicFraction(spec) {
  const normSpec = normalizeFractionRepresentationSpec({ ...spec, type: spec.type || "SYMBOLIC_FRACTION" });
  const denom = normSpec.denominator;
  const num = normSpec.numerator;
  const whole = normSpec.wholeNumber;
  const accessibleDesc = normSpec.ariaLabel || getFractionAccessibleDescription({
    type: "SYMBOLIC_FRACTION",
    numerator: num,
    denominator: denom,
    wholeNumber: whole
  });

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
 * 분수 연산(덧셈, 뺄셈, 통분) 시각화 렌더러 (순수 SVG, pointer-events: none, role="img")
 * @param {Object} spec - { type, f1, f2, result, converted1, converted2 }
 * @returns {string} SVG HTML 문자열
 */
export function renderFractionOperationSVG(spec) {
  const f1 = spec.f1 || { numerator: 1, denominator: 2, wholeNumber: 0 };
  const f2 = spec.f2 || { numerator: 1, denominator: 2, wholeNumber: 0 };
  const res = spec.result || { numerator: 1, denominator: 1, wholeNumber: 0 };

  const opKey = String(spec.type || "op").toLowerCase();
  const patternId = `${opKey}_hatch_${f1.numerator}_${f1.denominator}_${f2.numerator}_${f2.denominator}`;
  const defs = createHatchPatternDef(patternId);

  const s1 = `${f1.wholeNumber ? f1.wholeNumber + ' ' : ''}${f1.numerator}/${f1.denominator}`;
  const s2 = `${f2.wholeNumber ? f2.wholeNumber + ' ' : ''}${f2.numerator}/${f2.denominator}`;

  let ariaLabel = "";
  let innerSvg = "";

  if (spec.type === "FRACTION_OPERATION_ADD") {
    ariaLabel = `분수 덧셈 시각화: ${s1} 더하기 ${s2}`;
    const barWidth = 120;
    const barHeight = 24;

    // Bar 1
    const p1Width = barWidth / f1.denominator;
    let segs1 = "";
    for (let i = 0; i < f1.denominator; i++) {
      const isFilled = i < f1.numerator;
      segs1 += `<rect x="${i * p1Width}" y="0" width="${p1Width}" height="${barHeight}" fill="${isFilled ? '#1a73e8' : '#f8f9fa'}" stroke="#70757a" stroke-width="1" />`;
    }

    // Bar 2
    const p2Width = barWidth / f2.denominator;
    let segs2 = "";
    for (let i = 0; i < f2.denominator; i++) {
      const isFilled = i < f2.numerator;
      segs2 += `<rect x="${i * p2Width}" y="0" width="${p2Width}" height="${barHeight}" fill="${isFilled ? '#34a853' : '#f8f9fa'}" stroke="#70757a" stroke-width="1" />`;
    }

    innerSvg = `
      <g transform="translate(10, 10)">
        <g transform="translate(0, 0)">
          <text x="${barWidth / 2}" y="-4" text-anchor="middle" font-size="12" font-weight="bold" fill="#202124">${escapeAttr(s1)}</text>
          ${segs1}
        </g>
        <text x="140" y="16" text-anchor="middle" font-size="18" font-weight="bold" fill="#5f6368">+</text>
        <g transform="translate(160, 0)">
          <text x="${barWidth / 2}" y="-4" text-anchor="middle" font-size="12" font-weight="bold" fill="#202124">${escapeAttr(s2)}</text>
          ${segs2}
        </g>
      </g>
    `;
  } else if (spec.type === "FRACTION_OPERATION_SUB") {
    ariaLabel = `분수 뺄셈 시각화: ${s1} 빼기 ${s2}`;
    const barWidth = 180;
    const barHeight = 28;
    const pWidth = barWidth / f1.denominator;

    let segs = "";
    for (let i = 0; i < f1.denominator; i++) {
      const isOriginal = i < f1.numerator;
      const isSubtracted = i >= (f1.numerator - f2.numerator) && i < f1.numerator;
      let fill = "#f8f9fa";
      if (isSubtracted) {
        fill = `url(#${patternId})`;
      } else if (isOriginal) {
        fill = "#1a73e8";
      }
      segs += `<rect x="${i * pWidth}" y="0" width="${pWidth}" height="${barHeight}" fill="${fill}" stroke="#70757a" stroke-width="1" />`;
      if (isSubtracted) {
        // 차감 표시 사선
        segs += `<line x1="${i * pWidth}" y1="0" x2="${(i + 1) * pWidth}" y2="${barHeight}" stroke="#d93025" stroke-width="2" />`;
      }
    }

    innerSvg = `
      <g transform="translate(10, 15)">
        <text x="${barWidth / 2}" y="-4" text-anchor="middle" font-size="12" font-weight="bold" fill="#202124">${escapeAttr(s1)} - ${escapeAttr(s2)}</text>
        ${segs}
      </g>
    `;
  } else {
    // FRACTION_COMMON_DENOMINATOR
    const c1 = spec.converted1 || f1;
    const c2 = spec.converted2 || f2;
    ariaLabel = `분수 통분 시각화: ${s1}과 ${s2}의 공통분모 비교`;

    innerSvg = `
      <g transform="translate(10, 15)">
        <text x="140" y="0" text-anchor="middle" font-size="13" font-weight="bold" fill="#202124">공통분모 통분: ${c1.denominator}</text>
        <g transform="translate(0, 15)">
          <text x="50" y="16" text-anchor="middle" font-size="12" fill="#1a73e8" font-weight="bold">${escapeAttr(s1)} = ${c1.numerator}/${c1.denominator}</text>
          <text x="210" y="16" text-anchor="middle" font-size="12" fill="#34a853" font-weight="bold">${escapeAttr(s2)} = ${c2.numerator}/${c2.denominator}</text>
        </g>
      </g>
    `;
  }

  return `
    <div class="fraction-operation-visual-container" style="display: flex; justify-content: center; margin: 12px 0; pointer-events: none;">
      <svg role="img" aria-label="${escapeAttr(ariaLabel)}" width="320" height="70" viewBox="0 0 320 70" xmlns="http://www.w3.org/2000/svg" style="pointer-events: none; max-width: 100%;">
        ${defs}
        ${innerSvg}
      </svg>
    </div>
  `.trim();
}

/**
 * 범용 분수 시각 표현 진입점 (fail-closed)
 * @param {Object} activityOrSpec - Activity 객체(activity.metadata.fractionRepresentation) 또는 시각화 spec
 * @returns {string} HTML 문자열
 */
export function renderFractionRepresentation(activityOrSpec) {
  if (!activityOrSpec) return "";

  // 1. Activity 객체에 fractionRepresentation 또는 fractionOperation 메타데이터가 명시된 경우
  let spec = activityOrSpec.metadata?.fractionRepresentation ||
             activityOrSpec.metadata?.fractionOperation ||
             activityOrSpec.fractionRepresentation ||
             activityOrSpec.fractionOperation;

  // 2. spec 객체가 직접 전달된 경우
  if (!spec) {
    // Activity/Question 객체이면서 분수 시각화 메타데이터가 없는 일반 액티비티는 시각화 없음
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

  const normSpec = normalizeFractionRepresentationSpec(spec);

  switch (normSpec.type) {
    case "PART_WHOLE_BAR":
      return renderPartWholeBar(normSpec);
    case "PART_WHOLE_GRID":
      return renderPartWholeGrid(normSpec);
    case "NUMBER_LINE":
      return renderNumberLine(normSpec);
    case "EQUIVALENT_PAIR":
      return renderEquivalentPair(normSpec);
    case "SYMBOLIC_FRACTION":
      return renderSymbolicFraction(normSpec);
    case "FRACTION_OPERATION_ADD":
    case "FRACTION_OPERATION_SUB":
    case "FRACTION_COMMON_DENOMINATOR":
      return renderFractionOperationSVG(normSpec);
    default:
      throw new Error(`지원되지 않는 분수 시각화 타입입니다: ${normSpec.type}`);
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

