//+_+// Math Canvas Pro - Phase F11 Deterministic Unit Conversion Generator
//+_+// SSOT UNIFIED_CURRICULUM_ACTIVITY_PLATFORM_v2.2 및 Phase F11 명세 준수
//+_+// - Unit Catalog 기반 결정론적 LearningActivity (TEXT) 생성기
//+_+// - 정수 변환만 지원, 음수/0/소수/cross-dimension 배제, 세션 내 문제 중복 방지

import { ActivityType, ResponseType, GradingMode, SourceType, ReviewStatus, normalizeLearningActivity } from "./learningActivity.js";
import { normalizeUnitCatalog, getProfileForSkill, getUnit, convertValue, checkIntegerConversion } from "./measurementUnitCatalog.js";

/**
 * 결정론적 의사 난수 생성기 (Mulberry32)
 */
function createMulberry32(seed) {
  let s = Number(seed) >>> 0;
  return function next() {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 문자열 또는 숫자 시드를 안정적인 32비트 정수로 해싱 (FNV-1a)
 */
export function hashSeed(seed) {
  if (typeof seed === "number" && Number.isInteger(seed)) {
    return seed >>> 0;
  }
  const str = String(seed ?? "default-seed");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/**
 * 정수 범위 내의 난수 선택 [min, max]
 */
function randomInt(rng, min, max) {
  const range = max - min + 1;
  return Math.floor(rng() * range) + min;
}

/**
 * 단위 변환 학습 활동 배열 결정론적 생성
 * @param {Object} params
 * @param {string} params.skillId - 생성 대상 스킬 ID
 * @param {number} [params.count=20] - 생성 문제 수
 * @param {string|number} [params.seed] - 결정론적 시드
 * @param {Object} params.unitCatalog - Unit Catalog 객체
 * @param {Object} [params.packageMetadata] - 패키지 메타데이터 ({ packageId, packageVersion })
 * @returns {Array<Object>} LearningActivity 객체 배열
 */
export function generateUnitConversionActivities({
  skillId,
  count = 20,
  seed = 42,
  unitCatalog,
  packageMetadata = null
}) {
  if (!skillId || typeof skillId !== "string") {
    throw new Error("유효한 skillId가 필요합니다.");
  }
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`count는 양의 정수여야 합니다: ${count}`);
  }
  if (!unitCatalog || typeof unitCatalog !== "object") {
    throw new Error("유효한 unitCatalog 객체가 필요합니다.");
  }

  const catalog = unitCatalog.dimensionMap instanceof Map
    ? unitCatalog
    : normalizeUnitCatalog(unitCatalog);

  const profile = getProfileForSkill(catalog, skillId);
  if (!profile) {
    throw new Error(`지원되지 않거나 catalog에 등록되지 않은 skillId입니다: ${skillId}`);
  }

  const seedInt = hashSeed(seed);
  const rng = createMulberry32(seedInt);

  const allowedPairs = profile.allowedPairs;
  if (!Array.isArray(allowedPairs) || allowedPairs.length === 0) {
    throw new Error(`skillId(${skillId})에 허용된 변환 단위 쌍이 없습니다.`);
  }

  const dimId = profile.dimensionId;
  const isToSmaller = profile.direction === "to_smaller";

  const activities = [];
  const seenQuestionKeys = new Set();
  const maxAttempts = count * 200;
  let attempts = 0;

  while (activities.length < count && attempts < maxAttempts) {
    attempts += 1;

    // 1. 변환 단위 쌍 선택
    const pairIndex = Math.floor(rng() * allowedPairs.length);
    const pair = allowedPairs[pairIndex];
    const sourceUnit = getUnit(catalog, dimId, pair.sourceUnitId);
    const targetUnit = getUnit(catalog, dimId, pair.targetUnitId);

    if (!sourceUnit || !targetUnit) continue;

    let sourceValue = 0;
    let expectedAnswer = 0;

    if (isToSmaller) {
      // 큰 단위 -> 작은 단위: sourceValue는 정수
      // ratio = sourceUnit.baseFactor / targetUnit.baseFactor (정수 >= 10)
      const ratio = sourceUnit.baseFactor / targetUnit.baseFactor;
      if (!Number.isInteger(ratio) || ratio <= 1) continue;

      const minVal = profile.sourceRange?.min || 1;
      const maxVal = profile.sourceRange?.max || (ratio >= 1000000 ? 5 : (ratio >= 1000 ? 20 : 50));
      sourceValue = randomInt(rng, minVal, maxVal);
      expectedAnswer = convertValue(sourceValue, pair.sourceUnitId, pair.targetUnitId, dimId, catalog);
    } else {
      // 작은 단위 -> 큰 단위: expectedAnswer가 정수가 되도록 multiplier(k) 생성
      // ratio = targetUnit.baseFactor / sourceUnit.baseFactor (정수 >= 10)
      const ratio = targetUnit.baseFactor / sourceUnit.baseFactor;
      if (!Number.isInteger(ratio) || ratio <= 1) continue;

      const minMult = profile.multiplierRange?.min || 1;
      const maxMult = profile.multiplierRange?.max || 50;
      const k = randomInt(rng, minMult, maxMult);
      sourceValue = k * ratio;
      expectedAnswer = k;
    }

    // 검증: 양의 정수 및 수학적 관계
    if (sourceValue <= 0 || expectedAnswer <= 0) continue;
    if (!Number.isInteger(sourceValue) || !Number.isInteger(expectedAnswer)) continue;

    // 수학적 공식 완전 검증: sourceValue * sourceUnit.baseFactor === expectedAnswer * targetUnit.baseFactor
    if (sourceValue * sourceUnit.baseFactor !== expectedAnswer * targetUnit.baseFactor) {
      throw new Error(`수학적 무결성 위반: ${sourceValue} * ${sourceUnit.baseFactor} !== ${expectedAnswer} * ${targetUnit.baseFactor}`);
    }

    // 동일 세션 내 중복 문제 방지
    const questionKey = `${dimId}:${pair.sourceUnitId}:${sourceValue}->${pair.targetUnitId}`;
    if (seenQuestionKeys.has(questionKey)) {
      continue;
    }
    seenQuestionKeys.add(questionKey);

    const index = activities.length;
    const catVer = catalog.catalogVersion || 1;
    const activityId = `act_meas_${skillId.toLowerCase()}_v${catVer}_${seedInt}_${index + 1}`;
    const prompt = `${sourceValue} ${sourceUnit.symbol} = ___ ${targetUnit.symbol}`;

    let explanation = "";
    if (isToSmaller) {
      const ratio = sourceUnit.baseFactor / targetUnit.baseFactor;
      explanation = `1 ${sourceUnit.symbol} = ${ratio} ${targetUnit.symbol}이므로, ${sourceValue} ${sourceUnit.symbol} = ${expectedAnswer} ${targetUnit.symbol}입니다.`;
    } else {
      const ratio = targetUnit.baseFactor / sourceUnit.baseFactor;
      explanation = `${ratio} ${sourceUnit.symbol} = 1 ${targetUnit.symbol}이므로, ${sourceValue} ${sourceUnit.symbol} = ${expectedAnswer} ${targetUnit.symbol}입니다.`;
    }

    const pkgId = packageMetadata?.packageId || catalog.packageId || "math-measurement-v1";
    const pkgVer = packageMetadata?.packageVersion || catalog.packageVersion || "1.0.0";

    const rawActivity = {
      id: activityId,
      version: 1,
      subjectId: "math",
      courseId: "measurement",
      moduleId: "measurement",
      unitId: dimId,
      skillId,
      activityType: ActivityType.SHORT_ANSWER,
      responseType: ResponseType.TEXT,
      gradingMode: GradingMode.GUARDIAN_MANUAL,
      prompt,
      expectedAnswer: String(expectedAnswer),
      achievementStandardIds: profile.achievementStandardIds,
      explanation,
      orderNumber: index + 1,
      level: skillId,
      sourceMetadata: {
        sourceType: SourceType.PROJECT_OWNED,
        sourceId: "generator:measurement-unit-v1",
        license: "PROJECT_OWNED",
        attribution: "Math Canvas Pro",
        reviewStatus: ReviewStatus.VERIFIED
      },
      metadata: {
        generatorId: "measurement-unit-generator-v1",
        generatorVersion: "1.0.0",
        packageId: pkgId,
        packageVersion: pkgVer,
        unitCatalogVersion: catVer,
        dimensionId: dimId,
        sourceUnitId: pair.sourceUnitId,
        targetUnitId: pair.targetUnitId,
        sourceValue,
        seed: seedInt,
        generationKey: `${skillId}:v${catVer}:${seedInt}:${index + 1}`
      }
    };

    activities.push(normalizeLearningActivity(rawActivity));
  }

  if (activities.length < count) {
    throw new Error(`요청된 문제 수(${count})를 중복 없이 생성하지 못했습니다 (생성된 수: ${activities.length}).`);
  }

  return activities;
}
