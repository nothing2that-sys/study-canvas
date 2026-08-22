import test from "node:test";
import assert from "node:assert/strict";

// Canvas 모의 객체
function createMockCanvas() {
  const listeners = {};
  return {
    width: 300,
    height: 200,
    getContext: () => ({
      scale: () => {},
      setTransform: () => {},
      clearRect: () => {},
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      moveTo: () => {},
      quadraticCurveTo: () => {},
      lineTo: () => {},
      stroke: () => {}
    }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 200 }),
    addEventListener: (type, fn) => { listeners[type] = fn; },
    removeEventListener: (type) => { delete listeners[type]; },
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    _listeners: listeners
  };
}

test("canvasEngine: 캔버스 생성 및 기본 스트로크 관리", async () => {
  // 브라우저 전역 모의
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  globalThis.window = { devicePixelRatio: 2 };

  const { createDrawingCanvas } = await import("../public/app/js/canvasEngine.js");
  const mockCanvas = createMockCanvas();

  let changedStrokes = null;
  const canvas = createDrawingCanvas(mockCanvas, {
    color: "#173f35",
    width: 2.5,
    onStrokeChange: (s) => { changedStrokes = s; }
  });

  assert.equal(canvas.isEmpty(), true);

  // 1. 드로잉 시뮬레이션: 다운 -> 무브 1 -> 무브 2 -> 업
  mockCanvas._listeners.pointerdown({ clientX: 10, clientY: 10, pointerId: 1, pointerType: "pen" });
  mockCanvas._listeners.pointermove({ clientX: 50, clientY: 50, pointerId: 1, pointerType: "pen" });
  mockCanvas._listeners.pointermove({ clientX: 100, clientY: 100, pointerId: 1, pointerType: "pen" });
  mockCanvas._listeners.pointerup({ clientX: 100, clientY: 100, pointerId: 1, pointerType: "pen" });

  assert.equal(canvas.isEmpty(), false);
  const strokes = canvas.getStrokes();
  assert.equal(strokes.length, 1);
  assert.equal(strokes[0].points.length, 3);
  assert.equal(strokes[0].color, "#173f35");

  // 2. Undo 검증
  const undoResult = canvas.undo();
  assert.equal(undoResult, true);
  assert.equal(canvas.getStrokes().length, 0);

  // 3. Redo 검증
  const redoResult = canvas.redo();
  assert.equal(redoResult, true);
  assert.equal(canvas.getStrokes().length, 1);

  // 4. setStrokes 검증
  canvas.setStrokes([]);
  assert.equal(canvas.isEmpty(), true);

  canvas.destroy();
});
