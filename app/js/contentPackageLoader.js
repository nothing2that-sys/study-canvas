import {assertAiReviewResource} from './aiReviewResources.js';
//+_+// Math Canvas Pro - Phase F10B Content Package Loader
//+_+// SSOT UNIFIED_CURRICULUM_ACTIVITY_PLATFORM_v2.2 및 Phase F10B 명세 준수
//+_+// - 정적 Content Package 로드, 검증 및 결정론적 인메모리 바인딩
//+_+// - 브라우저(fetch) 및 Node.js(fs) 양방향 지원

import { normalizeLearningActivity } from "./learningActivity.js";
import { normalizeSkillDefinition, registerPackageSkills } from "./unifiedCurriculumRegistry.js";

const DEFAULT_CONTENT_BASE = "./content";

/**
 * 환경에 맞추어 JSON 파일을 비동기 로드하는 헬퍼
 */
async function fetchJsonResource(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== "string") {
    throw new Error("유효한 리소스 경로가 필요합니다.");
  }

  // 브라우저 환경이거나 HTTP/HTTPS 요청인 경우 fetch 사용
  const isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined";
  if (isBrowser || pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    let targetUrl = pathOrUrl;
    if (isBrowser && !pathOrUrl.startsWith("http://") && !pathOrUrl.startsWith("https://") && !pathOrUrl.startsWith("/")) {
      targetUrl = `/${pathOrUrl.replace(/^\.\//, "")}`;
    }
    const res = await fetch(targetUrl);
    if (!res.ok) {
      throw new Error(`콘텐츠 파일 로드 실패 (HTTP ${res.status}): ${targetUrl}`);
    }
    const text=await res.text();await assertAiReviewResource(pathOrUrl,text);return JSON.parse(text);
  }

  // Node.js 환경인 경우 fs/promises 사용
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const resolvedPath = pathOrUrl.startsWith("file://")
      ? new URL(pathOrUrl)
      : path.resolve(pathOrUrl);
    const content = await fs.readFile(resolvedPath, "utf8");
    await assertAiReviewResource(pathOrUrl,content);return JSON.parse(content);
  } catch (err) {
    throw new Error(`콘텐츠 파일 읽기 실패 (${pathOrUrl}): ${err.message}`);
  }
}

/**
 * 경로 결합 유틸리티 (POSIX 스타일 상대 경로)
 */
function joinPaths(base, relative) {
  if (!relative) return base;
  if (relative.startsWith("http://") || relative.startsWith("https://") || relative.startsWith("/")) {
    return relative;
  }
  const cleanBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const cleanRel = relative.startsWith("./") ? relative.slice(2) : relative;
  return `${cleanBase}/${cleanRel}`;
}

/**
 * Package Registry (registry.json) 로드 및 검증
 */
export async function loadContentRegistry(baseDir = DEFAULT_CONTENT_BASE) {
  const registryUrl = joinPaths(baseDir, "registry.json");
  const data = await fetchJsonResource(registryUrl);

  if (!data || typeof data !== "object") {
    throw new TypeError("유효하지 않은 registry.json 구조입니다.");
  }

  if (Number(data.schemaVersion) !== 1) {
    throw new Error(`지원되지 않는 registry schemaVersion입니다: ${data.schemaVersion}`);
  }

  if (!Array.isArray(data.packages)) {
    throw new TypeError("registry.json에는 packages 배열이 필요합니다.");
  }

  const seenIds = new Set();
  for (const pkg of data.packages) {
    if (!pkg.packageId || typeof pkg.packageId !== "string") {
      throw new Error("모든 패키지 항목에는 packageId가 필요합니다.");
    }
    if (seenIds.has(pkg.packageId)) {
      throw new Error(`중복된 packageId가 registry에 존재합니다: ${pkg.packageId}`);
    }
    seenIds.add(pkg.packageId);

    if (!pkg.manifestPath) {
      throw new Error(`패키지(${pkg.packageId})에 manifestPath가 누락되었습니다.`);
    }
  }

  return data;
}

/**
 * Package Manifest (manifest.json) 로드 및 검증
 */
export async function loadPackageManifest(manifestPath, baseDir = DEFAULT_CONTENT_BASE) {
  const fullUrl = joinPaths(baseDir, manifestPath);
  const data = await fetchJsonResource(fullUrl);

  if (!data || typeof data !== "object") {
    throw new TypeError(`유효하지 않은 manifest 데이터입니다: ${manifestPath}`);
  }

  if (Number(data.schemaVersion) !== 1) {
    throw new Error(`지원되지 않는 manifest schemaVersion입니다: ${data.schemaVersion}`);
  }

  if (!data.packageId) {
    throw new Error("manifest에 packageId가 누락되었습니다.");
  }
  if (!data.packageVersion) {
    throw new Error("manifest에 packageVersion이 누락되었습니다.");
  }
  if (!data.files || typeof data.files !== "object") {
    throw new Error("manifest에 files 선언이 누락되었습니다.");
  }
  if (!data.files.curriculum) {
    throw new Error("manifest files에 curriculum 파일 경로가 필요합니다.");
  }
  if (!data.isSharded && !data.files.activities) {
    throw new Error("manifest files에 activities 파일 경로가 필요합니다.");
  }

  // Source / License Policy 검증
  if (!data.sourcePolicy || typeof data.sourcePolicy !== "object") {
    throw new Error("manifest에 유효한 sourcePolicy 객체가 필요합니다.");
  }
  const defaultLicense = String(data.sourcePolicy.defaultLicense || "").trim();
  if (!defaultLicense) {
    throw new Error("manifest sourcePolicy에 비어있지 않은 defaultLicense가 필요합니다.");
  }
  if (data.sourcePolicy.defaultSourceType) {
    const defaultSourceType = String(data.sourcePolicy.defaultSourceType).trim();
    if (!["INTERNAL_FIXTURE", "PROJECT_OWNED", "EXTERNAL", "ARITHMETIC_GENERATOR"].includes(defaultSourceType)) {
      throw new Error(`manifest sourcePolicy에 유효하지 않은 defaultSourceType입니다: ${defaultSourceType}`);
    }
  }
  if (data.sourcePolicy.defaultReviewStatus) {
    const defaultReviewStatus = String(data.sourcePolicy.defaultReviewStatus).trim();
    if (!["INTERNAL", "DRAFT", "VERIFIED", "APPROVED"].includes(defaultReviewStatus)) {
      throw new Error(`manifest sourcePolicy에 유효하지 않은 defaultReviewStatus입니다: ${defaultReviewStatus}`);
    }
  }

  return {
    ...data,
    _manifestDir: fullUrl.substring(0, fullUrl.lastIndexOf("/"))
  };
}

/**
 * Curriculum Package (curriculum.json) 로드 및 검증
 */
export async function loadCurriculumPackage(curriculumPath, manifestDir, expectedPackageId = null) {
  const fullUrl = joinPaths(manifestDir, curriculumPath);
  const data = await fetchJsonResource(fullUrl);

  if (!data || typeof data !== "object") {
    throw new TypeError(`유효하지 않은 curriculum 데이터입니다: ${curriculumPath}`);
  }

  if (Number(data.schemaVersion) !== 1) {
    throw new Error(`지원되지 않는 curriculum schemaVersion입니다: ${data.schemaVersion}`);
  }

  if (expectedPackageId && data.packageId !== expectedPackageId) {
    throw new Error(`curriculum.json의 packageId(${data.packageId})가 manifest packageId(${expectedPackageId})와 불일치합니다.`);
  }

  if (!Array.isArray(data.skills)) {
    throw new TypeError("curriculum.json에는 skills 배열이 필요합니다.");
  }

  const seenSkills = new Set();
  const normalizedSkills = [];

  for (const raw of data.skills) {
    const s = normalizeSkillDefinition(raw);
    if (seenSkills.has(s.skillId)) {
      throw new Error(`중복된 skillId가 curriculum에 존재합니다: ${s.skillId}`);
    }
    seenSkills.add(s.skillId);
    normalizedSkills.push(s);
  }

  return {
    packageId: data.packageId,
    curriculumVersion: data.curriculumVersion,
    subjectId: data.subjectId || null,
    courseId: data.courseId || null,
    skills: normalizedSkills
  };
}

/**
 * Activity Package (activities.json) 로드 및 검증
 */
export async function loadActivityPackage(
  activitiesPath,
  manifestDir,
  curriculumSkills = [],
  expectedPackageId = null,
  expectedPackageVersion = null
) {
  const fullUrl = joinPaths(manifestDir, activitiesPath);
  const data = await fetchJsonResource(fullUrl);

  if (!data || typeof data !== "object") {
    throw new TypeError(`유효하지 않은 activities 데이터입니다: ${activitiesPath}`);
  }

  if (Number(data.schemaVersion) !== 1) {
    throw new Error(`지원되지 않는 activities schemaVersion입니다: ${data.schemaVersion}`);
  }

  if (expectedPackageId && data.packageId !== expectedPackageId) {
    throw new Error(`activities.json의 packageId(${data.packageId})가 manifest packageId(${expectedPackageId})와 불일치합니다.`);
  }

  if (!Array.isArray(data.activities)) {
    throw new TypeError("activities.json에는 activities 배열이 필요합니다.");
  }

  const skillMap = new Map(curriculumSkills.map((s) => [s.skillId, s]));
  const seenIds = new Set();
  const normalizedActivities = [];

  for (const raw of data.activities) {
    if (!raw.id) {
      throw new Error("활동 항목에 id가 누락되었습니다.");
    }
    if (seenIds.has(raw.id)) {
      throw new Error(`중복된 activity ID가 activities에 존재합니다: ${raw.id}`);
    }
    seenIds.add(raw.id);

    // Skill 참조 검증 (curriculumSkills가 제공된 경우)
    if (skillMap.size > 0 && !skillMap.has(raw.skillId)) {
      throw new Error(`활동(${raw.id})의 skillId(${raw.skillId})가 선언된 curriculum에 존재하지 않습니다.`);
    }

    // 과목/스킬 일치 검증
    if (skillMap.size > 0) {
      const parentSkill = skillMap.get(raw.skillId);
      if (raw.subjectId && raw.subjectId !== parentSkill.subjectId) {
        throw new Error(`활동(${raw.id})의 subjectId(${raw.subjectId})가 Skill의 subjectId(${parentSkill.subjectId})와 불일치합니다.`);
      }
    }

    // contentRef 필수 및 일치 검증
    if (!raw.contentRef || typeof raw.contentRef !== "object") {
      throw new Error(`활동(${raw.id})에는 contentRef 객체가 필수입니다.`);
    }
    if (expectedPackageId && raw.contentRef.packageId !== expectedPackageId) {
      throw new Error(`활동(${raw.id})의 contentRef.packageId(${raw.contentRef.packageId})가 manifest packageId(${expectedPackageId})와 불일치합니다.`);
    }
    if (expectedPackageVersion && raw.contentRef.packageVersion !== expectedPackageVersion) {
      throw new Error(`활동(${raw.id})의 contentRef.packageVersion(${raw.contentRef.packageVersion})가 manifest packageVersion(${expectedPackageVersion})와 불일치합니다.`);
    }
    if (raw.contentRef.contentId && raw.contentRef.contentId !== raw.id) {
      throw new Error(`활동(${raw.id})의 contentRef.contentId(${raw.contentRef.contentId})가 활동 id와 불일치합니다.`);
    }
    if (raw.contentRef.contentVersion !== undefined && raw.version !== undefined && Number(raw.contentRef.contentVersion) !== Number(raw.version)) {
      throw new Error(`활동(${raw.id})의 contentRef.contentVersion(${raw.contentRef.contentVersion})가 활동 version(${raw.version})과 불일치합니다.`);
    }

    // Source / License metadata 검증
    if (!raw.sourceMetadata || !String(raw.sourceMetadata.license || "").trim()) {
      throw new Error(`활동(${raw.id})에는 sourceMetadata 및 비어있지 않은 license가 반드시 지정되어야 합니다.`);
    }

    const activity = normalizeLearningActivity(raw);
    normalizedActivities.push(activity);
  }

  return {
    packageId: data.packageId,
    activities: normalizedActivities
  };
}

/**
 * 단일 Content Package 전체 로드 (manifest -> curriculum -> activities)
 */
export async function loadPackage(packageId, baseDir = DEFAULT_CONTENT_BASE) {
  const registry = await loadContentRegistry(baseDir);
  const pkgEntry = registry.packages.find((p) => p.packageId === packageId);
  if (!pkgEntry) {
    throw new Error(`Registry에 등록되지 않은 패키지입니다: ${packageId}`);
  }

  const manifest = await loadPackageManifest(pkgEntry.manifestPath, baseDir);
  if (manifest.packageId !== pkgEntry.packageId) {
    throw new Error(`manifest packageId(${manifest.packageId})가 registry packageId(${pkgEntry.packageId})와 불일치합니다.`);
  }
  if (pkgEntry.packageVersion && manifest.packageVersion !== pkgEntry.packageVersion) {
    throw new Error(`manifest packageVersion(${manifest.packageVersion})가 registry packageVersion(${pkgEntry.packageVersion})와 불일치합니다.`);
  }

  const curriculum = await loadCurriculumPackage(manifest.files.curriculum, manifest._manifestDir, manifest.packageId);
  registerPackageSkills(curriculum.skills);

  if (manifest.isSharded) {
    return {
      manifest,
      curriculum,
      isSharded: true,
      activities: []
    };
  }

  const activities = await loadActivityPackage(
    manifest.files.activities,
    manifest._manifestDir,
    curriculum.skills,
    manifest.packageId,
    manifest.packageVersion
  );

  return {
    manifest,
    curriculum,
    activities: activities.activities
  };
}

/**
 * 특정 패키지 내 활동 ID로 단일 Activity 로드
 */
export async function loadActivityById(packageId, activityId, baseDir = DEFAULT_CONTENT_BASE) {
  const pkg = await loadPackage(packageId, baseDir);
  const activity = pkg.activities.find((a) => a.id === activityId);
  if (!activity) {
    throw new Error(`패키지(${packageId}) 내에서 활동(${activityId})을 찾을 수 없습니다.`);
  }
  return activity;
}

//+_+// Phase F11: Generic Package Resource Loader (예: unitCatalog 등 추가 정적 파일 로드)
export async function loadPackageResource(packageId, fileRole, baseDir = DEFAULT_CONTENT_BASE) {
  if (!packageId || typeof packageId !== "string") {
    throw new Error("유효한 packageId가 필요합니다.");
  }
  if (!fileRole || typeof fileRole !== "string") {
    throw new Error("유효한 fileRole이 필요합니다.");
  }

  const registry = await loadContentRegistry(baseDir);
  const pkgEntry = registry.packages.find((p) => p.packageId === packageId);
  if (!pkgEntry) {
    throw new Error(`Registry에 등록되지 않은 패키지입니다: ${packageId}`);
  }

  const manifest = await loadPackageManifest(pkgEntry.manifestPath, baseDir);
  if (manifest.packageId !== pkgEntry.packageId) {
    throw new Error(`manifest packageId(${manifest.packageId})가 registry packageId(${pkgEntry.packageId})와 불일치합니다.`);
  }

  const relFilePath = manifest.files?.[fileRole];
  if (!relFilePath || typeof relFilePath !== "string") {
    throw new Error(`manifest.files에 role(${fileRole})이 선언되지 않았거나 유효하지 않습니다.`);
  }

  // 외부 경로 또는 상위 디렉터리 임의 탈출 방지
  if (relFilePath.includes("..")) {
    throw new Error(`보안 위반: 파일 경로에 상위 디렉터리 접근(..)이 허용되지 않습니다: ${relFilePath}`);
  }

  const resourceUrl = joinPaths(manifest._manifestDir, relFilePath);
  const resource = await fetchJsonResource(resourceUrl);

  if (!resource || typeof resource !== "object") {
    throw new TypeError(`유효하지 않은 resource 데이터입니다: ${fileRole}`);
  }

  // packageId / packageVersion 교차 검증 (선언된 경우)
  if (resource.packageId && resource.packageId !== manifest.packageId) {
    throw new Error(`리소스의 packageId(${resource.packageId})가 manifest packageId(${manifest.packageId})와 불일치합니다.`);
  }
  if (manifest.packageVersion && resource.packageVersion && resource.packageVersion !== manifest.packageVersion) {
    throw new Error(`리소스의 packageVersion(${resource.packageVersion})가 manifest packageVersion(${manifest.packageVersion})와 불일치합니다.`);
  }

  return resource;
}

