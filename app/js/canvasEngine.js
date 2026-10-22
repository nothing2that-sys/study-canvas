import { sceneReference, fitScene, mapScenePoint } from './canvasSceneGeometry.js';
const GRID_STYLE_KEYS = ['--grid-cell-w', '--grid-cell-h', '--grid-font-size', '--carry-cell-w', '--carry-cell-h', '--carry-font-size', '--box-cell-w', '--box-cell-h', '--box-font-size'];
function readGridStyle(element) {
  const view = element?.ownerDocument?.defaultView;
  if (!view?.getComputedStyle) return undefined;
  const computed = view.getComputedStyle(element);
  return Object.fromEntries(GRID_STYLE_KEYS.map(key => [key, computed.getPropertyValue(key).trim()]).filter(([, value]) => value));
}
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

export function resolveInputProfile(options = {}) {
  const userAgent = String(options.userAgent || "");
  const maxTouchPoints = Number(options.maxTouchPoints) || 0;
  const isIPad = /iPad/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
  const savedProfile = options.savedProfile;
  if (savedProfile && Object.values(InputProfile).includes(savedProfile)) {
    //+_+// PC에서는 iPad 전용 저장값을 복원하지 않고 mouse와 pen 입력을 항상 보장한다.
    if (!isIPad && (savedProfile === InputProfile.IPAD_PEN_ONLY || savedProfile === InputProfile.IPAD_PEN_TOUCH)) {
      return InputProfile.DESKTOP_MOUSE_PEN;
    }
    return savedProfile;
  }

  const legacyPencilOnly = options.legacyPencilOnly;

  if (legacyPencilOnly !== undefined && legacyPencilOnly !== null) {
    if (String(legacyPencilOnly) === "true") {
      return isIPad ? InputProfile.IPAD_PEN_ONLY : InputProfile.DESKTOP_MOUSE_PEN;
    }
    return isIPad ? InputProfile.IPAD_PEN_TOUCH : InputProfile.DESKTOP_MOUSE_PEN;
  }

  return isIPad ? InputProfile.IPAD_PEN_ONLY : InputProfile.DESKTOP_MOUSE_PEN;
}

export function togglePenOnlyProfile(currentProfile, environment = {}) {
  const nativeProfile = resolveInputProfile(environment);
  //+_+// 데스크톱에서는 touch를 차단하면서 mouse와 pen을 유지하는 profile을 고정한다.
  if (nativeProfile !== InputProfile.IPAD_PEN_ONLY) {
    return InputProfile.DESKTOP_MOUSE_PEN;
  }
  if (currentProfile !== InputProfile.IPAD_PEN_ONLY) {
    return InputProfile.IPAD_PEN_ONLY;
  }
  return InputProfile.IPAD_PEN_TOUCH;
}

/**
 * 단일 입력 수락 판정기 (상태 머신 규칙 완벽 준수)
 */
export function shouldAcceptPointer(event, profile, state = InputState.IDLE) {
  if (!event || profile === InputProfile.READ_ONLY) return false;
  const pType = event.pointerType;

  // PEN_DRAWING 중에는 오직 pen만 수락, touch와 mouse는 절대 수락하지 않음
  if (state === InputState.PEN_DRAWING) {
    return pType === "pen";
  }

  // TOUCH_DRAWING 중에는 새로운 pen만 가로채기 허용, 추가 touch/mouse 거부
  if (state === InputState.TOUCH_DRAWING) {
    return pType === "pen";
  }

  // PEN_COOLDOWN 중에는 pen만 즉시 수락, touch는 쿨다운 보호(Palm Rejection)로 거부
  // 단, DESKTOP_MOUSE_PEN 프로필의 정상 마우스 좌클릭은 고속 필기를 위해 허용
  if (state === InputState.PEN_COOLDOWN) {
    if (pType === "pen") return true;
    if (profile === InputProfile.DESKTOP_MOUSE_PEN && pType === "mouse") {
      return event.button === 0 || event.button === undefined;
    }
    return false;
  }

  if (profile === InputProfile.IPAD_PEN_ONLY) {
    return pType === "pen";
  }

  if (profile === InputProfile.IPAD_PEN_TOUCH) {
    return pType === "pen" || pType === "touch";
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

  return pType === "pen" || (pType === "mouse" && (event.button === 0 || event.button === undefined));
}

export function createDrawingCanvas(canvasElement, options = {}) {
  const ctx = canvasElement.getContext("2d", { alpha: true });
  let strokes = []; // [{ id, color, width, isEraser, points: [{x, y, relX, relY}], gridWidth, gridHeight, gridLeft, gridTop }]
  let backgroundStrokes = Array.isArray(options.backgroundStrokes) ? cloneStrokes(options.backgroundStrokes) : [];
  let undoStack = [];
  let redoStack = [];

  let currentStroke = null;
  let isDrawing = false;
  let activePenPointerId = null;
  let activeTouchPointerId = null;
  let activeTouchPointerType = null;
  let activePointerStartTime = null;
  let currentState = InputState.IDLE;
  let lastPenEndTime = 0;
  let cooldownTimer = null;
  let destroyed = false;
  let recoverySuspended = false;
  const penTerminals = new Map();
  const inputDiagnostics = { downReceived: 0, startsAccepted: 0, recoveredStarts: 0,
    rejectedDown: 0, orphanMoves: 0, blockedRecovery: 0, captureLosses: 0, cancels: 0 };

  function rememberPenTerminal(e) {
    if (e?.pointerType !== "pen") return;
    const previous = penTerminals.get(e.pointerId);
    if (previous && Number.isFinite(e.timeStamp) && e.timeStamp < previous.timeStamp) return;
    penTerminals.delete(e.pointerId);
    penTerminals.set(e.pointerId, { timeStamp: Number.isFinite(e.timeStamp) ? e.timeStamp : 0, blocked: true });
    if (penTerminals.size > 16) penTerminals.delete(penTerminals.keys().next().value);
  }

  function suspendRecovery() {
    recoverySuspended = true;
    resetActivePointers();
  }

  function cloneStrokes(value) {
    return JSON.parse(JSON.stringify(Array.isArray(value) ? value : []));
  }

  function getEnvironmentProfile() {
    return resolveInputProfile({
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      maxTouchPoints: typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0,
      hasTouchStart: typeof window !== "undefined" && "ontouchstart" in window
    });
  }

  // 입력 프로필 결정
  let currentProfile = options.profile;
  if (!currentProfile) {
    if (options.pencilOnly) {
      currentProfile = InputProfile.IPAD_PEN_ONLY;
    } else {
      currentProfile = getEnvironmentProfile();
    }
  }
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
  let eraserGestureChanged = false;
  let lastEraserPoint = null;

  // 동적 touch-action 업데이트
  function updateTouchAction() {
    if (typeof canvasElement.style === "undefined") return;
    if (settings.readOnly) {
      canvasElement.style.touchAction = "auto";
    } else {
      //+_+// 쓰기 가능한 캔버스는 Safari가 빠른 Pencil 세로 획을 pan 제스처로 선점하지 못하게 항상 직접 처리한다.
      canvasElement.style.touchAction = "none";
    }
  }
  updateTouchAction();

  function resize() {
    if (destroyed) return;
    const rect = canvasElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    dpr = (typeof window !== "undefined" && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    canvasElement.width = Math.round(rect.width * dpr);
    canvasElement.height = Math.round(rect.height * dpr);
    redraw();
  }

  function redraw() {
    if (destroyed) return;
    const rect = canvasElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    // Layout and formula transforms can change between grading and compact review.
    cachedCanvasRect = rect;
    cachedGridInfo = getGridBoundingInfo();
    const archived = [...backgroundStrokes, ...strokes];
    currentScene = sceneReference(archived.length ? archived : (currentStroke ? [currentStroke] : []));
    currentSceneFit = currentScene ? fitScene(currentScene, rect.width, rect.height) : null;
    if (currentSceneFit?.grid) {
      const grid = canvasElement.parentElement?.querySelector('.math-grid-container, .div-grid-container, .horizontal-math-container');
      let sourceStyle = currentScene.gridStyle;
      if (!sourceStyle && grid?.ownerDocument && options.sourcePageSize) {
        const size = Number(options.sourcePageSize);
        const density = size === 1 ? '1x1' : size === 2 ? '1x2' : size <= 4 ? '2x2' : size <= 6 ? '2x3' : '2x5';
        const probe = grid.ownerDocument.createElement('div');
        probe.className = `worksheet-grid density-${density}`; probe.style.display = 'none';
        grid.ownerDocument.body.appendChild(probe); sourceStyle = readGridStyle(probe); probe.remove();
      }
      if (sourceStyle && grid?.style?.setProperty) {
        for (const key of GRID_STYLE_KEYS) if (sourceStyle[key]) grid.style.setProperty(key, sourceStyle[key]);
      }
      if (grid?.style && grid.offsetWidth > 0 && grid.offsetHeight > 0) {
        const target = currentSceneFit.grid;
        grid.dataset.canvasSceneManaged = '1';
        grid.style.position = 'absolute'; grid.style.maxWidth = 'none';
        // Horizontal formulas originally fill their capture stage. Preserve that
        // layout width; shrinking to max-content then stretching both axes distorts text.
        const horizontal = grid.matches?.('.horizontal-math-container');
        grid.style.width = currentScene.gridLayoutWidth > 0 ? `${currentScene.gridLayoutWidth}px` : (horizontal ? `${currentScene.gridWidth}px` : 'max-content');
        if (horizontal && !(currentScene.gridLayoutWidth > 0) && grid.offsetHeight > 0) {
          const captureScale = currentScene.gridHeight / grid.offsetHeight;
          grid.style.width = `${currentScene.gridWidth / captureScale}px`;
        }
        const uniformScale = Math.min(target.gridWidth / grid.offsetWidth, target.gridHeight / grid.offsetHeight);
        grid.style.left = `${target.gridLeft}px`; grid.style.top = `${target.gridTop}px`;
        grid.style.transformOrigin = '0 0';
        grid.style.transform = `scale(${uniformScale}, ${uniformScale})`;
      }
      cachedGridInfo = currentSceneFit.grid;
    }

    if (typeof ctx.setTransform === "function") {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    ctx.save();
    if (typeof ctx.setTransform === "function") {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    for (const stroke of backgroundStrokes) {
      drawFullStroke(stroke);
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
      gridLayoutWidth: gridEl?.offsetWidth,
      gridLayoutHeight: gridEl?.offsetHeight,
      gridStyle: readGridStyle(gridEl)
    };
  }

  function mapPointToCanvas(pt, stroke) {
    if (!pt) return { x: 0, y: 0, scale: 1 };
    if (!cachedCanvasRect || !cachedGridInfo) {
      cachedCanvasRect = canvasElement.getBoundingClientRect();
      cachedGridInfo = getGridBoundingInfo();
    }
    const currentGrid = cachedGridInfo;
    const currentCanvas = cachedCanvasRect;

    if (currentScene && currentSceneFit) {
      const mapped = mapScenePoint(pt, stroke, currentScene, currentSceneFit);
      if (mapped) return mapped;
    }
    // The stored canvas geometry is the common frame for ALL strokes/layers.
    // Choosing a frame from each stroke's first point breaks crossing annotations.
    // Uniform fit preserves shapes; centering handles a different review aspect ratio.
    if (Number.isFinite(stroke.baseWidth) && stroke.baseWidth > 0 &&
        Number.isFinite(stroke.baseHeight) && stroke.baseHeight > 0 &&
        Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
      const scale = Math.min(currentCanvas.width / stroke.baseWidth, currentCanvas.height / stroke.baseHeight);
      return {
        x: (currentCanvas.width - stroke.baseWidth * scale) / 2 + pt.x * scale,
        y: (currentCanvas.height - stroke.baseHeight * scale) / 2 + pt.y * scale,
        scale: Math.max(0.5, Math.min(2.0, scale))
      };
    }
    // Older grid-only snapshots have no recoverable canvas geometry.
    if (Number.isFinite(pt.relX) && Number.isFinite(pt.relY) && currentGrid.gridWidth > 0) {
      const x = currentGrid.gridLeft + (pt.relX * currentGrid.gridWidth);
      const y = currentGrid.gridTop + (pt.relY * currentGrid.gridHeight);
      const scale = stroke.gridWidth > 0 ? (currentGrid.gridWidth / stroke.gridWidth) : 1;
      return { x, y, scale: Math.max(0.5, Math.min(2.0, scale)) };
    }

    const scaleX = (stroke.baseWidth && currentCanvas.width) ? (currentCanvas.width / stroke.baseWidth) : 1;
    const scaleY = (stroke.baseHeight && currentCanvas.height) ? (currentCanvas.height / stroke.baseHeight) : 1;
    const scale = (scaleX + scaleY) / 2;
    return {
      x: pt.x * scaleX,
      y: pt.y * scaleY,
      scale: Math.max(0.5, Math.min(2.0, scale))
    };
  }

  function drawFullStroke(stroke) {
    if (!stroke || !stroke.points || stroke.points.length === 0) return;

    ctx.save();
    if (typeof ctx.setTransform === "function") {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
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
    if (destroyed) return;
    if (typeof requestAnimationFrame === "function") {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (destroyed) return;
        renderIncremental();
      });
    } else {
      renderIncremental();
    }
  }

  function pointSegmentDistanceSquared(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
    return (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2;
  }

  function segmentsWithinRadius(a, b, c, d, radius) {
    if (Math.max(a.x, b.x) + radius < Math.min(c.x, d.x) || Math.max(c.x, d.x) + radius < Math.min(a.x, b.x)
      || Math.max(a.y, b.y) + radius < Math.min(c.y, d.y) || Math.max(c.y, d.y) + radius < Math.min(a.y, b.y)) return false;
    const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    if (Math.max(a.x, b.x) >= Math.min(c.x, d.x) && Math.max(c.x, d.x) >= Math.min(a.x, b.x)
      && Math.max(a.y, b.y) >= Math.min(c.y, d.y) && Math.max(c.y, d.y) >= Math.min(a.y, b.y)
      && cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0) return true;
    return Math.min(pointSegmentDistanceSquared(a, c, d), pointSegmentDistanceSquared(b, c, d),
      pointSegmentDistanceSquared(c, a, b), pointSegmentDistanceSquared(d, a, b)) <= radius * radius;
  }

  function renderedInkPath(mapped) {
    if (mapped.length < 3 || typeof ctx.quadraticCurveTo !== "function") return mapped;
    const path = [mapped[0]];
    const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    function flatten(a, control, b, depth = 0) {
      // Follow the same quadratic segments as drawFullStroke to within half a CSS pixel.
      if (depth >= 10 || pointSegmentDistanceSquared(control, a, b) <= 0.25) {
        path.push(b);
        return;
      }
      const left = midpoint(a, control), right = midpoint(control, b), split = midpoint(left, right);
      flatten(a, left, split, depth + 1);
      flatten(split, right, b, depth + 1);
    }
    for (let i = 1; i < mapped.length; i++) {
      if (i === mapped.length - 1) path.push(mapped[i]);
      else flatten(path[path.length - 1], mapped[i], midpoint(mapped[i], mapped[i + 1]));
    }
    return path;
  }

  // Test the swept eraser against ink segments, including sparsely sampled fast strokes.
  function eraseStrokesAtPoints(points) {
    if (!Array.isArray(points) || points.length === 0) return false;
    const path = lastEraserPoint ? [lastEraserPoint, ...points] : points;
    lastEraserPoint = points[points.length - 1];
    if (strokes.length === 0) return false;
    const remaining = strokes.filter((stroke) => {
      const mapped = stroke.points.map(p => mapPointToCanvas(p, stroke));
      const ink = renderedInkPath(mapped);
      const radius = settings.eraserRadius + (stroke.width || 2.5) * (mapped[0]?.scale || 1) / 2;
      for (let i = 0; i < ink.length; i++) {
        for (let j = 0; j < path.length; j++) {
          if (segmentsWithinRadius(ink[Math.max(0, i - 1)], ink[i], path[Math.max(0, j - 1)], path[j], radius)) return false;
        }
      }
      return true;
    });

    if (remaining.length !== strokes.length) {
      if (!eraserGestureChanged) saveToUndoStack();
      strokes = remaining;
      redraw();
      eraserGestureChanged = true;
      return true;
    }
    return false;
  }

  function saveToUndoStack() {
    //+_+// 확정된 stroke 객체는 이후 직접 수정하지 않으므로 배열만 복사해 고속 연속 필기의 전체 point 직렬화를 피한다.
    undoStack.push(strokes.slice());
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
  let currentScene = null;
  let currentSceneFit = null;

  function extractPoints(e) {
    if (!cachedCanvasRect || !cachedGridInfo) {
      cachedCanvasRect = canvasElement.getBoundingClientRect();
      cachedGridInfo = getGridBoundingInfo();
    }

    const coalescedEvents = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : null;
    //+_+// Chrome이 빈 coalesced 배열을 반환하면 원본 PointerEvent를 사용해 시작 좌표를 보존한다.
    const events = Array.isArray(coalescedEvents) && coalescedEvents.length > 0 ? coalescedEvents : [e];
    const points = [];

    for (const evt of events) {
      const touch = evt.touches?.[0] || evt.changedTouches?.[0] || null;
      const clientX = Number.isFinite(evt.clientX) ? evt.clientX : touch?.clientX;
      const clientY = Number.isFinite(evt.clientY) ? evt.clientY : touch?.clientY;
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) continue;
      const x = clientX - cachedCanvasRect.left;
      const y = clientY - cachedCanvasRect.top;
      const relX = cachedGridInfo.gridWidth > 0 ? (x - cachedGridInfo.gridLeft) / cachedGridInfo.gridWidth : 0;
      const relY = cachedGridInfo.gridHeight > 0 ? (y - cachedGridInfo.gridTop) / cachedGridInfo.gridHeight : 0;

      points.push({ x, y, relX, relY });
    }

    return points;
  }

  function appendUniquePoints(target, points) {
    if (!target || !Array.isArray(points) || points.length === 0) return 0;
    let appended = 0;
    for (const point of points) {
      const previous = target[target.length - 1];
      if (previous && previous.x === point.x && previous.y === point.y) continue;
      target.push(point);
      appended += 1;
    }
    return appended;
  }

  function cancelScheduledRender() {
    if (rafId && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(rafId);
    }
    rafId = null;
  }

  function captureTerminalEvent(e) {
    const points = extractPoints(e);
    if (settings.isEraser) {
      eraseStrokesAtPoints(points);
      return;
    }
    if (currentStroke) appendUniquePoints(currentStroke.points, points);
  }

  // ----------------------------------------------------
  // Pointer Event Handlers
  // ----------------------------------------------------
  function onPointerDown(e, recovered = false) {
    if (destroyed || settings.readOnly) return;
    if (!recovered) {
      inputDiagnostics.downReceived++;
      const terminal = penTerminals.get(e.pointerId);
      if (e.pointerType === "pen" && terminal && Number.isFinite(e.timeStamp) && e.timeStamp > 0 && e.timeStamp < terminal.timeStamp) {
        inputDiagnostics.rejectedDown++;
        return;
      }
      if (e.pointerType === "pen") penTerminals.delete(e.pointerId);
    }
    //+_+// [고속 필기 획 씹힘 방지 SSOT]
    // 직전 획이 아직 완전히 종료되지 않은 상태(isDrawing이거나 활성 포인터가 남아있는 상태)에서
    // 빠른 새 pointerdown이 들어오면, 진행 중이던 이전 획을 즉시 정상 commit하고 포인터 상태를 정리한다.
    if (isDrawing || activePenPointerId !== null || activeTouchPointerId !== null) {
      if (activePenPointerId !== null && e.pointerType !== "pen") return;
      const isSamePen = activePenPointerId !== null && e.pointerType === "pen" && e.pointerId === activePenPointerId;
      const isSameTouch = activeTouchPointerId !== null && e.pointerId === activeTouchPointerId;
      resetActivePointers({ releaseCapture: !isSamePen && !isSameTouch });
    }

    // Cooldown 검사
    const now = Date.now();
    if (now - lastPenEndTime < 400) {
      currentState = InputState.PEN_COOLDOWN;
    }

    // 단일 입력 수락 판정
    if (!shouldAcceptPointer(e, settings.profile, currentState)) {
      inputDiagnostics.rejectedDown++;
      return;
    }
    if (!recovered && e.pointerType === "pen") recoverySuspended = false;

    // Pen 입력인 경우 이전 터치 드로잉 즉시 취소 및 Pen Active Lock 획득
    if (e.pointerType === "pen") {
      if (currentState === InputState.TOUCH_DRAWING && currentStroke) {
        currentStroke = null;
      }
      if (activeTouchPointerId !== null) {
        try {
          if (typeof canvasElement.releasePointerCapture === "function") {
            canvasElement.releasePointerCapture(activeTouchPointerId);
          }
        } catch (_) {}
      }
      currentState = InputState.PEN_DRAWING;
      activePenPointerId = e.pointerId;
      activeTouchPointerId = null;
      activeTouchPointerType = null;
    } else {
      currentState = InputState.TOUCH_DRAWING;
      activeTouchPointerId = e.pointerId;
      activeTouchPointerType = e.pointerType;
    }

    if (e.cancelable) e.preventDefault();

    if (canvasElement.width === 0 || canvasElement.height === 0) {
      resize();
    }

    isDrawing = true;
    inputDiagnostics.startsAccepted++;
    if (recovered) inputDiagnostics.recoveredStarts++;
    activePointerStartTime = Number.isFinite(e.timeStamp) ? e.timeStamp : null;

    try {
      if (typeof canvasElement.setPointerCapture === "function" && e.pointerId !== undefined) {
        canvasElement.setPointerCapture(e.pointerId);
      }
    } catch (_) {}

    cachedCanvasRect = canvasElement.getBoundingClientRect();
    cachedGridInfo = getGridBoundingInfo();

    const pts = extractPoints(e);
    if (pts.length === 0) {
      resetActivePointers();
      return;
    }

    eraserGestureChanged = false;
    lastEraserPoint = null;

    if (settings.isEraser) {
      eraseStrokesAtPoints(pts);
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
      gridStyle: cachedGridInfo.gridStyle,
      gridLayoutWidth: cachedGridInfo.gridLayoutWidth,
      gridLayoutHeight: cachedGridInfo.gridLayoutHeight,
      sceneGeometry: currentScene ? { baseWidth: currentScene.baseWidth, baseHeight: currentScene.baseHeight,
        gridLeft: currentScene.gridLeft, gridTop: currentScene.gridTop,
        gridWidth: currentScene.gridWidth, gridHeight: currentScene.gridHeight, gridStyle: currentScene.gridStyle,
        gridLayoutWidth: currentScene.gridLayoutWidth, gridLayoutHeight: currentScene.gridLayoutHeight } : undefined,
      points: pts,
      timestamp: Date.now()
    };

    lastDrawnPointIndex = 0;
    scheduleRender();
  }

  function matchesActivePointer(e) {
    if (!e) return false;
    // ID reuse must not let an older contact's queued event mutate the new stroke.
    if (activePointerStartTime !== null && Number.isFinite(e.timeStamp) && e.timeStamp > 0
      && e.timeStamp < activePointerStartTime) return false;
    if (activePenPointerId !== null) {
      return e.pointerType === "pen" && e.pointerId === activePenPointerId;
    }
    if (activeTouchPointerId !== null) {
      return e.pointerType === activeTouchPointerType && e.pointerId === activeTouchPointerId;
    }
    return false;
  }

  function onPointerMove(e) {
    if (destroyed) return;
    if (!isDrawing) {
      if (e.pointerType !== "pen") return;
      inputDiagnostics.orphanMoves++;
      const terminal = penTerminals.get(e.pointerId);
      const stale = terminal && Number.isFinite(e.timeStamp) && e.timeStamp > 0 && e.timeStamp < terminal.timeStamp;
      // A hover/release is evidence that a cancelled contact really ended. Pressure
      // alone can transiently be zero during contact, so require both signals.
      if (!stale && (e.buttons & 1) === 0 && e.pressure === 0) {
        if (terminal) terminal.blocked = false;
        return;
      }
      const rect = canvasElement.getBoundingClientRect();
      const canRecover = !settings.readOnly && !settings.isEraser && !recoverySuspended &&
        !(typeof document !== "undefined" && document.hidden) && !stale && !terminal?.blocked &&
        shouldAcceptPointer(e, settings.profile, currentState) && (e.buttons & 1) === 1 &&
        Number.isFinite(e.pressure) && e.pressure > 0 &&
        Number.isFinite(e.clientX) && Number.isFinite(e.clientY) && rect.width > 0 && rect.height > 0 &&
        e.clientX >= rect.left && e.clientX <= rect.left + rect.width &&
        e.clientY >= rect.top && e.clientY <= rect.top + rect.height;
      if (canRecover) onPointerDown(e, true);
      else inputDiagnostics.blockedRecovery++;
      return;
    }
    if (!matchesActivePointer(e)) return;

    if (e.cancelable) e.preventDefault();

    const pts = extractPoints(e);
    if (pts.length === 0) return;

    if (settings.isEraser) {
      eraseStrokesAtPoints(pts);
      return;
    }

    if (currentStroke) {
      if (appendUniquePoints(currentStroke.points, pts) > 0) scheduleRender();
    }
  }

  function onPointerUp(e, captureCoordinates = true) {
    // Capture loss is not a physical end: a subsequent contact move may recover.
    if (captureCoordinates && (!isDrawing || matchesActivePointer(e))) rememberPenTerminal(e);
    if (destroyed || !isDrawing || !matchesActivePointer(e)) return;

    const isPen = e.pointerType === "pen";

    if (e.cancelable) e.preventDefault();

    //+_+// 빠른 짧은 획은 마지막 pointermove 없이 pointerup될 수 있으므로 종료 좌표를 확정 전에 반영한다.
    if (captureCoordinates) captureTerminalEvent(e);
    cancelScheduledRender();

    if (currentStroke && currentStroke.points.length > 0) {
      strokes.push(currentStroke);
      currentStroke = null;
      // Remove provisional incremental tails; committed ink must match reload/hit testing.
      redraw();
      notifyChange();
    } else if (settings.isEraser && eraserGestureChanged) {
      notifyChange();
    }
    eraserGestureChanged = false;

    isDrawing = false;
    activePenPointerId = null;
    activeTouchPointerId = null;
    activeTouchPointerType = null;
    activePointerStartTime = null;
    lastEraserPoint = null;
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

  }

  function onPointerCancel(e) {
    if (!isDrawing || matchesActivePointer(e)) {
      rememberPenTerminal(e);
      inputDiagnostics.cancels++;
    }
    if (destroyed || !isDrawing || !matchesActivePointer(e)) return;

    const isPen = e.pointerType === "pen";

    if (e.cancelable) e.preventDefault();

    //+_+// cancel 좌표는 마지막 전달 좌표와 같을 수 있으므로 중복 제거 후 안전하게 확정한다.
    captureTerminalEvent(e);
    cancelScheduledRender();

    if (currentStroke && currentStroke.points.length > 0) {
      strokes.push(currentStroke);
      currentStroke = null;
      redraw();
      notifyChange();
    } else if (settings.isEraser && eraserGestureChanged) {
      notifyChange();
    }
    eraserGestureChanged = false;

    isDrawing = false;
    activePenPointerId = null;
    activeTouchPointerId = null;
    activeTouchPointerType = null;
    activePointerStartTime = null;
    lastEraserPoint = null;
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

    currentStroke = null;
  }

  function onLostPointerCapture(e) {
    // A prior contact's queued loss can arrive after this ID has been recaptured.
    // Capture events have no drawing coordinates and must not append (0, 0).
    try {
      if (canvasElement.hasPointerCapture?.(e.pointerId)) return;
    } catch (_) {}
    if (!destroyed && isDrawing && matchesActivePointer(e)) {
      inputDiagnostics.captureLosses++;
      onPointerUp(e, false);
    }
  }

  function resetActivePointers(options = {}) {
    const activePointerId = activePenPointerId !== null ? activePenPointerId : activeTouchPointerId;
    if (activePointerId !== null && options.releaseCapture !== false) {
      try {
        if (typeof canvasElement.releasePointerCapture === "function") {
          canvasElement.releasePointerCapture(activePointerId);
        }
      } catch (_) {}
    }
    cancelScheduledRender();
    if (cooldownTimer) {
      clearTimeout(cooldownTimer);
      cooldownTimer = null;
    }
    if (isDrawing) {
      let strokeCommitted = false;
      if (currentStroke && currentStroke.points.length > 0) {
        strokes.push(currentStroke);
        strokeCommitted = true;
      }
      currentStroke = null;
      isDrawing = false;
      if (strokeCommitted) redraw();
      if (strokeCommitted || eraserGestureChanged) notifyChange();
    }
    eraserGestureChanged = false;
    activePenPointerId = null;
    activeTouchPointerId = null;
    activeTouchPointerType = null;
    activePointerStartTime = null;
    lastEraserPoint = null;
    currentState = InputState.IDLE;
    cachedCanvasRect = null;
    cachedGridInfo = null;
  }

  function handleVisibilityChange() {
    if (typeof document !== "undefined" && document.hidden) {
      suspendRecovery();
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
  //+_+// iPad Safari에서는 pointerrawupdate 단독 경로가 일부 Pencil 좌표를 전달하지 않으므로 검증된 pointermove와 coalesced events를 사용한다.
  addManagedListener(canvasElement, "pointermove", onPointerMove, { passive: false });
  addManagedListener(canvasElement, "pointerup", onPointerUp, { passive: false });
  addManagedListener(canvasElement, "pointercancel", onPointerCancel, { passive: false });
  addManagedListener(canvasElement, "lostpointercapture", onLostPointerCapture, { passive: false });

  if (typeof window !== "undefined") {
    addManagedListener(window, "blur", suspendRecovery);
    addManagedListener(window, "pagehide", suspendRecovery);
    //+_+// [캔버스 경계 이탈 획 씹힘 방지] 캔버스 밖으로 나가서 포인터를 떼거나 취소되었을 때도 획을 안전하게 확정/종료
    addManagedListener(window, "pointerup", (e) => {
      if (!destroyed && (!isDrawing || matchesActivePointer(e))) {
        onPointerUp(e);
      }
    }, { passive: false });
    addManagedListener(window, "pointercancel", (e) => {
      if (!destroyed && (!isDrawing || matchesActivePointer(e))) {
        onPointerCancel(e);
      }
    }, { passive: false });
  }
  if (typeof document !== "undefined") {
    addManagedListener(document, "visibilitychange", handleVisibilityChange);
  }

  const preventDefaults = (e) => {
    if (e.cancelable) e.preventDefault();
  };
  addManagedListener(canvasElement, "selectstart", preventDefaults, { passive: false });
  addManagedListener(canvasElement, "dragstart", preventDefaults, { passive: false });
  addManagedListener(canvasElement, "contextmenu", preventDefaults, { passive: false });

  let resizeObserver = null;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      if (destroyed) return;
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
      suspendRecovery();
      settings.pencilOnly = Boolean(pencilOnly);
      if (pencilOnly) {
        settings.profile = InputProfile.IPAD_PEN_ONLY;
      } else {
        settings.profile = getEnvironmentProfile() === InputProfile.IPAD_PEN_ONLY
          ? InputProfile.IPAD_PEN_TOUCH
          : InputProfile.DESKTOP_MOUSE_PEN;
      }
      updateTouchAction();
    },
    setInputProfile(profile) {
      if (Object.values(InputProfile).includes(profile)) {
        if (profile !== settings.profile) suspendRecovery();
        settings.profile = profile;
        settings.pencilOnly = (profile === InputProfile.IPAD_PEN_ONLY);
        updateTouchAction();
      }
    },
    getInputProfile() {
      return settings.profile;
    },
    getInputDiagnostics() {
      return { ...inputDiagnostics, profile: settings.profile, isDrawing, recoverySuspended };
    },
    setReadOnly(readOnly) {
      suspendRecovery();
      settings.readOnly = Boolean(readOnly);
      if (settings.readOnly) {
        settings.profile = InputProfile.READ_ONLY;
      }
      updateTouchAction();
    },
    undo() {
      if (undoStack.length === 0) return false;
      redoStack.push(strokes.slice());
      strokes = undoStack.pop();
      redraw();
      notifyChange();
      return true;
    },
    redo() {
      if (redoStack.length === 0) return false;
      undoStack.push(strokes.slice());
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
    getBackgroundStrokes() {
      return cloneStrokes(backgroundStrokes);
    },
    setBackgroundStrokes(newStrokes) {
      backgroundStrokes = cloneStrokes(newStrokes);
      redraw();
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
    redraw,
    destroy() {
      if (destroyed) return;
      resetActivePointers();
      destroyed = true;
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
