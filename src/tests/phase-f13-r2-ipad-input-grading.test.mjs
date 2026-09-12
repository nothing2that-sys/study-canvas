import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createDrawingCanvas, InputProfile } from "../public/app/js/canvasEngine.js";
import { refreshScribbleCommitSurface } from "../public/app/js/typedInteractionSurface.js";

function createMockCanvas({ rawUpdate = false } = {}) {
  const listeners = {};
  const canvas = {
    width: 300,
    height: 200,
    style: {},
    parentElement: null,
    getContext: () => ({
      setTransform() {}, clearRect() {}, save() {}, restore() {}, beginPath() {}, arc() {}, fill() {},
      moveTo() {}, quadraticCurveTo() {}, lineTo() {}, stroke() {}
    }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 200 }),
    addEventListener: (type, handler) => { listeners[type] = handler; },
    removeEventListener: (type) => { delete listeners[type]; },
    setPointerCapture() {},
    releasePointerCapture() {},
    _listeners: listeners
  };
  if (rawUpdate) canvas.onpointerrawupdate = null;
  return canvas;
}

test("F13-R2: iPad pen-only canvas keeps writable touch-action none", () => {
  const canvas = createMockCanvas();
  const instance = createDrawingCanvas(canvas, { profile: InputProfile.IPAD_PEN_ONLY });
  assert.equal(canvas.style.touchAction, "none");
  instance.destroy();
});

test("F13-R2: pointerrawupdate support replaces pointermove without duplicate stream", () => {
  const canvas = createMockCanvas({ rawUpdate: true });
  const instance = createDrawingCanvas(canvas, { profile: InputProfile.IPAD_PEN_ONLY });
  assert.equal(typeof canvas._listeners.pointerrawupdate, "function");
  assert.equal(canvas._listeners.pointermove, undefined);
  instance.destroy();
});

test("F13-R2: delayed previous Pencil lifecycle does not swallow next stroke", () => {
  const canvas = createMockCanvas();
  const instance = createDrawingCanvas(canvas, { profile: InputProfile.IPAD_PEN_ONLY });
  canvas._listeners.pointerdown({ pointerId: 1, pointerType: "pen", clientX: 10, clientY: 10 });
  canvas._listeners.pointerdown({ pointerId: 2, pointerType: "pen", clientX: 30, clientY: 30 });
  canvas._listeners.pointerup({ pointerId: 2, pointerType: "pen", clientX: 40, clientY: 40 });
  assert.equal(instance.getStrokes().length, 2);
  instance.destroy();
});

test("F13-R2: Scribble commit refresh removes its compositor class on next frame", () => {
  const classes = new Set();
  const input = {
    offsetWidth: 240,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name)
    }
  };
  let callback = null;
  assert.equal(refreshScribbleCommitSurface(input, (fn) => { callback = fn; }), true);
  assert.equal(classes.has("scribble-commit-refresh"), true);
  callback();
  assert.equal(classes.has("scribble-commit-refresh"), false);
});

test("F13-R2: quick/detail grading and canonical question ID fixes are wired", () => {
  const app = fs.readFileSync(new URL("../public/app/js/app.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../public/app/css/app.css", import.meta.url), "utf8");
  assert.match(app, /function resolveSessionQuestionId\(rawQuestionId\)/);
  assert.match(app, /const qId = resolveSessionQuestionId\(btn\.dataset\.id\)/);
  assert.match(app, /const canvasQuestions = gradingViewMode === "detail"/);
  assert.match(css, /\.grading-grid\.view-quick \.grading-comparison-grid/);
  assert.match(css, /\.worksheet-card\.response-surface-text \.card-problem-body[\s\S]*?touch-action:\s*auto/);
});
