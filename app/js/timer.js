/**
 * Math Canvas Pro - 정밀 타이머 모듈
 * performance.now() 기반 밀리초 정밀도 시간 측정 및 Page Visibility 대응
 */

export function createQuestionTimer(options = {}) {
  const getTime = options.getTime || (() => (globalThis.performance ? performance.now() : Date.now()));
  const onTick = options.onTick || null;
  const doc = options.document || (typeof document !== "undefined" ? document : null);

  let startedAt = 0;
  let stoppedAt = 0;
  let pausedAt = 0;
  let accumulatedPauseMs = 0;
  let isRunning = false;
  let isPaused = false;
  let animFrameId = null;

  function handleVisibilityChange() {
    if (!doc || !isRunning) return;
    if (doc.hidden) {
      pause();
    } else {
      resume();
    }
  }

  if (doc && typeof doc.addEventListener === "function") {
    doc.addEventListener("visibilitychange", handleVisibilityChange);
  }

  function tick() {
    if (!isRunning || isPaused) return;
    if (onTick) {
      onTick(getElapsedMs());
    }
    if (typeof requestAnimationFrame === "function") {
      animFrameId = requestAnimationFrame(tick);
    }
  }

  function start(initialElapsedMs = 0) {
    const safeInitial = (Number.isFinite(initialElapsedMs) && initialElapsedMs > 0) ? Math.max(0, Number(initialElapsedMs)) : 0;
    const now = getTime();
    startedAt = now - safeInitial;
    stoppedAt = 0;
    pausedAt = 0;
    accumulatedPauseMs = 0;
    isRunning = true;
    isPaused = false;

    if (animFrameId && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    if (onTick) {
      onTick(safeInitial);
      if (typeof requestAnimationFrame === "function") {
        animFrameId = requestAnimationFrame(tick);
      }
    }
  }

  function pause() {
    if (!isRunning || isPaused) return;
    pausedAt = getTime();
    isPaused = true;
    if (animFrameId && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  function resume() {
    if (!isRunning || !isPaused) return;
    const now = getTime();
    if (pausedAt > 0) {
      accumulatedPauseMs += Math.max(0, now - pausedAt);
    }
    pausedAt = 0;
    isPaused = false;

    if (onTick && typeof requestAnimationFrame === "function") {
      animFrameId = requestAnimationFrame(tick);
    }
  }

  function stop() {
    if (!isRunning) {
      return stoppedAt > 0 ? Math.max(0, stoppedAt - startedAt - accumulatedPauseMs) : 0;
    }
    stoppedAt = getTime();
    if (isPaused && pausedAt > 0) {
      accumulatedPauseMs += Math.max(0, stoppedAt - pausedAt);
    }
    isRunning = false;
    isPaused = false;

    if (animFrameId && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    const elapsed = Math.max(0, stoppedAt - startedAt - accumulatedPauseMs);
    if (onTick) {
      onTick(elapsed);
    }
    return Math.round(elapsed);
  }

  function getElapsedMs() {
    if (!isRunning) {
      if (stoppedAt > 0) {
        return Math.round(Math.max(0, stoppedAt - startedAt - accumulatedPauseMs));
      }
      if (startedAt > 0) {
        return Math.round(Math.max(0, getTime() - startedAt - accumulatedPauseMs));
      }
      return 0;
    }
    const now = getTime();
    let currentPause = 0;
    if (isPaused && pausedAt > 0) {
      currentPause = Math.max(0, now - pausedAt);
    }
    return Math.round(Math.max(0, now - startedAt - accumulatedPauseMs - currentPause));
  }

  function reset() {
    if (animFrameId && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    startedAt = 0;
    stoppedAt = 0;
    pausedAt = 0;
    accumulatedPauseMs = 0;
    isRunning = false;
    isPaused = false;
    if (onTick) {
      onTick(0);
    }
  }

  function setElapsedMs(ms) {
    const safeMs = Math.max(0, Number(ms) || 0);
    const now = getTime();
    startedAt = now - safeMs;
    stoppedAt = 0;
    pausedAt = 0;
    accumulatedPauseMs = 0;
    isRunning = true;
    isPaused = false;
    if (onTick) {
      onTick(safeMs);
    }
  }

  function destroy() {
    if (animFrameId && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    if (doc && typeof doc.removeEventListener === "function") {
      doc.removeEventListener("visibilitychange", handleVisibilityChange);
    }
    isRunning = false;
    isPaused = false;
  }

  return {
    start,
    pause,
    resume,
    stop,
    reset,
    setElapsedMs,
    getElapsedMs,
    destroy,
    get isRunning() { return isRunning; },
    get isPaused() { return isPaused; }
  };
}

export function startSessionTimer(timer, initialElapsedMs = 0) {
  if (!timer || typeof timer.reset !== "function" || typeof timer.start !== "function") {
    throw new TypeError("유효한 QuestionTimer 인스턴스가 필요합니다.");
  }
  const safeElapsedMs = Number.isFinite(initialElapsedMs) && initialElapsedMs > 0
    ? Number(initialElapsedMs)
    : 0;
  timer.reset();
  timer.start(safeElapsedMs);
  return safeElapsedMs;
}

export function formatTime(ms, mode = "digital") {
  const safeMs = Math.max(0, Math.round(ms || 0));
  const totalSeconds = safeMs / 1000;

  if (mode === "korean") {
    if (totalSeconds < 60) {
      return `${totalSeconds.toFixed(1)}초`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = (totalSeconds % 60).toFixed(1);
    return `${minutes}분 ${remainingSeconds}초`;
  }

  // 기본 디지털 포맷 mm:ss.s
  const minutes = Math.floor(safeMs / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  const tenths = Math.floor((safeMs % 1000) / 100);

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${mm}:${ss}.${tenths}`;
}
