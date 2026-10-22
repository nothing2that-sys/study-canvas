// Same independent regression assertions, executed against the frozen release modules.
import test from "node:test";
import assert from "node:assert/strict";
import {
  digitBounds,
  fisherYates,
  generateDivisionSet,
  generateMultiplicationSet,
  questionKey
} from "../app/js/mathGen.js";

test("자릿수 범위가 기본 정책을 따른다", () => {
  assert.deepEqual(digitBounds(1), { min: 2, max: 9 });
  assert.deepEqual(digitBounds(2), { min: 10, max: 99 });
  assert.deepEqual(digitBounds(3), { min: 100, max: 999 });
});

test("Fisher Yates 셔플이 원소를 보존한다", () => {
  const source = [1, 2, 3, 4, 5];
  const shuffled = fisherYates(source, () => 0.25);
  assert.deepEqual([...shuffled].sort(), source);
  assert.notStrictEqual(shuffled, source);
});

test("곱셈 1000문제가 조건과 정답을 만족한다", () => {
  const questions = [];
  for (let index = 0; index < 20; index += 1) {
    questions.push(...generateMultiplicationSet({ count: 50, difficulty: "hard" }));
  }
  assert.equal(questions.length, 1000);
  for (const question of questions) {
    assert.equal(question.answer, question.operandA * question.operandB);
    assert.equal(question.level, "M9");
    assert.equal(question.key, questionKey("mul", question.operandA, question.operandB));
  }
});

test("곱셈 세션 안에 중복이 없다", () => {
  const questions = generateMultiplicationSet({ count: 50, difficulty: "normal" });
  assert.equal(new Set(questions.map((question) => question.key)).size, questions.length);
});

test("고정 숫자와 배수 모드가 조건을 만족한다", () => {
  const fixed = generateMultiplicationSet({ count: 30, difficulty: "normal", multiplierMode: "fixed", fixedMultiplier: 7 });
  const multiples = generateMultiplicationSet({ count: 30, difficulty: "normal", multiplierMode: "multiple", multipleBase: 5 });
  assert.ok(fixed.every((question) => question.operandB === 7));
  assert.ok(multiples.every((question) => question.operandB % 5 === 0));
});

test("나눗셈 1000문제가 나머지 없이 조건을 만족한다", () => {
  const questions = [];
  for (let index = 0; index < 20; index += 1) {
    questions.push(...generateDivisionSet({ count: 50, difficulty: "normal" }));
  }
  assert.equal(questions.length, 1000);
  for (const question of questions) {
    assert.equal(question.operandA % question.operandB, 0);
    assert.equal(question.answer, question.operandA / question.operandB);
    assert.ok(question.operandA <= 999);
    assert.ok(question.answer >= 2);
  }
});

test("나눗셈 세션 안에 중복이 없고 끝자리 0 비율이 제한된다", () => {
  const questions = generateDivisionSet({ count: 50, difficulty: "hard" });
  const trailingZeroCount = questions.filter((question) => question.features.trailingZero).length;
  assert.equal(new Set(questions.map((question) => question.key)).size, questions.length);
  assert.ok(trailingZeroCount <= 10);
});
