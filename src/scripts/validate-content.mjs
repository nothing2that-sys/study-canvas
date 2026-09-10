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
const VALID_REVIEW_STATUSES = new Set(["INTERNAL", "DRAFT", "VERIFIED", "AUTO_VALIDATED", "REVIEWED", "APPROVED"]);

//+_+// Phase F12 Rework: 기본 문제 수 SSOT
export const DEFAULT_PROBLEM_COUNT = 20;

//+_+// Phase F12 Rework 2: 허용된 canonical license set
export const CANONICAL_LICENSES = new Set([
  "KOGL_TYPE_1",
  "KOGL_TYPE_2",
  "KOGL_TYPE_3",
  "KOGL_TYPE_4",
  "CC_BY_SA_2_0_KR",
  "PUBLIC_DOMAIN",
  "PROJECT_OWNED"
]);

/**
 * Canonical Source Contracts SSOT
 * actual source -> license 계약 (기관명 기반 일괄 추론 금지)
 */
export const KNOWN_SOURCE_CONTRACTS = {
  STD_KOREAN_DICTIONARY: {
    id: "STD_KOREAN_DICTIONARY",
    name: "국립국어원 표준국어대사전",
    matches: (sm) => {
      const id = String(sm.sourceId || "");
      const name = String(sm.sourceName || "");
      return id.includes("표준국어대사전") || name.includes("표준국어대사전");
    },
    expectedLicense: "CC_BY_SA_2_0_KR",
    disallowedLicenses: ["KOGL_TYPE_1", "PUBLIC_DOMAIN"],
    validate: (sm, context, localErrors) => {
      const url = String(sm.sourceUrl || "").trim();
      if (!url.includes("stdict.korean.go.kr")) {
        localErrors.push(`${context}: 표준국어대사전 출처의 sourceUrl은 stdict.korean.go.kr 도메인이어야 합니다 (현재: ${url})`);
      }
    }
  },
  KOREAN_ORTHOGRAPHY_NORMS: {
    id: "KOREAN_ORTHOGRAPHY_NORMS",
    name: "한국 어문 규정 (한글 맞춤법 및 표준어 규정)",
    matches: (sm) => {
      const id = String(sm.sourceId || "");
      const name = String(sm.sourceName || "");
      const isOrthography = id.includes("한글 맞춤법") || id.includes("한글맞춤법") || name.includes("한글 맞춤법");
      const isStandardLang = id.includes("표준어 규정") || id.includes("표준어규정") || name.includes("표준어 규정");
      const isEtiquette = id.includes("표준 언어 예절") || name.includes("표준 언어 예절");
      return (isOrthography || isStandardLang) && !isEtiquette;
    },
    expectedLicense: "KOGL_TYPE_1",
    disallowedLicenses: ["PUBLIC_DOMAIN", "CC_BY_SA_2_0_KR"],
    validate: (sm, context, localErrors) => {
      const url = String(sm.sourceUrl || "").trim();
      const genericRoots = [
        "https://kornorms.korean.go.kr",
        "https://kornorms.korean.go.kr/",
        "http://kornorms.korean.go.kr",
        "http://kornorms.korean.go.kr/",
        "https://www.korean.go.kr",
        "https://www.korean.go.kr/",
        "https://korean.go.kr",
        "https://korean.go.kr/"
      ];
      if (genericRoots.includes(url)) {
        localErrors.push(`${context}: 한국 어문 규정 출처는 generic root URL(${url})이 아닌 구체적 규정 조항 URL(regltnView.do 등)이어야 합니다`);
      }
    }
  },
  STANDARD_LANGUAGE_ETIQUETTE_2011: {
    id: "STANDARD_LANGUAGE_ETIQUETTE_2011",
    name: "국립국어원 표준 언어 예절 (2011)",
    matches: (sm) => {
      const id = String(sm.sourceId || "");
      const name = String(sm.sourceName || "");
      return id.includes("표준 언어 예절") || name.includes("표준 언어 예절");
    },
    expectedLicense: "KOGL_TYPE_4",
    disallowedLicenses: ["KOGL_TYPE_1", "PUBLIC_DOMAIN"],
    validate: (sm, context, localErrors) => {
      const url = String(sm.sourceUrl || "").trim();
      const genericRoots = [
        "https://kornorms.korean.go.kr",
        "https://kornorms.korean.go.kr/",
        "http://kornorms.korean.go.kr",
        "http://kornorms.korean.go.kr/",
        "https://www.korean.go.kr",
        "https://www.korean.go.kr/",
        "https://korean.go.kr",
        "https://korean.go.kr/"
      ];
      if (genericRoots.includes(url)) {
        localErrors.push(`${context}: 표준 언어 예절 출처는 generic root URL(${url})이 아닌 구체적 자료/보고서 URL이어야 합니다`);
      }
    }
  }
};

/**
 * Knowledge Entry sourceMetadata 라이선스 및 출처 정밀 검증
 * @param {Object} sm - sourceMetadata 객체
 * @param {string} [context] - 에러 메시지용 컨텍스트 식별자
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateKnowledgeSourceMetadata(sm, context = "knowledge-catalog.json") {
  const localErrors = [];
  if (!sm || typeof sm !== "object") {
    localErrors.push(`${context}: sourceMetadata 누락 또는 객체 아님`);
    return { valid: false, errors: localErrors };
  }

  const sourceType = String(sm.sourceType || "").trim();
  if (!sourceType || !VALID_SOURCE_TYPES.has(sourceType)) {
    localErrors.push(`${context}: 유효하지 않은 sourceType: ${sourceType}`);
  }

  const license = String(sm.license || "").trim();
  if (!license) {
    localErrors.push(`${context}: sourceMetadata.license 누락`);
  } else if (!CANONICAL_LICENSES.has(license)) {
    localErrors.push(`${context}: 허용되지 않은 canonical license: ${license}`);
  }

  const attribution = String(sm.attribution || "").trim();
  const sourceName = String(sm.sourceName || "").trim();
  const sourceId = String(sm.sourceId || "").trim();
  const sourceUrl = String(sm.sourceUrl || "").trim();
  const licenseUrl = String(sm.licenseUrl || "").trim();
  const retrievedAt = String(sm.retrievedAt || "").trim();

  if (!retrievedAt) {
    localErrors.push(`${context}: retrievedAt 필수`);
  }

  if (sourceType === "PROJECT_OWNED") {
    if (license && license !== "PROJECT_OWNED") {
      localErrors.push(`${context}: PROJECT_OWNED 소스는 license가 PROJECT_OWNED여야 합니다 (현재: ${license})`);
    }
    if (!attribution) {
      localErrors.push(`${context}: PROJECT_OWNED 소스는 attribution 필수`);
    }
    return { valid: localErrors.length === 0, errors: localErrors };
  }

  if (sourceType === "EXTERNAL") {
    if (!attribution) {
      localErrors.push(`${context}: EXTERNAL source는 attribution 필수`);
    }
    if (!sourceName) {
      localErrors.push(`${context}: EXTERNAL source는 sourceName 필수`);
    }
    if (!sourceId) {
      localErrors.push(`${context}: EXTERNAL source는 sourceId 필수`);
    }
    if (!sourceUrl || (!sourceUrl.startsWith("http://") && !sourceUrl.startsWith("https://"))) {
      localErrors.push(`${context}: EXTERNAL source는 유효한 sourceUrl(http/https) 필수`);
    }

    // Generic root URL 단독 사용 금지 (exact source URL 필수)
    const genericRoots = new Set([
      "https://kornorms.korean.go.kr",
      "https://kornorms.korean.go.kr/",
      "http://kornorms.korean.go.kr",
      "http://kornorms.korean.go.kr/",
      "https://www.korean.go.kr",
      "https://www.korean.go.kr/",
      "https://korean.go.kr",
      "https://korean.go.kr/"
    ]);
    if (genericRoots.has(sourceUrl)) {
      localErrors.push(`${context}: EXTERNAL source에 generic root URL(${sourceUrl})만 지정되어 구체적 출처가 특정되지 않았습니다. 조항 또는 세부 문서 URL이 필요합니다.`);
    }

    // Source Contract 매칭
    let matchedContract = null;
    for (const contract of Object.values(KNOWN_SOURCE_CONTRACTS)) {
      if (contract.matches(sm)) {
        matchedContract = contract;
        break;
      }
    }

    if (!matchedContract) {
      // 등록되지 않은 미검증 EXTERNAL 출처는 거부 (arbitrary official-looking sourceName 등)
      localErrors.push(`${context}: 등록되지 않았거나 출처 계약(contract)이 정의되지 않은 외부 출처입니다 (sourceName: "${sourceName}", sourceId: "${sourceId}")`);
    } else {
      // Contract 검증
      if (matchedContract.disallowedLicenses && matchedContract.disallowedLicenses.includes(license)) {
        localErrors.push(`${context}: ${matchedContract.name} 출처의 저작권 라이선스는 ${matchedContract.expectedLicense}이어야 하며, ${license}은 허용되지 않습니다`);
      } else if (matchedContract.expectedLicense && license !== matchedContract.expectedLicense) {
        localErrors.push(`${context}: ${matchedContract.name} 출처의 저작권 라이선스는 ${matchedContract.expectedLicense}이어야 합니다 (현재: ${license})`);
      }
      if (matchedContract.validate) {
        matchedContract.validate(sm, context, localErrors);
      }
    }

    // licenseUrl 필수 여부 검증 (KOGL, CC)
    if (license.startsWith("KOGL") || license.startsWith("CC")) {
      if (!licenseUrl || (!licenseUrl.startsWith("http://") && !licenseUrl.startsWith("https://"))) {
        localErrors.push(`${context}: ${license} 라이선스는 유효한 licenseUrl(http/https) 필수`);
      }
    }
  }

  return { valid: localErrors.length === 0, errors: localErrors };
}

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

    //+_+// Phase F12: Knowledge Catalog 검증
    const knowledgeCatalogRel = manifest.files?.knowledgeCatalog;
    const registeredKnowledgeIds = new Set();
    const knowledgeCatalogMap = new Map();
    if (knowledgeCatalogRel) {
      const knowledgeCatalogPath = path.resolve(packageDir, knowledgeCatalogRel);
      const knowledgeCatalog = readJsonFile(knowledgeCatalogPath);
      if (knowledgeCatalog) {
        if (knowledgeCatalog.schemaVersion !== 1) {
          recordError(`knowledge-catalog.json: schemaVersion은 1이어야 합니다 (${manifestPkgId}): ${knowledgeCatalog.schemaVersion}`);
        }
        if (knowledgeCatalog.packageId && knowledgeCatalog.packageId !== manifestPkgId) {
          recordError(`knowledge-catalog.json: packageId 불일치 (${manifestPkgId}: expected ${manifestPkgId}, got ${knowledgeCatalog.packageId})`);
        }
        if (manifestPkgVer && knowledgeCatalog.packageVersion && knowledgeCatalog.packageVersion !== manifestPkgVer) {
          recordError(`knowledge-catalog.json: packageVersion 불일치 (${manifestPkgId}: expected ${manifestPkgVer}, got ${knowledgeCatalog.packageVersion})`);
        }
        if (!Number.isInteger(knowledgeCatalog.catalogVersion) || knowledgeCatalog.catalogVersion < 1) {
          recordError(`knowledge-catalog.json: catalogVersion은 1 이상의 정수여야 합니다 (${manifestPkgId}): ${knowledgeCatalog.catalogVersion}`);
        }
        if (!Array.isArray(knowledgeCatalog.entries) || knowledgeCatalog.entries.length === 0) {
          recordError(`knowledge-catalog.json: entries는 비어있지 않은 배열이어야 합니다 (${manifestPkgId})`);
        } else {
          const VALID_DOMAINS = new Set(["vocabulary", "spelling", "spacing", "sentence"]);
          for (const entry of knowledgeCatalog.entries) {
            if (!entry.knowledgeId || registeredKnowledgeIds.has(entry.knowledgeId)) {
              recordError(`knowledge-catalog.json: knowledgeId 누락 또는 중복 (${manifestPkgId}): ${entry.knowledgeId}`);
            }
            registeredKnowledgeIds.add(entry.knowledgeId);
            knowledgeCatalogMap.set(entry.knowledgeId, entry);

            if (!VALID_DOMAINS.has(entry.domain)) {
              recordError(`knowledge-catalog.json: 유효하지 않은 domain (${entry.knowledgeId}): ${entry.domain}`);
            }
            if (!entry.title || !String(entry.title).trim()) {
              recordError(`knowledge-catalog.json: title 누락 (${entry.knowledgeId})`);
            }
            if (!entry.summary || !String(entry.summary).trim()) {
              recordError(`knowledge-catalog.json: summary 누락 (${entry.knowledgeId})`);
            }
            if (!entry.ruleType || !String(entry.ruleType).trim()) {
              recordError(`knowledge-catalog.json: ruleType 누락 (${entry.knowledgeId})`);
            }
            const metaRes = validateKnowledgeSourceMetadata(entry.sourceMetadata, `knowledge-catalog.json (${entry.knowledgeId})`);
            if (!metaRes.valid) {
              for (const err of metaRes.errors) {
                recordError(err);
              }
            }
            if (!VALID_REVIEW_STATUSES.has(entry.reviewStatus)) {
              recordError(`knowledge-catalog.json: 유효하지 않은 reviewStatus (${entry.knowledgeId}): ${entry.reviewStatus}`);
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
        const skillActivityCounts = new Map();
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

          // TEXT 응답 검증
          if (act.responseType === "TEXT" || act.activityType === "SHORT_ANSWER") {
            if (!act.expectedAnswer || typeof act.expectedAnswer !== "string" || !act.expectedAnswer.trim()) {
              recordError(`activities.json: TEXT 활동은 expectedAnswer 문자열이 필요합니다 (${act.id})`);
            }
            if (act.subjectId === "korean" && (!act.gradingReference || typeof act.gradingReference !== "object")) {
              recordError(`activities.json: Korean TEXT 활동은 gradingReference 객체가 필요합니다 (${act.id})`);
            }
          }

          // knowledgeRef 참조 및 시맨틱 도메인 검증
          if (act.knowledgeRef && registeredKnowledgeIds.size > 0) {
            if (!registeredKnowledgeIds.has(act.knowledgeRef)) {
              recordError(`activities.json: 존재하지 않는 knowledgeRef 참조 (${act.id}): ${act.knowledgeRef}`);
            } else {
              const kEntry = knowledgeCatalogMap.get(act.knowledgeRef);
              if (kEntry && act.unitId && kEntry.domain !== act.unitId) {
                recordError(`activities.json: knowledgeRef 도메인 불일치 (${act.id}: activity unitId=${act.unitId}, knowledge domain=${kEntry.domain})`);
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

          // Korean Production 패키지 검증
          if (manifest.status === "APPROVED" && manifestPkgId === "korean-core-v1") {
            if (act.sourceMetadata?.reviewStatus !== "APPROVED") {
              recordError(`activities.json: Production Korean 활동은 reviewStatus=APPROVED이어야 합니다 (${act.id}: ${act.sourceMetadata?.reviewStatus})`);
            }
            if (act.subjectId !== "korean") {
              recordError(`activities.json: Korean 패키지의 활동은 subjectId=korean이어야 합니다 (${act.id}: ${act.subjectId})`);
            }
            if (!act.sourceMetadata?.attribution || !String(act.sourceMetadata.attribution).trim()) {
              recordError(`activities.json: sourceMetadata.attribution 누락 (${act.id})`);
            }
            if (!act.sourceMetadata?.retrievedAt || !String(act.sourceMetadata.retrievedAt).trim()) {
              recordError(`activities.json: sourceMetadata.retrievedAt 누락 (${act.id})`);
            }
          }

          // 스킬별 활동 카운트 집계
          const isApproved = act.sourceMetadata?.reviewStatus === "APPROVED";
          skillActivityCounts.set(act.skillId, (skillActivityCounts.get(act.skillId) || 0) + (isApproved ? 1 : 0));
        }

        // Active Skill 문제 수 검증
        if (manifest.status === "APPROVED" && manifestPkgId === "korean-core-v1") {
          for (const sId of registeredSkillIds) {
            const count = skillActivityCounts.get(sId) || 0;
            if (count < DEFAULT_PROBLEM_COUNT) {
              recordError(`activities.json: Production 활성 스킬 ${sId}의 APPROVED 문제 수가 부족합니다 (현재: ${count}, 필요: ${DEFAULT_PROBLEM_COUNT})`);
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
