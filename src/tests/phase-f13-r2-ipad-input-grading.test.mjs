import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createDrawingCanvas, InputProfile } from "../public/app/js/canvasEngine.js";
import { refreshScribbleCommitSurface } from "../public/app/js/typedInteractionSurface.js";
import { createSession } from "../public/app/js/sessionEngine.js";

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

test("F13-R3: iPad uses pointermove and coalesced events even when pointerrawupdate exists", () => {
  const canvas = createMockCanvas({ rawUpdate: true });
  const instance = createDrawingCanvas(canvas, { profile: InputProfile.IPAD_PEN_ONLY });
  assert.equal(typeof canvas._listeners.pointermove, "function");
  assert.equal(canvas._listeners.pointerrawupdate, undefined);
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

test("F13-R3: Scribble commit refresh keeps one paint frame before removing its compositor class", () => {
  const classes = new Set();
  const input = {
    offsetWidth: 240,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name)
    }
  };
  const callbacks = [];
  assert.equal(refreshScribbleCommitSurface(input, (fn) => { callbacks.push(fn); }), true);
  assert.equal(classes.has("scribble-commit-refresh"), true);
  callbacks.shift()();
  assert.equal(classes.has("scribble-commit-refresh"), true);
  callbacks.shift()();
  assert.equal(classes.has("scribble-commit-refresh"), false);
});

test("F13-R3: evidence-first grading navigator and canonical question ID fixes are wired", () => {
  const app = fs.readFileSync(new URL("../public/app/js/app.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../public/app/css/app.css", import.meta.url), "utf8");
  const html = fs.readFileSync(new URL("../public/app/index.html", import.meta.url), "utf8");
  assert.match(app, /function resolveSessionQuestionId\(rawQuestionId\)/);
  assert.match(app, /const qId = resolveSessionQuestionId\(btn\.dataset\.id\)/);
  assert.match(app, /const canvasQuestions = questions\.filter/);
  assert.match(app, /function renderGradingQuestionNavigator/);
  assert.match(app, /refreshScribbleCommitSurface\(inputEl\)/);
  assert.doesNotMatch(app, /focusNextUngraded\(qId\)/);
  assert.match(html, /id="gradingQuestionNavigator"/);
  assert.match(html, /id="gradingExitBtn"/);
  assert.doesNotMatch(css, /\.grading-grid\.view-quick/);
  assert.match(css, /\.worksheet-card\.response-surface-text \.card-problem-body[\s\S]*?touch-action:\s*auto/);
});

test("F13-R2: string dataset ID grades numeric question ID and enables completion", () => {
  const session = createSession({}, [
    { id: 101, answer: "a", level: "G3" },
    { id: 102, answer: "b", level: "G3" }
  ]);
  session.start();
  session.startSubmitting();
  session.submitPractice();
  session.setPendingGrading();
  session.startGrading();
  session.gradeQuestion("101", "CORRECT");
  session.gradeQuestion("102", "WRONG");
  assert.equal(session.getGradingStatus().allGraded, true);
  assert.doesNotThrow(() => session.finishGrading());
});
