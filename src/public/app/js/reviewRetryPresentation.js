// UI adapter for the storage Retry result. Restore saved work before starting a fresh worksheet.
export function openReviewRetryResult(result, { startSession, restoreDraft } = {}) {
  const session = result?.retrySession;
  if (!session?.questions?.length || !session.config) throw new Error("재풀이 세션을 찾을 수 없습니다.");
  if (result.resumed && !result.draft) throw new Error('저장된 재풀이 내용을 찾을 수 없습니다. 빈 풀이로 이어풀기를 시작하지 않았습니다.');
  if (result.draft) {
    if (!restoreDraft(result.draft)) throw new Error("저장된 재풀이를 복원할 수 없습니다.");
  } else {
    startSession(session.questions, session.config);
  }
  return result.reviewItem.id;
}
