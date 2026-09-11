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
