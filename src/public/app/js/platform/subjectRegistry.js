/**
 * Math Canvas Pro - 과목 레지스트리 (Subject Registry)
 * SSOT Section 10~11 및 Phase F3 명세 준수
 * - 단일 Registry로 과목(수학, 국어, 영어) 및 하위 모듈 계약 관리
 * - UI 하드코딩 방지 및 다과목 확장성 확보
 */

export const SUBJECTS = Object.freeze([
  {
    id: "math",
    title: "수학",
    description: "직접 쓰고 정확하게 익히는 연산 학습",
    badgeText: "연산 학습",
    icon: "📐",
    status: "active",
    enabled: true,
    entryRoute: "/math",
    modules: [
      {
        id: "arithmetic",
        title: "연산 학습",
        description: "자연수 사칙연산 (덧셈·뺄셈·곱셈·나눗셈)",
        badgeText: "학습 가능",
        icon: "➕✖",
        status: "active",
        enabled: true,
        route: "/math/arithmetic"
      },
      {
        id: "fraction",
        title: "분수 연산",
        description: "진분수·가분수·대분수 사칙연산",
        badgeText: "준비 중",
        icon: "½",
        status: "coming_soon",
        enabled: false,
        route: "/math/fraction"
      },
      {
        id: "decimal",
        title: "소수 연산",
        description: "소수의 덧셈·뺄셈·곱셈·나눗셈",
        badgeText: "준비 중",
        icon: "0.5",
        status: "coming_soon",
        enabled: false,
        route: "/math/decimal"
      }
    ],
    capabilities: ["worksheet", "canvas", "grading", "adaptive"]
  },
  {
    id: "korean",
    title: "국어",
    description: "어휘와 문해력의 기초",
    badgeText: "준비 중",
    icon: "📖",
    status: "coming_soon",
    enabled: false,
    entryRoute: "/korean",
    modules: [
      {
        id: "reading",
        title: "독해",
        description: "지문 읽기와 이해",
        badgeText: "준비 중",
        status: "coming_soon",
        enabled: false,
        route: "/korean/reading"
      },
      {
        id: "writing",
        title: "어휘·맞춤법",
        description: "기초 맞춤법과 단어 쓰기",
        badgeText: "준비 중",
        status: "coming_soon",
        enabled: false,
        route: "/korean/writing"
      }
    ],
    capabilities: []
  },
  {
    id: "english",
    title: "영어",
    description: "파닉스와 기초 어휘",
    badgeText: "준비 중",
    icon: "🔤",
    status: "coming_soon",
    enabled: false,
    entryRoute: "/english",
    modules: [
      {
        id: "vocabulary",
        title: "기초 단어",
        description: "초등 필수 영단어",
        badgeText: "준비 중",
        status: "coming_soon",
        enabled: false,
        route: "/english/vocabulary"
      },
      {
        id: "phonics",
        title: "파닉스",
        description: "소리와 글자의 관계",
        badgeText: "준비 중",
        status: "coming_soon",
        enabled: false,
        route: "/english/phonics"
      }
    ],
    capabilities: []
  }
]);

/**
 * 모든 등록 과목 목록 반환
 */
export function getAllSubjects() {
  return SUBJECTS;
}

/**
 * 활성(active & enabled) 상태인 과목 목록 반환
 */
export function getActiveSubjects() {
  return SUBJECTS.filter((subject) => subject.status === "active" && subject.enabled);
}

/**
 * 과목 ID로 과목 정보 조회
 */
export function getSubject(subjectId) {
  if (!subjectId) return null;
  return SUBJECTS.find((s) => s.id === subjectId) || null;
}

/**
 * 특정 과목의 하위 모듈 정보 조회
 */
export function getSubjectModule(subjectId, moduleId) {
  const subject = getSubject(subjectId);
  if (!subject || !Array.isArray(subject.modules)) return null;
  return subject.modules.find((m) => m.id === moduleId) || null;
}

/**
 * 경로(route)에 해당하는 과목 또는 모듈 정보 조회
 */
export function resolveSubjectByRoute(routePath) {
  if (!routePath) return null;
  const path = String(routePath).trim();

  for (const subject of SUBJECTS) {
    if (subject.entryRoute === path) {
      return { subject, module: null };
    }
    if (Array.isArray(subject.modules)) {
      for (const mod of subject.modules) {
        if (mod.route === path || path.startsWith(`${mod.route}/`)) {
          return { subject, module: mod };
        }
      }
    }
  }
  return null;
}
