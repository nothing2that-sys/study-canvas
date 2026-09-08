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
const VALID_SOURCE_TYPES = new Set(["INTERNAL_FIXTURE", "PROJECT_OWNED", "EXTERNAL"]);
const VALID_REVIEW_STATUSES = new Set(["INTERNAL_SMOKE", "DRAFT", "VERIFIED"]);

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

export function validateAllContent() {
  errors = [];
  console.log("🔍 [Phase F10B] Content Package 유효성 검증 시작...");

  const registryPath = path.join(CONTENT_ROOT, "registry.json");
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

    const manifestPath = path.resolve(CONTENT_ROOT, relManifestPath);
    const packageDir = path.dirname(manifestPath);
    const manifest = readJsonFile(manifestPath);
    if (!manifest) continue;

    // Manifest 검증
    const manifestPkgId = manifest.packageId || manifest.id;
    if (manifestPkgId !== pkgId) {
      recordError(`manifest.json: 패키지 ID 불일치 (registry: ${pkgId}, manifest: ${manifestPkgId})`);
    }
    if (!manifest.packageVersion && !manifest.version) {
      recordError(`manifest.json: 패키지 ${manifestPkgId}의 version이 누락되었습니다.`);
    }
    if (!manifest.sourcePolicy || (!manifest.sourcePolicy.defaultLicense && !manifest.sourcePolicy.license)) {
      recordError(`manifest.json: 패키지 ${manifestPkgId}의 sourcePolicy license가 필수입니다.`);
    }

    // Curriculum 검증
    const curriculumRel = manifest.files?.curriculum || manifest.curriculumPath || "curriculum.json";
    const curriculumPath = path.resolve(packageDir, curriculumRel);
    const curriculum = readJsonFile(curriculumPath);
    const registeredSkillIds = new Set();

    if (curriculum) {
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
          if (!act.contentRef || act.contentRef.packageId !== manifestPkgId) {
            recordError(`activities.json: contentRef.packageId 불일치 (${act.id})`);
          }

          // sourceMetadata 라이선스 검증
          if (!act.sourceMetadata || !act.sourceMetadata.license) {
            recordError(`activities.json: sourceMetadata.license 누락 (${act.id})`);
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
