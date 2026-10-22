//+_+// Math Canvas Pro - 학습자 조회 Query 계층
//+_+// SSOT Section 3 & 5 및 Phase F3 명세 준수
//+_+// - UI -> Query -> storage.js 읽기 전용 경계 제공

import {
  getCurrentLearnerId,
  getLearnerProfile,
  getActiveLearners,
  getAllLearnerProfiles,
  restoreActiveLearner as storageRestoreActiveLearner
} from "../storage.js";

//+_+// 현재 활성 학습자 ID 조회
export function getActiveLearnerId() {
  return getCurrentLearnerId();
}

//+_+// 현재 활성 학습자 프로필 객체 조회
export async function getActiveLearner() {
  const activeId = getCurrentLearnerId();
  if (!activeId) return null;
  const profile = await getLearnerProfile(activeId);
  if (!profile || profile.archived) return null;
  return profile;
}

//+_+// 활성 학습자 목록 조회 (최근 사용/생성 순 정렬)
export async function getLearners() {
  const learners = await getActiveLearners();
  const activeId = getCurrentLearnerId();

  //+_+// 현재 active 학습자가 있으면 최상단으로 우선 정렬
  return learners.sort((a, b) => {
    if (a.id === activeId) return -1;
    if (b.id === activeId) return 1;
    const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return timeB - timeA;
  });
}

//+_+// 보관된 학습자 목록 조회
export async function getArchivedLearnersList() {
  const all = await getAllLearnerProfiles({ includeArchived: true });
  return all.filter((p) => p.archived);
}

//+_+// 전체 학습자 프로필 목록 조회 (보관 포함)
export async function getAllLearners() {
  return await getAllLearnerProfiles();
}

//+_+// ID로 특정 학습자 프로필 조회
export async function getLearnerById(learnerId) {
  if (!learnerId) return null;
  return await getLearnerProfile(learnerId);
}

//+_+// 앱 시작 시 마지막 활성 학습자 복원
export async function restoreActiveLearner(options = {}) {
  return await storageRestoreActiveLearner(options);
}
