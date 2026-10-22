//+_+// Math Canvas Pro - Phase F11 Measurement Unit Catalog 모듈
//+_+// SSOT UNIFIED_CURRICULUM_ACTIVITY_PLATFORM_v2.2 및 Phase F11 명세 준수
//+_+// - 정적 unit-catalog.json 데이터 정규화, 무결성 검증 및 단위 변환 관계 연산

/**
 * Unit Catalog 유효성 검증 함수 (순수 함수)
 * @param {Object} catalog
 * @param {Object} [options]
 * @param {Object} [options.manifest]
 * @param {Object} [options.curriculum]
 */
export function validateUnitCatalog(catalog, options = {}) {
  if (!catalog || typeof catalog !== "object") {
    throw new TypeError("유효하지 않은 unit catalog 데이터입니다.");
  }

  if (Number(catalog.schemaVersion) !== 1) {
    throw new Error(`지원되지 않는 catalog schemaVersion입니다: ${catalog.schemaVersion}`);
  }

  const manifest = options.manifest;
  if (manifest) {
    if (catalog.packageId && catalog.packageId !== manifest.packageId) {
      throw new Error(`catalog packageId(${catalog.packageId})가 manifest packageId(${manifest.packageId})와 불일치합니다.`);
    }
    if (manifest.packageVersion && catalog.packageVersion && catalog.packageVersion !== manifest.packageVersion) {
      throw new Error(`catalog packageVersion(${catalog.packageVersion})가 manifest packageVersion(${manifest.packageVersion})와 불일치합니다.`);
    }
  }

  if (!Number.isInteger(catalog.catalogVersion) || catalog.catalogVersion < 1) {
    throw new Error(`catalogVersion은 1 이상의 정수여야 합니다: ${catalog.catalogVersion}`);
  }

  if (!Array.isArray(catalog.dimensions) || catalog.dimensions.length === 0) {
    throw new Error("dimensions는 비어있지 않은 배열이어야 합니다.");
  }

  const seenDimensionIds = new Set();
  const dimensionMap = new Map();

  for (const dim of catalog.dimensions) {
    if (!dim.dimensionId || typeof dim.dimensionId !== "string" || !dim.dimensionId.trim()) {
      throw new Error("dimensionId는 비어있지 않은 문자열이어야 합니다.");
    }
    if (seenDimensionIds.has(dim.dimensionId)) {
      throw new Error(`중복된 dimensionId가 존재합니다: ${dim.dimensionId}`);
    }
    seenDimensionIds.add(dim.dimensionId);

    if (!Array.isArray(dim.units) || dim.units.length === 0) {
      throw new Error(`dimension(${dim.dimensionId})의 units는 비어있지 않은 배열이어야 합니다.`);
    }

    const seenUnitIds = new Set();
    let baseFactorOneCount = 0;
    const dimUnits = new Map();

    for (const u of dim.units) {
      if (!u.unitId || typeof u.unitId !== "string" || !u.unitId.trim()) {
        throw new Error(`dimension(${dim.dimensionId})에 유효하지 않은 unitId가 있습니다.`);
      }
      if (seenUnitIds.has(u.unitId)) {
        throw new Error(`dimension(${dim.dimensionId}) 내에 중복된 unitId가 존재합니다: ${u.unitId}`);
      }
      seenUnitIds.add(u.unitId);

      if (!u.symbol || typeof u.symbol !== "string" || !u.symbol.trim()) {
        throw new Error(`단위(${u.unitId})의 symbol은 비어있지 않은 문자열이어야 합니다.`);
      }

      if (!Number.isInteger(u.baseFactor) || u.baseFactor <= 0) {
        throw new Error(`단위(${u.unitId})의 baseFactor는 양의 정수여야 합니다: ${u.baseFactor}`);
      }
      if (u.baseFactor === 1) {
        baseFactorOneCount += 1;
      }
      dimUnits.set(u.unitId, u);
    }

    if (baseFactorOneCount !== 1) {
      throw new Error(`dimension(${dim.dimensionId})에는 baseFactor=1인 기준 단위가 정확히 1개 존재해야 합니다 (현재: ${baseFactorOneCount}).`);
    }

    dimensionMap.set(dim.dimensionId, dimUnits);
  }

  // generatorProfiles 검증 (있는 경우)
  if (Array.isArray(catalog.generatorProfiles)) {
    const curriculumSkills = options.curriculum?.skills;
    const validSkillIds = Array.isArray(curriculumSkills) ? new Set(curriculumSkills.map((s) => s.skillId)) : null;
    const skillById = Array.isArray(curriculumSkills) ? new Map(curriculumSkills.map((s) => [s.skillId, s])) : null;
    const seenProfileSkills = new Set();

    for (const profile of catalog.generatorProfiles) {
      if (!profile.skillId || typeof profile.skillId !== "string") {
        throw new Error("generatorProfile에 유효한 skillId가 필요합니다.");
      }
      if (seenProfileSkills.has(profile.skillId)) {
        throw new Error(`중복된 generatorProfile skillId입니다: ${profile.skillId}`);
      }
      seenProfileSkills.add(profile.skillId);
      if (validSkillIds && !validSkillIds.has(profile.skillId)) {
        throw new Error(`generatorProfile의 skillId(${profile.skillId})가 curriculum에 존재하지 않습니다.`);
      }
      if (!Array.isArray(profile.achievementStandardIds) || profile.achievementStandardIds.length === 0 ||
          profile.achievementStandardIds.some((id) => typeof id !== "string" || !id.trim())) {
        throw new Error(`generatorProfile(${profile.skillId})의 성취기준 ID가 필요합니다.`);
      }
      if (skillById && JSON.stringify(profile.achievementStandardIds) !== JSON.stringify(skillById.get(profile.skillId)?.achievementStandardIds)) {
        throw new Error(`generatorProfile(${profile.skillId})의 성취기준 ID가 Skill과 불일치합니다.`);
      }
      if (!profile.dimensionId || !dimensionMap.has(profile.dimensionId)) {
        throw new Error(`generatorProfile의 dimensionId(${profile.dimensionId})가 catalog에 존재하지 않습니다.`);
      }
      if (profile.allowDecimals === true || profile.decimalPolicy) {
        throw new Error(`F11에서는 소수 변환 profile을 지원하지 않습니다 (${profile.skillId}).`);
      }

      if (!Array.isArray(profile.allowedPairs) || profile.allowedPairs.length === 0) {
        throw new Error(`generatorProfile(${profile.skillId})의 allowedPairs는 비어있지 않은 배열이어야 합니다.`);
      }

      const dimUnits = dimensionMap.get(profile.dimensionId);
      const seenPairs = new Set();

      for (const pair of profile.allowedPairs) {
        if (!dimUnits.has(pair.sourceUnitId)) {
          throw new Error(`pair의 sourceUnitId(${pair.sourceUnitId})가 dimension(${profile.dimensionId})에 존재하지 않습니다.`);
        }
        if (!dimUnits.has(pair.targetUnitId)) {
          throw new Error(`pair의 targetUnitId(${pair.targetUnitId})가 dimension(${profile.dimensionId})에 존재하지 않습니다.`);
        }
        if (pair.sourceUnitId === pair.targetUnitId) {
          throw new Error(`sourceUnitId와 targetUnitId는 같을 수 없습니다: ${pair.sourceUnitId}`);
        }
        const pairKey = `${pair.sourceUnitId}->${pair.targetUnitId}`;
        if (seenPairs.has(pairKey)) {
          throw new Error(`중복된 conversion pair입니다: ${pairKey}`);
        }
        seenPairs.add(pairKey);
      }
    }
  }

  return true;
}

/**
 * Unit Catalog 정규화 인스턴스 생성
 */
export function normalizeUnitCatalog(rawCatalog, options = {}) {
  validateUnitCatalog(rawCatalog, options);

  const dimensionMap = new Map();
  const allUnitsMap = new Map();

  for (const dim of rawCatalog.dimensions) {
    const unitsMap = new Map();
    for (const u of dim.units) {
      const normalizedUnit = Object.freeze({
        unitId: u.unitId,
        symbol: u.symbol,
        name: u.name || u.symbol,
        baseFactor: u.baseFactor,
        dimensionId: dim.dimensionId
      });
      unitsMap.set(u.unitId, normalizedUnit);
      allUnitsMap.set(`${dim.dimensionId}:${u.unitId}`, normalizedUnit);
    }

    dimensionMap.set(dim.dimensionId, Object.freeze({
      dimensionId: dim.dimensionId,
      name: dim.name || dim.dimensionId,
      units: dim.units.map((u) => unitsMap.get(u.unitId)),
      unitsMap
    }));
  }

  const profilesMap = new Map();
  if (Array.isArray(rawCatalog.generatorProfiles)) {
    for (const p of rawCatalog.generatorProfiles) {
      profilesMap.set(p.skillId, Object.freeze({ ...p }));
    }
  }

  return Object.freeze({
    schemaVersion: rawCatalog.schemaVersion,
    packageId: rawCatalog.packageId,
    packageVersion: rawCatalog.packageVersion,
    catalogVersion: rawCatalog.catalogVersion,
    dimensions: Array.from(dimensionMap.values()),
    dimensionMap,
    allUnitsMap,
    generatorProfiles: Array.from(profilesMap.values()),
    profilesMap
  });
}

/**
 * 특정 차원(dimension) 조회
 */
export function getDimension(catalog, dimensionId) {
  if (!catalog || !dimensionId) return null;
  if (catalog.dimensionMap instanceof Map) {
    return catalog.dimensionMap.get(dimensionId) || null;
  }
  const dim = (catalog.dimensions || []).find((d) => d.dimensionId === dimensionId);
  return dim || null;
}

/**
 * 특정 단위(unit) 조회
 */
export function getUnit(catalog, dimensionId, unitId) {
  const dim = getDimension(catalog, dimensionId);
  if (!dim) return null;
  if (dim.unitsMap instanceof Map) {
    return dim.unitsMap.get(unitId) || null;
  }
  return (dim.units || []).find((u) => u.unitId === unitId) || null;
}

/**
 * 단위 변환 계산: sourceValue * sourceUnit.baseFactor = expectedAnswer * targetUnit.baseFactor
 */
export function convertValue(sourceValue, sourceUnitId, targetUnitId, dimensionId, catalog) {
  if (!Number.isInteger(sourceValue) || sourceValue <= 0) {
    throw new Error(`sourceValue는 양의 정수여야 합니다: ${sourceValue}`);
  }
  const sourceUnit = getUnit(catalog, dimensionId, sourceUnitId);
  if (!sourceUnit) {
    throw new Error(`sourceUnit(${sourceUnitId})을 dimension(${dimensionId})에서 찾을 수 없습니다.`);
  }
  const targetUnit = getUnit(catalog, dimensionId, targetUnitId);
  if (!targetUnit) {
    throw new Error(`targetUnit(${targetUnitId})을 dimension(${dimensionId})에서 찾을 수 없습니다.`);
  }

  const totalBaseUnits = sourceValue * sourceUnit.baseFactor;
  if (totalBaseUnits % targetUnit.baseFactor !== 0) {
    throw new Error(`정수로 나누어떨어지지 않는 단위 변환입니다: ${sourceValue} ${sourceUnit.symbol} -> ${targetUnit.symbol}`);
  }

  return totalBaseUnits / targetUnit.baseFactor;
}

/**
 * 정수 단위 변환 가능 여부 확인
 */
export function checkIntegerConversion(sourceValue, sourceUnitId, targetUnitId, dimensionId, catalog) {
  if (!Number.isInteger(sourceValue) || sourceValue <= 0) return false;
  const sourceUnit = getUnit(catalog, dimensionId, sourceUnitId);
  const targetUnit = getUnit(catalog, dimensionId, targetUnitId);
  if (!sourceUnit || !targetUnit) return false;
  return (sourceValue * sourceUnit.baseFactor) % targetUnit.baseFactor === 0;
}

/**
 * 특정 스킬에 해당하는 generatorProfile 조회
 */
export function getProfileForSkill(catalog, skillId) {
  if (!catalog || !skillId) return null;
  if (catalog.profilesMap instanceof Map) {
    return catalog.profilesMap.get(skillId) || null;
  }
  return (catalog.generatorProfiles || []).find((p) => p.skillId === skillId) || null;
}
