//+_+// Math Canvas Pro - 학습 데이터 상태 변경 Command 계층
//+_+// SSOT Section 3 및 Phase F4 명세 준수
//+_+// - UI -> Command -> storage.js 상태 변경 경계 제공

import {
  saveSessionRecord,
  saveDraftSession,
  clearDraftSession,
  clearAllData,
  saveSubmissionSnapshot,
  getSubmission as storageGetSubmission,
  getCurrentLearnerId,
  DEFAULT_LEGACY_LEARNER_ID,
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

//+_+// Phase F4: 학습 세션 풀이 제출 및 불변 Snapshot 원자적 저장 (성공 시에만 Draft 정리 및 상태 전이)
export async function submitLearningSession(options = {}) {
  if (!options) throw new Error("제출할 세션 옵션 또는 스냅샷 데이터가 필요합니다.");

  const session = options.session;
  let snapshot;

  // 1. 제출 시작 및 학생 입력 잠금 (SUBMITTING 전이)
  if (session && typeof session.startSubmitting === "function" && session.state === "PRACTICE_ACTIVE") {
    session.startSubmitting();
  }

  if (session && typeof session.createSubmissionSnapshot === "function") {
    snapshot = session.createSubmissionSnapshot(options);
  } else if (session && session.id && session.questions) {
    snapshot = {
      ...options,
      sessionId: session.id,
      questions: session.questions,
      config: session.config || { pageSize: session.pageSize, operation: session.operation, cols: session.cols, rows: session.rows },
      totalPages: session.totalPages,
      pageSize: session.pageSize,
      totalSolveTimeMs: options.totalSolveTimeMs || 0
    };
  } else if (options.sessionId && options.questions) {
    snapshot = options;
  } else {
    if (session && typeof session.rollbackSubmitting === "function") {
      session.rollbackSubmitting();
    }
    throw new Error("유효한 세션 인스턴스 또는 스냅샷 데이터가 필요합니다.");
  }

  // 2. 불변 Snapshot 영구 스토리지에 원자적 저장 (멱등성 보장)
  let savedSubmission;
  try {
    savedSubmission = await saveSubmissionSnapshot(snapshot, options);
  } catch (saveError) {
    // 저장 실패 시 세션 상태를 PRACTICE_ACTIVE로 롤백하고 에러 전파
    if (session && typeof session.rollbackSubmitting === "function") {
      session.rollbackSubmitting();
    }
    throw saveError;
  }

  // 3. 저장 성공 확인 후 세션 상태를 SUBMITTED_LOCKED -> PARENT_GRADING_PENDING으로 확정
  if (session) {
    if (session.state === "SUBMITTING") {
      if (typeof session.submitPractice === "function") {
        session.submitPractice(snapshot.totalSolveTimeMs);
      }
      if (typeof session.setPendingGrading === "function") {
        session.setPendingGrading();
      }
    }
  }

  // 4. 스냅샷 저장 성공이 확인된 경우에만 활성 Draft 삭제 (실패 시에도 스냅샷 보존 및 경고 반환)
  let draftCleaned = true;
  let draftCleanupError = null;
  if (savedSubmission && savedSubmission.learnerId) {
    try {
      await clearDraftSession({ learnerId: savedSubmission.learnerId });
    } catch (cleanupErr) {
      draftCleaned = false;
      draftCleanupError = cleanupErr?.message || String(cleanupErr);
      console.warn("Draft cleanup failed after submission snapshot was saved:", cleanupErr);
    }
  }

  return {
    ...savedSubmission,
    draftCleaned,
    draftCleanupError
  };
}

//+_+// Phase F4: 보호자 채점 상태 및 빨간 펜 레이어 갱신 Command
export async function updateSubmissionGrading(submissionId, gradingResults = {}, gradingStrokesMap = new Map(), options = {}) {
  return await storageUpdateSubmissionGrading(submissionId, gradingResults, gradingStrokesMap, options);
}

//+_+// Phase F5: 보호자가 명시적으로 채점을 시작할 때만 GRADING_ACTIVE로 전환 (PARENT_GRADING_PENDING -> GRADING_ACTIVE 전이만 허용)
export async function startSubmissionGrading(submissionId, options = {}) {
  if (!submissionId) throw new Error("채점을 시작할 submission ID가 필요합니다.");

  const rawExisting = await storageGetSubmission(submissionId, { allLearners: true });
  if (!rawExisting) {
    throw new Error(`해당 ID(${submissionId})의 submission snapshot을 찾을 수 없습니다.`);
  }

  // 소유권 검사
  const targetLearnerId = options.allLearners ? null : (options.learnerId || getCurrentLearnerId());
  if (targetLearnerId && (rawExisting.learnerId || DEFAULT_LEGACY_LEARNER_ID) !== targetLearnerId) {
    throw new Error("해당 제출본에 대한 접근 또는 수정 권한이 없습니다.");
  }

  const currentStatus = rawExisting.status || "PARENT_GRADING_PENDING";
  if (currentStatus !== "PARENT_GRADING_PENDING") {
    throw new Error(`PARENT_GRADING_PENDING 상태의 제출본만 채점을 시작할 수 있습니다. (현재 상태: ${currentStatus})`);
  }

  return await storageUpdateSubmissionGrading(submissionId, {}, new Map(), {
    ...options,
    status: "GRADING_ACTIVE"
  });
}

//+_+// Phase F5: 문제별 판정과 빨간 펜을 Submission의 가변 채점 영역에 저장
export async function saveSubmissionGradingProgress(submissionId, gradingResults = {}, gradingStrokesMap = new Map(), options = {}) {
  return await storageUpdateSubmissionGrading(submissionId, gradingResults, gradingStrokesMap, {
    ...options,
    status: options.status || "GRADING_ACTIVE"
  });
}
