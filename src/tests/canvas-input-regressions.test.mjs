import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrawingCanvas, InputProfile } from '../public/app/js/canvasEngine.js';

function harness(profile=InputProfile.DESKTOP_MOUSE_PEN) {
  const listeners=new Map(), captures=new Set();
  const context={setTransform(){},clearRect(){},save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},stroke(){},arc(){},fill(){}};
  const canvas={width:300,height:200,style:{},getBoundingClientRect:()=>({left:0,top:0,width:300,height:200}),
    getContext:()=>context,
    addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type),
    setPointerCapture:id=>captures.add(id),releasePointerCapture:id=>captures.delete(id),hasPointerCapture:id=>captures.has(id)};
  const engine=createDrawingCanvas(canvas,{profile});
  const send=(type,x,y,extra={})=>listeners.get(type)({pointerId:1,pointerType:'mouse',button:0,clientX:x,clientY:y,...extra});
  const draw=()=>{send('pointerdown',20,50);send('pointerup',280,50);};
  return {canvas,engine,send,draw,captures,context};
}

test('Mouse eraser hits the middle of a fast two-point stroke and one undo restores it',()=>{
  const h=harness();try {
    h.draw();const before=h.engine.getStrokes();h.engine.setEraser(true);
    h.send('pointerdown',150,50);h.send('pointerup',150,50);
    assert.equal(h.engine.getStrokes().length,0);
    assert.equal(h.engine.undo(),true);assert.deepEqual(h.engine.getStrokes(),before);
    assert.equal(h.engine.redo(),true);assert.equal(h.engine.getStrokes().length,0);
  }finally{h.engine.destroy();}
});
test('An eraser miss adds no undo step and preserves redo history',()=>{
  const h=harness();try {
    h.draw();h.engine.setEraser(true);h.send('pointerdown',150,180);h.send('pointerup',150,180);
    assert.equal(h.engine.undo(),true);assert.equal(h.engine.getStrokes().length,0,'undo must remove the last actual writing');
    h.send('pointerdown',150,180);h.send('pointerup',150,180);
    assert.equal(h.engine.redo(),true,'a no-op eraser must not clear redo');assert.equal(h.engine.getStrokes().length,1);
  }finally{h.engine.destroy();}
});
test('Fast swept eraser crosses ink between delivered pointer samples',()=>{
  const h=harness();try {
    h.draw();h.engine.setEraser(true);h.send('pointerdown',150,10);h.send('pointerup',150,100);
    assert.equal(h.engine.getStrokes().length,0);
    assert.equal(h.engine.undo(),true);assert.equal(h.engine.getStrokes().length,1);
    assert.equal(h.engine.undo(),true);assert.equal(h.engine.getStrokes().length,0);
  }finally{h.engine.destroy();}
});
test('Old lost capture after same-ID pen recapture cannot terminate the next whole stroke',()=>{
  const h=harness(InputProfile.IPAD_PEN_ONLY);try {
    for(let i=0;i<3;i++) {
      const pen={pointerType:'pen',timeStamp:100+i*10};
      h.send('pointerdown',20,20+i*30,pen);
      if(i)h.send('lostpointercapture',0,0,{pointerType:'pen',timeStamp:100+i*10+1});
      h.send('pointermove',80,20+i*30,{...pen,timeStamp:pen.timeStamp+2});
      h.send('pointerup',120,20+i*30,{...pen,timeStamp:pen.timeStamp+3});
    }
    const s=h.engine.getStrokes();assert.equal(s.length,3);
    assert.deepEqual(s.map(x=>x.points.map(p=>[p.x,p.y])),[
      [[20,20],[80,20],[120,20]],[[20,50],[80,50],[120,50]],[[20,80],[80,80],[120,80]]]);
  }finally{h.engine.destroy();}
});
test('Timestamped old terminal events for a reused pen ID cannot close a newer contact',()=>{
  const h=harness(InputProfile.IPAD_PEN_ONLY);try {
    h.send('pointerdown',10,10,{pointerType:'pen',timeStamp:10});
    h.send('pointerup',30,10,{pointerType:'pen',timeStamp:20});
    h.send('pointerdown',10,40,{pointerType:'pen',timeStamp:30});
    for(const type of ['pointerup','pointercancel'])h.send(type,30,10,{pointerType:'pen',timeStamp:20});
    h.send('pointermove',50,40,{pointerType:'pen',timeStamp:40});
    h.send('pointerup',80,40,{pointerType:'pen',timeStamp:50});
    assert.deepEqual(h.engine.getStrokes()[1].points.map(p=>[p.x,p.y]),[[10,40],[50,40],[80,40]]);
  }finally{h.engine.destroy();}
});

test('Real capture loss commits delivered pen points without origin and retains palm cooldown',()=>{
  const h=harness(InputProfile.IPAD_PEN_TOUCH);try {
    h.send('pointerdown',70,80,{pointerType:'pen'});
    h.send('pointermove',100,80,{pointerType:'pen'});
    h.captures.delete(1);
    h.send('lostpointercapture',0,0,{pointerType:'pen'});
    h.send('pointerdown',10,10,{pointerType:'touch',pointerId:2});
    h.send('pointerup',50,10,{pointerType:'touch',pointerId:2});
    assert.deepEqual(h.engine.getStrokes().map(s=>s.points.map(p=>[p.x,p.y])),[[[70,80],[100,80]]]);
    h.send('pointerdown',70,110,{pointerType:'pen'});h.send('pointerup',100,110,{pointerType:'pen'});
    assert.equal(h.engine.getStrokes().length,2,'next pen remains accepted immediately');
  }finally{h.engine.destroy();}
});

test('Restored smoothed curve erases at visible quadratic ink and undo preserves the saved original',()=>{
  const h=harness();try {
    const original=[{id:'saved-curve',baseWidth:300,baseHeight:200,width:3,color:'#123456',
      points:[{x:20,y:100},{x:150,y:0},{x:280,y:100}]}];
    h.engine.setStrokes(original);h.engine.setEraser(true);
    // At t=.5 of quadratic (20,100) -> control (150,0) -> midpoint (215,50).
    h.send('pointerdown',133.75,37.5);h.send('pointerup',133.75,37.5);
    assert.equal(h.engine.getStrokes().length,0);
    assert.equal(h.engine.undo(),true);assert.deepEqual(h.engine.getStrokes(),original);
  }finally{h.engine.destroy();}
});

test('Commit replaces incremental provisional lines with the same canonical curve used by reload and eraser',()=>{
  const oldRAF=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame;
  let callback,id=0;globalThis.requestAnimationFrame=fn=>{callback=fn;return ++id;};globalThis.cancelAnimationFrame=()=>{callback=null;};
  const h=harness();const operations=[];
  h.context.clearRect=()=>operations.push(['clear']);h.context.lineTo=(x,y)=>operations.push(['line',x,y]);
  h.context.quadraticCurveTo=(...p)=>operations.push(['curve',...p]);
  const frame=()=>{const fn=callback;callback=null;fn?.();};
  try {
    h.send('pointerdown',20,100);frame();h.send('pointermove',150,0);frame();
    assert.ok(operations.some(op=>op[0]==='line'&&op[1]===150&&op[2]===0),'provisional line was actually drawn');
    h.send('pointermove',280,100);h.send('pointerup',280,100);
    const final=operations.slice(operations.findLastIndex(op=>op[0]==='clear'));
    assert.equal(final.some(op=>op[0]==='line'&&op[1]===150&&op[2]===0),false,'provisional ink must not remain after commit');
    assert.ok(final.some(op=>op[0]==='curve'&&op[1]===150&&op[2]===0));
  }finally{h.engine.destroy();if(oldRAF===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=oldRAF;
    if(oldCancel===undefined)delete globalThis.cancelAnimationFrame;else globalThis.cancelAnimationFrame=oldCancel;}
});

test('A missing Pencil down recovers from confirmed contact moves and remains undoable',()=>{
  const h=harness(InputProfile.IPAD_PEN_ONLY);try {
    const pen={pointerType:'pen',buttons:1,pressure:0.4,timeStamp:100};
    h.send('pointermove',30,40,pen);
    h.send('pointermove',70,40,{...pen,timeStamp:110});
    h.send('pointerup',110,40,{...pen,buttons:0,pressure:0,timeStamp:120});
    assert.deepEqual(h.engine.getStrokes().map(s=>s.points.map(p=>[p.x,p.y])),[[[30,40],[70,40],[110,40]]]);
    assert.equal(h.engine.getInputDiagnostics().recoveredStarts,1);
    assert.equal(h.engine.undo(),true);assert.equal(h.engine.getStrokes().length,0);
    assert.equal(h.engine.redo(),true);assert.equal(h.engine.getStrokes().length,1);
  }finally{h.engine.destroy();}
});

test('Hover, palm, mouse, secondary pen button and eraser cannot recover missing starts',()=>{
  for(const event of [
    {pointerType:'pen',buttons:0,pressure:0}, {pointerType:'pen',buttons:1,pressure:0},
    {pointerType:'pen',buttons:0,pressure:0.5}, {pointerType:'pen',buttons:2,pressure:0.5},
    {pointerType:'touch',buttons:1,pressure:0.5}, {pointerType:'mouse',buttons:1,pressure:0.5}
  ]) {
    const h=harness(InputProfile.IPAD_PEN_TOUCH);try {
      h.send('pointermove',30,40,event);h.send('pointerup',70,40,event);
      assert.equal(h.engine.getStrokes().length,0);
    }finally{h.engine.destroy();}
  }
  const h=harness(InputProfile.IPAD_PEN_ONLY);try {
    h.draw();const original=h.engine.getStrokes();h.engine.setEraser(true);
    h.send('pointermove',150,50,{pointerType:'pen',buttons:1,pressure:0.5});
    assert.deepEqual(h.engine.getStrokes(),original);
  }finally{h.engine.destroy();}
});

test('Explicit cancel and up block stale pen contact moves until a genuine new down',()=>{
  for(const terminal of ['pointercancel','pointerup']) {
    const h=harness(InputProfile.IPAD_PEN_ONLY);try {
      const pen={pointerType:'pen',buttons:1,pressure:0.5};
      h.send('pointerdown',30,40,pen);h.send(terminal,50,40,{...pen,buttons:0,pressure:0});
      h.send('pointermove',70,40,pen);h.send('pointermove',90,40,pen);
      assert.equal(h.engine.getInputDiagnostics().recoveredStarts,0);
      h.send('pointerdown',30,80,pen);h.send('pointerup',70,80,{...pen,buttons:0,pressure:0});
      assert.equal(h.engine.getStrokes().length,2);
    }finally{h.engine.destroy();}
  }
});

test('Real Pencil capture loss allows a new recovered segment while retaining delivered ink',()=>{
  const h=harness(InputProfile.IPAD_PEN_ONLY);try {
    const pen={pointerType:'pen',buttons:1,pressure:0.5};
    h.send('pointerdown',30,40,pen);h.send('pointermove',50,40,pen);
    h.captures.delete(1);h.send('lostpointercapture',0,0,pen);
    h.send('pointermove',70,40,pen);h.send('pointerup',110,40,{...pen,buttons:0,pressure:0});
    assert.deepEqual(h.engine.getStrokes().map(s=>s.points.map(p=>[p.x,p.y])),[[[30,40],[50,40]],[[70,40],[110,40]]]);
    assert.equal(h.engine.getInputDiagnostics().recoveredStarts,1);
  }finally{h.engine.destroy();}
});

test('Cancelled contact needs a full no-contact signal; stale hover cannot unlock recovery',()=>{
  const h=harness(InputProfile.IPAD_PEN_ONLY);try {
    const pen={pointerType:'pen',buttons:1,pressure:0.5};
    h.send('pointercancel',20,40,{...pen,timeStamp:100});
    h.send('pointermove',30,40,{...pen,pressure:0,timeStamp:110});
    h.send('pointermove',40,40,{...pen,timeStamp:120});
    h.send('pointermove',40,40,{...pen,buttons:0,pressure:0,timeStamp:90});
    h.send('pointermove',50,40,{...pen,timeStamp:130});
    assert.equal(h.engine.getInputDiagnostics().recoveredStarts,0);
    h.send('pointermove',50,40,{...pen,buttons:0,pressure:0,timeStamp:140});
    h.send('pointermove',60,40,{...pen,timeStamp:150});
    h.send('pointerup',80,40,{...pen,buttons:0,pressure:0,timeStamp:160});
    assert.equal(h.engine.getInputDiagnostics().recoveredStarts,1);
    assert.equal(h.engine.getStrokes().length,1);
  }finally{h.engine.destroy();}
});

test('Recovery rejects off-canvas, hidden, read-only and destroyed surfaces',()=>{
  const oldDocument=globalThis.document;
  globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};
  const h=harness(InputProfile.IPAD_PEN_ONLY);try {
    const pen={pointerType:'pen',buttons:1,pressure:0.5};
    for(const [x,y] of [[-1,30],[301,30],[20,201],[NaN,30]])h.send('pointermove',x,y,pen);
    document.hidden=true;h.send('pointermove',30,30,pen);document.hidden=false;
    h.engine.setReadOnly(true);h.send('pointermove',30,30,pen);
    assert.equal(h.engine.getInputDiagnostics().recoveredStarts,0);
    h.engine.destroy();assert.equal(h.engine.getStrokes().length,0);
  }finally{h.engine.destroy();globalThis.document=oldDocument;}
});

test('Blur suspends recovery until a genuine new down; palm cancel does not block Pencil recovery',()=>{
  const oldWindow=globalThis.window;const handlers=new Map();
  globalThis.window={addEventListener:(type,fn)=>handlers.set(type,fn),removeEventListener:type=>handlers.delete(type)};
  const h=harness(InputProfile.IPAD_PEN_ONLY);try {
    const pen={pointerType:'pen',buttons:1,pressure:0.5};
    h.send('pointercancel',30,40,{pointerType:'touch',pointerId:2});
    h.send('pointermove',30,40,pen);h.send('pointerup',50,40,{...pen,buttons:0,pressure:0});
    assert.equal(h.engine.getInputDiagnostics().recoveredStarts,1);
    handlers.get('blur')();
    h.send('pointerdown',50,50,{pointerType:'touch',pointerId:2,buttons:1,pressure:0.5});
    h.send('pointermove',50,50,{...pen,buttons:0,pressure:0});h.send('pointermove',70,50,pen);
    assert.equal(h.engine.getInputDiagnostics().recoveredStarts,1);
    h.send('pointerdown',30,80,pen);h.send('pointerup',70,80,{...pen,buttons:0,pressure:0});
    assert.equal(h.engine.getStrokes().length,2);
    const diagnostics=h.engine.getInputDiagnostics();diagnostics.recoveredStarts=999;
    assert.equal(h.engine.getInputDiagnostics().recoveredStarts,1);
  }finally{h.engine.destroy();globalThis.window=oldWindow;}
});
