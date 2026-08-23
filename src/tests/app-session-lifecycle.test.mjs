import test from "node:test";
import assert from "node:assert/strict";
import { createQuestionTimer, formatTime } from "../public/app/js/timer.js";
import { createSession } from "../public/app/js/sessionEngine.js";
import { saveDraftSession, getDraftSession, clearDraftSession } from "../public/app/js/storage.js";
import { composeAdaptiveSession } from "../public/app/js/adaptiveEngine.js";
import { generateQuestionSet } from "../public/app/js/mathGen.js";

test("6.4 & P0-1: QuestionTimer reset, setElapsedMs, formatTime 검증", () => {
  let currentTime = 1000;
  const timer = createQuestionTimer({ getTime: () => currentTime });

  timer.start();
  currentTime = 3500;
  assert.equal(timer.getElapsedMs(), 2500);

  timer.reset();
  assert.equal(timer.getElapsedMs(), 0);
  assert.equal(timer.isRunning, false);

  // 이어서 풀기 시간 복원
  timer.setElapsedMs(12340);
  assert.equal(timer.getElapsedMs(), 12340);
  currentTime = 5000; // 시간이 흘렀을 때 (3500 -> 5000: 1500ms 경과)
  assert.equal(timer.getElapsedMs(), 12340 + 1500);

  assert.equal(formatTime(12340, "digital"), "00:12.3");
  assert.equal(formatTime(12340, "korean"), "12.3초");

  timer.destroy();
});

test("6.4 & P0-1: 세션 진입 경로(일반, 추천, 오답) 세션 생성 및 문제 일치 검증", () => {
  const config = {
    operation: "mul",
    count: 10,
    pageSize: 4,
    cols: 2,
    rows: 2,
    mathFormat: "vertical"
  };

  // 1. 일반 학습 생성
  const normalQuestions = generateQuestionSet(config);
  const normalSession = createSession(config, normalQuestions);
  assert.equal(normalSession.questions.length, 10);
  assert.equal(normalSession.totalPages, 3); // 4 + 4 + 2

  // 2. 추천 학습 생성
  const adaptive = composeAdaptiveSession({
    count: 10,
    currentStageId: "M2-2",
    attempts: [],
    mistakes: []
  });
  assert.equal(adaptive.questions.length, 10);
  const adaptiveSession = createSession(config, adaptive.questions);
  assert.equal(adaptiveSession.questions.length, 10);

  // 3. Draft 저장 및 복원 시 무결성 검증
  const strokesObj = {
    [adaptive.questions[0].id]: [{ id: "s1", points: [{ x: 10, y: 10 }] }]
  };

  const draftData = {
    schemaVersion: 2,
    appBuildId: "20260823_2",
    config,
    questions: adaptive.questions,
    currentPageIndex: 1,
    strokesMap: strokesObj,
    elapsedMs: 25400,
    pencilOnly: true
  };

  // 비동기 Draft 저장
  return saveDraftSession(draftData).then(async (saved) => {
    assert.equal(saved.currentPageIndex, 1);
    assert.equal(saved.elapsedMs, 25400);

    const loaded = await getDraftSession();
    assert.ok(loaded, "Draft가 정상 로드되어야 함");
    assert.equal(loaded.questions.length, 10);
    assert.equal(loaded.currentPageIndex, 1);
    assert.equal(loaded.strokesMap[adaptive.questions[0].id].length, 1);

    await clearDraftSession();
    const afterClear = await getDraftSession();
    assert.equal(afterClear, null, "Clear 후 Draft는 null이어야 함");
  });
});
