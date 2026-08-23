import test from "node:test";
import assert from "node:assert/strict";
import { createQuestionTimer, formatTime } from "../public/app/js/timer.js";
import { createSession } from "../public/app/js/sessionEngine.js";
import { saveDraftSession, getDraftSession, clearDraftSession } from "../public/app/js/storage.js";
import { composeAdaptiveSession } from "../public/app/js/adaptiveEngine.js";
import { generateQuestionSet } from "../public/app/js/mathGen.js";
import { InputProfile } from "../public/app/js/canvasEngine.js";

test("R2-P0-01: QuestionTimer start(initialElapsedMs) 단일 계약 및 복원 시간 흐름 검증", () => {
  let currentTime = 1000;
  const timer = createQuestionTimer({ getTime: () => currentTime });

  // 1. 새 세션 시작: start(0)
  timer.start(0);
  currentTime = 3500;
  assert.equal(timer.getElapsedMs(), 2500);

  // 2. 완전 정지 및 초기화: reset()
  timer.reset();
  assert.equal(timer.getElapsedMs(), 0);
  assert.equal(timer.isRunning, false);

  // 3. 이어풀기 시작: start(12340) -> 즉시 12340부터 정밀하게 시작
  currentTime = 5000;
  timer.start(12340);
  assert.equal(timer.getElapsedMs(), 12340);

  // 4. 시간 경과 (5000 -> 6500: 1500ms 경과)
  currentTime = 6500;
  assert.equal(timer.getElapsedMs(), 12340 + 1500);

  // 5. 중복 start 호출 시 상태 오염 없이 안전
  timer.start(12340 + 1500);
  assert.equal(timer.getElapsedMs(), 13840);

  // 6. 음수 및 NaN 정규화 (0으로 처리)
  timer.start(-500);
  assert.equal(timer.getElapsedMs(), 0);

  assert.equal(formatTime(12340, "digital"), "00:12.3");
  assert.equal(formatTime(12340, "korean"), "12.3초");

  timer.destroy();
});

test("R2-P0-02 & R2-P0-05: 세션 생성, Draft 저장 및 inputProfile 복원 무결성 검증", async () => {
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
  assert.equal(normalSession.totalPages, 3);

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

  // 3. Draft 저장 및 복원 시 inputProfile, elapsedMs, strokes 무결성 검증
  const strokesObj = {
    [adaptive.questions[0].id]: [{ id: "s1", points: [{ x: 10, y: 10, relX: 0.1, relY: 0.1 }] }]
  };

  const draftData = {
    schemaVersion: 2,
    appBuildId: "20260823_3",
    revision: 1,
    config,
    questions: adaptive.questions,
    currentPageIndex: 1,
    strokesMap: strokesObj,
    elapsedMs: 25400,
    inputProfile: InputProfile.IPAD_PEN_ONLY,
    updatedAt: Date.now()
  };

  const saved = await saveDraftSession(draftData);
  assert.equal(saved.currentPageIndex, 1);
  assert.equal(saved.elapsedMs, 25400);

  const loaded = await getDraftSession();
  assert.ok(loaded, "Draft가 정상 로드되어야 함");
  assert.equal(loaded.questions.length, 10);
  assert.equal(loaded.currentPageIndex, 1);
  assert.equal(loaded.inputProfile, InputProfile.IPAD_PEN_ONLY);
  assert.equal(loaded.strokesMap[adaptive.questions[0].id].length, 1);

  await clearDraftSession();
  const afterClear = await getDraftSession();
  assert.equal(afterClear, null, "Clear 후 Draft는 null이어야 함");
});
