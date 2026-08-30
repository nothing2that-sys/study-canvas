//+_+// Math Canvas Pro - 학습 데이터 상태 변경 Command 계층
//+_+// SSOT Section 3 및 Phase F4 명세 준수
//+_+// - UI -> Command -> storage.js 상태 변경 경계 제공

import {
  saveSessionRecord,
  saveDraftSession,
  clearDraftSession,
  clearAllData,
  saveSubmissionSnapshot,
  updateSubmissionGrading as storageUpdateSubmissionGrading
} from "../storage.js";

//+_+// 완료된 학습 세션 레코드 저장 (최종 채점 완료 후 sessions/attempts/mistakes 반영)
export async function saveSession(sessionRecord, strokesMap = new Map(), gradingStrokesMap = new Map(), options = {}) {
  return await saveSessionRecord(sessionRecord, strokesMap, gradingStrokesMap, options);
}

//+_+// 진행 중인 학습 세션 임시 저장 (Draft)
export async function saveDraft(draftData, options = {}) {
  return await saveDraftSession(draftData, options);
}

//+_+// 임시 저장된 Draft 삭제
export async function clearDraft(options = {}) {
  return await clearDraftSession(options);
}

//+_+// 학습자 데이터 초기화 (특정 학습자 또는 전체)
export async function clearLearnerData(options = {}) {
  return await clearAllData(options);
}

//+_+// Phase F4: 학습 세션 풀이 제출 및 불변 Snapshot 원자적 저장 (성공 시에만 Draft 정리)
export async function submitLearningSession(options = {}) {
  if (!options) throw new Error("제출할 세션 옵션 또는 스냅샷 데이터가 필요합니다.");

  let snapshot;
  if (options.session && typeof options.session.createSubmissionSnapshot === "function") {
    snapshot = options.session.createSubmissionSnapshot(options);
  } else if (options.sessionId && options.questions) {
    snapshot = options;
  } else {
    throw new Error("유효한 세션 인스턴스 또는 스냅샷 데이터가 필요합니다.");
  }

  // 1. 불변 Snapshot 영구 스토리지에 원자적 저장 (멱등성 보장)
  const savedSubmission = await saveSubmissionSnapshot(snapshot, options);

  // 2. 스냅샷 저장 성공이 확인된 경우에만 활성 Draft 삭제
  if (savedSubmission && savedSubmission.learnerId) {
    try {
      await clearDraftSession({ learnerId: savedSubmission.learnerId });
    } catch (_) {}
  }

  return savedSubmission;
}

//+_+// Phase F4: 보호자 채점 상태 및 빨간 펜 레이어 갱신 Command
export async function updateSubmissionGrading(submissionId, gradingResults = {}, gradingStrokesMap = new Map(), options = {}) {
  return await storageUpdateSubmissionGrading(submissionId, gradingResults, gradingStrokesMap, options);
}

