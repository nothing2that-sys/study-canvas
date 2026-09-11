import test from "node:test";
import assert from "node:assert/strict";
import { shouldAcceptPointer, InputProfile, InputState, createDrawingCanvas } from "../public/app/js/canvasEngine.js";

test("R2-P0-02 & 7.1: 입력 프로필별 포인터 수락 검증", () => {
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

test("R2-P0-03 & 7.2: 펜과 손바닥 상태 머신 및 포인터 라이프사이클 격리 검증", () => {
  // 1. 상태 머신 수락 규칙 검증
  assert.equal(shouldAcceptPointer({ pointerType: "touch" }, InputProfile.IPAD_PEN_TOUCH, InputState.PEN_DRAWING), false, "PEN_DRAWING 중 touch 거부");
  assert.equal(shouldAcceptPointer({ pointerType: "touch" }, InputProfile.IPAD_PEN_TOUCH, InputState.TOUCH_DRAWING), false, "TOUCH_DRAWING 중 2번째 touch 거부");
  assert.equal(shouldAcceptPointer({ pointerType: "touch" }, InputProfile.IPAD_PEN_TOUCH, InputState.PEN_COOLDOWN), false, "PEN_COOLDOWN 중 touch 거부");
  assert.equal(shouldAcceptPointer({ pointerType: "touch" }, InputProfile.IPAD_PEN_TOUCH, InputState.IDLE), true, "IDLE 시 touch 수락");
  assert.equal(shouldAcceptPointer({ pointerType: "pen" }, InputProfile.IPAD_PEN_TOUCH, InputState.PEN_COOLDOWN), true, "PEN_COOLDOWN 중 pen 즉시 수락");

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
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type),
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    style: {}
  };

  const canvas = createDrawingCanvas(mockCanvas, { profile: InputProfile.IPAD_PEN_TOUCH });

  // [회귀 시퀀스 1] Pen 필기 중 손바닥 터치 무시 및 Pen 스트로크 온전성 검증
  // 1. Pen down
  listeners.get("pointerdown")({ pointerType: "pen", pointerId: 10, clientX: 10, clientY: 10 });
  // 2. Pen move
  listeners.get("pointermove")({ pointerType: "pen", pointerId: 10, clientX: 20, clientY: 20 });
  // 3. Palm touch down (pointerId 20) -> 무시되어야 함
  listeners.get("pointerdown")({ pointerType: "touch", pointerId: 20, clientX: 100, clientY: 100 });
  // 4. Palm touch move
  listeners.get("pointermove")({ pointerType: "touch", pointerId: 20, clientX: 110, clientY: 110 });
  // 5. Palm touch up -> 활성 Pen 스트로크를 종료하지 않아야 함!
  listeners.get("pointerup")({ pointerType: "touch", pointerId: 20, clientX: 110, clientY: 110 });
  // 6. Pen move
  listeners.get("pointermove")({ pointerType: "pen", pointerId: 10, clientX: 30, clientY: 30 });
  // 7. Pen up -> Pen 스트로크 정상 확정
  listeners.get("pointerup")({ pointerType: "pen", pointerId: 10, clientX: 40, clientY: 40 });

  const strokes = canvas.getStrokes();
  assert.equal(strokes.length, 1, "오직 Pen 획 1개만 생성되어야 함");
  assert.equal(strokes[0].points.length >= 3, true, "Pen의 시작과 끝 좌표가 온전히 유지되어야 함");

  // [회귀 시퀀스 2] Touch 필기 중 Pen 진입 시 Touch 취소 및 Pen 전환 검증
  // 1. Touch down (pointerId 30)
  listeners.get("pointerdown")({ pointerType: "touch", pointerId: 30, clientX: 5, clientY: 5 });
  // 2. Touch move
  listeners.get("pointermove")({ pointerType: "touch", pointerId: 30, clientX: 15, clientY: 15 });
  // 3. Pen down (pointerId 40) -> Touch stroke 폐기 및 Pen 활성화
  listeners.get("pointerdown")({ pointerType: "pen", pointerId: 40, clientX: 50, clientY: 50 });
  // 4. 이전 Touch up (pointerId 30) -> Pen에 영향 없음
  listeners.get("pointerup")({ pointerType: "touch", pointerId: 30, clientX: 15, clientY: 15 });
  // 5. Pen move & up
  listeners.get("pointermove")({ pointerType: "pen", pointerId: 40, clientX: 60, clientY: 60 });
  listeners.get("pointerup")({ pointerType: "pen", pointerId: 40, clientX: 70, clientY: 70 });

  const allStrokes = canvas.getStrokes();
  assert.equal(allStrokes.length, 2, "총 2개의 스트로크(이전 Pen 1개 + 신규 Pen 1개)가 확정되어야 함");

  canvas.destroy();
});

test("R2-P1-01 & 7.3: 고속 필기 getCoalescedEvents 다중 좌표 수집 보장", () => {
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

test("E-R1-01: Safari fallback 고속 단획의 pointerup 종료 좌표 보존", () => {
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
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    style: {}
  };

  const canvas = createDrawingCanvas(mockCanvas, { profile: InputProfile.IPAD_PEN_ONLY });

  //+_+// Safari fallback처럼 getCoalescedEvents와 pointermove 없이 즉시 끝나는 빠른 획을 재현한다.
  listeners.get("pointerdown")({ pointerType: "pen", pointerId: 201, clientX: 11, clientY: 13 });
  listeners.get("pointerup")({ pointerType: "pen", pointerId: 201, clientX: 27, clientY: 31 });

  const strokes = canvas.getStrokes();
  assert.equal(strokes.length, 1);
  assert.equal(strokes[0].points.length, 2, "시작점과 pointerup 종료점이 모두 저장되어야 함");
  assert.deepEqual(
    strokes[0].points.map(({ x, y }) => ({ x, y })),
    [{ x: 11, y: 13 }, { x: 27, y: 31 }]
  );

  canvas.destroy();
});

test("E-R1-02: pointercancel과 lostpointercapture 종료 경로의 좌표 무결성", () => {
  const listeners = new Map();
  const mockCanvas = {
    getContext: () => ({
      clearRect: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
      quadraticCurveTo: () => {}, stroke: () => {}, arc: () => {}, fill: () => {},
      save: () => {}, restore: () => {}, setTransform: () => {}
    }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 260 }),
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type),
    setPointerCapture: () => {}, releasePointerCapture: () => {}, style: {}
  };

  const canvas = createDrawingCanvas(mockCanvas, { profile: InputProfile.IPAD_PEN_ONLY });

  listeners.get("pointerdown")({ pointerType: "pen", pointerId: 301, clientX: 5, clientY: 7 });
  listeners.get("pointermove")({ pointerType: "pen", pointerId: 301, clientX: 15, clientY: 17 });
  listeners.get("pointercancel")({ pointerType: "pen", pointerId: 301, clientX: 15, clientY: 17 });

  listeners.get("pointerdown")({ pointerType: "pen", pointerId: 302, clientX: 40, clientY: 50 });
  //+_+// 좌표가 없는 capture 상실 이벤트가 원점 좌표를 추가하지 않아야 한다.
  listeners.get("lostpointercapture")({ pointerType: "pen", pointerId: 302 });

  const strokes = canvas.getStrokes();
  assert.equal(strokes.length, 2);
  assert.equal(strokes[0].points.length, 2, "cancel 좌표가 직전 좌표와 같으면 중복 저장하지 않아야 함");
  assert.deepEqual(strokes[1].points.map(({ x, y }) => ({ x, y })), [{ x: 40, y: 50 }]);

  canvas.destroy();
});
