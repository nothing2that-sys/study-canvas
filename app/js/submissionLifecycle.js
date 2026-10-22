//+_+// Math Canvas Pro - Phase F4 Submission Lifecycle & Session Restore Helper
//+_+// SSOT Section 16 및 Phase F4 5차 Rework 명세 준수

import { SessionState } from "./sessionEngine.js";

//+_+// 제출 완료로 간주되는 SubmissionSnapshot status 목록
export const SUBMITTED_SNAPSHOT_STATUSES = Object.freeze([
  "SUBMITTED",
  "SUBMITTED_LOCKED",
  "PARENT_GRADING_PENDING",
  "GRADING_ACTIVE",
  "GRADED",
  "SESSION_COMPLETE"
]);

//+_+// Snapshot status가 제출 완료 상태인지 판별
export function isSubmittedSnapshotStatus(status) {
  return SUBMITTED_SNAPSHOT_STATUSES.includes(status);
}

// Restore the persisted lifecycle without writing or finalizing storage again.
export function restoreSessionStateFromSubmission(session, submission) {
  if (session.state === SessionState.IDLE) session.start();
  if (session.state === SessionState.PRACTICE_ACTIVE) session.startSubmitting();
  if (session.state === SessionState.SUBMITTING) {
    session.submitPractice(submission.totalSolveTimeMs || 0, submission.perQuestionElapsedMs || {});
  }
  if (session.state === SessionState.SUBMITTED_LOCKED) session.setPendingGrading();
  const completed = submission.status === "GRADED" || submission.status === "SESSION_COMPLETE";
  if (submission.status === "GRADING_ACTIVE" || completed) {
    if (session.state === SessionState.PARENT_GRADING_PENDING) session.startGrading();
    for (const [id, grade] of Object.entries(submission.gradingResults || {})) {
      // Notes may be persisted before a decision; keep them in the UI map without grading.
      if (!grade || (!grade.decision && typeof grade.isCorrect !== "boolean")) continue;
      const questionId = session.questions.find(question => String(question.id) === String(id))?.id ?? id;
      session.gradeQuestion(questionId, grade.decision ?? grade.isCorrect, grade.comment || "");
    }
    if (completed) return { ...session.finishGrading(), submittedAt: submission.submittedAt,
      completedAt: submission.completedAt, totalSolveTimeMs: submission.totalSolveTimeMs };
  }
  return null;
}

//+_+// F4-R5-01 ~ F4-R5-05: 제출 실패 시 시간 무손실 유지 및 PRACTICE_ACTIVE / Draft 복구
export async function rollbackSubmissionToPractice({
  session,
  elapsedMs,
  unlockInteraction,
  restoreTimer,
  persistDraft,
  error
}) {
  if (error) {
    console.error("제출 Snapshot 저장 실패 및 롤백:", error);
  }

  // 1. 메모리 세션 상태를 PRACTICE_ACTIVE로 롤백
  if (session && typeof session.rollbackSubmitting === "function") {
    session.rollbackSubmitting();
  }

  // 2. UI 인터랙션 잠금 해제
  if (typeof unlockInteraction === "function") {
    unlockInteraction();
  }

  // 3. 풀이 경과 시간(elapsedMs)을 0으로 초기화하지 않고 원래 시간부터 타이머 복구
  const safeElapsedMs = Math.max(0, Number(elapsedMs) || 0);
  if (typeof restoreTimer === "function") {
    restoreTimer(safeElapsedMs);
  }

  // 4. 영구 스토리지의 Draft를 PRACTICE_ACTIVE 상태로 재저장
  if (typeof persistDraft === "function") {
    try {
      await persistDraft(safeElapsedMs);
    } catch (draftRestoreError) {
      console.error("제출 실패 후 PRACTICE_ACTIVE Draft 복구 저장 실패:", draftRestoreError);
    }
  }
}

//+_+// F4-R5-08 ~ F4-R5-11, F4-R5-19 ~ F4-R5-21: Draft로부터 strict state machine을 준수하여 세션 상태 복원
export function restoreSessionStateFromDraft({
  session,
  draft,
  onGradingActive,
  onPracticeActive
}) {
  if (!session || !draft) return;

  // 1. IDLE -> PRACTICE_ACTIVE 진입
  session.start();

  // 2. 문제별 풀이 시간 및 현재 페이지 복원 (PRACTICE_ACTIVE에서만 가능)
  if (typeof session.setQuestionSolveTimes === "function") {
    session.setQuestionSolveTimes(draft.perQuestionElapsedMs || {});
  }
  if (typeof session.goToPage === "function") {
    session.goToPage(draft.currentPageIndex || 0);
  }

  // 3. Grading Draft인 경우 strict state transition 수행
  const isGrading = draft.sessionState === SessionState.GRADING_ACTIVE || draft.sessionType === "grading";
  if (isGrading) {
    session.startSubmitting();
    session.submitPractice(draft.totalElapsedMs || 0);
    session.setPendingGrading();
    session.startGrading();

    // 4. GRADING_ACTIVE 상태에서 개별 채점 결과 복원
    if (draft.gradingResults && typeof session.gradeQuestion === "function") {
      Object.entries(draft.gradingResults).forEach(([questionId, grade]) => {
        if (grade && (grade.decision || typeof grade.isCorrect === "boolean")) {
          session.gradeQuestion(questionId, grade.decision ?? grade.isCorrect, grade.comment || "");
        }
      });
    }

    if (typeof onGradingActive === "function") {
      onGradingActive();
    }
  } else {
    if (typeof onPracticeActive === "function") {
      onPracticeActive();
    }
  }
}

//+_+// F4-R5-12 ~ F4-R5-18: SubmissionSnapshot 우선 복원 정책 평가 순수 함수
export function evaluateStartupDraftResumePolicy({ draft, submission }) {
  if (!draft || !draft.questions || draft.questions.length === 0) {
    return {
      canResumePractice: false,
      shouldCleanupStaleDraft: false,
      reason: "NO_DRAFT"
    };
  }

  // 같은 세션의 SubmissionSnapshot이 이미 제출/채점 완료 상태인 경우
  const isSameSession = Boolean(
    submission &&
    submission.sessionId &&
    draft.sessionId &&
    submission.sessionId === draft.sessionId
  );
  if (isSameSession && isSubmittedSnapshotStatus(submission.status)) {
    const isPracticeDraft = draft.sessionState !== SessionState.GRADING_ACTIVE && draft.sessionType !== "grading";
    if (isPracticeDraft) {
      return {
        canResumePractice: false,
        shouldCleanupStaleDraft: true,
        reason: "SUBMISSION_EXISTS_PRACTICE_BLOCKED"
      };
    }
  }

  return {
    canResumePractice: true,
    shouldCleanupStaleDraft: false,
    reason: "ACTIVE_PRACTICE_DRAFT"
  };
}
