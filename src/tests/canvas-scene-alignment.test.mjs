import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { createDrawingCanvas } from '../public/app/js/canvasEngine.js';
import { sceneReference, fitScene, mapScenePoint } from '../public/app/js/canvasSceneGeometry.js';

function setup(width, height) {
  globalThis.window = { devicePixelRatio: 1 };
  let resized; globalThis.ResizeObserver = class { constructor(fn) { resized = fn; } observe() {} disconnect() {} };
  const paths = []; let path; const listeners = {};
  const context = { setTransform() {}, clearRect() {}, save() {}, restore() {}, beginPath() { path = []; },
    arc() {}, fill() {}, moveTo(x,y) { path.push([x,y]); }, lineTo(x,y) { path.push([x,y]); }, stroke() { paths.push(path); } };
  const grid = { style: {}, dataset: {}, offsetWidth: 200, offsetHeight: 160,
    getBoundingClientRect() { const scale = /scale\(([^,]+), ([^)]+)\)/.exec(this.style.transform || '');
      return { left: parseFloat(this.style.left || 20), top: parseFloat(this.style.top || 20),
        width: 200 * (scale ? +scale[1] : 1), height: 160 * (scale ? +scale[2] : 1) }; } };
  const canvas = { style: {}, getContext: () => context, getBoundingClientRect: () => ({ left:0, top:0, width, height }),
    parentElement: { querySelector: () => grid }, addEventListener(type, fn) { listeners[type] = fn; }, removeEventListener() {}, setPointerCapture() {}, releasePointerCapture() {} };
  return { grid, canvas, paths, listeners, resize(w,h) { width=w; height=h; resized(); } };
}
const student = { baseWidth:600, baseHeight:400, gridLeft:100, gridTop:100, gridWidth:300, gridHeight:200,
  points:[{x:200,y:150,relX:1/3,relY:0.25},{x:220,y:170,relX:0.4,relY:0.35}] };
const guardian = { baseWidth:600, baseHeight:500, gridLeft:100, gridTop:150, gridWidth:300, gridHeight:200,
  points:[{x:200,y:200,relX:1/3,relY:0.25},{x:220,y:220,relX:0.4,relY:0.35}] };

test('different-aspect student/guardian capture and formula share a single transform on review and resize', () => {
  const m=setup(600,500); const before=structuredClone([student,guardian]);
  const engine=createDrawingCanvas(m.canvas,{readOnly:true,backgroundStrokes:[student]}); engine.setStrokes([guardian]);
  function check() {
    const [a,b]=m.paths.slice(-2); assert.deepEqual(a,b);
    const grid=m.grid.getBoundingClientRect();
    assert.ok(Math.abs(a[0][0]-(grid.left+grid.width/3))<1e-8);
    assert.ok(Math.abs(a[0][1]-(grid.top+grid.height/4))<1e-8);
    assert.equal(m.grid.dataset.canvasSceneManaged,'1');
  }
  check(); m.resize(300,200); check(); m.resize(800,360); check();
  assert.deepEqual(engine.getStrokes(),[guardian]); assert.deepEqual([student,guardian],before); engine.destroy();
});
test('grading pointer records the same formula reference and replays at the same location', () => {
  const m=setup(600,500); const engine=createDrawingCanvas(m.canvas,{backgroundStrokes:[student]});
  const grid=m.grid.getBoundingClientRect(); const x=grid.left+grid.width/3,y=grid.top+grid.height/4;
  m.listeners.pointerdown({clientX:x,clientY:y,pointerId:1,pointerType:'pen'});
  m.listeners.pointermove({clientX:x+10,clientY:y+10,pointerId:1,pointerType:'pen'});
  m.listeners.pointerup({clientX:x+10,clientY:y+10,pointerId:1,pointerType:'pen'});
  const recorded=engine.getStrokes()[0]; assert.equal(recorded.sceneGeometry.gridLeft,student.gridLeft);
  const reference=sceneReference([student,recorded]),fit=fitScene(reference,300,200);
  const a=mapScenePoint(student.points[0],student,reference,fit),b=mapScenePoint(recorded.points[0],recorded,reference,fit);
  assert.ok(Math.abs(a.x-b.x)<1e-8&&Math.abs(a.y-b.y)<1e-8); engine.destroy();
});
test('combined capture bounds retain margin strokes without choosing different first-point frames', () => {
  const extra={...guardian,baseWidth:800,points:[{x:780,y:30,relX:(780-100)/300,relY:(30-150)/200}]};
  const reference=sceneReference([student,extra]),fit=fitScene(reference,300,200);
  const point=mapScenePoint(extra.points[0],extra,reference,fit);
  assert.ok(point.x>=0&&point.x<=300&&point.y>=0&&point.y<=200);
});

test('legacy page density and newly captured formula styles preserve internal cell dimensions', () => {
  const css = fs.readFileSync(new URL('../public/app/css/app.css', import.meta.url), 'utf8');
  const dom = new JSDOM('<html><head></head><body><div class="math-grid-container"></div></body></html>');
  const style = dom.window.document.createElement('style');
  // Use the shipped density rules, without asking JSDOM to parse unrelated browser CSS.
  style.textContent = [...css.matchAll(/\.worksheet-grid(?:\.density-[\w]+)?\s*\{[^}]+\}/g)].map(m => m[0]).join('\n');
  dom.window.document.head.appendChild(style);
  const actualGrid = dom.window.document.querySelector('.math-grid-container');
  const nativeComputed = dom.window.getComputedStyle.bind(dom.window);
  const m = setup(600,500);
  m.grid.ownerDocument = dom.window.document;
  m.grid.style = actualGrid.style;
  dom.window.getComputedStyle = element => nativeComputed(element === m.grid ? actualGrid : element);
  const engine = createDrawingCanvas(m.canvas, { backgroundStrokes:[student], sourcePageSize:1 });
  assert.equal(actualGrid.style.getPropertyValue('--grid-cell-w'), '74px');
  assert.equal(actualGrid.style.getPropertyValue('--grid-font-size'), '58px');
  assert.equal(dom.window.document.querySelector('.worksheet-grid'), null, 'density probe is removed');
  // A stored source style takes precedence over the legacy density fallback.
  engine.setBackgroundStrokes([{...student, gridStyle:{'--grid-cell-w':'66px','--grid-font-size':'52px'}}]);
  assert.equal(actualGrid.style.getPropertyValue('--grid-cell-w'), '66px');
  assert.equal(actualGrid.style.getPropertyValue('--grid-font-size'), '52px');
  m.listeners.pointerdown({clientX:200,clientY:200,pointerId:1,pointerType:'pen'});
  m.listeners.pointermove({clientX:210,clientY:210,pointerId:1,pointerType:'pen'});
  m.listeners.pointerup({clientX:210,clientY:210,pointerId:1,pointerType:'pen'});
  assert.equal(engine.getStrokes()[0].gridStyle['--grid-cell-w'], '66px');
  assert.equal(engine.getStrokes()[0].sceneGeometry.gridStyle['--grid-font-size'], '52px');
  m.resize(300,200);
  assert.equal(actualGrid.style.getPropertyValue('--grid-cell-w'), '66px');
  engine.destroy(); dom.window.close();
});
