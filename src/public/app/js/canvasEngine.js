/**
 * Math Canvas Pro - Canvas 손계산 필기 및 제스처 펜 엔진 (Phase 3)
 * SSOT Section 23~35 명세 준수
 * - PointerEvents 기반 멀티 인풋 (Apple Pencil, 터치, 마우스)
 * - 팜 리젝션(Palm Rejection) 지원
 * - Quadratic Bezier 곡선 실시간 스무딩
 * - 획 지우개 / 픽셀 지우개
 * - Undo / Redo 히스토리 스택
 */

export function createDrawingCanvas(canvasElement, options = {}) {
  const ctx = canvasElement.getContext("2d", { alpha: true });
  let strokes = []; // [{ id, color, width, isEraser, points: [{x, y}] }]
  let undoStack = []; // 히스토리 스택
  let redoStack = [];

  let currentStroke = null;
  let isDrawing = false;
  let activePointerId = null;

  // 기본 드로잉 설정
  const settings = {
    color: options.color || "#173f35",
    width: options.width || 2.5,
    isEraser: options.isEraser || false,
    eraserType: options.eraserType || "stroke",
    eraserRadius: options.eraserRadius || 14,
    readOnly: Boolean(options.readOnly),
    onStrokeChange: options.onStrokeChange || null
  };

  let dpr = (typeof window !== "undefined" && window.devicePixelRatio) ? window.devicePixelRatio : 1;

  function resize() {
    const rect = canvasElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    dpr = (typeof window !== "undefined" && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    canvasElement.width = Math.round(rect.width * dpr);
    canvasElement.height = Math.round(rect.height * dpr);
    redraw();
  }

  function getCanvasPoint(event) {
    const rect = canvasElement.getBoundingClientRect();
    let clientX = event.clientX;
    let clientY = event.clientY;

    if (clientX === undefined && event.touches && event.touches.length > 0) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else if (clientX === undefined && event.changedTouches && event.changedTouches.length > 0) {
      clientX = event.changedTouches[0].clientX;
      clientY = event.changedTouches[0].clientY;
    }

    const x = (clientX || 0) - rect.left;
    const y = (clientY || 0) - rect.top;
    return { x, y };
  }

  function redraw() {
    const rect = canvasElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // 1. 변환 행렬을 리셋하고 전체 픽셀 버퍼를 100% 완전 투명 클리어
    if (typeof ctx.setTransform === "function") {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // 2. DPR 스케일 적용 후 스트로크 렌더링
    ctx.save();
    if (typeof ctx.setTransform === "function") {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    for (const stroke of strokes) {
      drawStroke(stroke);
    }

    if (currentStroke) {
      drawStroke(currentStroke);
    }
    ctx.restore();
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

  function drawStroke(stroke) {
    if (!stroke.points || stroke.points.length === 0) return;

    const canvasRect = canvasElement.getBoundingClientRect();
    const currentGrid = getGridBoundingInfo();

    const baseGridW = stroke.gridWidth || stroke.baseWidth || currentGrid.gridWidth;
    const scale = (baseGridW > 0 && currentGrid.gridWidth > 0) ? (currentGrid.gridWidth / baseGridW) : 1;

    // 수식 모눈 박스 기준 정규화 좌표(0.0~1.0)를 현재 수식 박스 픽셀로 1:1 완벽 매핑
    const mapX = (pt) => {
      if (pt.relX !== undefined) {
        return currentGrid.gridLeft + (pt.relX * currentGrid.gridWidth);
      }
      return (pt.x * (canvasRect.width / (stroke.baseWidth || canvasRect.width || 1)));
    };

    const mapY = (pt) => {
      if (pt.relY !== undefined) {
        return currentGrid.gridTop + (pt.relY * currentGrid.gridHeight);
      }
      return (pt.y * (canvasRect.height / (stroke.baseHeight || canvasRect.height || 1)));
    };

    ctx.save();
    ctx.strokeStyle = stroke.color || settings.color;
    ctx.fillStyle = stroke.color || settings.color;
    ctx.lineWidth = Math.max(1.2, (stroke.width || settings.width) * scale);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const pts = stroke.points;

    if (pts.length <= 2) {
      ctx.beginPath();
      ctx.arc(mapX(pts[0]), mapY(pts[0]), Math.max(1, ctx.lineWidth / 2), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(mapX(pts[0]), mapY(pts[0]));

    for (let i = 1; i < pts.length - 1; i++) {
      const midRawX = (mapX(pts[i]) + mapX(pts[i + 1])) / 2;
      const midRawY = (mapY(pts[i]) + mapY(pts[i + 1])) / 2;
      ctx.quadraticCurveTo(mapX(pts[i]), mapY(pts[i]), midRawX, midRawY);
    }

    const last = pts[pts.length - 1];
    ctx.lineTo(mapX(last), mapY(last));
    ctx.stroke();
    ctx.restore();
  }

  // 획 지우개(Stroke Eraser): 터치 지점과 획의 최소 거리 계산
  function distanceToSegment(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = (dx * dx) + (dy * dy);
    if (lenSq === 0) {
      const px = p.x - a.x;
      const py = p.y - a.y;
      return Math.sqrt((px * px) + (py * py));
    }
    const t = Math.max(0, Math.min(1, (((p.x - a.x) * dx) + ((p.y - a.y) * dy)) / lenSq));
    const projX = a.x + (t * dx);
    const projY = a.y + (t * dy);
    const ex = p.x - projX;
    const ey = p.y - projY;
    return Math.sqrt((ex * ex) + (ey * ey));
  }

  function eraseStrokesAtPoint(point) {
    const rect = canvasElement.getBoundingClientRect();
    const currentW = rect.width;
    const currentH = rect.height;
    const eraseRadius = settings.eraserRadius;
    const remaining = [];
    let erasedAny = false;

    for (const stroke of strokes) {
      let hit = false;
      const baseW = stroke.baseWidth || currentW;
      const baseH = stroke.baseHeight || currentH;
      const scaleX = (baseW > 0 && currentW > 0) ? (currentW / baseW) : 1;
      const scaleY = (baseH > 0 && currentH > 0) ? (currentH / baseH) : 1;

      const pts = stroke.points;
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = { x: pts[i].x * scaleX, y: pts[i].y * scaleY };
        const p2 = { x: pts[i + 1].x * scaleX, y: pts[i + 1].y * scaleY };
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

  // Pointer & Touch Event Handlers
  function onPointerDown(e) {
    if (settings.readOnly) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    // 브라우저 텍스트 선택(Selection) 즉시 해제 (글씨 쓸 때 주변 숫자가 선택되는 현상 완전 방지)
    try {
      if (typeof window !== "undefined" && window.getSelection) {
        const sel = window.getSelection();
        if (sel && typeof sel.removeAllRanges === "function") {
          sel.removeAllRanges();
        }
      }
    } catch (_) {}

    // 애플 펜슬 전용 모드일 때: 손가락 터치는 필기하지 않고 화면 스크롤 허용
    if (settings.pencilOnly && (e.pointerType === "touch" || (e.touches && e.pointerType === undefined))) {
      return;
    }

    if (e.cancelable) e.preventDefault();

    if (canvasElement.width === 0 || canvasElement.height === 0) {
      resize();
    }

    isDrawing = true;
    activePointerId = e.pointerId !== undefined ? e.pointerId : 1;

    try {
      if (typeof canvasElement.setPointerCapture === "function" && e.pointerId !== undefined) {
        canvasElement.setPointerCapture(e.pointerId);
      }
    } catch (_) {}

    cachedCanvasRect = canvasElement.getBoundingClientRect();
    cachedGridInfo = getGridBoundingInfo();

    const clientX = e.clientX ?? (e.touches?.[0]?.clientX || 0);
    const clientY = e.clientY ?? (e.touches?.[0]?.clientY || 0);
    const pt = {
      x: clientX - cachedCanvasRect.left,
      y: clientY - cachedCanvasRect.top
    };
    pt.relX = (pt.x - cachedGridInfo.gridLeft) / cachedGridInfo.gridWidth;
    pt.relY = (pt.y - cachedGridInfo.gridTop) / cachedGridInfo.gridHeight;

    if (settings.isEraser) {
      eraseStrokesAtPoint(pt);
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
      points: [pt],
      timestamp: Date.now()
    };

    redraw();
  }

  function onPointerMove(e) {
    if (!isDrawing) return;
    if (activePointerId !== null && e.pointerId !== undefined && e.pointerId !== activePointerId) return;

    if (settings.pencilOnly && (e.pointerType === "touch" || (e.touches && e.pointerType === undefined))) {
      return;
    }

    if (e.cancelable) e.preventDefault();

    if (!cachedCanvasRect || !cachedGridInfo) {
      cachedCanvasRect = canvasElement.getBoundingClientRect();
      cachedGridInfo = getGridBoundingInfo();
    }

    const clientX = e.clientX ?? (e.touches?.[0]?.clientX || 0);
    const clientY = e.clientY ?? (e.touches?.[0]?.clientY || 0);
    const pt = {
      x: clientX - cachedCanvasRect.left,
      y: clientY - cachedCanvasRect.top
    };
    pt.relX = (pt.x - cachedGridInfo.gridLeft) / cachedGridInfo.gridWidth;
    pt.relY = (pt.y - cachedGridInfo.gridTop) / cachedGridInfo.gridHeight;

    if (settings.isEraser) {
      eraseStrokesAtPoint(pt);
      return;
    }

    if (currentStroke) {
      currentStroke.points.push(pt);
      redraw();
    }
  }

  function onPointerUp(e) {
    if (!isDrawing) return;

    if (e.cancelable) e.preventDefault();

    isDrawing = false;
    activePointerId = null;
    cachedCanvasRect = null;
    cachedGridInfo = null;

    try {
      if (typeof canvasElement.releasePointerCapture === "function" && e.pointerId !== undefined) {
        canvasElement.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}

    if (currentStroke && currentStroke.points.length > 0) {
      strokes.push(currentStroke);
      currentStroke = null;
      redraw();
      notifyChange();
    }
  }

  function onPointerCancel(e) {
    if (isDrawing) {
      if (e.cancelable) e.preventDefault();
      isDrawing = false;
      activePointerId = null;
      cachedCanvasRect = null;
      cachedGridInfo = null;
      currentStroke = null;
      redraw();
    }
  }

  // PointerEvents 및 텍스트 선택/제스처 차단 등록
  const supportsPointer = typeof window !== "undefined" && window.PointerEvent;

  if (supportsPointer) {
    canvasElement.addEventListener("pointerdown", onPointerDown, { passive: false });
    canvasElement.addEventListener("pointermove", onPointerMove, { passive: false });
    canvasElement.addEventListener("pointerup", onPointerUp, { passive: false });
    canvasElement.addEventListener("pointercancel", onPointerCancel, { passive: false });
  } else {
    // 구형 터치 전용 브라우저 fallback
    canvasElement.addEventListener("touchstart", onPointerDown, { passive: false });
    canvasElement.addEventListener("touchmove", onPointerMove, { passive: false });
    canvasElement.addEventListener("touchend", onPointerUp, { passive: false });
    canvasElement.addEventListener("touchcancel", onPointerCancel, { passive: false });
    canvasElement.addEventListener("mousedown", onPointerDown, { passive: false });
    canvasElement.addEventListener("mousemove", onPointerMove, { passive: false });
    canvasElement.addEventListener("mouseup", onPointerUp, { passive: false });
  }

  // 브라우저 텍스트 선택 및 드래그 방지
  canvasElement.addEventListener("selectstart", (e) => e.preventDefault());
  canvasElement.addEventListener("dragstart", (e) => e.preventDefault());
  canvasElement.addEventListener("contextmenu", (e) => e.preventDefault());

  // ResizeObserver로 캔버스 크기 변화 감지
  let resizeObserver = null;
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(() => {
      resize();
    });
    resizeObserver.observe(canvasElement);
  }

  // 초기화 (DOM 렌더링 타이밍 보장)
  const safeRaf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (cb) => setTimeout(cb, 0);
  safeRaf(() => {
    resize();
    setTimeout(resize, 50); // layout 완료 후 2차 resize
  });

  return {
    setColor(color) {
      settings.color = color;
      settings.isEraser = false;
    },
    setWidth(width) {
      settings.width = width;
    },
    setEraser(enabled, type = "stroke") {
      settings.isEraser = Boolean(enabled);
      settings.eraserType = type;
    },
    setPencilOnly(enabled) {
      settings.pencilOnly = Boolean(enabled);
    },
    setReadOnly(readOnly) {
      settings.readOnly = Boolean(readOnly);
    },
    resize() {
      resize();
    },
    redraw() {
      redraw();
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
    destroy() {
      canvasElement.removeEventListener("pointerdown", onPointerDown);
      canvasElement.removeEventListener("pointermove", onPointerMove);
      canvasElement.removeEventListener("pointerup", onPointerUp);
      canvasElement.removeEventListener("pointercancel", onPointerCancel);
      if (resizeObserver) resizeObserver.disconnect();
    }
  };
}
