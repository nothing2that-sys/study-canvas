import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import 'fake-indexeddb/auto';
import { createSession, SessionState } from '../public/app/js/sessionEngine.js';
import { restoreSessionStateFromDraft } from '../public/app/js/submissionLifecycle.js';
import { saveDraftSession, getDraftSession } from '../public/app/js/storage.js';

const source = fs.readFileSync(new URL('../public/app/js/app.js', import.meta.url), 'utf8');
const restore = source.slice(source.indexOf('function restoreSessionFromDraft('), source.indexOf('//+_+// Phase F5: Draft가 없어도'));
function setup() {
  let c;
  const render = (instances) => {
    instances.set('partial', { destroy() { c.destroyed++; } });
    if (c.fail) throw new Error('second canvas failed');
  };
  c = vm.createContext({ Date, Map, Object, Number, Boolean, createSession, SessionState, restoreSessionStateFromDraft,
    currentSession: null, currentSubmission: null, currentQuestions: [], currentResultSummary: null,
    currentDraftCreatedAt: null, lastSessionConfig: null, currentFocusedProblemIndex: 0, lastActiveCanvasId: null,
    currentPenColor: '#000', currentPenWidth: 3, currentIsEraser: false, InputProfile: {},
    questionStrokesMap: new Map(), questionResponseRecordsMap: new Map(), gradingStrokesMap: new Map(), gradingResultsMap: new Map(),
    activeCanvasInstances: new Map(), gradingCanvasInstances: new Map(), gradingRenderRevision: 0,
    worksheetGrid: { replaceChildren() { c.clearedGrids++; } }, gradingGrid: { replaceChildren() { c.clearedGrids++; } },
    gradingCanvasObserver: { disconnect() { c.disconnected++; } },
    questionTimer: { stop() { c.stopped++; } }, startSessionTimer(timer, elapsed) { c.timerStarts.push(elapsed); },
    draftCoordinator: { setBaseVersion(draft) { c.base = draft; } }, getActiveLearnerId: () => 'restore-test',
    practiceView: {}, gradingView: {}, switchView() {}, updateToolDockUI() {},
    renderCurrentWorksheetPage() { render(c.activeCanvasInstances); }, renderGradingView() { render(c.gradingCanvasInstances); },
    setPracticeInteractionLocked(value) { c.locked = value; }, ROUTES: { HOME: '/home' }, navigate(route) { c.route = route; },
    alert(message) { c.message = message; }, console: { error() {} },
    fail: true, destroyed: 0, disconnected: 0, stopped: 0, clearedGrids: 0, timerStarts: []
  });
  vm.runInContext(restore, c);
  return c;
}
for (const state of [SessionState.PRACTICE_ACTIVE, SessionState.GRADING_ACTIVE]) {
  test(`${state}: partial restore failure preserves stored ink and permits immediate retry`, async () => {
    const draft = await saveDraftSession({ learnerId: 'restore-test', sessionId: `restore-${state}`, config: {}, sessionState: state,
      questions: [{ id: 'q:1', operation: 'add', operandA: 1, operandB: 2, answer: 3 }],
      studentStrokesMap: { 'q:1': [{ points: [{ x: 12, y: 34 }] }] },
      gradingStrokesMap: { 'q:1': [{ points: [{ x: 56, y: 78 }] }] }, gradingResults: {}, totalElapsedMs: 789, revision: 3 });
    const before = await getDraftSession({ learnerId: 'restore-test' });
    const c = setup();
    assert.equal(c.restoreSessionFromDraft(draft), false);
    assert.equal(c.currentSession, null);
    assert.equal(c.currentSubmission, null);
    assert.equal(c.currentQuestions.length, 0);
    assert.equal(c.activeCanvasInstances.size + c.gradingCanvasInstances.size, 0);
    assert.equal(c.destroyed, 1);
    assert.equal(c.clearedGrids, 2);
    assert.equal(c.disconnected, 1);
    assert.equal(c.base, null);
    assert.equal(c.locked, true);
    assert.equal(c.route, '/home');
    assert.equal(c.timerStarts.length, 0);
    assert.ok(c.stopped > 0);
    for (const name of ['questionStrokesMap', 'questionResponseRecordsMap', 'gradingStrokesMap', 'gradingResultsMap']) assert.equal(c[name].size, 0);
    assert.deepEqual(await getDraftSession({ learnerId: 'restore-test' }), before);
    c.fail = false;
    assert.equal(c.restoreSessionFromDraft(before), true);
    assert.equal(c.currentSession.id, before.sessionId);
    assert.deepEqual(c.questionStrokesMap.get('q:1'), before.studentStrokesMap['q:1']);
    assert.deepEqual(c.gradingStrokesMap.get('q:1'), before.gradingStrokesMap['q:1']);
    assert.equal(c.currentSession.state, state);
    assert.equal(c.timerStarts.length, state === SessionState.PRACTICE_ACTIVE ? 1 : 0);
    assert.deepEqual(await getDraftSession({ learnerId: 'restore-test' }), before);
  });
}
