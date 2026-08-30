/**
 * Math Canvas Pro - 학습자 상태 변경 Command 계층
 * SSOT Section 3 & 6 및 Phase F3 명세 준수
 * - UI -> Command -> storage.js 호출 경계 제공
 * - 학습자 생성, 수정, 보관, 복원, 선택
 */

import {
  createLearnerProfile,
  updateLearnerProfile,
  archiveLearnerProfile,
  unarchiveLearnerProfile,
  setCurrentLearnerId,
  clearCurrentLearner,
  getLearnerProfile,
  getActiveLearners
} from "../storage.js";

/**
 * 신규 학습자 프로필 생성 및 active learner 지정 옵션
 */
export async function createLearner(profileData = {}, options = { makeActive: true }) {
  const name = String(profileData.name || "").trim();
  if (!name) {
    throw new Error("학습자 이름을 입력해 주세요.");
  }

  const profile = await createLearnerProfile({
    name,
    avatar: profileData.avatar || "🌱",
    color: profileData.color || "#173f35",
    theme: profileData.theme || "paper",
    soundEnabled: profileData.soundEnabled ?? true
  });

  if (options.makeActive && profile && profile.id) {
    setCurrentLearnerId(profile.id);
  }

  return profile;
}

/**
 * 학습자 프로필 수정 (이름, 아바타, 색상 등)
 */
export async function updateLearner(learnerId, updates = {}) {
  if (!learnerId) {
    throw new Error("수정할 학습자 ID가 필요합니다.");
  }
  return await updateLearnerProfile(learnerId, updates);
}

/**
 * 학습자 보관 (소프트 아카이브: 기존 기록은 보존)
 */
export async function archiveLearner(learnerId) {
  if (!learnerId) {
    throw new Error("보관할 학습자 ID가 필요합니다.");
  }
  const result = await archiveLearnerProfile(learnerId);

  // 현재 active learner를 보관한 경우 다음 활성 학습자로 자동 전환하거나 클리어
  const activeLearners = await getActiveLearners();
  if (activeLearners.length > 0) {
    setCurrentLearnerId(activeLearners[0].id);
  } else {
    clearCurrentLearner();
  }

  return result;
}

/**
 * 보관된 학습자 복원 (Unarchive)
 */
export async function restoreLearner(learnerId) {
  if (!learnerId) {
    throw new Error("복원할 학습자 ID가 필요합니다.");
  }
  return await unarchiveLearnerProfile(learnerId);
}

/**
 * 활성 학습자 선택 (Active Learner 전환)
 */
export async function selectLearner(learnerId) {
  if (!learnerId) {
    clearCurrentLearner();
    return null;
  }

  const profile = await getLearnerProfile(learnerId);
  if (!profile || profile.archived) {
    throw new Error("유효하지 않거나 보관된 학습자입니다.");
  }

  setCurrentLearnerId(profile.id);
  return profile;
}
