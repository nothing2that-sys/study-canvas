/**
 * Math Canvas Pro - 학습자 & 채점자 키보드 파워 단축키 엔진
 * 워크시트 및 채점 화면에서 효율적인 조작 단축키 지원
 */

export function setupKeyboardShortcuts(handlers = {}) {
  if (typeof window === "undefined") return () => {};

  function handleKeyDown(event) {
    // 텍스트 입력 중일 때는 단축키 무시
    const target = event.target;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
      return;
    }

    const key = event.key;

    // 1. 단축키 도움말 모달 열기 ('?' 키)
    if (key === "?" || (event.shiftKey && key === "/")) {
      event.preventDefault();
      if (handlers.onToggleHelp) handlers.onToggleHelp();
      return;
    }

    // 2. 워크시트 화면 단축키
    if (handlers.isPracticeActive && handlers.isPracticeActive()) {
      if (key === "[" || key === "PageUp") {
        event.preventDefault();
        if (handlers.onPrevPage) handlers.onPrevPage();
      } else if (key === "]" || key === "PageDown") {
        event.preventDefault();
        if (handlers.onNextPage) handlers.onNextPage();
      } else if (key === "e" || key === "E") {
        event.preventDefault();
        if (handlers.onToggleEraser) handlers.onToggleEraser();
      } else if (key === "p" || key === "P") {
        event.preventDefault();
        if (handlers.onTogglePencilOnly) handlers.onTogglePencilOnly();
      } else if (key === "1" || key === "2" || key === "3" || key === "4") {
        event.preventDefault();
        const colorIdx = Number(key) - 1;
        if (handlers.onSelectColor) handlers.onSelectColor(colorIdx);
      } else if (key === "z" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        if (event.shiftKey) {
          if (handlers.onRedo) handlers.onRedo();
        } else {
          if (handlers.onUndo) handlers.onUndo();
        }
      } else if (key === "y" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        if (handlers.onRedo) handlers.onRedo();
      }
      return;
    }

    // 3. 채점 화면 단축키
    if (handlers.isGradingActive && handlers.isGradingActive()) {
      if (key === "a" || key === "A") {
        event.preventDefault();
        if (handlers.onGradeAllCorrect) handlers.onGradeAllCorrect();
      } else if (key === "h" || key === "H") {
        event.preventDefault();
        if (handlers.onToggleAnswers) handlers.onToggleAnswers();
      }
    }
  }

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}
