/**
 * Math Canvas Pro - 앱 전역 Interaction Guard (작업 5)
 * SSOT Section 41~45 및 CODEX_IPAD_WEBAPP_STABILIZATION 명세 준수
 * - 텍스트 선택, 이미지/링크 드래그, Safari 제스처 확대, 컨텍스트 메뉴 차단
 * - input, textarea, select, dialog 등 필수 조작 요소 예외 허용
 * - 화면 상태 Class 단일 관리 (mode-setup, mode-practice, mode-grading, mode-result, mode-modal-open)
 */

export const AppMode = Object.freeze({
  SETUP: "mode-setup",
  PRACTICE: "mode-practice",
  GRADING: "mode-grading",
  RESULT: "mode-result",
  MODAL_OPEN: "mode-modal-open"
});

/**
 * 특정 요소가 상호작용 예외 대상(입력창, 선택상자 등)인지 확인
 */
export function isInteractiveElement(target) {
  if (!target || typeof target.closest !== "function") return false;
  return Boolean(
    target.closest("input, textarea, select, option, [contenteditable='true'], dialog, [data-interactive='true']")
  );
}

/**
 * 앱 전역 Interaction Guard 초기화
 */
export function setupInteractionGuard(rootElement = (typeof document !== "undefined" ? document : null)) {
  if (!rootElement) return { destroy: () => {}, setAppMode: () => {} };

  const listeners = [];

  function addGuardListener(target, type, handler, options = { capture: true, passive: false }) {
    if (!target || typeof target.addEventListener !== "function") return;
    target.addEventListener(type, handler, options);
    listeners.push({ target, type, handler, options });
  }

  // 1. 텍스트 선택 차단 (입력창 제외)
  const onSelectStart = (e) => {
    if (isInteractiveElement(e.target)) return;
    if (e.cancelable) e.preventDefault();
  };

  // 2. 드래그 차단
  const onDragStart = (e) => {
    if (isInteractiveElement(e.target)) return;
    if (e.cancelable) e.preventDefault();
  };

  // 3. 컨텍스트 메뉴 및 Safari Callout 차단
  const onContextMenu = (e) => {
    if (isInteractiveElement(e.target)) return;
    if (e.cancelable) e.preventDefault();
  };

  // 4. Safari 멀티터치 제스처 (핀치 줌 등) 차단
  const onGesture = (e) => {
    if (e.cancelable) e.preventDefault();
  };

  addGuardListener(rootElement, "selectstart", onSelectStart);
  addGuardListener(rootElement, "dragstart", onDragStart);
  addGuardListener(rootElement, "contextmenu", onContextMenu);
  addGuardListener(rootElement, "gesturestart", onGesture);
  addGuardListener(rootElement, "gesturechange", onGesture);
  addGuardListener(rootElement, "gestureend", onGesture);

  return {
    setAppMode(mode) {
      if (typeof document === "undefined" || !document.body) return;
      const allModes = Object.values(AppMode);
      allModes.forEach((m) => document.body.classList.remove(m));
      if (mode && allModes.includes(mode)) {
        document.body.classList.add(mode);
      }
    },
    destroy() {
      listeners.forEach(({ target, type, handler, options }) => {
        if (target && typeof target.removeEventListener === "function") {
          target.removeEventListener(type, handler, options);
        }
      });
      listeners.length = 0;
    }
  };
}
