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

//+_+// Phase F4/F10A: 제출 이후 학생 응답 잠금(Answer Lock) 확인
export function assertResponseNotLocked(submission, questionId) {
  if (!submission) return true;
  const status = submission.status;
  if (status && status !== "PRACTICE_ACTIVE" && status !== "SUBMITTING") {
    throw new Error(`제출 완료된 학습(${submission.id})의 학생 응답은 수정할 수 없습니다 (상태: ${status}).`);
  }
  return true;
}
