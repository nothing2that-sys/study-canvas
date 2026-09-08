//+_+// Math Canvas Pro - Phase F10B Unified Curriculum Registry
//+_+// SSOT UNIFIED_CURRICULUM_ACTIVITY_PLATFORM_v2.2 및 Phase F10B 명세 준수
//+_+// - 신규 영역용 공통 Skill 등록, 검색 및 유효성 검증
//+_+// - 과목(Subject), 코스(Course), 단원(Unit) 간 격리 및 충돌 방지
//+_+// - 기존 수학 Arithmetic Stage Registry는 이동하지 않고 보존 (Adapter 연계)

const skillsMap = new Map();

/**
 * 단일 Skill 정의 유효성 검증 및 정규화
 */
export function normalizeSkillDefinition(raw) {
  if (!raw || typeof raw !== "object") {
    throw new TypeError("Skill 정의 객체가 유효하지 않습니다.");
  }

  const skillId = String(raw.skillId || "").trim();
  if (!skillId) {
    throw new Error("Skill 정의에는 고유한 skillId가 필요합니다.");
  }

  const VALID_SUBJECTS = new Set(["math", "korean", "english"]);
  const subjectId = String(raw.subjectId || "").trim().toLowerCase();
  if (!subjectId) {
    throw new Error(`Skill(${skillId})에는 subjectId가 필요합니다.`);
  }
  if (!VALID_SUBJECTS.has(subjectId)) {
    throw new Error(`지원되지 않는 subjectId입니다: ${subjectId}`);
  }

  const courseId = String(raw.courseId || "general").trim().toLowerCase();
  const unitId = String(raw.unitId || "general").trim().toLowerCase();
  const gradeBand = String(raw.gradeBand || "all").trim();

  const difficulty = Number(raw.difficulty);
  if (!Number.isFinite(difficulty) || difficulty < 1 || difficulty > 5) {
    throw new Error(`Skill(${skillId})의 difficulty는 1 이상 5 이하의 숫자여야 합니다 (입력값: ${raw.difficulty}).`);
  }

  const status = String(raw.status || "ACTIVE").trim().toUpperCase();
  const prerequisites = Array.isArray(raw.prerequisites)
    ? raw.prerequisites.map((p) => String(p).trim()).filter(Boolean)
    : [];

  //+_+// 자기 참조 선수학습(Self-reference prerequisite) 금지
  if (prerequisites.includes(skillId)) {
    throw new Error(`Skill(${skillId})은 자기 자신을 선수학습(prerequisite)으로 가질 수 없습니다.`);
  }

  return {
    skillId,
    subjectId,
    courseId,
    unitId,
    name: String(raw.name || skillId).trim(),
    description: String(raw.description || "").trim(),
    gradeBand,
    difficulty,
    status,
    prerequisites
  };
}

/**
 * 단일 Skill 등록
 */
export function registerSkill(rawSkill) {
  const normalized = normalizeSkillDefinition(rawSkill);
  const existing = skillsMap.get(normalized.skillId);
  if (existing) {
    if (JSON.stringify(existing) === JSON.stringify(normalized)) {
      return existing;
    }
    throw new Error(`이미 등록된 skillId입니다: ${normalized.skillId}`);
  }
  skillsMap.set(normalized.skillId, Object.freeze(normalized));
  return skillsMap.get(normalized.skillId);
}

/**
 * 패키지 단위 Skill 목록 일괄 등록
 */
export function registerPackageSkills(skillsList = []) {
  if (!Array.isArray(skillsList)) {
    throw new TypeError("registerPackageSkills에는 Skill 배열이 필요합니다.");
  }
  const registered = [];
  for (const s of skillsList) {
    registered.push(registerSkill(s));
  }
  return registered;
}

/**
 * skillId로 등록된 Skill 조회
 */
export function getSkill(skillId) {
  if (!skillId) return null;
  return skillsMap.get(String(skillId).trim()) || null;
}

/**
 * 특정 과목(subjectId)의 모든 Skill 조회
 */
export function getSkillsBySubject(subjectId) {
  const target = String(subjectId || "").trim().toLowerCase();
  if (!target) return [];
  return Array.from(skillsMap.values()).filter((s) => s.subjectId === target);
}

/**
 * 특정 과목 및 코스(subjectId, courseId)의 모든 Skill 조회
 */
export function getSkillsByCourse(subjectId, courseId) {
  const targetSub = String(subjectId || "").trim().toLowerCase();
  const targetCourse = String(courseId || "").trim().toLowerCase();
  return Array.from(skillsMap.values()).filter(
    (s) => s.subjectId === targetSub && s.courseId === targetCourse
  );
}

/**
 * Skill 참조 유효성 검증
 */
export function validateSkillReference(skillId) {
  const skill = getSkill(skillId);
  if (!skill) {
    throw new Error(`존재하지 않는 Skill 참조입니다: ${skillId}`);
  }
  return skill;
}

/**
 * 등록된 전체 Skill 반환
 */
export function getAllSkills() {
  return Array.from(skillsMap.values());
}

/**
 * 테스트 격리용 Registry 초기화
 */
export function clearRegisteredSkills() {
  skillsMap.clear();
}
