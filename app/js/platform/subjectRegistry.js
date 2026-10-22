//+_+// Math Canvas Pro - 과목 레지스트리 (Subject Registry)
//+_+// SSOT Section 10~11 및 Phase F3 명세 준수
//+_+// - 단일 Registry로 과목(수학, 국어, 영어) 및 하위 모듈 계약 관리
//+_+// - UI 하드코딩 방지 및 다과목 확장성 확보
//+_+// Phase F12: Korean Core 모듈 상시 활성화 (SSOT)
import { isReleaseSubjectAllowed } from "../publicReleasePolicy.js";
const KOREAN_MODULES = Object.freeze([
  {
    id: "korean-core",
    title: "국어 핵심",
    description: "어휘·맞춤법·띄어쓰기·문장",
    badgeText: "학습 가능",
    icon: "✏️",
    status: "active",
    enabled: true,
    route: "/korean/core"
  },
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
]);

//+_+// Phase F13: English Core 모듈 상시 활성화 (SSOT)
const ENGLISH_MODULES = Object.freeze([
  {
    id: "english-core",
    title: "영어 핵심",
    description: "어휘·단어형·표현·문장",
    badgeText: "학습 가능",
    icon: "🔤",
    status: "active",
    enabled: true,
    route: "/english/core"
  },
  {
    id: "phonics",
    title: "파닉스",
    description: "소리와 글자의 관계",
    badgeText: "준비 중",
    status: "coming_soon",
    enabled: false,
    route: "/english/phonics"
  },
  {
    id: "reading",
    title: "독해",
    description: "짧은 글 읽기와 이해",
    badgeText: "준비 중",
    status: "coming_soon",
    enabled: false,
    route: "/english/reading"
  }
]);

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
      //+_+// Phase F11: Measurement 모듈 활성화
      {
        id: "measurement",
        title: "단위 변환",
        description: "길이·무게·들이 단위 변환 (mm, cm, m, km / g, kg / mL, L)",
        badgeText: "학습 가능",
        icon: "📏",
        status: "active",
        enabled: true,
        route: "/math/measurement"
      },
      {
        id: "fraction",
        title: "분수 연산",
        description: "진분수·가분수·대분수의 덧셈과 뺄셈 및 통분",
        badgeText: "학습 가능",
        icon: "½",
        status: "active",
        enabled: true,
        route: "/math/fraction"
      },
      {
        id: "decimal",
        title: "소수 연산",
        description: "소수의 개념, 자릿값, 크기 비교 및 덧셈·뺄셈·곱셈·나눗셈",
        badgeText: "학습 가능",
        icon: "0.5",
        status: "active",
        enabled: true,
        route: "/math/decimal"
      }
    ],
    capabilities: ["worksheet", "canvas", "grading", "adaptive"]
  },
  //+_+// Phase F12: Korean Core 활성화 (canonical active subject)
  {
    id: "korean",
    title: "국어",
    description: "어휘와 문해력의 기초",
    badgeText: "AI 검토 자료",
    icon: "📖",
    status: "active",
    enabled: true,
    entryRoute: "/korean",
    modules: KOREAN_MODULES,
    capabilities: ["worksheet", "grading", "adaptive"]
  },
  //+_+// Phase F13: English Core 활성화 (canonical active subject)
  {
    id: "english",
    title: "영어",
    description: "어휘와 표현의 기초",
    badgeText: "AI 검토 자료",
    icon: "🔤",
    status: "active",
    enabled: true,
    entryRoute: "/english",
    modules: ENGLISH_MODULES,
    capabilities: ["worksheet", "grading", "adaptive"]
  }
]);

//+_+// 모든 등록 과목 목록 반환
export function getAllSubjects() {
  return SUBJECTS.filter(subject => isReleaseSubjectAllowed(subject.id));
}

//+_+// 활성(active & enabled) 상태인 과목 목록 반환
export function getActiveSubjects() {
  return SUBJECTS.filter((subject) => subject.status === "active" && subject.enabled && isReleaseSubjectAllowed(subject.id));
}

//+_+// 과목 ID로 과목 정보 조회
export function getSubject(subjectId) {
  if (!subjectId || !isReleaseSubjectAllowed(subjectId)) return null;
  return SUBJECTS.find((s) => s.id === subjectId) || null;
}

//+_+// 특정 과목의 하위 모듈 정보 조회
export function getSubjectModule(subjectId, moduleId) {
  const subject = getSubject(subjectId);
  if (!subject || !Array.isArray(subject.modules)) return null;
  return subject.modules.find((m) => m.id === moduleId) || null;
}

//+_+// 경로(route)에 해당하는 과목 또는 모듈 정보 조회
export function resolveSubjectByRoute(routePath) {
  if (!routePath) return null;
  const path = String(routePath).trim();

  for (const subject of SUBJECTS) {
    if (!isReleaseSubjectAllowed(subject.id)) continue;
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
