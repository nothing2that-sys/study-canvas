export function getPreferredScrollBehavior(matchMediaFn = globalThis.matchMedia) {
  try {
    return matchMediaFn?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth";
  } catch {
    return "auto";
  }
}

export function createVisualViewportController({ windowRef = globalThis.window, documentRef = globalThis.document, onChange = () => {} } = {}) {
  const rootStyle = documentRef?.documentElement?.style;
  const viewport = windowRef?.visualViewport;
  const listeners = [];
  let frameId = null;

  const apply = () => {
    frameId = null;
    const width = viewport?.width || windowRef?.innerWidth || 0;
    const height = viewport?.height || windowRef?.innerHeight || 0;
    const offsetTop = viewport?.offsetTop || 0;
    const offsetLeft = viewport?.offsetLeft || 0;
    const keyboardInset = Math.max(0, (windowRef?.innerHeight || height) - height - offsetTop);
    rootStyle?.setProperty("--visual-viewport-width", `${width}px`);
    rootStyle?.setProperty("--visual-viewport-height", `${height}px`);
    rootStyle?.setProperty("--visual-viewport-offset-top", `${offsetTop}px`);
    rootStyle?.setProperty("--visual-viewport-offset-left", `${offsetLeft}px`);
    rootStyle?.setProperty("--keyboard-inset", `${keyboardInset}px`);
    onChange({ width, height, offsetTop, offsetLeft, keyboardInset });
  };

  const schedule = () => {
    if (frameId !== null) return;
    frameId = windowRef?.requestAnimationFrame ? windowRef.requestAnimationFrame(apply) : 0;
    if (!windowRef?.requestAnimationFrame) apply();
  };

  const listen = (target, type) => {
    target?.addEventListener?.(type, schedule, { passive: true });
    listeners.push([target, type]);
  };
  listen(viewport, "resize");
  listen(viewport, "scroll");
  listen(windowRef, "resize");
  listen(windowRef, "orientationchange");
  schedule();

  return {
    refresh: schedule,
    destroy() {
      listeners.forEach(([target, type]) => target?.removeEventListener?.(type, schedule));
      if (frameId !== null && windowRef?.cancelAnimationFrame) windowRef.cancelAnimationFrame(frameId);
      frameId = null;
    }
  };
}
