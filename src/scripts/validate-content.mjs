//+_+// Phase F10B: Static Content Package 검증 스크립트
//+_+// SSOT UNIFIED_CURRICULUM_ACTIVITY_PLATFORM_v2.2 및 Phase F10B 명세 준수
//+_+// - registry.json, manifest.json, curriculum.json, activities.json 구조 및 무결성 검증

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTENT_ROOT = path.resolve(__dirname, "../public/app/content");

const VALID_SUBJECTS = new Set(["math", "korean", "english"]);
const VALID_ACTIVITY_TYPES = new Set(["SHORT_ANSWER", "MULTIPLE_CHOICE", "ARITHMETIC"]);
const VALID_RESPONSE_TYPES = new Set(["CANVAS", "TEXT", "CHOICE"]);
const VALID_SOURCE_TYPES = new Set(["INTERNAL_FIXTURE", "PROJECT_OWNED", "EXTERNAL", "ARITHMETIC_GENERATOR"]);
const VALID_REVIEW_STATUSES = new Set(["INTERNAL", "DRAFT", "VERIFIED"]);

let errors = [];

function recordError(msg) {
  errors.push(msg);
  console.error(`❌ ${msg}`);
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    recordError(`파일이 존재하지 않습니다: ${filePath}`);
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    recordError(`JSON 파싱 실패: ${filePath} (${err.message})`);
    return null;
  }
}

export function validateAllContent(contentRoot = CONTENT_ROOT) {
  errors = [];
  console.log(`🔍 [Phase F10B] Content Package 유효성 검증 시작 (${contentRoot})...`);

  const registryPath = path.join(contentRoot, "registry.json");
  const registry = readJsonFile(registryPath);
  if (!registry) {
    return { valid: false, errors };
  }

  if (registry.schemaVersion !== 1) {
    recordError(`registry.json: schemaVersion은 1이어야 합니다 (현재: ${registry.schemaVersion})`);
  }
  if (!Array.isArray(registry.packages)) {
    recordError("registry.json: packages는 배열이어야 합니다.");
    return { valid: false, errors };
  }

  const seenPackageIds = new Set();

  for (const pkgEntry of registry.packages) {
    const pkgId = pkgEntry.packageId || pkgEntry.id;
    if (!pkgId || seenPackageIds.has(pkgId)) {
      recordError(`registry.json: 패키지 ID 누락 또는 중복: ${pkgId}`);
    }
    seenPackageIds.add(pkgId);

    if (typeof pkgEntry.enabled !== "boolean") {
      recordError(`registry.json: 패키지 ${pkgId}의 enabled 필드는 boolean이어야 합니다.`);
    }

    const relManifestPath = pkgEntry.manifestPath || pkgEntry.path;
    if (!relManifestPath) {
      recordError(`registry.json: 패키지 ${pkgId}의 manifestPath가 누락되었습니다.`);
      continue;
    }

    const manifestPath = path.resolve(contentRoot, relManifestPath);
    const packageDir = path.dirname(manifestPath);
    const manifest = readJsonFile(manifestPath);
    if (!manifest) continue;

    // Manifest 검증
    const manifestPkgId = manifest.packageId || manifest.id;
    if (manifestPkgId !== pkgId) {
      recordError(`manifest.json: 패키지 ID 불일치 (registry: ${pkgId}, manifest: ${manifestPkgId})`);
    }
    const expectedPkgVer = pkgEntry.packageVersion || pkgEntry.version;
    const manifestPkgVer = manifest.packageVersion || manifest.version;
    if (!manifestPkgVer) {
      recordError(`manifest.json: 패키지 ${manifestPkgId}의 version이 누락되었습니다.`);
    } else if (expectedPkgVer && manifestPkgVer !== expectedPkgVer) {
      recordError(`manifest.json: 패키지 버전 불일치 (registry: ${expectedPkgVer}, manifest: ${manifestPkgVer})`);
    }

    // Source Policy 검증
    if (!manifest.sourcePolicy || typeof manifest.sourcePolicy !== "object") {
      recordError(`manifest.json: 패키지 ${manifestPkgId}의 sourcePolicy 객체가 누락되었습니다.`);
    } else {
      const defaultLicense = String(manifest.sourcePolicy.defaultLicense || manifest.sourcePolicy.license || "").trim();
      if (!defaultLicense) {
        recordError(`manifest.json: 패키지 ${manifestPkgId}의 sourcePolicy license는 비어있지 않아야 합니다.`);
      }
      if (manifest.sourcePolicy.defaultSourceType && !VALID_SOURCE_TYPES.has(manifest.sourcePolicy.defaultSourceType)) {
        recordError(`manifest.json: 패키지 ${manifestPkgId}의 defaultSourceType이 유효하지 않습니다: ${manifest.sourcePolicy.defaultSourceType}`);
      }
      if (manifest.sourcePolicy.defaultReviewStatus && !VALID_REVIEW_STATUSES.has(manifest.sourcePolicy.defaultReviewStatus)) {
        recordError(`manifest.json: 패키지 ${manifestPkgId}의 defaultReviewStatus가 유효하지 않습니다: ${manifest.sourcePolicy.defaultReviewStatus}`);
      }
    }

    // Curriculum 검증
    const curriculumRel = manifest.files?.curriculum || manifest.curriculumPath || "curriculum.json";
    const curriculumPath = path.resolve(packageDir, curriculumRel);
    const curriculum = readJsonFile(curriculumPath);
    const registeredSkillIds = new Set();

    if (curriculum) {
      if (curriculum.packageId && curriculum.packageId !== manifestPkgId) {
        recordError(`curriculum.json: packageId 불일치 (manifest: ${manifestPkgId}, curriculum: ${curriculum.packageId})`);
      }
      if (!Array.isArray(curriculum.skills)) {
        recordError(`curriculum.json: 패키지 ${manifestPkgId}의 skills는 배열이어야 합니다.`);
      } else {
        for (const skill of curriculum.skills) {
          const sId = skill.skillId || skill.id;
          if (!sId || registeredSkillIds.has(sId)) {
            recordError(`curriculum.json: 스킬 ID 누락 또는 중복 (${manifestPkgId}): ${sId}`);
          }
          registeredSkillIds.add(sId);

          if (!VALID_SUBJECTS.has(String(skill.subjectId).toLowerCase())) {
            recordError(`curriculum.json: 알 수 없는 subjectId (${sId}): ${skill.subjectId}`);
          }
          if (typeof skill.difficulty !== "number" || skill.difficulty < 1 || skill.difficulty > 5) {
            recordError(`curriculum.json: difficulty는 1~5 숫자여야 합니다 (${sId}): ${skill.difficulty}`);
          }
          if (Array.isArray(skill.prerequisites)) {
            if (skill.prerequisites.includes(sId)) {
              recordError(`curriculum.json: 스킬은 자신을 선수 스킬(prerequisites)로 가질 수 없습니다 (${sId})`);
            }
          }
        }
      }
    }

    // Activities 검증
    const activitiesRel = manifest.files?.activities || manifest.activitiesPath || "activities.json";
    const activitiesPath = path.resolve(packageDir, activitiesRel);
    const activitiesData = readJsonFile(activitiesPath);

    if (activitiesData) {
      if (activitiesData.packageId && activitiesData.packageId !== manifestPkgId) {
        recordError(`activities.json: packageId 불일치 (manifest: ${manifestPkgId}, activities: ${activitiesData.packageId})`);
      }
      if (!Array.isArray(activitiesData.activities)) {
        recordError(`activities.json: 패키지 ${manifestPkgId}의 activities는 배열이어야 합니다.`);
      } else {
        const seenActivityIds = new Set();
        for (const act of activitiesData.activities) {
          if (!act.id || seenActivityIds.has(act.id)) {
            recordError(`activities.json: 활동 ID 누락 또는 중복 (${manifestPkgId}): ${act.id}`);
          }
          seenActivityIds.add(act.id);

          if (!VALID_ACTIVITY_TYPES.has(act.activityType)) {
            recordError(`activities.json: 유효하지 않은 activityType (${act.id}): ${act.activityType}`);
          }
          if (!VALID_RESPONSE_TYPES.has(act.responseType)) {
            recordError(`activities.json: 유효하지 않은 responseType (${act.id}): ${act.responseType}`);
          }
          if (!registeredSkillIds.has(act.skillId)) {
            recordError(`activities.json: 등록되지 않은 skillId 참조 (${act.id}): ${act.skillId}`);
          }

          // CHOICE 선택지 검증
          if (act.responseType === "CHOICE" || act.activityType === "MULTIPLE_CHOICE") {
            if (!Array.isArray(act.choices) || act.choices.length < 2) {
              recordError(`activities.json: CHOICE 활동은 2개 이상의 선택지가 필요합니다 (${act.id})`);
            } else {
              const choiceIds = new Set();
              for (const c of act.choices) {
                if (!c.id || choiceIds.has(c.id)) {
                  recordError(`activities.json: 선택지 ID 누락 또는 중복 (${act.id}): ${c.id}`);
                }
                choiceIds.add(c.id);
              }
              if (act.expectedAnswer && !choiceIds.has(act.expectedAnswer)) {
                recordError(`activities.json: expectedAnswer가 choices 목록에 존재하지 않습니다 (${act.id}: ${act.expectedAnswer})`);
              }
            }
          }

          // contentRef 검증
          if (!act.contentRef || typeof act.contentRef !== "object") {
            recordError(`activities.json: contentRef 누락 (${act.id})`);
          } else {
            if (act.contentRef.packageId !== manifestPkgId) {
              recordError(`activities.json: contentRef.packageId 불일치 (${act.id}: expected ${manifestPkgId}, got ${act.contentRef.packageId})`);
            }
            if (manifestPkgVer && act.contentRef.packageVersion !== manifestPkgVer) {
              recordError(`activities.json: contentRef.packageVersion 불일치 (${act.id}: expected ${manifestPkgVer}, got ${act.contentRef.packageVersion})`);
            }
            if (act.contentRef.contentId && act.contentRef.contentId !== act.id) {
              recordError(`activities.json: contentRef.contentId 불일치 (${act.id}: expected ${act.id}, got ${act.contentRef.contentId})`);
            }
            if (act.contentRef.contentVersion !== undefined && act.version !== undefined && Number(act.contentRef.contentVersion) !== Number(act.version)) {
              recordError(`activities.json: contentRef.contentVersion 불일치 (${act.id}: expected ${act.version}, got ${act.contentRef.contentVersion})`);
            }
          }

          // sourceMetadata 라이선스 및 출처 검증
          if (!act.sourceMetadata || typeof act.sourceMetadata !== "object") {
            recordError(`activities.json: sourceMetadata 누락 (${act.id})`);
          } else {
            const license = String(act.sourceMetadata.license || "").trim();
            if (!license) {
              recordError(`activities.json: sourceMetadata.license 누락 또는 공백 (${act.id})`);
            }
            if (!VALID_SOURCE_TYPES.has(act.sourceMetadata.sourceType)) {
              recordError(`activities.json: 유효하지 않은 sourceType (${act.id}: ${act.sourceMetadata.sourceType})`);
            }
            if (!VALID_REVIEW_STATUSES.has(act.sourceMetadata.reviewStatus)) {
              recordError(`activities.json: 유효하지 않은 reviewStatus (${act.id}: ${act.sourceMetadata.reviewStatus})`);
            }
            if (!String(act.sourceMetadata.sourceId || "").trim()) {
              recordError(`activities.json: sourceMetadata.sourceId 누락 또는 공백 (${act.id})`);
            }
          }
        }
      }
    }

    //+_+// Phase F11: Unit Catalog 검증
    const unitCatalogRel = manifest.files?.unitCatalog;
    if (unitCatalogRel) {
      const unitCatalogPath = path.resolve(packageDir, unitCatalogRel);
      const unitCatalog = readJsonFile(unitCatalogPath);
      if (unitCatalog) {
        if (unitCatalog.schemaVersion !== 1) {
          recordError(`unit-catalog.json: schemaVersion은 1이어야 합니다 (${manifestPkgId}): ${unitCatalog.schemaVersion}`);
        }
        if (unitCatalog.packageId && unitCatalog.packageId !== manifestPkgId) {
          recordError(`unit-catalog.json: packageId 불일치 (${manifestPkgId}: expected ${manifestPkgId}, got ${unitCatalog.packageId})`);
        }
        if (manifestPkgVer && unitCatalog.packageVersion && unitCatalog.packageVersion !== manifestPkgVer) {
          recordError(`unit-catalog.json: packageVersion 불일치 (${manifestPkgId}: expected ${manifestPkgVer}, got ${unitCatalog.packageVersion})`);
        }
        if (!Number.isInteger(unitCatalog.catalogVersion) || unitCatalog.catalogVersion < 1) {
          recordError(`unit-catalog.json: catalogVersion은 1 이상의 정수여야 합니다 (${manifestPkgId}): ${unitCatalog.catalogVersion}`);
        }
        if (!Array.isArray(unitCatalog.dimensions) || unitCatalog.dimensions.length === 0) {
          recordError(`unit-catalog.json: dimensions는 비어있지 않은 배열이어야 합니다 (${manifestPkgId})`);
        } else {
          const seenDimensionIds = new Set();
          const dimensionMap = new Map();

          for (const dim of unitCatalog.dimensions) {
            if (!dim.dimensionId || seenDimensionIds.has(dim.dimensionId)) {
              recordError(`unit-catalog.json: dimensionId 누락 또는 중복 (${manifestPkgId}): ${dim.dimensionId}`);
            }
            seenDimensionIds.add(dim.dimensionId);

            if (!Array.isArray(dim.units) || dim.units.length === 0) {
              recordError(`unit-catalog.json: units는 비어있지 않은 배열이어야 합니다 (${dim.dimensionId})`);
              continue;
            }

            const seenUnitIds = new Set();
            let baseFactorOneCount = 0;
            const dimUnits = new Map();

            for (const u of dim.units) {
              if (!u.unitId || seenUnitIds.has(u.unitId)) {
                recordError(`unit-catalog.json: unitId 누락 또는 중복 (${dim.dimensionId}): ${u.unitId}`);
              }
              seenUnitIds.add(u.unitId);

              if (!u.symbol || typeof u.symbol !== "string" || !u.symbol.trim()) {
                recordError(`unit-catalog.json: symbol은 비어있지 않은 문자열이어야 합니다 (${u.unitId})`);
              }
              if (!Number.isInteger(u.baseFactor) || u.baseFactor <= 0) {
                recordError(`unit-catalog.json: baseFactor는 양의 정수여야 합니다 (${u.unitId}: ${u.baseFactor})`);
              } else if (u.baseFactor === 1) {
                baseFactorOneCount += 1;
              }
              dimUnits.set(u.unitId, u);
            }

            if (baseFactorOneCount !== 1) {
              recordError(`unit-catalog.json: dimension (${dim.dimensionId})에는 baseFactor=1인 기준 단위가 정확히 1개 존재해야 합니다 (현재: ${baseFactorOneCount})`);
            }
            dimensionMap.set(dim.dimensionId, dimUnits);
          }

          // generatorProfiles 검증
          if (Array.isArray(unitCatalog.generatorProfiles)) {
            for (const profile of unitCatalog.generatorProfiles) {
              if (!profile.skillId || !registeredSkillIds.has(profile.skillId)) {
                recordError(`unit-catalog.json: generatorProfile의 skillId가 curriculum에 존재하지 않습니다: ${profile.skillId}`);
              }
              if (!profile.dimensionId || !dimensionMap.has(profile.dimensionId)) {
                recordError(`unit-catalog.json: generatorProfile의 dimensionId가 catalog에 존재하지 않습니다: ${profile.dimensionId}`);
                continue;
              }
              if (profile.allowDecimals === true || profile.decimalPolicy) {
                recordError(`unit-catalog.json: F11에서는 소수 변환 profile을 지원하지 않습니다 (${profile.skillId})`);
              }
              if (Array.isArray(profile.allowedPairs)) {
                const seenPairs = new Set();
                const currentDimUnits = dimensionMap.get(profile.dimensionId);
                for (const pair of profile.allowedPairs) {
                  if (!currentDimUnits.has(pair.sourceUnitId)) {
                    recordError(`unit-catalog.json: pair의 sourceUnitId(${pair.sourceUnitId})가 dimension(${profile.dimensionId})에 존재하지 않습니다`);
                  }
                  if (!currentDimUnits.has(pair.targetUnitId)) {
                    recordError(`unit-catalog.json: pair의 targetUnitId(${pair.targetUnitId})가 dimension(${profile.dimensionId})에 존재하지 않습니다`);
                  }
                  if (pair.sourceUnitId === pair.targetUnitId) {
                    recordError(`unit-catalog.json: sourceUnitId와 targetUnitId는 같을 수 없습니다 (${pair.sourceUnitId})`);
                  }
                  const pairKey = `${pair.sourceUnitId}->${pair.targetUnitId}`;
                  if (seenPairs.has(pairKey)) {
                    recordError(`unit-catalog.json: 중복된 conversion pair입니다 (${pairKey})`);
                  }
                  seenPairs.add(pairKey);
                }
              }
            }
          }
        }
      }
    }
  }

  const valid = errors.length === 0;
  if (valid) {
    console.log("✅ [Phase F10B] 모든 Content Package 유효성 검증 성공.");
  } else {
    console.error(`❌ [Phase F10B] 총 ${errors.length}개의 콘텐츠 유효성 오류 발견.`);
  }

  return { valid, errors };
}

if (process.argv[1] && process.argv[1].endsWith("validate-content.mjs")) {
  const result = validateAllContent();
  if (!result.valid) {
    process.exit(1);
  }
}
