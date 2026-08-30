//+_+// Math Canvas Pro - 학습자 Command 모듈 (Learner Commands)
//+_+// SSOT Section 6 & 10 및 Phase F3 재검토 명세 준수
//+_+// - CUD 작업 전담 (생성, 수정, 보관, 복원, 선택)
//+_+// - UI가 storage.js를 직접 호출하지 않고 본 Command 모듈을 통해 실행
//+_+// - 활성 세션 진행 중 임의 전환 차단 계약 준수

import {
  createLearnerProfile,
  updateLearnerProfile,
  archiveLearnerProfile,
  unarchiveLearnerProfile,
  setCurrentLearnerId,
  getCurrentLearnerId
} from "../storage.js";

//+_+// 신규 학습자 프로필 생성
export async function createLearner({ name, avatar, icon, avatarKey }) {
  const selectedAvatar = avatar || icon || avatarKey || "🌱";
  const profile = await createLearnerProfile({
    name,
    avatar: selectedAvatar,
    icon: selectedAvatar,
    avatarKey: selectedAvatar
  });

  //+_+// 생성 후 자동 선택
  if (profile && profile.id) {
    setCurrentLearnerId(profile.id);
  }
  return profile;
}

//+_+// 학습자 프로필 수정 (이름, 아바타 등)
export async function updateLearner(id, updates = {}) {
  const payload = { ...updates };
  if (payload.avatar && !payload.icon) {
    payload.icon = payload.avatar;
    payload.avatarKey = payload.avatar;
  }
  return await updateLearnerProfile(id, payload);
}

//+_+// 학습자 프로필 보관 (데이터는 무손실 보존)
export async function archiveLearner(id) {
  return await archiveLearnerProfile(id);
}

//+_+// 보관된 학습자 프로필 복원
export async function restoreLearner(id) {
  return await unarchiveLearnerProfile(id);
}

//+_+// 활성 학습자 선택/전환
export async function selectLearner(id, options = {}) {
  if (!id) {
    throw new Error("선택할 학습자 ID가 유효하지 않습니다.");
  }

  //+_+// 활성 세션 검사 (세션 진행 중 임의 전환 차단)
  if (options.isSessionActive && options.isSessionActive()) {
    throw new Error("현재 활성 세션이 진행 중입니다. 학습자를 변경하려면 먼저 세션을 종료해야 합니다.");
  }

  const currentId = getCurrentLearnerId();
  if (currentId !== id) {
    setCurrentLearnerId(id);
  }
  return id;
}
