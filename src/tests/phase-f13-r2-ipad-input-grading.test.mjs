import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { JSDOM } from "jsdom";

import { createDrawingCanvas, InputProfile } from "../public/app/js/canvasEngine.js";
import { refreshScribbleCommitSurface, bindTextResponseSurface } from "../public/app/js/typedInteractionSurface.js";
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

test("F13-R4: delayed lifecycle with reused Pencil pointerId preserves both strokes", () => {
  const canvas = createMockCanvas();
  const instance = createDrawingCanvas(canvas, { profile: InputProfile.IPAD_PEN_ONLY });
  canvas._listeners.pointerdown({ pointerId: 7, pointerType: "pen", clientX: 10, clientY: 10 });
  canvas._listeners.pointerdown({ pointerId: 7, pointerType: "pen", clientX: 30, clientY: 30 });
  canvas._listeners.pointerup({ pointerId: 7, pointerType: "pen", clientX: 40, clientY: 40 });
  const strokes = instance.getStrokes();
  assert.equal(strokes.length, 2);
  assert.deepEqual(strokes[0].points.map(({ x, y }) => ({ x, y })), [{ x: 10, y: 10 }]);
  assert.deepEqual(strokes[1].points.map(({ x, y }) => ({ x, y })), [{ x: 30, y: 30 }, { x: 40, y: 40 }]);
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
  //+_+// Phase F15A Rework 4: Scribble refresh 실행 책임은 bindTextResponseSurface 단일 SSOT로 이전됨
  assert.equal(typeof refreshScribbleCommitSurface, "function", "typedInteractionSurface exports refreshScribbleCommitSurface");
  assert.equal(typeof bindTextResponseSurface, "function", "typedInteractionSurface exports bindTextResponseSurface");
  assert.match(app, /bindTextResponseSurface\s*\(\s*document,\s*q\.id/);
  assert.doesNotMatch(app, /applyStudentResponseChange[\s\S]*?refreshScribbleCommitSurface/);

  // Behavioral assertion: bindTextResponseSurface routes exactly 1 refresh scheduling per input & compositionend
  const dom = new JSDOM('<!DOCTYPE html><html><body><input id="textInput_f13_ssot" class="typed-text-input" /></body></html>');
  let outerScheduleCount = 0;
  const mockSchedule = (fn) => {
    outerScheduleCount++;
  };
  bindTextResponseSurface(dom.window.document, "f13_ssot", () => {}, { scheduleFrame: mockSchedule });
  const f13InputEl = dom.window.document.getElementById("textInput_f13_ssot");

  // Input event -> exactly 1 refresh outer scheduling
  f13InputEl.value = "10";
  f13InputEl.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  assert.equal(outerScheduleCount, 1, "한 input event당 refresh scheduling은 정확히 1회");
  assert.equal(f13InputEl.classList.contains("scribble-commit-refresh"), true);

  // Compositionend event -> exactly 1 additional refresh outer scheduling
  f13InputEl.dispatchEvent(new dom.window.CompositionEvent("compositionend", { bubbles: true, data: "10" }));
  assert.equal(outerScheduleCount, 2, "한 compositionend당 refresh scheduling은 정확히 1회 추가 (총 2회)");

  assert.doesNotMatch(app, /focusNextUngraded\(qId\)/);
  assert.match(html, /id="gradingQuestionNavigator"/);
  assert.match(html, /id="gradingExitBtn"/);
  assert.doesNotMatch(css, /\.grading-grid\.view-quick/);
  assert.doesNotMatch(css, /grading-card:not\(\[aria-current="step"\]\)\s*\{\s*display:\s*none/);
  assert.match(css, /\.worksheet-card\.response-surface-text \.card-problem-body[\s\S]*?touch-action:\s*auto/);
});

test("F13-R4: grading start, resume, and finish keep storage as the state authority", () => {
  const app = fs.readFileSync(new URL("../public/app/js/app.js", import.meta.url), "utf8");
  const startBlock = app.slice(app.indexOf("async function handleStartParentGrading"), app.indexOf("async function persistCurrentGradingProgress"));
  const finishBlock = app.slice(app.indexOf("async function handleFinishGrading"), app.indexOf("function showSessionResult"));
  assert.ok(startBlock.indexOf("await startSubmissionGrading") < startBlock.indexOf("currentSession.startGrading()"));
  assert.ok(finishBlock.indexOf("await finalizeSubmissionGrading") < finishBlock.indexOf("currentSession.finishGrading()"));
  assert.match(app, /const latestSubmission = await getSubmission\(submission\?\.id/);
  assert.match(app, /applyPersistedGradesToCurrentSession\(\)/);
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
