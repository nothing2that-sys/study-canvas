import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "fake-indexeddb/auto";

import {
  WorkbookAssignmentStatus,
  PageProgressStatus,
  createWorkbookAssignment,
  deepFreezeWorkbook,
  moveWorkbookAssignment,
  normalizeWorkbookDefinition,
  normalizeWorkbookEdition,
  projectWorkbookPageProgress,
  resolveWorkbookSpread
} from "../public/app/js/workbookEngine.js";
import { getWorkbookCatalog } from "../public/app/js/workbookCatalog.js";
import {
  DB_VERSION,
  getDB,
  clearAllData,
  closeDB,
  getWorkbookAssignment,
  getWorkbookAssignments,
  saveWorkbookAssignment,
  setCurrentLearnerId
} from "../public/app/js/storage.js";
import { consumeActiveWorkbookContext, getActiveWorkbookContext } from "../public/app/js/workbookView.js";
import { exportAllData, importBackupData, validateBackupData } from "../public/app/js/backupEngine.js";
import { ROUTES, resolveGuardedPath } from "../public/app/js/platform/appRouter.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(dirname, "..", "public", "app");

test.beforeEach(async () => {
  await clearAllData({ allLearners: true });
  setCurrentLearnerId(null);
});

test.after(async () => {
  await clearAllData({ allLearners: true });
  await closeDB();
});

test("F13-R3 문제집 유형과 필수 식별자를 정규화한다", () => {
  const definition = normalizeWorkbookDefinition({
    workbookId: "math-3-1",
    type: "fixed",
    subjectId: "MATH",
    courseId: "core",
    title: "3학년 수학",
    gradeLevel: 3,
    difficulty: "standard"
  });
  assert.equal(definition.type, "FIXED");
  assert.equal(definition.subjectId, "math");
  assert.equal(definition.gradeLevel, 3);
});

test("F13-R3 검수 문제집은 1부터 6까지의 학년만 허용한다", () => {
  assert.throws(() => normalizeWorkbookDefinition({ workbookId: "a", subjectId: "math", courseId: "c", title: "t", gradeLevel: 0 }));
  assert.throws(() => normalizeWorkbookDefinition({ workbookId: "a", subjectId: "math", courseId: "c", title: "t", gradeLevel: 7 }));
  assert.throws(() => normalizeWorkbookDefinition({ workbookId: "a", subjectId: "math", courseId: "c", title: "t" }));
});


test("F13-R3 검수 문제집은 표준 학기와 난이도만 허용한다", () => {
  const base = { workbookId: "w", subjectId: "math", courseId: "core", title: "검수 문제집", gradeLevel: 3 };
  assert.throws(() => normalizeWorkbookDefinition({ ...base, semester: "3", difficulty: "STANDARD" }));
  assert.throws(() => normalizeWorkbookDefinition({ ...base, semester: "ALL", difficulty: "HARD" }));
  assert.throws(() => normalizeWorkbookDefinition({ ...base, semester: "ALL" }));
});

test("F13-R3 기존 미분류 콘텐츠만 null 학년을 명시적으로 허용한다", () => {
  const definition = normalizeWorkbookDefinition({
    workbookId: "legacy",
    subjectId: "math",
    courseId: "legacy",
    title: "기존 콘텐츠",
    gradeLevel: null,
    legacyUnclassified: true
  });
  assert.equal(definition.gradeLevel, null);
  assert.equal(definition.legacyUnclassified, true);
});

test("F13-R3 발행 Edition은 승인 상태와 페이지를 요구한다", () => {
  assert.throws(() => normalizeWorkbookEdition({ workbookId: "w", editionVersion: 1, reviewStatus: "DRAFT", pages: [{ pageId: "p", pageNumber: 1 }] }));
  assert.throws(() => normalizeWorkbookEdition({ workbookId: "w", editionVersion: 1, reviewStatus: "APPROVED", pages: [] }));
});

test("F13-R3 Edition은 중복 페이지 ID와 번호를 거절한다", () => {
  assert.throws(() => normalizeWorkbookEdition({
    workbookId: "w",
    editionVersion: 1,
    reviewStatus: "APPROVED",
    pages: [{ pageId: "p", pageNumber: 1 }, { pageId: "p", pageNumber: 2 }]
  }));
  assert.throws(() => normalizeWorkbookEdition({
    workbookId: "w",
    editionVersion: 1,
    reviewStatus: "APPROVED",
    pages: [{ pageId: "p1", pageNumber: 1 }, { pageId: "p2", pageNumber: 1 }]
  }));
});

test("F13-R3 Edition과 Page는 깊게 불변이다", () => {
  const edition = normalizeWorkbookEdition({
    workbookId: "w",
    editionVersion: 1,
    reviewStatus: "APPROVED",
    pages: [{ pageId: "p1", pageNumber: 1, activityRefs: [{ id: "a1" }] }]
  });
  assert.equal(Object.isFrozen(edition), true);
  assert.equal(Object.isFrozen(edition.pages), true);
  assert.equal(Object.isFrozen(edition.pages[0].activityRefs[0]), true);
});

test("F13-R3 deepFreezeWorkbook은 중첩 객체를 동결한다", () => {
  const value = deepFreezeWorkbook({ a: [{ b: 1 }] });
  assert.equal(Object.isFrozen(value.a[0]), true);
});

test("F13-R3 Assignment 기본 상태와 안정된 ID를 만든다", () => {
  const assignment = createWorkbookAssignment({ learnerId: "learner-a", workbookId: "w", editionVersion: 2, now: 10 });
  assert.equal(assignment.assignmentId, "workbook_learner-a_w_v2");
  assert.equal(assignment.status, WorkbookAssignmentStatus.NOT_STARTED);
});

test("F13-R3 페이지 이동은 마지막 페이지와 시간을 갱신한다", () => {
  const assignment = createWorkbookAssignment({ learnerId: "learner-a", workbookId: "w", editionVersion: 1, now: 10 });
  const moved = moveWorkbookAssignment(assignment, "p2", { now: 20 });
  assert.equal(moved.status, WorkbookAssignmentStatus.IN_PROGRESS);
  assert.equal(moved.lastPageId, "p2");
  assert.equal(moved.lastOpenedAt, 20);
});

test("F13-R3 책갈피는 Assignment에 보존하고 페이지 완료 목록은 중복 저장하지 않는다", () => {
  let assignment = createWorkbookAssignment({ learnerId: "learner-a", workbookId: "w", editionVersion: 1, now: 10 });
  assignment = moveWorkbookAssignment(assignment, "p1", { bookmark: true, now: 20 });
  assert.equal(assignment.bookmarkPageId, "p1");
  assert.equal(Object.hasOwn(assignment, "completedPageIds"), false);
});

test("F13-R3 좁은 화면은 한 페이지를 표시한다", () => {
  assert.deepEqual(resolveWorkbookSpread(1, 4, 768), { mode: "ONE_PAGE", visibleIndexes: [1] });
});

test("F13-R3 넓은 화면은 현재와 다음 페이지를 펼친다", () => {
  assert.deepEqual(resolveWorkbookSpread(1, 4, 1280), { mode: "TWO_PAGE", visibleIndexes: [1, 2] });
  assert.deepEqual(resolveWorkbookSpread(3, 4, 1280), { mode: "TWO_PAGE", visibleIndexes: [3] });
});

test("F13-R3 PageProgress는 Draft에서 투영한다", () => {
  assert.equal(projectWorkbookPageProgress({ pageId: "p1", draft: { config: { workbookPageId: "p1" } } }), PageProgressStatus.IN_PROGRESS);
});

test("F13-R3 PageProgress는 제출과 보호자 채점 대기를 투영한다", () => {
  assert.equal(projectWorkbookPageProgress({ pageId: "p1", submissions: [{ workbookPageId: "p1", status: "SUBMITTED" }] }), PageProgressStatus.SUBMITTED);
  assert.equal(projectWorkbookPageProgress({ pageId: "p1", submissions: [{ workbookPageId: "p1", status: "PARENT_GRADING_PENDING" }] }), PageProgressStatus.GRADING_PENDING);
});


test("F13-R3 ReviewItem은 원본 Submission을 통해 문제집 페이지에 투영된다", () => {
  assert.equal(projectWorkbookPageProgress({
    pageId: "p1",
    submissions: [{ id: "sub-1", config: { workbookPageId: "p1" }, status: "GRADED" }],
    reviewItems: [{ sourceSubmissionId: "sub-1", state: "review_pending" }]
  }), PageProgressStatus.REVIEW_DUE);
});

test("F13-R3 미해결 복습은 PageProgress 최우선 상태다", () => {
  assert.equal(projectWorkbookPageProgress({
    pageId: "p1",
    submissions: [{ workbookPageId: "p1", status: "GRADED" }],
    reviewItems: [{ workbookPageId: "p1", state: "due" }]
  }), PageProgressStatus.REVIEW_DUE);
});

test("F13-R3 DB_VERSION 7과 Assignment 저장소 인덱스를 사용한다", async () => {
  assert.equal(DB_VERSION, 7);
  const assignments = await getWorkbookAssignments({ allLearners: true });
  assert.deepEqual(assignments, []);
  const db = await getDB();
  const indexNames = Array.from(db.transaction("workbookAssignments", "readonly").objectStore("workbookAssignments").indexNames);
  for (const indexName of ["learnerId", "workbookId", "status", "lastOpenedAt"]) assert.ok(indexNames.includes(indexName));
});

test("F13-R3 Assignment 저장과 복원은 활성 학습자로 격리된다", async () => {
  setCurrentLearnerId("learner-a");
  const a = createWorkbookAssignment({ learnerId: "learner-a", workbookId: "w", editionVersion: 1, now: 10 });
  await saveWorkbookAssignment(a);
  assert.equal((await getWorkbookAssignments()).length, 1);
  setCurrentLearnerId("learner-b");
  assert.equal((await getWorkbookAssignments()).length, 0);
  assert.equal(await getWorkbookAssignment(a.assignmentId), null);
});

test("F13-R3 다른 학습자 Assignment 저장을 거절한다", async () => {
  setCurrentLearnerId("learner-a");
  const other = createWorkbookAssignment({ learnerId: "learner-b", workbookId: "w", editionVersion: 1 });
  await assert.rejects(() => saveWorkbookAssignment(other));
});


test("F13-R3 동일 Assignment ID로 다른 학습자 데이터를 덮어쓸 수 없다", async () => {
  setCurrentLearnerId("learner-a");
  await saveWorkbookAssignment(createWorkbookAssignment({ assignmentId: "shared-id", learnerId: "learner-a", workbookId: "w", editionVersion: 1 }));
  setCurrentLearnerId("learner-b");
  await assert.rejects(() => saveWorkbookAssignment(createWorkbookAssignment({ assignmentId: "shared-id", learnerId: "learner-b", workbookId: "w", editionVersion: 1 })));
});

test("F13-R3 특정 학습자 초기화는 다른 학습자 Assignment를 보존한다", async () => {
  for (const learnerId of ["learner-a", "learner-b"]) {
    setCurrentLearnerId(learnerId);
    await saveWorkbookAssignment(createWorkbookAssignment({ learnerId, workbookId: "w", editionVersion: 1 }));
  }
  await clearAllData({ learnerId: "learner-a" });
  const all = await getWorkbookAssignments({ allLearners: true });
  assert.deepEqual(all.map((item) => item.learnerId), ["learner-b"]);
});


test("F13-R3 백업 Preview에 Assignment 수를 포함한다", async () => {
  setCurrentLearnerId("learner-a");
  await saveWorkbookAssignment(createWorkbookAssignment({ learnerId: "learner-a", workbookId: "w", editionVersion: 1 }));
  const backup = await exportAllData();
  const validation = validateBackupData(backup);
  assert.equal(backup.metadata.workbookAssignmentCount, 1);
  assert.equal(validation.preview.workbookAssignmentCount, 1);
});

test("F13-R3 Assignment는 백업과 복원 왕복에서 보존된다", async () => {
  setCurrentLearnerId("learner-a");
  const assignment = createWorkbookAssignment({ learnerId: "learner-a", workbookId: "w", editionVersion: 1 });
  await saveWorkbookAssignment(assignment);
  const backup = await exportAllData();
  await clearAllData({ allLearners: true });
  await importBackupData(backup, { mode: "merge" });
  const restored = await getWorkbookAssignments({ allLearners: true });
  assert.equal(restored[0].assignmentId, assignment.assignmentId);
});

test("F13-R3 카탈로그는 기존 콘텐츠를 학년 미분류로 유지한다", () => {
  const catalog = getWorkbookCatalog();
  assert.ok(catalog.length >= 4);
  assert.equal(catalog.every((item) => item.definition.gradeLevel === null && item.definition.legacyUnclassified), true);
  assert.equal(catalog.some((item) => item.definition.subjectId === "math"), true);
  assert.equal(catalog.some((item) => item.definition.subjectId === "korean"), true);
  assert.equal(catalog.some((item) => item.definition.subjectId === "english"), true);
});

test("F13-R3 문제집 세션 문맥은 한 번만 소비한다", () => {
  const values = new Map([["math_canvas_workbook_context", JSON.stringify({ workbookPageId: "p1" })]]);
  const storage = {
    getItem: (key) => values.get(key) || null,
    removeItem: (key) => values.delete(key)
  };
  assert.equal(getActiveWorkbookContext(storage).workbookPageId, "p1");
  assert.equal(consumeActiveWorkbookContext(storage).workbookPageId, "p1");
  assert.equal(consumeActiveWorkbookContext(storage), null);
});

test("F13-R3 문제집 라우트는 학습자 보호 라우트다", () => {
  setCurrentLearnerId(null);
  for (const route of [ROUTES.BOOKSHELF, ROUTES.WORKBOOK_DETAIL, ROUTES.WORKBOOK_READER]) {
    assert.equal(resolveGuardedPath(route), ROUTES.LEARNERS);
  }
});

test("F13-R3 App Shell에 책장, 상세, 펼침 화면이 포함된다", () => {
  const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
  for (const id of ["openBookshelfBtn", "bookshelfView", "workbookDetailView", "workbookReaderView", "workbookPageNavigator"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
});

test("F13-R3 App Shell과 배포 검증에 문제집 모듈이 포함된다", () => {
  const serviceWorker = fs.readFileSync(path.join(appRoot, "service-worker.js"), "utf8");
  const verifier = fs.readFileSync(path.join(dirname, "..", "scripts", "verify-dist-sync.mjs"), "utf8");
  for (const file of ["workbookEngine.js", "workbookCatalog.js", "workbookView.js"]) {
    assert.match(serviceWorker, new RegExp(file.replace(".", "\\.")));
    assert.match(verifier, new RegExp(file.replace(".", "\\.")));
  }
});

test("F13-R3 세션 생성은 문제집 문맥을 일회성으로 병합한다", () => {
  const source = fs.readFileSync(path.join(appRoot, "js", "app.js"), "utf8");
  assert.match(source, /consumeActiveWorkbookContext\(\)/);
  assert.match(source, /createSession\(effectiveConfig, questions\)/);
});

test("F13-R3 페이지 이동 전 저장 실패 시 이동을 중단한다", () => {
  const source = fs.readFileSync(path.join(appRoot, "js", "workbookView.js"), "utf8");
  assert.match(source, /await beforePageChange\(\)/);
  assert.match(source, /const assignment = await resolveSelectedAssignment\(\)/);
  assert.match(source, /저장에 실패하여 페이지를 이동하지 않았습니다/);
});

test("F13-R3 문제집 화면은 단일·양면 반응형과 터치 목표를 제공한다", () => {
  const css = fs.readFileSync(path.join(appRoot, "css", "app.css"), "utf8");
  assert.match(css, /workbook-reader-content\.two-page/);
  assert.match(css, /@media \(max-width: 1023px\)/);
  assert.match(css, /@media \(pointer: coarse\)/);
  assert.match(css, /min-height: 48px/);
});
