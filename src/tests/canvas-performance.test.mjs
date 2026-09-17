import test from "node:test";
import assert from "node:assert/strict";
import { createDrawingCanvas, InputProfile } from "../public/app/js/canvasEngine.js";

test("R2-P1-01: 1,000개 고속 Coalesced Point 필기 성능 및 지우개 Undo 계측 검증", () => {
  const listeners = new Map();
  let clearRectCalls = 0;
  let strokeCalls = 0;
  let getBoundingClientRectCalls = 0;

  const mockCanvas = {
    getContext: () => ({
      clearRect: () => { clearRectCalls++; },
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      quadraticCurveTo: () => {},
      stroke: () => { strokeCalls++; },
      arc: () => {},
      fill: () => {},
      save: () => {},
      restore: () => {},
      setTransform: () => {}
    }),
    getBoundingClientRect: () => {
      getBoundingClientRectCalls++;
      return { left: 0, top: 0, width: 600, height: 400 };
    },
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type),
    style: {}
  };

  let strokeChangeCalls = 0;
  const canvas = createDrawingCanvas(mockCanvas, {
    profile: InputProfile.IPAD_PEN_ONLY,
    onStrokeChange: () => { strokeChangeCalls++; }
  });

  // 1. 1,000개 고속 점 연속 입력 시뮬레이션 (100개 chunk x 10 coalesced points)
  listeners.get("pointerdown")({ pointerType: "pen", pointerId: 1, clientX: 10, clientY: 10 });

  for (let i = 1; i <= 100; i++) {
    const pts = [];
    for (let j = 0; j < 10; j++) {
      pts.push({ clientX: 10 + i * 5 + j * 0.5, clientY: 10 + i * 3 + j * 0.3 });
    }
    listeners.get("pointermove")({
      pointerType: "pen",
      pointerId: 1,
      clientX: 10 + i * 5 + 4.5,
      clientY: 10 + i * 3 + 2.7,
      getCoalescedEvents: () => pts
    });
  }

  listeners.get("pointerup")({ pointerType: "pen", pointerId: 1, clientX: 515, clientY: 313 });

  const strokes = canvas.getStrokes();
  assert.equal(strokes.length, 1);
  assert.ok(strokes[0].points.length >= 1000, `수집된 점 수(${strokes[0].points.length})가 1000점 이상이어야 함`);
  assert.equal(strokeChangeCalls, 1, "획 완료 시 onStrokeChange는 1회만 호출되어야 함");

  // 2. 지우개 모드: 1개 제스처 당 정확히 1회의 Undo snapshot만 생성되는지 검증
  canvas.setEraser(true);
  const beforeUndoCount = canvas.getStrokes().length;

  listeners.get("pointerdown")({ pointerType: "pen", pointerId: 2, clientX: 50, clientY: 50 });
  for (let k = 0; k < 20; k++) {
    listeners.get("pointermove")({ pointerType: "pen", pointerId: 2, clientX: 50 + k, clientY: 50 + k });
  }
  listeners.get("pointerup")({ pointerType: "pen", pointerId: 2, clientX: 70, clientY: 70 });

  const undone = canvas.undo();
  assert.equal(undone, true, "지우개 제스처 완료 후 Undo가 성공해야 함");
  assert.equal(canvas.getStrokes().length, beforeUndoCount, "Undo 1회로 지우개 이전 상태가 복원되어야 함");

  canvas.destroy();
});

test("E-R1-03: 250개 고속 짧은 획의 종료 좌표 및 Undo Redo 보존", () => {
  const listeners = new Map();
  const mockCanvas = {
    getContext: () => ({
      clearRect: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
      quadraticCurveTo: () => {}, stroke: () => {}, arc: () => {}, fill: () => {},
      save: () => {}, restore: () => {}, setTransform: () => {}
    }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 400 }),
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type),
    setPointerCapture: () => {}, releasePointerCapture: () => {}, style: {}
  };

  let changeCount = 0;
  const canvas = createDrawingCanvas(mockCanvas, {
    profile: InputProfile.IPAD_PEN_ONLY,
    onStrokeChange: () => { changeCount++; }
  });

  for (let i = 0; i < 250; i++) {
    const pointerId = i + 1;
    const x = 10 + (i % 50);
    const y = 10 + Math.floor(i / 50);
    listeners.get("pointerdown")({ pointerType: "pen", pointerId, clientX: x, clientY: y });
    listeners.get("pointerup")({ pointerType: "pen", pointerId, clientX: x + 4, clientY: y + 6 });
  }

  const strokes = canvas.getStrokes();
  assert.equal(strokes.length, 250);
  assert.equal(strokes.every((stroke) => stroke.points.length === 2), true, "모든 짧은 획에 종료점이 있어야 함");
  assert.equal(changeCount, 250, "획 하나당 변경 알림은 한 번만 발생해야 함");

  assert.equal(canvas.undo(), true);
  assert.equal(canvas.getStrokes().length, 249);
  assert.equal(canvas.redo(), true);
  assert.equal(canvas.getStrokes().length, 250);

  canvas.destroy();
});

test("Fix: 초고속 오버랩 연속 획 입력 시 이전 획 덮어쓰기 및 씹힘 0% 보존 검증", () => {
  const listeners = new Map();
  const mockCanvas = {
    getContext: () => ({
      clearRect: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
      quadraticCurveTo: () => {}, stroke: () => {}, arc: () => {}, fill: () => {},
      save: () => {}, restore: () => {}, setTransform: () => {}
    }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }),
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type),
    setPointerCapture: () => {}, releasePointerCapture: () => {}, style: {}
  };

  const canvas = createDrawingCanvas(mockCanvas, { profile: InputProfile.DESKTOP_MOUSE_PEN });

  // 10개 획 연속 입력: 각 획의 pointerup이 지연되어 새 pointerdown이 먼저 발생해도 이전 획이 commit되어야 함
  for (let i = 0; i < 10; i++) {
    listeners.get("pointerdown")({ pointerType: "mouse", pointerId: 1, button: 0, clientX: 10 + i * 20, clientY: 10 });
    listeners.get("pointermove")({ pointerType: "mouse", pointerId: 1, button: 0, clientX: 20 + i * 20, clientY: 20 });
    // up 없이 바로 다음 down이 들어오는 극단적 오버랩 상황!
  }
  // 마지막 획만 pointerup
  listeners.get("pointerup")({ pointerType: "mouse", pointerId: 1, button: 0, clientX: 200, clientY: 20 });

  const strokes = canvas.getStrokes();
  assert.equal(strokes.length, 10, "오버랩 연속 필기에서도 10개 획이 씹히지 않고 전수 보존되어야 함");
  assert.ok(strokes.every((s) => s.points.length >= 2), "모든 획이 정상 좌표를 포함해야 함");

  canvas.destroy();
});

test("Fix: 캔버스 경계 밖 이탈 후 window pointerup 발생 시 획 안전 확정 및 다음 획 입력 보장", () => {
  const canvasListeners = new Map();
  const windowListeners = new Map();

  const mockCanvas = {
    getContext: () => ({
      clearRect: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
      quadraticCurveTo: () => {}, stroke: () => {}, arc: () => {}, fill: () => {},
      save: () => {}, restore: () => {}, setTransform: () => {}
    }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }),
    addEventListener: (type, fn) => canvasListeners.set(type, fn),
    removeEventListener: (type) => canvasListeners.delete(type),
    setPointerCapture: () => {}, releasePointerCapture: () => {}, style: {}
  };

  const originalWindow = globalThis.window;
  globalThis.window = {
    addEventListener: (type, fn) => windowListeners.set(type, fn),
    removeEventListener: (type) => windowListeners.delete(type)
  };

  try {
    const canvas = createDrawingCanvas(mockCanvas, { profile: InputProfile.DESKTOP_MOUSE_PEN });

    // 1번 획: 캔버스 안에서 시작하여 캔버스 밖으로 이동
    canvasListeners.get("pointerdown")({ pointerType: "mouse", pointerId: 1, button: 0, clientX: 350, clientY: 250 });
    canvasListeners.get("pointermove")({ pointerType: "mouse", pointerId: 1, button: 0, clientX: 450, clientY: 350 }); // 밖으로 이탈

    // canvasElement 대신 window에서 pointerup 발생 (캔버스 밖에서 손을 뗀 상황)
    assert.ok(windowListeners.has("pointerup"), "window pointerup 리스너가 등록되어 있어야 함");
    windowListeners.get("pointerup")({ pointerType: "mouse", pointerId: 1, button: 0, clientX: 450, clientY: 350 });

    assert.equal(canvas.getStrokes().length, 1, "경계 이탈 획이 정상 확정되어야 함");

    // 2번 획: 곧바로 다음 획을 정상 시작할 수 있어야 함 (isDrawing이 풀렸으므로)
    canvasListeners.get("pointerdown")({ pointerType: "mouse", pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    canvasListeners.get("pointermove")({ pointerType: "mouse", pointerId: 1, button: 0, clientX: 120, clientY: 120 });
    canvasListeners.get("pointerup")({ pointerType: "mouse", pointerId: 1, button: 0, clientX: 120, clientY: 120 });

    assert.equal(canvas.getStrokes().length, 2, "경계 이탈 후 다음 획도 씹힘 없이 2개로 완벽 저장되어야 함");

    canvas.destroy();
  } finally {
    globalThis.window = originalWindow;
  }
});

