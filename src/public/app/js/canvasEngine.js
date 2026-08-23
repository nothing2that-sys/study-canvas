/**
 * Math Canvas Pro - Canvas 손계산 필기 및 제스처 펜 엔진 (iPad 최적화 확정본)
 * SSOT Section 23~35 및 CODEX_IPAD_WEBAPP_STABILIZATION_AND_UX_IMPLEMENTATION 명세 준수
 * - 명시적 입력 프로필 (IPAD_PEN_ONLY, IPAD_PEN_TOUCH, DESKTOP_MOUSE_PEN, DESKTOP_ALL_INPUT, READ_ONLY)
 * - Pen Active Lock & Palm Rejection 상태 머신
 * - getCoalescedEvents 고속 필기 좌표 수집 및 RAF 증분 렌더링 파이프라인
 * - PointerCancel / LostPointerCapture 획 보존
 * - Quadratic Bezier 곡선 실시간 스무딩 및 정규화 좌표계
 * - 획 지우개 / Undo / Redo 히스토리 스택
 */

export const InputProfile = Object.freeze({
  IPAD_PEN_ONLY: "IPAD_PEN_ONLY",
  IPAD_PEN_TOUCH: "IPAD_PEN_TOUCH",
  DESKTOP_MOUSE_PEN: "DESKTOP_MOUSE_PEN",
  DESKTOP_ALL_INPUT: "DESKTOP_ALL_INPUT",
  READ_ONLY: "READ_ONLY"
});

export const InputState = Object.freeze({
  IDLE: "idle",
  TOUCH_SCROLL: "touch-scroll",
  TOUCH_DRAWING: "touch-drawing",
  PEN_DRAWING: "pen-drawing",
  PEN_COOLDOWN: "pen-cooldown",
  CANCELING: "canceling"
});

/**
 * 단일 입력 수락 판정기
 */
export function shouldAcceptPointer(event, profile, state = InputState.IDLE) {
  if (!event || profile === InputProfile.READ_ONLY) return false;
  const pType = event.pointerType;

  if (profile === InputProfile.IPAD_PEN_ONLY) {
    // 엄격한 Pen 전용: pen 타입만 수락, touch/mouse/unknown 일체 거부
    return pType === "pen";
  }

  if (profile === InputProfile.IPAD_PEN_TOUCH) {
    if (pType === "pen") return true;
    if (pType === "touch") {
      // Pen Cooldown 중에는 touch 거부
      return state !== InputState.PEN_COOLDOWN;
    }
    return false;
  }

  if (profile === InputProfile.DESKTOP_MOUSE_PEN) {
    if (pType === "pen") return true;
    if (pType === "mouse") {
      return event.button === 0 || event.button === undefined;
    }
    return false;
  }

  if (profile === InputProfile.DESKTOP_ALL_INPUT) {
    if (pType === "mouse") return event.button === 0 || event.button === undefined;
    return true;
  }

  // 기본 Fallback
  return pType === "pen" || (pType === "mouse" && (event.button === 0 || event.button === undefined));
}

export function createDrawingCanvas(canvasElement, options = {}) {
  const ctx = canvasElement.getContext("2d", { alpha: true });
  let strokes = []; // [{ id, color, width, isEraser, points: [{x, y, relX, relY}], gridWidth, gridHeight, gridLeft, gridTop }]
  let undoStack = [];
  let redoStack = [];

  let currentStroke = null;
  let isDrawing = false;
  let activePointerId = null;
  let currentState = InputState.IDLE;
  let lastPenEndTime = 0;
  let cooldownTimer = null;

  // 입력 프로필 결정
  let currentProfile = options.profile || (options.pencilOnly ? InputProfile.IPAD_PEN_ONLY : InputProfile.DESKTOP_MOUSE_PEN);
  if (options.readOnly) currentProfile = InputProfile.READ_ONLY;

  const settings = {
    color: options.color || "#173f35",
    width: options.width || 2.5,
    isEraser: options.isEraser || false,
    eraserType: options.eraserType || "stroke",
    eraserRadius: options.eraserRadius || 14,
    pencilOnly: currentProfile === InputProfile.IPAD_PEN_ONLY,
    readOnly: Boolean(options.readOnly),
    profile: currentProfile,
    onStrokeChange: options.onStrokeChange || null
  };

  let dpr = (typeof window !== "undefined" && window.devicePixelRatio) ? window.devicePixelRatio : 1;
  let rafId = null;
  let lastDrawnPointIndex = 0;

  // 동적 touch-action 업데이트
  function updateTouchAction() {
    if (typeof canvasElement.style === "undefined") return;
    if (settings.readOnly) {
      canvasElement.style.touchAction = "auto";
    } else if (settings.profile === InputProfile.IPAD_PEN_ONLY) {
      canvasElement.style.touchAction = "pan-y";
    } else {
      canvasElement.style.touchAction = "none";
    }
  }
  updateTouchAction();

  function resize() {
    const rect = canvasElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    dpr = (typeof window !== "undefined" && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    canvasElement.width = Math.round(rect.width * dpr);
    canvasElement.height = Math.round(rect.height * dpr);
    redraw();
  }

  function redraw() {
    const rect = canvasElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    if (typeof ctx.setTransform === "function") {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    ctx.save();
    if (typeof ctx.setTransform === "function") {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    for (const stroke of strokes) {
      drawFullStroke(stroke);
    }

    if (currentStroke) {
      drawFullStroke(currentStroke);
    }
    ctx.restore();
    lastDrawnPointIndex = currentStroke ? currentStroke.points.length - 1 : 0;
  }

  function getGridBoundingInfo() {
    const parent = canvasElement.parentElement;
    const gridEl = parent ? (parent.querySelector(".math-grid-container, .div-grid-container, .horizontal-math-container") || parent) : canvasElement;
    const canvasRect = canvasElement.getBoundingClientRect();
    const gridRect = gridEl ? gridEl.getBoundingClientRect() : canvasRect;

    const cW = canvasRect.width || 300;
    const cH = canvasRect.height || 260;

    return {
      gridLeft: gridRect.left - canvasRect.left,
      gridTop: gridRect.top - canvasRect.top,
      gridWidth: Math.max(20, gridRect.width || cW),
      gridHeight: Math.max(20, gridRect.height || cH),
      canvasWidth: cW,
      canvasHeight: cH
    };
  }

  function mapPointToCanvas(pt, stroke) {
    const currentGrid = getGridBoundingInfo();
    const baseGridW = stroke.gridWidth || stroke.baseWidth || currentGrid.gridWidth;
    const scale = (baseGridW > 0 && currentGrid.gridWidth > 0) ? (currentGrid.gridWidth / baseGridW) : 1;

    if (pt.relX !== undefined) {
      return {
        x: currentGrid.gridLeft + (pt.relX * currentGrid.gridWidth),
        y: currentGrid.gridTop + (pt.relY * currentGrid.gridHeight),
        scale
      };
    }

    const sLeft = stroke.gridLeft !== undefined ? stroke.gridLeft : 0;
    const sTop = stroke.gridTop !== undefined ? stroke.gridTop : 0;
    const normX = (pt.x - sLeft) / (baseGridW || 1);
    const normY = (pt.y - sTop) / (stroke.gridHeight || stroke.baseHeight || 1);

    return {
      x: currentGrid.gridLeft + (normX * currentGrid.gridWidth),
      y: currentGrid.gridTop + (normY * currentGrid.gridHeight),
      scale
    };
  }

  function drawFullStroke(stroke) {
    if (!stroke.points || stroke.points.length === 0) return;

    ctx.save();
    ctx.strokeStyle = stroke.color || "#173f35";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const mappedFirst = mapPointToCanvas(stroke.points[0], stroke);
    ctx.lineWidth = (stroke.width || 2.5) * mappedFirst.scale;

    if (stroke.points.length === 1) {
      ctx.beginPath();
      ctx.arc(mappedFirst.x, mappedFirst.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(mappedFirst.x, mappedFirst.y);

    for (let i = 1; i < stroke.points.length; i++) {
      const pCurrent = mapPointToCanvas(stroke.points[i], stroke);
      if (i === stroke.points.length - 1) {
        ctx.lineTo(pCurrent.x, pCurrent.y);
      } else {
        const pNext = mapPointToCanvas(stroke.points[i + 1], stroke);
        const midX = (pCurrent.x + pNext.x) / 2;
        const midY = (pCurrent.y + pNext.y) / 2;
        if (typeof ctx.quadraticCurveTo === "function") {
          ctx.quadraticCurveTo(pCurrent.x, pCurrent.y, midX, midY);
        } else {
          ctx.lineTo(midX, midY);
        }
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  // 증분 렌더링 (RAF 기반 고속 렌더링)
  function renderIncremental() {
    if (!currentStroke || currentStroke.points.length <= 1) {
      redraw();
      return;
    }

    ctx.save();
    if (typeof ctx.setTransform === "function") {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    ctx.strokeStyle = currentStroke.color || "#173f35";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const startIndex = Math.max(1, lastDrawnPointIndex);
    const mappedStart = mapPointToCanvas(currentStroke.points[startIndex - 1], currentStroke);
    ctx.lineWidth = (currentStroke.width || 2.5) * mappedStart.scale;

    ctx.beginPath();
    ctx.moveTo(mappedStart.x, mappedStart.y);

    for (let i = startIndex; i < currentStroke.points.length; i++) {
      const pCurrent = mapPointToCanvas(currentStroke.points[i], currentStroke);
      if (i === currentStroke.points.length - 1) {
        ctx.lineTo(pCurrent.x, pCurrent.y);
      } else {
        const pNext = mapPointToCanvas(currentStroke.points[i + 1], currentStroke);
        const midX = (pCurrent.x + pNext.x) / 2;
        const midY = (pCurrent.y + pNext.y) / 2;
        if (typeof ctx.quadraticCurveTo === "function") {
          ctx.quadraticCurveTo(pCurrent.x, pCurrent.y, midX, midY);
        } else {
          ctx.lineTo(midX, midY);
        }
      }
    }
    ctx.stroke();
    ctx.restore();

    lastDrawnPointIndex = currentStroke.points.length - 1;
  }

  function scheduleRender() {
    if (typeof requestAnimationFrame === "function") {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        renderIncremental();
      });
    } else {
      renderIncremental();
    }
  }

  function distanceToSegment(p, a, b) {
    const l2 = ((b.x - a.x) ** 2) + ((b.y - a.y) ** 2);
    if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)));
  }

  function eraseStrokesAtPoint(point) {
    const eraseRadius = settings.eraserRadius || 14;
    let erasedAny = false;
    const remaining = [];
    const currentGrid = getGridBoundingInfo();

    for (const stroke of strokes) {
      const baseGridW = stroke.gridWidth || stroke.baseWidth || currentGrid.gridWidth;
      const baseGridH = stroke.gridHeight || stroke.baseHeight || currentGrid.gridHeight;
      const scaleX = currentGrid.gridWidth / (baseGridW || 1);
      const scaleY = currentGrid.gridHeight / (baseGridH || 1);

      let hit = false;
      const pts = stroke.points || [];

      for (let i = 0; i < pts.length - 1; i++) {
        let p1, p2;
        if (pts[i].relX !== undefined) {
          p1 = { x: currentGrid.gridLeft + pts[i].relX * currentGrid.gridWidth, y: currentGrid.gridTop + pts[i].relY * currentGrid.gridHeight };
          p2 = { x: currentGrid.gridLeft + pts[i + 1].relX * currentGrid.gridWidth, y: currentGrid.gridTop + pts[i + 1].relY * currentGrid.gridHeight };
        } else {
          p1 = { x: pts[i].x * scaleX, y: pts[i].y * scaleY };
          p2 = { x: pts[i + 1].x * scaleX, y: pts[i + 1].y * scaleY };
        }

        if (distanceToSegment(point, p1, p2) <= eraseRadius + (stroke.width / 2)) {
          hit = true;
          break;
        }
      }
      if (hit) {
        erasedAny = true;
      } else {
        remaining.push(stroke);
      }
    }

    if (erasedAny) {
      saveToUndoStack();
      strokes = remaining;
      redraw();
      notifyChange();
    }
  }

  function saveToUndoStack() {
    undoStack.push(JSON.parse(JSON.stringify(strokes)));
    if (undoStack.length > 50) undoStack.shift();
    redoStack = [];
  }

  function notifyChange() {
    if (typeof settings.onStrokeChange === "function") {
      settings.onStrokeChange(strokes);
    }
  }

  let cachedGridInfo = null;
  let cachedCanvasRect = null;

  function extractPoints(e) {
    if (!cachedCanvasRect || !cachedGridInfo) {
      cachedCanvasRect = canvasElement.getBoundingClientRect();
      cachedGridInfo = getGridBoundingInfo();
    }

    const events = (typeof e.getCoalescedEvents === "function") ? e.getCoalescedEvents() : [e];
    const points = [];

    for (const evt of events) {
      const clientX = evt.clientX ?? (evt.touches?.[0]?.clientX || 0);
      const clientY = evt.clientY ?? (evt.touches?.[0]?.clientY || 0);
      const x = clientX - cachedCanvasRect.left;
      const y = clientY - cachedCanvasRect.top;
      const relX = cachedGridInfo.gridWidth > 0 ? (x - cachedGridInfo.gridLeft) / cachedGridInfo.gridWidth : 0;
      const relY = cachedGridInfo.gridHeight > 0 ? (y - cachedGridInfo.gridTop) / cachedGridInfo.gridHeight : 0;

      points.push({ x, y, relX, relY });
    }

    return points;
  }

  // ----------------------------------------------------
  // Pointer Event Handlers
  // ----------------------------------------------------
  function onPointerDown(e) {
    if (settings.readOnly) return;

    // Cooldown 검사
    const now = Date.now();
    if (now - lastPenEndTime < 400) {
      currentState = InputState.PEN_COOLDOWN;
    }

    // 단일 입력 수락 판정
    if (!shouldAcceptPointer(e, settings.profile, currentState)) {
      return;
    }

    // Pen 입력인 경우 이전 터치 드로잉 즉시 취소 및 Pen Active Lock 획득
    if (e.pointerType === "pen") {
      if (currentState === InputState.TOUCH_DRAWING && currentStroke) {
        // 터치 스트로크 폐기
        currentStroke = null;
      }
      currentState = InputState.PEN_DRAWING;
      activePointerId = e.pointerId;
    } else {
      currentState = InputState.TOUCH_DRAWING;
      activePointerId = e.pointerId;
    }

    if (e.cancelable) e.preventDefault();

    if (canvasElement.width === 0 || canvasElement.height === 0) {
      resize();
    }

    isDrawing = true;

    try {
      if (typeof canvasElement.setPointerCapture === "function" && e.pointerId !== undefined) {
        canvasElement.setPointerCapture(e.pointerId);
      }
    } catch (_) {}

    cachedCanvasRect = canvasElement.getBoundingClientRect();
    cachedGridInfo = getGridBoundingInfo();

    const pts = extractPoints(e);
    if (pts.length === 0) return;

    if (settings.isEraser) {
      eraseStrokesAtPoint(pts[0]);
      return;
    }

    saveToUndoStack();

    currentStroke = {
      id: `stroke_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      color: settings.color,
      width: settings.width,
      isEraser: false,
      baseWidth: cachedCanvasRect.width || 300,
      baseHeight: cachedCanvasRect.height || 260,
      gridWidth: cachedGridInfo.gridWidth,
      gridHeight: cachedGridInfo.gridHeight,
      gridLeft: cachedGridInfo.gridLeft,
      gridTop: cachedGridInfo.gridTop,
      points: pts,
      timestamp: Date.now()
    };

    lastDrawnPointIndex = 0;
    scheduleRender();
  }

  function onPointerMove(e) {
    if (!isDrawing) return;
    if (activePointerId !== null && e.pointerId !== undefined && e.pointerId !== activePointerId) return;

    if (!shouldAcceptPointer(e, settings.profile, currentState)) return;

    if (e.cancelable) e.preventDefault();

    const pts = extractPoints(e);
    if (pts.length === 0) return;

    if (settings.isEraser) {
      pts.forEach(p => eraseStrokesAtPoint(p));
      return;
    }

    if (currentStroke) {
      currentStroke.points.push(...pts);
      scheduleRender();
    }
  }

  function onPointerUp(e) {
    if (!isDrawing) return;
    if (activePointerId !== null && e.pointerId !== undefined && e.pointerId !== activePointerId) return;

    if (e.cancelable) e.preventDefault();

    isDrawing = false;
    const isPen = e.pointerType === "pen";
    activePointerId = null;
    cachedCanvasRect = null;
    cachedGridInfo = null;

    try {
      if (typeof canvasElement.releasePointerCapture === "function" && e.pointerId !== undefined) {
        canvasElement.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}

    if (isPen) {
      lastPenEndTime = Date.now();
      currentState = InputState.PEN_COOLDOWN;
      if (cooldownTimer) clearTimeout(cooldownTimer);
      cooldownTimer = setTimeout(() => {
        if (currentState === InputState.PEN_COOLDOWN) {
          currentState = InputState.IDLE;
        }
      }, 400);
    } else {
      currentState = InputState.IDLE;
    }

    if (currentStroke && currentStroke.points.length > 0) {
      strokes.push(currentStroke);
      currentStroke = null;
      redraw();
      notifyChange();
    }
  }

  function onPointerCancel(e) {
    if (!isDrawing) return;

    if (e.cancelable) e.preventDefault();
    isDrawing = false;
    const isPen = e.pointerType === "pen";
    activePointerId = null;
    cachedCanvasRect = null;
    cachedGridInfo = null;

    if (isPen) {
      lastPenEndTime = Date.now();
      currentState = InputState.PEN_COOLDOWN;
    } else {
      currentState = InputState.IDLE;
    }

    //+_+// CODEX 명세: 취소 시에도 유효 좌표(1개 이상)가 있다면 획을 버리지 않고 보존
    if (currentStroke && currentStroke.points.length > 0) {
      strokes.push(currentStroke);
      currentStroke = null;
      redraw();
      notifyChange();
    } else {
      currentStroke = null;
      redraw();
    }
  }

  function onLostPointerCapture(e) {
    if (isDrawing && (activePointerId === null || e.pointerId === activePointerId)) {
      onPointerUp(e);
    }
  }

  // ----------------------------------------------------
  // 이벤트 리스너 바인딩 및 생명주기 관리
  // ----------------------------------------------------
  const boundListeners = [];
  function addManagedListener(target, type, handler, opts) {
    if (!target || typeof target.addEventListener !== "function") return;
    target.addEventListener(type, handler, opts);
    boundListeners.push({ target, type, handler, opts });
  }

  addManagedListener(canvasElement, "pointerdown", onPointerDown, { passive: false });
  addManagedListener(canvasElement, "pointermove", onPointerMove, { passive: false });
  addManagedListener(canvasElement, "pointerup", onPointerUp, { passive: false });
  addManagedListener(canvasElement, "pointercancel", onPointerCancel, { passive: false });
  addManagedListener(canvasElement, "lostpointercapture", onLostPointerCapture, { passive: false });

  const preventDefaults = (e) => {
    if (e.cancelable) e.preventDefault();
  };
  addManagedListener(canvasElement, "selectstart", preventDefaults, { passive: false });
  addManagedListener(canvasElement, "dragstart", preventDefaults, { passive: false });
  addManagedListener(canvasElement, "contextmenu", preventDefaults, { passive: false });

  let resizeObserver = null;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      resize();
    });
    resizeObserver.observe(canvasElement);
  }

  // 초기 사이즈 보정
  resize();

  return {
    setColor(color) {
      settings.color = color;
      settings.isEraser = false;
    },
    setWidth(width) {
      settings.width = width;
    },
    setEraser(isEraser, radius = 14) {
      settings.isEraser = Boolean(isEraser);
      settings.eraserRadius = radius;
    },
    setPencilOnly(pencilOnly) {
      settings.pencilOnly = Boolean(pencilOnly);
      settings.profile = pencilOnly ? InputProfile.IPAD_PEN_ONLY : InputProfile.DESKTOP_MOUSE_PEN;
      updateTouchAction();
    },
    setInputProfile(profile) {
      if (Object.values(InputProfile).includes(profile)) {
        settings.profile = profile;
        settings.pencilOnly = (profile === InputProfile.IPAD_PEN_ONLY);
        updateTouchAction();
      }
    },
    getInputProfile() {
      return settings.profile;
    },
    setReadOnly(readOnly) {
      settings.readOnly = Boolean(readOnly);
      if (settings.readOnly) {
        settings.profile = InputProfile.READ_ONLY;
      }
      updateTouchAction();
    },
    undo() {
      if (undoStack.length === 0) return false;
      redoStack.push(JSON.parse(JSON.stringify(strokes)));
      strokes = undoStack.pop();
      redraw();
      notifyChange();
      return true;
    },
    redo() {
      if (redoStack.length === 0) return false;
      undoStack.push(JSON.parse(JSON.stringify(strokes)));
      strokes = redoStack.pop();
      redraw();
      notifyChange();
      return true;
    },
    clear() {
      if (strokes.length === 0) return;
      saveToUndoStack();
      strokes = [];
      currentStroke = null;
      redraw();
      notifyChange();
    },
    getStrokes() {
      return JSON.parse(JSON.stringify(strokes));
    },
    setStrokes(newStrokes) {
      strokes = Array.isArray(newStrokes) ? JSON.parse(JSON.stringify(newStrokes)) : [];
      undoStack = [];
      redoStack = [];
      redraw();
    },
    isEmpty() {
      return strokes.length === 0;
    },
    resize,
    destroy() {
      if (rafId && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(rafId);
      }
      if (cooldownTimer) clearTimeout(cooldownTimer);
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      boundListeners.forEach(({ target, type, handler, opts }) => {
        if (target && typeof target.removeEventListener === "function") {
          target.removeEventListener(type, handler, opts);
        }
      });
      boundListeners.length = 0;
    }
  };
}
