//+_+// Math Canvas Pro - 학습자 Command 모듈 (Learner Commands)
//+_+// SSOT Section 6 & 10 및 Phase F3 최종 보완 명세 준수
//+_+// - CUD 작업 전담 (생성, 수정, 보관, 복원, 선택)
//+_+// - UI가 storage.js를 직접 호출하지 않고 본 Command 모듈을 통해 실행
//+_+// - Command 레벨 중앙 세션 가드(configureLearnerSessionGuard)를 통한 활성 세션 중 학습자 변경/조작 원천 차단

import {
  createLearnerProfile,
  updateLearnerProfile,
  archiveLearnerProfile,
  unarchiveLearnerProfile,
  setCurrentLearnerId,
  getCurrentLearnerId
} from "../storage.js";

let learnerSessionGuard = null;

//+_+// 중앙 세션 가드 함수 설정
export function configureLearnerSessionGuard(guardFn) {
  learnerSessionGuard = typeof guardFn === "function" ? guardFn : null;
}

//+_+// 테스트용 세션 가드 리셋
export function _resetLearnerSessionGuardForTesting() {
  learnerSessionGuard = null;
}

//+_+// 활성 세션 진행 여부 검사 헬퍼
function assertNoActiveSession(actionName = "작업") {
  if (learnerSessionGuard && learnerSessionGuard()) {
    throw new Error(`현재 활성 세션이 진행 중입니다. 학습자 ${actionName}을(를) 수행하려면 먼저 세션을 종료해야 합니다.`);
  }
}

//+_+// 신규 학습자 프로필 생성
export async function createLearner({ name, avatar, icon, avatarKey, schoolGrade, guardianPolicy }) {
  assertNoActiveSession("생성");

  const selectedAvatar = avatar || icon || avatarKey || "🌱";
  const profile = await createLearnerProfile({
    name,
    avatar: selectedAvatar,
    icon: selectedAvatar,
    avatarKey: selectedAvatar,
    schoolGrade,
    guardianPolicy
  });

  //+_+// 생성 후 자동 선택
  if (profile && profile.id) {
    setCurrentLearnerId(profile.id);
  }
  return profile;
}

//+_+// 학습자 프로필 수정 (이름, 아바타 등)
export async function updateLearner(id, updates = {}) {
  assertNoActiveSession("수정");

  const payload = { ...updates };
  if (payload.avatar && !payload.icon) {
    payload.icon = payload.avatar;
    payload.avatarKey = payload.avatar;
  }
  return await updateLearnerProfile(id, payload);
}

//+_+// 학습자 프로필 보관 (데이터는 무손실 보존)
export async function archiveLearner(id) {
  assertNoActiveSession("보관");
  return await archiveLearnerProfile(id);
}

//+_+// 보관된 학습자 프로필 복원
export async function restoreLearner(id) {
  assertNoActiveSession("복원");
  return await unarchiveLearnerProfile(id);
}

//+_+// 활성 학습자 선택/전환 (중앙 세션 가드 자동 적용)
export async function selectLearner(id) {
  if (!id) {
    throw new Error("선택할 학습자 ID가 유효하지 않습니다.");
  }

  //+_+// 활성 세션 중 변경 원천 차단 (호출자 옵션 불필요)
  assertNoActiveSession("변경");

  const currentId = getCurrentLearnerId();
  if (currentId !== id) {
    setCurrentLearnerId(id);
  }
  return id;
}
