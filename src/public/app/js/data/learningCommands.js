//+_+// Math Canvas Pro - 학습 데이터 상태 변경 Command 계층
//+_+// SSOT Section 3 및 Phase F3 명세 준수
//+_+// - UI -> Command -> storage.js 상태 변경 경계 제공

import {
  saveSessionRecord,
  saveDraftSession,
  clearDraftSession,
  clearAllData
} from "../storage.js";

//+_+// 완료된 학습 세션 레코드 저장
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
