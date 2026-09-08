//+_+// Phase F11: Math Expansion 1 - Measurement / Unit 모듈 전수 검증 테스트
//+_+// SSOT UNIFIED_CURRICULUM_ACTIVITY_PLATFORM_v2.2 및 Phase F11 명세 준수
//+_+// - Group A ~ Group L 전 영역에 걸쳐 실제 Production 함수를 직접 호출하여 검증

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import "fake-indexeddb/auto";

import {
  DB_VERSION,
  getDB,
  clearAllData,
  saveDraftSession,
  getDraftSession,
  clearDraftSession,
  saveSubmissionSnapshot,
  getSubmission,
  getAllSubmissions,
  updateSubmissionGrading,
  finalizeSubmissionGrading,
  reviseFinalizedGradeDecision,
  getAllProgressAggregates,
  getProgressAggregateByLevel,
  buildProgressAggregateKey,
  calculateProgressAggregatesForLearner,
  startReviewRetry,
  resolveReviewItem,
  getAllReviewItems
} from "../public/app/js/storage.js";

import {
  validateUnitCatalog,
  normalizeUnitCatalog,
  getDimension,
  getUnit,
  convertValue,
  checkIntegerConversion,
  getProfileForSkill
} from "../public/app/js/measurementUnitCatalog.js";

import {
  generateUnitConversionActivities,
  hashSeed
} from "../public/app/js/measurementUnitGenerator.js";

import {
  resolvePracticeRoute,
  resolveLandingRoute,
  isMeasurementRoute,
  LEARNING_ROUTES
} from "../public/app/js/learningRouteResolver.js";

import {
  loadContentRegistry,
  loadPackageManifest,
  loadPackage,
  loadPackageResource
} from "../public/app/js/contentPackageLoader.js";

import {
  registerSkill,
  getSkill,
  clearRegisteredSkills
} from "../public/app/js/unifiedCurriculumRegistry.js";

import {
  ROUTES,
  initRouter,
  resolveGuardedPath,
  _resetRouterForTesting
} from "../public/app/js/platform/appRouter.js";

import {
  SUBJECTS,
  getSubject,
  getSubjectModule
} from "../public/app/js/platform/subjectRegistry.js";

import {
  createSession,
  SessionState
} from "../public/app/js/sessionEngine.js";

import {
  createResponseRecord,
  applyStudentResponseChange
} from "../public/app/js/responseEngine.js";

import {
  submitLearningSession,
  startSubmissionGrading
} from "../public/app/js/data/learningCommands.js";

import {
  buildLearningRecommendations
} from "../public/app/js/recommendations/recommendationEngine.js";

import {
  validateAllContent
} from "../scripts/validate-content.mjs";

import {
  collectContentPrecacheAssets
} from "../scripts/build.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(__dirname, "../public/app/content");

// Fixture loader helper
function loadMeasurementCatalogFixture() {
  const catalogPath = path.join(CONTENT_DIR, "packages/math-measurement-v1/unit-catalog.json");
  return JSON.parse(fs.readFileSync(catalogPath, "utf8"));
}

function loadMeasurementManifestFixture() {
  const manifestPath = path.join(CONTENT_DIR, "packages/math-measurement-v1/manifest.json");
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function loadMeasurementCurriculumFixture() {
  const curriculumPath = path.join(CONTENT_DIR, "packages/math-measurement-v1/curriculum.json");
  return JSON.parse(fs.readFileSync(curriculumPath, "utf8"));
}

// ---------------------------------------------------------------------------
// Group A: Baseline / Scope
// ---------------------------------------------------------------------------
test("Group A-1: DB_VERSION은 6이어야 하며 신규 Object Store는 0개여야 한다", async () => {
  assert.equal(DB_VERSION, 6);
  const db = await getDB();
  const expectedStores = [
    "sessions",
    "attempts",
    "mistakes",
    "stageProgress",
    "strokes",
    "draftSessions",
    "learnerProfiles",
    "submissions",
    "progressAggregates",
    "reviewItems"
  ];
  if (!db.isMemory) {
    const storeNames = Array.from(db.objectStoreNames);
    for (const storeName of expectedStores) {
      assert.ok(storeNames.includes(storeName), `Store ${storeName}이 존재해야 합니다.`);
    }
    assert.equal(storeNames.length, 10, "신규 Object Store는 0개여야 합니다 (총 10개 유지).");
  } else {
    for (const storeName of expectedStores) {
      assert.ok(db[storeName] instanceof Map, `Store ${storeName}이 존재해야 합니다.`);
    }
  }
});

test("Group A-2: foundation-smoke 패키지는 계속 enabled=false 및 status=INTERNAL을 유지해야 한다", async () => {
  const registry = await loadContentRegistry(CONTENT_DIR);
  const smokePkg = registry.packages.find((p) => p.packageId === "foundation-smoke");
  assert.ok(smokePkg, "foundation-smoke가 registry에 있어야 합니다.");
  assert.equal(smokePkg.enabled, false);
  assert.equal(smokePkg.status, "INTERNAL");
});

test("Group A-3: math-measurement-v1 패키지는 enabled=true 및 status=VERIFIED여야 한다", async () => {
  const registry = await loadContentRegistry(CONTENT_DIR);
  const measPkg = registry.packages.find((p) => p.packageId === "math-measurement-v1");
  assert.ok(measPkg, "math-measurement-v1이 registry에 등록되어 있어야 합니다.");
  assert.equal(measPkg.enabled, true);
  assert.equal(measPkg.status, "VERIFIED");
});

// ---------------------------------------------------------------------------
// Group B: Unit Catalog Validation
// ---------------------------------------------------------------------------
test("Group B-1: Production unit-catalog.json은 정상적으로 로드 및 정규화되어야 한다", () => {
  const catalog = loadMeasurementCatalogFixture();
  const manifest = loadMeasurementManifestFixture();
  const curriculum = loadMeasurementCurriculumFixture();

  assert.doesNotThrow(() => {
    validateUnitCatalog(catalog, { manifest, curriculum });
  });

  const normalized = normalizeUnitCatalog(catalog);
  assert.equal(normalized.dimensions.length, 3);
  assert.ok(getDimension(normalized, "length"));
  assert.ok(getDimension(normalized, "mass"));
  assert.ok(getDimension(normalized, "capacity"));

  const km = getUnit(normalized, "length", "km");
  assert.equal(km.baseFactor, 1000000);
  assert.equal(km.symbol, "km");
});

test("Group B-2: 잘못된 schemaVersion 및 packageId 불일치는 reject되어야 한다", () => {
  const catalog = loadMeasurementCatalogFixture();
  const manifest = loadMeasurementManifestFixture();

  assert.throws(() => {
    validateUnitCatalog({ ...catalog, schemaVersion: 2 });
  }, /schemaVersion/);

  assert.throws(() => {
    validateUnitCatalog({ ...catalog, packageId: "wrong-pkg" }, { manifest });
  }, /packageId/);
});

test("Group B-3: 중복된 dimensionId 또는 중복된 unitId는 reject되어야 한다", () => {
  const catalog = loadMeasurementCatalogFixture();

  const dupDim = {
    ...catalog,
    dimensions: [
      catalog.dimensions[0],
      { ...catalog.dimensions[0] }
    ]
  };
  assert.throws(() => validateUnitCatalog(dupDim), /중복된 dimensionId/);

  const dupUnit = {
    ...catalog,
    dimensions: [
      {
        ...catalog.dimensions[0],
        units: [
          ...catalog.dimensions[0].units,
          { unitId: "mm", symbol: "mm2", baseFactor: 2 }
        ]
      }
    ]
  };
  assert.throws(() => validateUnitCatalog(dupUnit), /중복된 unitId/);
});

test("Group B-4: baseFactor가 0 이하이거나 정수가 아니거나 baseFactor=1이 없는 경우 reject되어야 한다", () => {
  const catalog = loadMeasurementCatalogFixture();

  // baseFactor <= 0
  const nonPos = JSON.parse(JSON.stringify(catalog));
  nonPos.dimensions[0].units[0].baseFactor = 0;
  assert.throws(() => validateUnitCatalog(nonPos), /baseFactor는 양의 정수/);

  // baseFactor 소수
  const decFac = JSON.parse(JSON.stringify(catalog));
  decFac.dimensions[0].units[0].baseFactor = 1.5;
  assert.throws(() => validateUnitCatalog(decFac), /baseFactor는 양의 정수/);

  // baseFactor=1 없음
  const noBaseOne = JSON.parse(JSON.stringify(catalog));
  noBaseOne.dimensions[0].units[0].baseFactor = 2;
  assert.throws(() => validateUnitCatalog(noBaseOne), /baseFactor=1인 기준 단위가 정확히 1개/);

  // baseFactor=1 복수 개
  const twoBaseOne = JSON.parse(JSON.stringify(catalog));
  twoBaseOne.dimensions[0].units[1].baseFactor = 1;
  assert.throws(() => validateUnitCatalog(twoBaseOne), /baseFactor=1인 기준 단위가 정확히 1개/);
});

test("Group B-5: cross-dimension pair, 동일 단위 pair, 중복 pair, 소수 정책 profile은 reject되어야 한다", () => {
  const catalog = loadMeasurementCatalogFixture();
  const curriculum = loadMeasurementCurriculumFixture();

  // cross-dimension pair
  const crossDim = JSON.parse(JSON.stringify(catalog));
  crossDim.generatorProfiles[0].allowedPairs.push({ sourceUnitId: "km", targetUnitId: "g" });
  assert.throws(() => validateUnitCatalog(crossDim, { curriculum }), /targetUnitId/);

  // same unit pair
  const sameUnit = JSON.parse(JSON.stringify(catalog));
  sameUnit.generatorProfiles[0].allowedPairs.push({ sourceUnitId: "m", targetUnitId: "m" });
  assert.throws(() => validateUnitCatalog(sameUnit, { curriculum }), /같을 수 없습니다/);

  // duplicate pair
  const dupPair = JSON.parse(JSON.stringify(catalog));
  dupPair.generatorProfiles[0].allowedPairs.push({ sourceUnitId: "km", targetUnitId: "m" });
  assert.throws(() => validateUnitCatalog(dupPair, { curriculum }), /중복된 conversion pair/);

  // decimal policy
  const decPolicy = JSON.parse(JSON.stringify(catalog));
  decPolicy.generatorProfiles[0].allowDecimals = true;
  assert.throws(() => validateUnitCatalog(decPolicy, { curriculum }), /소수 변환 profile을 지원하지 않습니다/);
});

// ---------------------------------------------------------------------------
// Group C: Generator Correctness / Determinism
// ---------------------------------------------------------------------------
test("Group C-1: 동일한 seed + skillId + count는 항상 100% 동일한 문제 배열을 생성해야 한다 (Determinism)", () => {
  const catalog = normalizeUnitCatalog(loadMeasurementCatalogFixture());
  const skillId = "MATH_UNIT_LENGTH_TO_SMALLER";

  const run1 = generateUnitConversionActivities({ skillId, count: 20, seed: 12345, unitCatalog: catalog });
  const run2 = generateUnitConversionActivities({ skillId, count: 20, seed: 12345, unitCatalog: catalog });

  assert.equal(run1.length, 20);
  assert.equal(run2.length, 20);
  assert.deepEqual(run1, run2, "동일 seed 결과는 완벽하게 deepEqual이어야 합니다.");

  // 다른 seed는 다른 결과 생성
  const run3 = generateUnitConversionActivities({ skillId, count: 20, seed: 99999, unitCatalog: catalog });
  assert.notDeepEqual(run1, run3, "서로 다른 seed는 다른 결과를 생성해야 합니다.");
});

test("Group C-2: 6개 Production Skill 전수 대량 생성 수학적 정확성 검증 (2,000+ 문제 전수 assertion)", () => {
  const catalog = normalizeUnitCatalog(loadMeasurementCatalogFixture());
  const skills = [
    "MATH_UNIT_LENGTH_TO_SMALLER",
    "MATH_UNIT_LENGTH_TO_LARGER",
    "MATH_UNIT_MASS_TO_SMALLER",
    "MATH_UNIT_MASS_TO_LARGER",
    "MATH_UNIT_CAPACITY_TO_SMALLER",
    "MATH_UNIT_CAPACITY_TO_LARGER"
  ];

  let totalQuestionsVerified = 0;

  for (const skillId of skills) {
    for (let seed = 100; seed < 120; seed += 1) {
      const activities = generateUnitConversionActivities({
        skillId,
        count: 20,
        seed,
        unitCatalog: catalog
      });

      assert.equal(activities.length, 20);
      const seenPrompts = new Set();

      for (const act of activities) {
        totalQuestionsVerified += 1;

        assert.equal(act.responseType, "TEXT");
        assert.equal(act.activityType, "SHORT_ANSWER");
        assert.equal(act.gradingMode, "GUARDIAN_MANUAL");
        assert.ok(act.prompt, "prompt가 존재해야 합니다.");
        assert.ok(act.expectedAnswer, "expectedAnswer가 존재해야 합니다.");

        // 세션 내 중복 문제 0건
        assert.equal(seenPrompts.has(act.prompt), false, `세션 내 중복 문제 발생: ${act.prompt}`);
        seenPrompts.add(act.prompt);

        // Metadata 검증
        const meta = act.metadata;
        assert.ok(meta, "metadata가 존재해야 합니다.");
        assert.equal(meta.generatorId, "measurement-unit-generator-v1");
        assert.equal(meta.packageId, "math-measurement-v1");
        assert.equal(meta.unitCatalogVersion, 1);
        assert.ok(meta.dimensionId);
        assert.ok(meta.sourceUnitId);
        assert.ok(meta.targetUnitId);
        assert.ok(meta.sourceValue > 0);
        assert.ok(Number.isInteger(meta.sourceValue));

        // 수학적 관계 전수 검사
        const sourceUnit = getUnit(catalog, meta.dimensionId, meta.sourceUnitId);
        const targetUnit = getUnit(catalog, meta.dimensionId, meta.targetUnitId);
        assert.ok(sourceUnit, "sourceUnit 조회 성공");
        assert.ok(targetUnit, "targetUnit 조회 성공");

        const numericExpected = Number(act.expectedAnswer);
        assert.ok(Number.isInteger(numericExpected), `정답은 정수여야 합니다: ${act.expectedAnswer}`);
        assert.ok(numericExpected > 0, `정답은 0보다 커야 합니다: ${numericExpected}`);

        // 핵심 공식: sourceValue * sourceFactor === expectedAnswer * targetFactor
        const lhs = meta.sourceValue * sourceUnit.baseFactor;
        const rhs = numericExpected * targetUnit.baseFactor;
        assert.equal(lhs, rhs, `수학적 불일치: ${act.prompt} (lhs=${lhs}, rhs=${rhs})`);
      }
    }
  }

  assert.ok(totalQuestionsVerified >= 2400, `최소 2400문제 이상 검증 완료 (실제: ${totalQuestionsVerified})`);
});

// ---------------------------------------------------------------------------
// Group D: Content Package & Build Validation
// ---------------------------------------------------------------------------
test("Group D-1: Production Package 로더를 통해 패키지 및 unitCatalog 로드 가능해야 한다", async () => {
  clearRegisteredSkills();
  const pkg = await loadPackage("math-measurement-v1", CONTENT_DIR);

  assert.equal(pkg.manifest.packageId, "math-measurement-v1");
  assert.equal(pkg.curriculum.skills.length, 6);
  assert.equal(pkg.activities.length, 6);

  // Curriculum 스킬이 글로벌 레지스트리에 등록되었는지 확인
  const skill = getSkill("MATH_UNIT_LENGTH_TO_SMALLER");
  assert.ok(skill, "MATH_UNIT_LENGTH_TO_SMALLER 스킬이 등록되어야 합니다.");
  assert.equal(skill.courseId, "measurement");

  // generic loadPackageResource 확인
  const unitCatalog = await loadPackageResource("math-measurement-v1", "unitCatalog", CONTENT_DIR);
  assert.ok(unitCatalog);
  assert.equal(unitCatalog.packageId, "math-measurement-v1");
  assert.equal(unitCatalog.dimensions.length, 3);
});

test("Group D-2: generic precache collector에 math-measurement-v1 패키지 전체 파일이 포함되어야 한다", () => {
  const assets = collectContentPrecacheAssets({ contentDir: CONTENT_DIR });
  assert.ok(assets.includes("./content/registry.json"));
  assert.ok(assets.includes("./content/packages/math-measurement-v1/manifest.json"));
  assert.ok(assets.includes("./content/packages/math-measurement-v1/curriculum.json"));
  assert.ok(assets.includes("./content/packages/math-measurement-v1/activities.json"));
  assert.ok(assets.includes("./content/packages/math-measurement-v1/unit-catalog.json"));
});

test("Group D-3: validateAllContent()는 현재 저장소의 모든 패키지를 무결성 통과시켜야 한다", () => {
  const res = validateAllContent(CONTENT_DIR);
  assert.equal(res.valid, true);
  assert.equal(res.errors.length, 0);
});

// ---------------------------------------------------------------------------
// Group E: Production Start / Route
// ---------------------------------------------------------------------------
test("Group E-1: learningRouteResolver는 모듈에 따라 올바른 Practice 및 Landing 경로를 반환해야 한다 (F9-R4 회귀 방지)", () => {
  // Measurement
  assert.equal(
    resolvePracticeRoute({ subjectId: "math", courseId: "measurement" }),
    "/math/measurement/practice"
  );
  assert.equal(
    resolvePracticeRoute({ subjectId: "math", moduleId: "measurement" }),
    "/math/measurement/practice"
  );
  assert.equal(
    resolveLandingRoute({ subjectId: "math", courseId: "measurement" }),
    "/math/measurement"
  );

  // Arithmetic (기존 경로 무회귀)
  assert.equal(
    resolvePracticeRoute({ subjectId: "math", courseId: "arithmetic" }),
    "/math/arithmetic/practice"
  );
  assert.equal(
    resolvePracticeRoute({ subjectId: "math" }),
    "/math/arithmetic/practice"
  );
  assert.equal(
    resolveLandingRoute({ subjectId: "math", courseId: "arithmetic" }),
    "/math/arithmetic"
  );
});

test("Group E-2: AppRouter에서 Measurement 라우트 가드 및 보호 검증", () => {
  _resetRouterForTesting();

  // 활성 학습자 없는 경우 /learners로 리다이렉트
  const guardedWithoutLearner = resolveGuardedPath(ROUTES.MATH_MEASUREMENT);
  assert.equal(guardedWithoutLearner, ROUTES.LEARNERS);

  const guardedPracticeWithoutLearner = resolveGuardedPath(ROUTES.MATH_MEASUREMENT_PRACTICE);
  assert.equal(guardedPracticeWithoutLearner, ROUTES.LEARNERS);
});

test("Group E-3: SubjectRegistry에서 math 하위 measurement 모듈 활성화 확인", () => {
  const mathSubject = getSubject("math");
  assert.ok(mathSubject);
  const measMod = getSubjectModule("math", "measurement");
  assert.ok(measMod, "measurement 모듈이 등록되어 있어야 합니다.");
  assert.equal(measMod.status, "active");
  assert.equal(measMod.enabled, true);
  assert.equal(measMod.route, "/math/measurement");
});

// ---------------------------------------------------------------------------
// Group F: Response / Draft
// ---------------------------------------------------------------------------
test("Group F-1: TEXT input mutation guard 및 Draft v4 round-trip 검증", async () => {
  await clearAllData();
  const catalog = normalizeUnitCatalog(loadMeasurementCatalogFixture());
  const activities = generateUnitConversionActivities({
    skillId: "MATH_UNIT_LENGTH_TO_SMALLER",
    count: 5,
    seed: 555,
    unitCatalog: catalog
  });

  const session = createSession({
    subjectId: "math",
    courseId: "measurement",
    moduleId: "measurement",
    skillId: "MATH_UNIT_LENGTH_TO_SMALLER",
    problemCount: 5
  }, activities);
  session.start();
  assert.equal(session.state, SessionState.PRACTICE_ACTIVE);

  const responseMap = new Map();

  // 1. PRACTICE_ACTIVE 상태에서 답안 수정 허용
  const q0 = activities[0];
  const record = applyStudentResponseChange(session, responseMap, q0, "300");
  assert.equal(record.value, "300");
  assert.equal(responseMap.get(q0.id).value, "300");

  // 2. Draft 저장 및 복원
  const draftPayload = {
    sessionId: session.id,
    learnerId: "learner_test_1",
    subjectId: "math",
    courseId: "measurement",
    sessionState: "PRACTICE_ACTIVE",
    config: { courseId: "measurement", skillId: "MATH_UNIT_LENGTH_TO_SMALLER" },
    questions: activities,
    responseRecords: Array.from(responseMap.values())
  };

  await saveDraftSession(draftPayload);
  const loadedDraft = await getDraftSession({ learnerId: "learner_test_1" });
  assert.ok(loadedDraft);
  assert.equal(loadedDraft.sessionId, session.id);
  assert.equal(loadedDraft.config?.courseId, "measurement");

  // 3. SUBMITTING 상태 이후 mutation 거부
  session.startSubmitting();
  assert.throws(() => {
    applyStudentResponseChange(session, responseMap, q0, "400");
  }, /현재 세션 상태\(SUBMITTING\)에서는 학생 응답을 수정할 수 없습니다/);
});

// ---------------------------------------------------------------------------
// Group G: Submission / Grading
// ---------------------------------------------------------------------------
test("Group G-1: Submission 스냅샷은 불변이어야 하며 자동 채점 없이 Guardian GradeDecision이 최종 SSOT여야 한다", async () => {
  await clearAllData();
  const catalog = normalizeUnitCatalog(loadMeasurementCatalogFixture());
  const activities = generateUnitConversionActivities({
    skillId: "MATH_UNIT_MASS_TO_SMALLER",
    count: 3,
    seed: 777,
    unitCatalog: catalog
  });

  const session = createSession({
    subjectId: "math",
    courseId: "measurement",
    skillId: "MATH_UNIT_MASS_TO_SMALLER",
    learnerId: "learner_g1"
  }, activities);
  session.start();

  const responseMap = new Map();
  activities.forEach((q) => {
    // 학생이 정답과 같은 문자열을 입력하더라도
    applyStudentResponseChange(session, responseMap, q, q.expectedAnswer);
  });

  // 제출
  const submissionRes = await submitLearningSession({
    session,
    responseRecordsMap: responseMap,
    learnerId: "learner_g1"
  });

  assert.ok(submissionRes.id);
  assert.equal(submissionRes.status, "PARENT_GRADING_PENDING");

  // 자동 채점 절대 없음: 모든 판정이 미채점 상태여야 함
  assert.equal(submissionRes.gradingProgress.graded, 0);
  assert.equal(submissionRes.gradingProgress.remaining, 3);
  assert.equal(submissionRes.gradingProgress.allGraded, false);

  // Guardian 채점 시작 (PARENT_GRADING_PENDING -> GRADING_ACTIVE)
  await startSubmissionGrading(submissionRes.id, { learnerId: "learner_g1" });

  // Guardian 채점 진행 및 최종 확정
  const gradingResults = {};
  activities.forEach((q, idx) => {
    gradingResults[q.id] = {
      decision: idx === 0 ? "CORRECT" : "WRONG",
      comment: "보호자 평가"
    };
  });

  // 가변 채점 저장
  await updateSubmissionGrading(submissionRes.id, gradingResults, new Map(), {
    status: "GRADING_ACTIVE",
    learnerId: "learner_g1"
  });

  // 최종 확정
  const finalized = await finalizeSubmissionGrading(submissionRes.id, {
    learnerId: "learner_g1"
  });

  assert.equal(finalized.submission.status, "GRADED");
  assert.equal(finalized.submission.gradingProgress.allGraded, true);
  assert.equal(finalized.sessionRecord.correctCount, 1);
  assert.equal(finalized.sessionRecord.wrongCount, 2);
});

// ---------------------------------------------------------------------------
// Group H: Review / Retry Lifecycle
// ---------------------------------------------------------------------------
test("Group H-1: WRONG/RETRY 문제는 ReviewItem으로 전이되며 재풀이 시 원본 Submission은 deepEqual 불변이어야 한다", async () => {
  await clearAllData();
  const catalog = normalizeUnitCatalog(loadMeasurementCatalogFixture());
  const activities = generateUnitConversionActivities({
    skillId: "MATH_UNIT_CAPACITY_TO_SMALLER",
    count: 2,
    seed: 888,
    unitCatalog: catalog
  });

  const session = createSession({
    subjectId: "math",
    courseId: "measurement",
    skillId: "MATH_UNIT_CAPACITY_TO_SMALLER",
    learnerId: "learner_h1"
  }, activities);
  session.start();

  const responseMap = new Map();
  activities.forEach((q) => {
    applyStudentResponseChange(session, responseMap, q, "1234"); // 임의 응답
  });

  const subSnapshot = await submitLearningSession({
    session,
    responseRecordsMap: responseMap,
    learnerId: "learner_h1"
  });

  // Guardian 채점 시작
  await startSubmissionGrading(subSnapshot.id, { learnerId: "learner_h1" });

  // 보호자 채점: 1번 WRONG, 2번 RETRY
  const gradingResults = {
    [activities[0].id]: { decision: "WRONG" },
    [activities[1].id]: { decision: "RETRY" }
  };
  await updateSubmissionGrading(subSnapshot.id, gradingResults, new Map(), {
    status: "GRADING_ACTIVE",
    learnerId: "learner_h1"
  });
  const finalized = await finalizeSubmissionGrading(subSnapshot.id, { learnerId: "learner_h1" });

  const originalSubmissionDeepCopy = JSON.parse(JSON.stringify(finalized.submission));

  // ReviewItem 생성 확인
  const reviewItems = await getAllReviewItems({ learnerId: "learner_h1" });
  assert.equal(reviewItems.length, 2);
  const wrongItem = reviewItems.find((r) => r.reasonCode === "WRONG");
  assert.ok(wrongItem);
  assert.equal(wrongItem.skillId, "MATH_UNIT_CAPACITY_TO_SMALLER");
  assert.equal(wrongItem.courseId, "measurement");

  // 재풀이 시작 (startReviewRetry)
  const retryResult = await startReviewRetry(wrongItem.id, { learnerId: "learner_h1" });
  assert.ok(retryResult);
  assert.ok(retryResult.retrySession);
  assert.equal(retryResult.retrySession.questions[0].courseId, "measurement");
  assert.equal(retryResult.retrySession.questions[0].skillId, "MATH_UNIT_CAPACITY_TO_SMALLER");
  assert.equal(retryResult.retrySession.questions[0].reviewItemId, wrongItem.id);

  // 원본 Submission 불변성 전수 검증
  const postRetryOriginalSub = await getSubmission(subSnapshot.id, { learnerId: "learner_h1" });
  assert.deepEqual(postRetryOriginalSub, originalSubmissionDeepCopy, "재풀이 후에도 원본 Submission은 deepEqual 불변이어야 합니다.");

  // 재풀이 제출 후 보호자 해결 (review_pending -> resolved)
  retryResult.retrySession.start();
  await submitLearningSession({
    session: retryResult.retrySession,
    reviewItemId: wrongItem.id,
    learnerId: "learner_h1"
  });

  const resolved = await resolveReviewItem(wrongItem.id, { learnerId: "learner_h1" });
  assert.equal(resolved.state, "resolved");
  assert.ok(resolved.resolvedAt);
});

// ---------------------------------------------------------------------------
// Group I: Progress
// ---------------------------------------------------------------------------
test("Group I-1: Measurement Skill Progress 집계 및 연산 Progress와의 엄격 격리 검증", async () => {
  await clearAllData();
  const catalog = normalizeUnitCatalog(loadMeasurementCatalogFixture());
  const activities = generateUnitConversionActivities({
    skillId: "MATH_UNIT_LENGTH_TO_LARGER",
    count: 2,
    seed: 999,
    unitCatalog: catalog
  });

  const session = createSession({
    subjectId: "math",
    courseId: "measurement",
    skillId: "MATH_UNIT_LENGTH_TO_LARGER",
    learnerId: "learner_i1"
  }, activities);
  session.start();

  const responseMap = new Map();
  activities.forEach((q) => applyStudentResponseChange(session, responseMap, q, q.expectedAnswer));

  const subRes = await submitLearningSession({
    session,
    responseRecordsMap: responseMap,
    learnerId: "learner_i1"
  });

  // 1. 미채점 상태에서는 ProgressAggregate에 반영되지 않음
  let aggs = await getAllProgressAggregates({ learnerId: "learner_i1" });
  assert.equal(aggs.length, 0, "미채점 세션은 진도에 반영되지 않아야 합니다.");

  // Guardian 채점 시작
  await startSubmissionGrading(subRes.id, { learnerId: "learner_i1" });

  // 2. 보호자 채점 확정 (2문제 모두 CORRECT)
  await updateSubmissionGrading(subRes.id, {
    [activities[0].id]: { decision: "CORRECT" },
    [activities[1].id]: { decision: "CORRECT" }
  }, new Map(), { status: "GRADING_ACTIVE", learnerId: "learner_i1" });

  await finalizeSubmissionGrading(subRes.id, { learnerId: "learner_i1" });

  aggs = await getAllProgressAggregates({ learnerId: "learner_i1" });
  assert.equal(aggs.length, 1);
  const measAgg = aggs[0];
  assert.equal(measAgg.courseId, "measurement");
  assert.equal(measAgg.levelId, "MATH_UNIT_LENGTH_TO_LARGER");
  assert.equal(measAgg.unitId, "length");
  assert.equal(measAgg.correctCount, 2);
  assert.equal(measAgg.accuracy, 100);

  // 3. 판정 수정(Revision): 1문제를 WRONG으로 번복 시 재계산 검증
  await reviseFinalizedGradeDecision(subRes.id, activities[1].id, "WRONG", "오판 정정", { learnerId: "learner_i1" });
  const revisedAgg = await getProgressAggregateByLevel("learner_i1", "MATH_UNIT_LENGTH_TO_LARGER");
  assert.equal(revisedAgg.correctCount, 1);
  assert.equal(revisedAgg.incorrectCount, 1);
  assert.equal(revisedAgg.accuracy, 50);

  // 4. 연산 Progress(M1 등)와 혼합되지 않음 검증
  const m1Agg = await getProgressAggregateByLevel("learner_i1", "M1");
  assert.equal(m1Agg, null, "연산 레벨과 단위 레벨은 완벽히 격리되어야 합니다.");
});

// ---------------------------------------------------------------------------
// Group J: Recommendation
// ---------------------------------------------------------------------------
test("Group J-1: Measurement 추천 후보는 courseId=measurement 및 올바른 라우트를 유지해야 한다", () => {
  const mockDraft = {
    sessionId: "sess_meas_rec_1",
    learnerId: "learner_j1",
    subjectId: "math",
    sessionState: "PRACTICE_ACTIVE",
    config: {
      courseId: "measurement",
      skillId: "MATH_UNIT_MASS_TO_SMALLER"
    },
    questions: [{ id: "q1", prompt: "2 kg = ___ g" }]
  };

  const recResult = buildLearningRecommendations({
    learnerId: "learner_j1",
    draft: mockDraft
  });

  assert.ok(recResult.topRecommendation);
  assert.equal(recResult.topRecommendation.type, "RESUME_SESSION");
  assert.equal(recResult.topRecommendation.priorityTier, 5);
  assert.equal(recResult.topRecommendation.courseId, "measurement");
  assert.equal(recResult.topRecommendation.skillId, "MATH_UNIT_MASS_TO_SMALLER");

  // route resolver로 전달 시 measurement practice 반환 확인
  const practiceRoute = resolvePracticeRoute({
    subjectId: recResult.topRecommendation.subjectId,
    courseId: recResult.topRecommendation.courseId
  });
  assert.equal(practiceRoute, "/math/measurement/practice");
});

// ---------------------------------------------------------------------------
// Group K: UI & Accessibility
// ---------------------------------------------------------------------------
test("Group K-1: TEXT input에 numeric inputmode 및 접근성 라벨 속성이 포함되어야 한다", () => {
  const appJsPath = path.join(__dirname, "../public/app/js/app.js");
  const appJs = fs.readFileSync(appJsPath, "utf8");

  assert.ok(appJs.includes('inputmode="numeric"'), "app.js의 renderTextActivityStage에 inputmode=\"numeric\"이 있어야 합니다.");
  assert.ok(appJs.includes('aria-label="답안 입력"') || appJs.includes('class="sr-only">답안 입력</label>'), "스크린 리더용 라벨이 제공되어야 합니다.");
  assert.ok(appJs.includes('renderMeasurementLandingView'), "renderMeasurementLandingView가 정의되어 있어야 합니다.");
});

// ---------------------------------------------------------------------------
// Group L: Offline & Distribution
// ---------------------------------------------------------------------------
test("Group L-1: verify-dist-sync에 신규 모듈 및 정적 콘텐츠 패키지 전체가 등록되어 있어야 한다", async () => {
  const verifyScriptPath = path.join(__dirname, "../scripts/verify-dist-sync.mjs");
  const scriptContent = fs.readFileSync(verifyScriptPath, "utf8");

  assert.ok(scriptContent.includes("js/measurementUnitCatalog.js"));
  assert.ok(scriptContent.includes("js/measurementUnitGenerator.js"));
  assert.ok(scriptContent.includes("js/learningRouteResolver.js"));
  assert.ok(scriptContent.includes("content/packages/math-measurement-v1/manifest.json"));
  assert.ok(scriptContent.includes("content/packages/math-measurement-v1/curriculum.json"));
  assert.ok(scriptContent.includes("content/packages/math-measurement-v1/activities.json"));
  assert.ok(scriptContent.includes("content/packages/math-measurement-v1/unit-catalog.json"));
});
