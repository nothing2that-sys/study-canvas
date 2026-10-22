//+_+// Phase F10A: 통합 학습 플랫폼 타당성 검증 (Typed Response Engine)
//+_+// SSOT UNIFIED_CURRICULUM_ACTIVITY_PLATFORM_v2.2 및 Phase F10A 명세 준수
//+_+// - typed response(TEXT, CHOICE) 계약 정의 및 normalization
//+_+// - 학생 원본 입력 비파괴 보존 (destructive trim/lowercasing 금지)
//+_+// - CHOICE 안정적 Option ID 보존
//+_+// - Canvas stroke와 ResponseRecord 분리 원칙 준수
//+_+// - 제출 후 Answer Lock 검증

import { ResponseType } from "./learningActivity.js";

export const RESPONSE_RECORD_SCHEMA_VERSION = 1;

export function createResponseRecord(questionId, responseType, value, options = {}) {
  const qId = String(questionId || "").trim();
  if (!qId) {
    throw new Error("ResponseRecord에는 questionId가 필요합니다.");
  }

  const type = String(responseType || "").trim().toUpperCase();
  if (type !== ResponseType.TEXT && type !== ResponseType.CHOICE) {
    throw new Error(`지원되는 typed responseType은 TEXT 또는 CHOICE여야 합니다: ${responseType}`);
  }

  //+_+// 학생 원본 입력 보존: destructive 변환을 가하지 않고 원본 문자열 유지
  const rawValue = value !== undefined && value !== null ? String(value) : "";

  return {
    questionId: qId,
    responseType: type,
    value: rawValue,
    updatedAt: Number(options.updatedAt) || Date.now(),
    schemaVersion: RESPONSE_RECORD_SCHEMA_VERSION
  };
}

export function normalizeResponseRecord(input) {
  if (!input || typeof input !== "object") return null;
  const questionId = String(input.questionId || "").trim();
  if (!questionId) return null;

  const responseType = String(input.responseType || "").trim().toUpperCase();
  if (responseType !== ResponseType.TEXT && responseType !== ResponseType.CHOICE) {
    return null;
  }

  const value = input.value !== undefined && input.value !== null ? String(input.value) : "";

  return {
    questionId,
    responseType,
    value,
    updatedAt: Number(input.updatedAt) || Date.now(),
    schemaVersion: Number(input.schemaVersion) || RESPONSE_RECORD_SCHEMA_VERSION
  };
}

export function normalizeResponseRecordsMap(inputMap) {
  if (!inputMap || typeof inputMap !== "object") return {};
  const normalized = {};

  const entries = inputMap instanceof Map
    ? inputMap.entries()
    : Object.entries(inputMap);

  for (const [key, value] of entries) {
    if (!key) continue;
    let rec = null;
    if (value && typeof value === "object" && value.responseType) {
      rec = normalizeResponseRecord(value);
    } else if (typeof value === "string") {
      // shorthand value: { qId: "val" }
      rec = normalizeResponseRecord({
        questionId: key,
        responseType: ResponseType.TEXT,
        value
      });
    }
    if (rec) {
      normalized[rec.questionId] = rec;
    }
  }

  return normalized;
}

export function isResponseAnswered(record) {
  if (!record || typeof record !== "object") return false;
  if (record.responseType === ResponseType.TEXT) {
    return String(record.value || "").trim().length > 0;
  }
  if (record.responseType === ResponseType.CHOICE) {
    return String(record.value || "").trim().length > 0;
  }
  return false;
}

//+_+// Phase F4/F10A/Rework 1: 세션/제출 상태 기준 학생 응답 잠금(Answer Lock) 확인
export function assertResponseNotLocked(sessionOrSubmission, questionId) {
  if (!sessionOrSubmission) return true;

  //+_+// Submission 객체인 경우 (status 필드 검사)
  if (sessionOrSubmission.status) {
    const status = sessionOrSubmission.status;
    if (status !== "PRACTICE_ACTIVE" && status !== "SUBMITTING") {
      throw new Error(`제출 완료된 학습(${sessionOrSubmission.id || ""})의 학생 응답은 수정할 수 없습니다 (상태: ${status}).`);
    }
  }

  //+_+// Session 객체인 경우 (isPracticeMutable 함수 또는 state 필드 검사)
  if (typeof sessionOrSubmission.isPracticeMutable === "function") {
    if (!sessionOrSubmission.isPracticeMutable()) {
      throw new Error(`잠금된 학습 세션(${sessionOrSubmission.id || ""})의 학생 응답은 수정할 수 없습니다 (상태: ${sessionOrSubmission.state}).`);
    }
  } else if (sessionOrSubmission.state && sessionOrSubmission.state !== "PRACTICE_ACTIVE") {
    throw new Error(`잠금된 학습 세션(${sessionOrSubmission.id || ""})의 학생 응답은 수정할 수 없습니다 (상태: ${sessionOrSubmission.state}).`);
  }

  return true;
}

//+_+// Phase F10A Rework 1: Production Typed Response Mutation Guard (F10A-R1)
//+_+// 반드시 session.isPracticeMutable() 계약을 통과한 경우에만 responseMap 변경 허용
export function applyStudentResponseChange(session, responseMap, question, value, options = {}) {
  if (!session) {
    throw new Error("학생 응답을 변경하려면 활성 학습 세션이 필요합니다.");
  }

  const isMutable = typeof session.isPracticeMutable === "function"
    ? session.isPracticeMutable()
    : (session.state === "PRACTICE_ACTIVE");

  if (!isMutable) {
    const currentState = session.state || "UNKNOWN";
    throw new Error(`현재 세션 상태(${currentState})에서는 학생 응답을 수정할 수 없습니다 (PRACTICE_ACTIVE 상태에서만 변경 가능).`);
  }

  //+_+// 추가 안전 방어: assertResponseNotLocked 검증
  assertResponseNotLocked(session, question?.id || question);

  const qId = String(question?.id || question || "").trim();
  if (!qId) {
    throw new Error("학생 응답을 적용할 question ID가 필요합니다.");
  }

  const responseType = question?.responseType ||
    (question?.activityType === "SHORT_ANSWER" ? ResponseType.TEXT : (question?.activityType === "MULTIPLE_CHOICE" ? ResponseType.CHOICE : options.responseType || ResponseType.TEXT));

  const record = createResponseRecord(qId, responseType, value, options);

  if (responseMap instanceof Map) {
    responseMap.set(record.questionId, record);
  } else if (responseMap && typeof responseMap === "object") {
    responseMap[record.questionId] = record;
  }

  return record;
}

