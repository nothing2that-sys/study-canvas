import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as adaptive from '../public/app/js/adaptiveEngine.js';

const wrong = (stageId, operation, operandA, operandB, extra = {}) => ({
  id: `wrong-${stageId}`, key: `${operation}:${operandA}:${operandB}`,
  stageId, operation, operandA, operandB, isCorrect: false, ...extra
});
const mul = wrong('M2', 'mul', 13, 2);
const div = wrong('D2', 'div', 32, 8);
const decimal = wrong('MATH_F16D_DECIMAL_WRITE', 'general', undefined, undefined,
  {subjectId:'math', courseId:'decimal', responseType:'TEXT'});

test('observed M2 and D2 records generate valid same-operation adaptive sessions', () => {
  for (const record of [mul, div]) {
    const before = structuredClone(record);
    const result = adaptive.composeAdaptiveSession({currentStageId:record.stageId, attempts:[record], mistakes:[record]});
    assert.equal(result.questions.length, 10);
    assert.ok(result.questions.every(q => q.operation === record.operation));
    assert.ok(result.questions.every(q => Number.isFinite(q.answer)));
    assert.deepEqual(record, before);
  }
});

test('typed and unknown records cannot become arithmetic weaknesses or variants', () => {
  const attempts = [decimal, {...decimal, stageId:'M2', operation:'mul', operandA:13, operandB:2},
    wrong('unknown', 'div', 32, 8), mul, div];
  const before = structuredClone(attempts);
  const analysis = adaptive.analyzeAdaptiveWeaknesses(attempts, attempts);
  assert.equal(analysis.weaknesses.length, 2);
  assert.ok(analysis.weaknesses.every(w => /^[MD]\d-\d$/.test(w.stageId)));
  const result = adaptive.composeAdaptiveSession({currentStageId:'D2-2', attempts, mistakes:attempts});
  assert.ok(result.questions.every(q => q.operation === 'div' && Number.isFinite(q.answer)));
  assert.throws(() => adaptive.generateSimilarQuestion(decimal));
  assert.deepEqual(attempts, before);
});

test('division review stays within division at the first division stage', () => {
  const result = adaptive.composeAdaptiveSession({currentStageId:'D1-1'});
  assert.ok(result.questions.every(q => q.operation === 'div'));
});

test('real recommendation card and start handler share eligible stage selection', async () => {
  const source = fs.readFileSync(new URL('../public/app/js/app.js', import.meta.url), 'utf8');
  const start = source.indexOf('async function renderAdaptiveRecommendCard()');
  const code = source.slice(start, source.indexOf('function restoreSessionFromDraft', start));
  for (const attempts of [[mul], [div], [decimal], [decimal, div]]) {
    const warnings = [], started = [];
    const label = {textContent:'추천 학습 시작하기'};
    const button = {disabled:false, querySelector:()=>label, setAttribute(){}, removeAttribute(){}};
    const title = {}, reason = {}, tags = {};
    const elements = {adaptiveCardTitle:title, adaptiveReasonText:reason, adaptiveTags:tags, startAdaptiveSessionBtn:button};
    const context = vm.createContext({
      ...adaptive, analyzeWeaknesses:()=>{throw Error('unfiltered analyzer reached');},
      document:{querySelector:selector=>elements[selector.slice(1)]},
      getRecentAttempts:async()=>structuredClone(attempts), getMistakes:async()=>structuredClone(attempts),
      startSessionWithQuestions:async(questions,config)=>started.push({questions,config}),
      console:{warn:(...args)=>warnings.push(args), error:(...args)=>warnings.push(args)},
      alert:message=>warnings.push(message)
    });
    vm.runInContext(code, context);
    await context.renderAdaptiveRecommendCard();
    await button.onclick();
    assert.equal(warnings.length,0,JSON.stringify(warnings));
    assert.equal(started.length,1);
    const operation = attempts.some(a=>a===div) ? 'div' : 'mul';
    assert.ok(started[0].questions.every(q=>q.operation===operation));
    assert.ok(reason.textContent.length>0);
    assert.match(title.textContent, operation==='div' ? /나눗셈|자리.*÷/ : /곱셈|자리.*×/);
  }
});
