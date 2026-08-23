import test from "node:test";
import assert from "node:assert/strict";
import { shouldAcceptPointer, InputProfile, InputState, createDrawingCanvas } from "../public/app/js/canvasEngine.js";

test("7.1 입력 프로필 검증: IPAD_PEN_ONLY, DESKTOP_MOUSE_PEN, READ_ONLY", () => {
  // 1. IPAD_PEN_ONLY: pen만 수락, touch/mouse/unknown 거부
  assert.equal(shouldAcceptPointer({ pointerType: "pen" }, InputProfile.IPAD_PEN_ONLY), true);
  assert.equal(shouldAcceptPointer({ pointerType: "touch" }, InputProfile.IPAD_PEN_ONLY), false);
  assert.equal(shouldAcceptPointer({ pointerType: "mouse", button: 0 }, InputProfile.IPAD_PEN_ONLY), false);
  assert.equal(shouldAcceptPointer({ pointerType: "" }, InputProfile.IPAD_PEN_ONLY), false);
  assert.equal(shouldAcceptPointer({ pointerType: undefined }, InputProfile.IPAD_PEN_ONLY), false);

  // 2. DESKTOP_MOUSE_PEN: 왼쪽 마우스 및 pen 수락
  assert.equal(shouldAcceptPointer({ pointerType: "pen" }, InputProfile.DESKTOP_MOUSE_PEN), true);
  assert.equal(shouldAcceptPointer({ pointerType: "mouse", button: 0 }, InputProfile.DESKTOP_MOUSE_PEN), true);
  assert.equal(shouldAcceptPointer({ pointerType: "mouse", button: 2 }, InputProfile.DESKTOP_MOUSE_PEN), false);

  // 3. READ_ONLY: 모든 입력 거부
  assert.equal(shouldAcceptPointer({ pointerType: "pen" }, InputProfile.READ_ONLY), false);
  assert.equal(shouldAcceptPointer({ pointerType: "mouse", button: 0 }, InputProfile.READ_ONLY), false);
  assert.equal(shouldAcceptPointer({ pointerType: "touch" }, InputProfile.READ_ONLY), false);
});

test("7.2 Palm 및 Pointer 상태 머신: Cooldown, Cancel 보존, 캔버스 동작", () => {
  // 1. Pen Cooldown 중 touch 거부
  assert.equal(shouldAcceptPointer({ pointerType: "touch" }, InputProfile.IPAD_PEN_TOUCH, InputState.PEN_COOLDOWN), false);
  assert.equal(shouldAcceptPointer({ pointerType: "pen" }, InputProfile.IPAD_PEN_TOUCH, InputState.PEN_COOLDOWN), true);

  // 2. 모의 캔버스 엘리먼트 생성
  const listeners = new Map();
  const mockCanvas = {
    getContext: () => ({
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      arc: () => {},
      fill: () => {},
      save: () => {},
      restore: () => {},
      setTransform: () => {}
    }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 260 }),
    addEventListener: (type, fn) => {
      listeners.set(type, fn);
    },
    removeEventListener: (type) => {
      listeners.delete(type);
    },
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    style: {}
  };

  const canvas = createDrawingCanvas(mockCanvas, { profile: InputProfile.IPAD_PEN_ONLY });
  assert.equal(canvas.getInputProfile(), InputProfile.IPAD_PEN_ONLY);

  // 3. 터치 입력 시 획이 생기지 않음
  listeners.get("pointerdown")({ pointerType: "touch", clientX: 10, clientY: 10, pointerId: 1 });
  listeners.get("pointermove")({ pointerType: "touch", clientX: 20, clientY: 20, pointerId: 1 });
  listeners.get("pointerup")({ pointerType: "touch", clientX: 20, clientY: 20, pointerId: 1 });
  assert.equal(canvas.getStrokes().length, 0, "Pen Only에서 touch는 획을 생성하지 않아야 함");

  // 4. Pen 입력 시 획 생성
  listeners.get("pointerdown")({ pointerType: "pen", clientX: 10, clientY: 10, pointerId: 2 });
  listeners.get("pointermove")({ pointerType: "pen", clientX: 30, clientY: 30, pointerId: 2 });
  listeners.get("pointerup")({ pointerType: "pen", clientX: 50, clientY: 50, pointerId: 2 });
  assert.equal(canvas.getStrokes().length, 1, "Pen 입력은 획을 정상 생성해야 함");

  // 5. PointerCancel 시에도 유효 좌표가 있는 획 보존
  listeners.get("pointerdown")({ pointerType: "pen", clientX: 15, clientY: 15, pointerId: 3 });
  listeners.get("pointermove")({ pointerType: "pen", clientX: 35, clientY: 35, pointerId: 3 });
  listeners.get("pointercancel")({ pointerType: "pen", clientX: 35, clientY: 35, pointerId: 3 });
  assert.equal(canvas.getStrokes().length, 2, "Cancel 시에도 수집된 획이 보존되어야 함");

  canvas.destroy();
});

test("7.3 고속 필기: getCoalescedEvents 다중 좌표 수집 보장", () => {
  const listeners = new Map();
  const mockCanvas = {
    getContext: () => ({
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      quadraticCurveTo: () => {},
      stroke: () => {},
      arc: () => {},
      fill: () => {},
      save: () => {},
      restore: () => {},
      setTransform: () => {}
    }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 260 }),
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type),
    style: {}
  };

  const canvas = createDrawingCanvas(mockCanvas, { profile: InputProfile.IPAD_PEN_ONLY });

  // Coalesced Events로 한 번에 5개 중간 좌표 전달
  const coalescedEvt = {
    pointerType: "pen",
    pointerId: 99,
    clientX: 10,
    clientY: 10,
    getCoalescedEvents: () => [
      { clientX: 10, clientY: 10 },
      { clientX: 12, clientY: 14 },
      { clientX: 15, clientY: 18 },
      { clientX: 20, clientY: 24 },
      { clientX: 25, clientY: 30 }
    ]
  };

  listeners.get("pointerdown")(coalescedEvt);
  listeners.get("pointerup")({ pointerType: "pen", pointerId: 99, clientX: 25, clientY: 30 });

  const strokes = canvas.getStrokes();
  assert.equal(strokes.length, 1);
  assert.equal(strokes[0].points.length, 5, "CoalescedEvents의 5개 좌표가 누락 없이 전부 수집되어야 함");

  canvas.destroy();
});
