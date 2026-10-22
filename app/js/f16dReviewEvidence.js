import { generateQuestionSet } from './mathGen.js';

// Review fixtures use the legacy generator and lifecycle, never coverage/exposure counts.
export function createExactMultiplicationReviewFixture(learnerId) {
  if (typeof learnerId !== 'string' || !learnerId.trim()) throw new Error('학습자를 먼저 선택하세요.');
  const config = { learnerId, operation: 'mul', difficulty: 'custom', aDigits: 2, bDigits: 1,
    multiplierMode: 'fixed', fixedMultiplier: 4, count: 1, problemCount: 1,
    pageSize: 1, cols: 1, rows: 1, mathFormat: 'vertical', subjectId: 'math',
    courseId: 'arithmetic', stageId: 'M2', macroLevelId: 'M2',
    reviewFixture: { id: 'f16d-exact-12x4', coverageContribution: 0 } };
  const questions = generateQuestionSet({ ...config, random: () => 2.5 / 90 });
  if (questions.length !== 1 || questions[0].operandA !== 12 || questions[0].operandB !== 4 || questions[0].answer !== 48) {
    throw new Error('12×4 검증 문항 생성 계약이 달라졌습니다.');
  }
  return { config, questions: questions.map(q => ({ ...q, expectedAnswer: q.answer, questionKey: q.key })) };
}

export function createExactArithmeticReviewFixture(learnerId) {
  if (typeof learnerId !== 'string' || !learnerId.trim()) throw new Error('학습자를 먼저 선택하세요.');
  const questions = [['mul', 50, 2, 'horizontal', 'M2'], ['div', 96, 4, 'vertical', 'D2']].map(([operation, operandA, operandB, mathFormat, stageId]) => ({
    id: `qa-exact-${globalThis.crypto.randomUUID()}`, operation, operandA, operandB, mathFormat, stageId,
    key: `${operation}:${operandA}:${operandB}`, questionKey: `${operation}:${operandA}:${operandB}`,
    answer: operation === 'mul' ? operandA * operandB : operandA / operandB,
    expectedAnswer: operation === 'mul' ? operandA * operandB : operandA / operandB,
    subjectId: 'math', courseId: 'arithmetic', responseType: 'CANVAS'
  }));
  return { questions, config: { learnerId, subjectId: 'math', courseId: 'arithmetic', operation: 'mul',
    count: 2, problemCount: 2, pageSize: 2, cols: 2, rows: 1, mathFormat: 'vertical',
    reviewFixture: { id: 'f16d-exact-mixed-50x2-96div4', coverageContribution: 0 } } };
}

const STORES = ['sessions', 'attempts', 'submissions', 'reviewItems', 'draftSessions', 'strokes', 'workbookAssignments',
  'mistakes', 'stageProgress', 'progressAggregates', 'vocabularyMemoryStates'];
function duplicateGroups(rows, keyOf) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (key === null) continue;
    const ids = groups.get(key) || []; ids.push(row.id); groups.set(key, ids);
  }
  return [...groups].filter(([, ids]) => ids.length > 1).map(([key, ids]) => ({ key, ids, excess: ids.length - 1 }));
}
export function summarizeReviewEvidence(records) {
  const { attempts = [], submissions = [], sessions = [], reviewItems = [], workbookAssignments = [] } = records;
  const attemptSessionQuestionGroups = duplicateGroups(attempts, r => r.sessionId && r.questionId ? JSON.stringify([r.sessionId, r.questionId]) : null);
  const submissionSessionGroups = duplicateGroups(submissions, r => r.sessionId || null);
  const fixtureSessions = sessions.filter(r => r.config?.reviewFixture?.id === 'f16d-exact-12x4');
  const fixtureIds = new Set(fixtureSessions.map(r => r.sessionId || r.id));
  const fixtureAttempts = attempts.filter(r => fixtureIds.has(r.sessionId));
  const fixtureSubmissions = submissions.filter(r => fixtureIds.has(r.sessionId));
  return {
    counts: Object.fromEntries(STORES.map(name => [name, (records[name] || []).length])),
    attemptSessionQuestionGroups,
    attemptSessionQuestionExcess: attemptSessionQuestionGroups.reduce((sum, g) => sum + g.excess, 0),
    submissionSessionGroups,
    submissionSessionExcess: submissionSessionGroups.reduce((sum, g) => sum + g.excess, 0),
    exactFixture: { scope: 'Finalized 12x4 fixture sessions; other practice sessions excluded',
      sessionIds: [...fixtureIds], attemptIds: fixtureAttempts.map(r => r.id), submissionIds: fixtureSubmissions.map(r => r.id),
      counts: { sessions: fixtureSessions.length, attempts: fixtureAttempts.length, submissions: fixtureSubmissions.length } },
    missingAttemptIdentity: attempts.filter(r => !r.id || !r.sessionId || !r.questionId).map(r => r.id ?? null),
    retryLinks: reviewItems.map(r => ({ reviewItemId: r.id, sourceSessionId: r.sourceSessionId,
      sourceAttemptId: r.sourceAttemptId, retries: (r.retryAttemptIds || []).map(id => {
        const attempt = attempts.find(a => a.id === id);
        return { attemptId: id, present: !!attempt, sessionId: attempt?.sessionId,
          sessionPresent: !!attempt && sessions.some(s => (s.sessionId || s.id) === attempt.sessionId),
          submissionIds: attempt ? submissions.filter(s => s.sessionId === attempt.sessionId).map(s => s.id) : [] };
      }) })),
    bookmarks: workbookAssignments.map(r => ({ assignmentId: r.assignmentId, workbookId: r.workbookId,
      lastPageId: r.lastPageId, bookmarkPageId: r.bookmarkPageId })),
    rawMistakeLinks: (records.mistakes || []).map(m => ({ key: m.key, questionId: m.questionId,
      questionKey: m.questionKey, sourceSessionId: m.sourceSessionId ?? null, mathFormat: m.mathFormat ?? null,
      matchingSourceSessionIds: sessions.filter(s => (!m.sourceSessionId || (s.sessionId || s.id) === m.sourceSessionId) &&
        (s.results || []).some(q => (q.questionId || q.id) === m.questionId &&
          (q.questionKey || q.key) === (m.questionKey || m.key))).map(s => s.sessionId || s.id) })),
    interpretation: 'Distinct Retry sessions may share questionId. Groups require record inspection before declaring duplicates. An active Retry can have no finalized session/submission.'
  };
}

export function showReviewEvidence(documentRef, container, evidence) {
  container.replaceChildren();
  const summary = documentRef.createElement('pre');
  summary.textContent = JSON.stringify({ capturedAt: evidence.capturedAt, learnerId: evidence.learnerId,
    buildId: evidence.buildId, evidenceKind: evidence.evidenceKind, summary: evidence.summary }, null, 2);
  const label = documentRef.createElement('label'); label.textContent = '전체 저장 JSON (읽기 전용, 선택하여 복사 가능)';
  const text = documentRef.createElement('textarea'); text.id = 'mathF16dEvidenceJson';
  text.readOnly = true; text.rows = 12; text.style.width = '100%'; text.value = JSON.stringify(evidence, null, 2);
  label.htmlFor = text.id; container.append(summary, label, text);
}

// One readonly transaction provides a consistent snapshot. No clearing, injection or writes.
export async function collectReviewEvidence(db, learnerId, buildId) {
  if (typeof learnerId !== 'string' || !learnerId.trim()) throw new Error('Explicit learner identity required');
  if (!db || db.isMemory) throw new Error('실제 IndexedDB 연결이 필요합니다.');
  const stores = STORES.filter(name => db.objectStoreNames.contains(name));
  const all = await new Promise((resolve, reject) => {
    const tx = db.transaction(stores, 'readonly'); const records = {};
    for (const name of stores) {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => { records[name] = request.result; };
    }
    tx.oncomplete = () => resolve(records);
    tx.onabort = tx.onerror = () => reject(tx.error || new Error('Evidence snapshot failed'));
  });
  const ownSessionIds = new Set((all.sessions || []).filter(r => r.learnerId === learnerId).map(r => r.sessionId || r.id));
  const records = Object.fromEntries(STORES.map(name => [name, (all[name] || []).filter(r =>
    r.learnerId === learnerId || (name === 'strokes' && !r.learnerId && ownSessionIds.has(r.sessionId)))]));
  return { schemaVersion: 2, evidenceKind: 'BROWSER_INDEXEDDB_READONLY', learnerId, buildId,
    capturedAt: new Date().toISOString(), scope: 'Selected learner; existing primary learning DB only. Math exposure DB and other learners excluded.',
    records, summary: summarizeReviewEvidence(records) };
}

