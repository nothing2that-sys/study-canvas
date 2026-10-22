//+_+// Math Canvas Pro - Practice Interaction Guard & Mutation Helpers
//+_+// Phase F4: 학생 풀이 모드 mutation 상태 검사 및 Canvas/도구 조작 공용 가드 모듈

//+_+// 학생 풀이 mutation 가능 여부 판정 (PRACTICE_ACTIVE 상태만 허용)
export function canMutatePractice(session) {
  return Boolean(
    session &&
    typeof session.isPracticeMutable === "function" &&
    session.isPracticeMutable()
  );
}

//+_+// 학생 풀이 mutation 실행 공통 헬퍼
export function runPracticeMutation(session, mutation) {
  if (!canMutatePractice(session)) {
    return false;
  }
  if (typeof mutation === "function") {
    mutation();
  }
  return true;
}

//+_+// 학생 Canvas 필기 획 변경 적용 (PRACTICE_ACTIVE에서만 strokesMap 갱신)
export function applyStudentStrokeChange({
  session,
  strokesMap,
  questionId,
  strokes,
  onAccepted
}) {
  if (!canMutatePractice(session)) {
    return false;
  }
  if (strokesMap && questionId) {
    strokesMap.set(questionId, strokes);
  }
  if (typeof onAccepted === "function") {
    onAccepted();
  }
  return true;
}

//+_+// 학생 캔버스 Undo 실행
export function performPracticeUndo(session, canvas) {
  if (!canMutatePractice(session)) return false;
  return Boolean(canvas?.undo?.());
}

//+_+// 학생 캔버스 Redo 실행
export function performPracticeRedo(session, canvas) {
  if (!canMutatePractice(session)) return false;
  return Boolean(canvas?.redo?.());
}

//+_+// 학생 캔버스 전체 지우기 실행
export function performPracticeClear(session, canvases = [], strokesMap = null, questionId = null) {
  if (!canMutatePractice(session)) return false;

  if (Array.isArray(canvases)) {
    for (const canvas of canvases) {
      if (canvas && typeof canvas.clear === "function") {
        canvas.clear();
      }
    }
  } else if (canvases && typeof canvases.clear === "function") {
    canvases.clear();
  }

  if (strokesMap && questionId) {
    strokesMap.delete(questionId);
  }
  return true;
}

//+_+// 학생 펜 도구 속성 변경 (색상/굵기/지우개/펜모드)
export function performPracticeToolSelect(session, setterFn) {
  if (!canMutatePractice(session)) return false;
  if (typeof setterFn === "function") {
    setterFn();
  }
  return true;
}

//+_+// 학생 워크시트 페이지 이동 (이전/다음/지정)
export function performPracticePageNav(session, navFn) {
  if (!canMutatePractice(session)) return false;
  if (typeof navFn === "function") {
    return navFn();
  }
  return false;
}
