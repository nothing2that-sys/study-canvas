import {isUsableReviewedActivity} from './aiReviewPolicy.js';
//+_+// Phase F13: Deterministic English Activity Selector
//+_+// SSOT UNIFIED_CURRICULUM_ACTIVITY_PLATFORM_v2.2 및 Phase F13 명세 준수
//+_+// - 사전에 승인된(APPROVED) Activity Bank로부터 결정론적 문제 선택
//+_+// - 전역 Math.random() 배제 (Mulberry32 PRNG), 원본 불변, 선택지 셔플 지원

import { normalizeLearningActivity, DEFAULT_PROBLEM_COUNT } from "./learningActivity.js";

/**
 * 결정론적 의사 난수 생성기 (Mulberry32)
 * @param {number} seed - 32비트 부호 없는 정수 시드
 * @returns {() => number} [0, 1) 범위의 난수를 반환하는 함수
 */
export function createMulberry32(seed) {
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
 * @param {string|number} seed
 * @returns {number}
 */
export function hashSeed(seed) {
  if (typeof seed === "number" && Number.isInteger(seed)) {
    return seed >>> 0;
  }
  const str = String(seed ?? "default-english-seed");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/**
 * 배열을 결정론적으로 셔플 (Fisher-Yates)
 * @template T
 * @param {Array<T>} array
 * @param {() => number} rng
 * @returns {Array<T>} 셔플된 새 배열
 */
function shuffleArray(array, rng) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * 영어 학습 활동 결정론적 선택
 * @param {Object} params
 * @param {string} params.skillId - 학습할 영어 스킬 ID
 * @param {number} [params.count=20] - 선택할 문제 수 (기본: 20)
 * @param {string|number} [params.seed=42] - 결정론적 시드
 * @param {Array<Object>} params.activities - 패키지 활동 목록
 * @param {boolean} [params.shuffleChoices=true] - CHOICE 활동 선택지 셔플 여부
 * @returns {Array<Object>} 불변 복제된 LearningActivity 배열
 */
export function selectEnglishActivities({
  skillId,
  count = DEFAULT_PROBLEM_COUNT,
  seed = 42,
  activities = [],
  shuffleChoices = true
}) {
  if (!skillId || typeof skillId !== "string") {
    throw new TypeError("selectEnglishActivities: 유효한 skillId가 필요합니다.");
  }
  if (!Array.isArray(activities) || activities.length === 0) {
    throw new Error("selectEnglishActivities: activities 배열이 비어있습니다.");
  }

  const numericSeed = hashSeed(seed);
  const rng = createMulberry32(numericSeed);

  // 1. APPROVED 상태 및 subject/skill 일치 활동만 필터링
  const candidates = activities.filter((act) => {
    if (!act || typeof act !== "object") return false;
    if (act.skillId !== skillId) return false;
    if (act.subjectId !== "english") return false;
    const reviewStatus = act.sourceMetadata?.reviewStatus || act.reviewStatus;
    return isUsableReviewedActivity(act);
  });

  if (candidates.length === 0) {
    throw new Error(`selectEnglishActivities: 스킬 ${skillId}에 해당하는 APPROVED 활동이 없습니다.`);
  }

  if (candidates.length < count) {
    throw new Error(`selectEnglishActivities: 스킬 ${skillId}의 APPROVED 활동 수가 부족합니다. (필요: ${count}, 보유: ${candidates.length})`);
  }

  // 2. 활동 결정론적 셔플
  const shuffledCandidates = shuffleArray(candidates, rng);

  // 3. count 개수만큼 선택
  const selected = shuffledCandidates.slice(0, count);

  // 4. 원본 불변을 위해 deep clone 및 선택지 셔플 처리
  const result = selected.map((act) => {
    // 깊은 복제
    const clone = JSON.parse(JSON.stringify(act));

    if (shuffleChoices && clone.responseType === "CHOICE" && Array.isArray(clone.choices)) {
      // 선택지 셔플 (동일 rng 시퀀스 사용하여 결정론 유지)
      clone.choices = shuffleArray(clone.choices, rng);
    }

    return normalizeLearningActivity(clone);
  });

  return result;
}
