//+_+// Phase F13-R3 책장, 문제집 상세와 펼침 화면

import { getActiveLearner } from "./learners/learnerQueries.js";
import { getWorkbookAssignments, saveWorkbookAssignment } from "./storage.js";
import { createWorkbookAssignment, moveWorkbookAssignment, projectWorkbookPageProgress, resolveWorkbookSpread } from "./workbookEngine.js";
import { getDraft, getAllSubmissions, getAllReviewItems } from "./data/learningQueries.js";
import { getWorkbookCatalog, getWorkbookCatalogItem } from "./workbookCatalog.js";
import { navigate, ROUTES } from "./platform/appRouter.js";
import { escapeHtml } from "./sessionEngine.js";
import { evaluateContentEligibility } from "./contentEligibility.js";

const SELECTION_KEY = "math_canvas_workbook_selection";
const CONTEXT_KEY = "math_canvas_workbook_context";

let documentRef = null;
let windowRef = null;
let beforePageChange = null;
let currentAssignment = null;
let currentCatalogItem = null;
let currentPageIndex = 0;

function readJson(storage, key) {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    return false;
  }
  return true;
}

function getSelection() {
  return readJson(windowRef?.localStorage, SELECTION_KEY) || {};
}

function saveSelection(value) {
  writeJson(windowRef?.localStorage, SELECTION_KEY, value);
}

export function getActiveWorkbookContext(storage = typeof sessionStorage !== "undefined" ? sessionStorage : null, options = null) {
  const context = readJson(storage, CONTEXT_KEY);
  if (!context || !options) return context;
  const expectedLaunchTarget = String(options.launchTarget || '').trim();
  if (expectedLaunchTarget && String(context.launchTarget || '') !== expectedLaunchTarget) return null;
  const maxAgeMs = Math.max(0, Number(options.maxAgeMs) || 30 * 60 * 1000);
  const createdAt = Number(context.createdAt);
  return createdAt > 0 && Date.now() - createdAt > maxAgeMs ? null : context;
}

export function consumeActiveWorkbookContext(
  storage = typeof sessionStorage !== "undefined" ? sessionStorage : null,
  options = {}
) {
  const context = getActiveWorkbookContext(storage, options);
  try {
    storage?.removeItem(CONTEXT_KEY);
  } catch {}
  return context;
}

function isWorkbookVisible(definition, learner) {
  if (definition.legacyUnclassified) return true;
  return evaluateContentEligibility({ learner, policy: learner.guardianPolicy, content: definition, requestedMode: "NEW" }).eligible;
}

function workbookScopeLabel(definition) {
  if (definition.legacyUnclassified) return "학년 미분류 기존 콘텐츠";
  const difficulty = { FOUNDATION: "기초", STANDARD: "표준", ADVANCED: "심화" }[definition.difficulty] || definition.difficulty;
  return `${definition.gradeLevel}학년 · ${difficulty}`;
}

async function ensureAssignments(learnerId, learner = null) {
  const existing = await getWorkbookAssignments({ learnerId });
  const byWorkbook = new Map(existing.map((item) => [item.workbookId, item]));
  const visibleCatalog = getWorkbookCatalog().filter((item) => !learner || isWorkbookVisible(item.definition, learner));
  for (const catalogItem of visibleCatalog) {
    const workbookId = catalogItem.definition.workbookId;
    if (!byWorkbook.has(workbookId)) {
      const assignment = createWorkbookAssignment({
        learnerId,
        workbookId,
        editionVersion: catalogItem.edition.editionVersion
      });
      byWorkbook.set(workbookId, await saveWorkbookAssignment(assignment, { learnerId }));
    }
  }
  const visibleIds = new Set(visibleCatalog.map((item) => item.definition.workbookId));
  return [...byWorkbook.values()].filter((assignment) => visibleIds.has(assignment.workbookId));
}

function subjectLabel(subjectId) {
  return { math: "수학", korean: "국어", english: "영어" }[subjectId] || subjectId;
}

async function loadPageProgress(learnerId, edition) {
  const [draft, submissions, reviewItems] = await Promise.all([
    getDraft({ learnerId }),
    getAllSubmissions({ learnerId }),
    getAllReviewItems({ learnerId })
  ]);
  return new Map(edition.pages.map((page) => [
    page.pageId,
    projectWorkbookPageProgress({ pageId: page.pageId, draft, submissions, reviewItems })
  ]));
}

function progressText(edition, pageProgress) {
  const total = edition.pages.length;
  const completedStates = new Set(["GRADED", "COMPLETED"]);
  const completed = edition.pages.filter((page) => completedStates.has(pageProgress.get(page.pageId))).length;
  return { total, completed, percent: total ? Math.round(completed / total * 100) : 0 };
}

function pageProgressLabel(status) {
  return {
    NOT_STARTED: "시작 전",
    IN_PROGRESS: "작성 중",
    SUBMITTED: "제출됨",
    GRADING_PENDING: "채점 대기",
    GRADED: "채점 완료",
    REVIEW_DUE: "복습 필요",
    COMPLETED: "완료"
  }[status] || status;
}

async function selectAssignment(assignment, { pageIndex } = {}) {
  currentAssignment = assignment;
  currentCatalogItem = getWorkbookCatalogItem(assignment.workbookId);
  const pages = currentCatalogItem?.edition.pages || [];
  const savedIndex = Math.max(0, pages.findIndex((page) => page.pageId === assignment.lastPageId));
  currentPageIndex = Math.min(Math.max(0, Number.isInteger(pageIndex) ? pageIndex : savedIndex), Math.max(0, pages.length - 1));
  saveSelection({ assignmentId: assignment.assignmentId, workbookId: assignment.workbookId, pageIndex: currentPageIndex });
}

async function resolveSelectedAssignment() {
  const learner = await getActiveLearner();
  if (!learner) return null;
  const assignments = await ensureAssignments(learner.id, learner);
  const selection = getSelection();
  const selected = assignments.find((item) => item.assignmentId === selection.assignmentId) || assignments[0] || null;
  if (selected) {
    // Restore a selection only for its own assignment, and persist the same index once.
    await selectAssignment(selected, selected.assignmentId === selection.assignmentId ? { pageIndex: selection.pageIndex } : {});
  }
  return selected;
}

export async function renderBookshelfView() {
  const root = documentRef?.querySelector("#bookshelfGrid");
  if (!root) return;
  const learner = await getActiveLearner();
  if (!learner) {
    root.innerHTML = "<p>학습자를 먼저 선택해 주세요.</p>";
    return;
  }
  const assignments = await ensureAssignments(learner.id, learner);
  const cards = await Promise.all(assignments.map(async (assignment) => {
    const item = getWorkbookCatalogItem(assignment.workbookId);
    if (!item) return "";
    const pageProgress = await loadPageProgress(learner.id, item.edition);
    const progress = progressText(item.edition, pageProgress);
    return `
      <article class="workbook-cover-card" data-assignment-id="${escapeHtml(assignment.assignmentId)}">
        <div class="workbook-cover-subject">${escapeHtml(subjectLabel(item.definition.subjectId))}</div>
        <h2>${escapeHtml(item.definition.title)}</h2>
        <p>${escapeHtml(item.definition.description)}</p>
        <span class="workbook-legacy-label">${escapeHtml(workbookScopeLabel(item.definition))}</span>
        <div class="workbook-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent}">
          <i style="width:${progress.percent}%"></i>
        </div>
        <small>${progress.completed} / ${progress.total} 페이지</small>
        <button type="button" class="primary-action workbook-open-btn">문제집 열기</button>
      </article>`;
  }));
  root.innerHTML = cards.join("") || "<p>책장에 등록된 문제집이 없습니다.</p>";
  root.querySelectorAll(".workbook-cover-card").forEach((card) => {
    card.querySelector(".workbook-open-btn")?.addEventListener("click", async () => {
      const assignment = assignments.find((item) => item.assignmentId === card.dataset.assignmentId);
      if (!assignment) return;
      await selectAssignment(assignment);
      navigate(ROUTES.WORKBOOK_DETAIL);
    });
  });
}

export async function renderWorkbookDetailView() {
  const root = documentRef?.querySelector("#workbookDetailContent");
  if (!root) return;
  const assignment = await resolveSelectedAssignment();
  if (!assignment || !currentCatalogItem) {
    root.innerHTML = "<p>문제집을 찾을 수 없습니다.</p>";
    return;
  }
  const { definition, edition } = currentCatalogItem;
  const pageProgress = await loadPageProgress(assignment.learnerId, edition);
  const progress = progressText(edition, pageProgress);
  root.innerHTML = `
    <div class="workbook-detail-cover">
      <span>${escapeHtml(subjectLabel(definition.subjectId))}</span>
      <h1>${escapeHtml(definition.title)}</h1>
      <p>${escapeHtml(definition.description)}</p>
      <b>${escapeHtml(workbookScopeLabel(definition))}</b>
    </div>
    <div class="workbook-detail-body">
      <div class="workbook-detail-actions">
        <button type="button" id="workbookBackToShelfBtn" class="secondary-action">책장으로</button>
        <button type="button" id="workbookContinueBtn" class="primary-action">${assignment.lastPageId ? "이어서 풀기" : "처음부터 보기"}</button>
      </div>
      <h2>차례</h2>
      <ol class="workbook-toc">
        ${edition.pages.map((page, index) => `<li><button type="button" data-page-index="${index}"><span>${page.pageNumber}</span><strong>${escapeHtml(page.title)}</strong><small>${escapeHtml(pageProgressLabel(pageProgress.get(page.pageId)))}</small></button></li>`).join("")}
      </ol>
      <p>진행률 ${progress.percent}%</p>
    </div>`;
  root.querySelector("#workbookBackToShelfBtn")?.addEventListener("click", () => navigate(ROUTES.BOOKSHELF));
  root.querySelector("#workbookContinueBtn")?.addEventListener("click", () => navigate(ROUTES.WORKBOOK_READER));
  root.querySelectorAll("[data-page-index]").forEach((button) => button.addEventListener("click", async () => {
    try {
      await persistReaderPage(edition.pages[Number(button.dataset.pageIndex)]);
      navigate(ROUTES.WORKBOOK_READER);
    } catch {
      windowRef?.alert?.("저장에 실패하여 페이지를 이동하지 않았습니다.");
    }
  }));
}

async function persistReaderPage(page, options = {}) {
  if (!currentAssignment || !page) return false;
  const pageIndex = currentCatalogItem.edition.pages.findIndex((item) => item.pageId === page.pageId);
  if (pageIndex < 0) throw new Error("문제집 페이지를 찾을 수 없습니다.");
  if (typeof beforePageChange === "function") await beforePageChange();
  const nextAssignment = moveWorkbookAssignment(currentAssignment, page.pageId, options);
  const saved = await saveWorkbookAssignment(nextAssignment, { learnerId: currentAssignment.learnerId });
  // Commit memory/selection only after the target page and Draft have been saved.
  currentAssignment = saved;
  currentPageIndex = pageIndex;
  saveSelection({ assignmentId: currentAssignment.assignmentId, workbookId: currentAssignment.workbookId, pageIndex: currentPageIndex });
  return true;
}

function readerPageMarkup(page) {
  return `
    <article class="workbook-page" data-page-id="${escapeHtml(page.pageId)}">
      <header><span>${page.pageNumber}쪽</span><strong>${escapeHtml(page.title)}</strong></header>
      <div class="workbook-page-surface">
        <p>이 페이지의 학습 영역을 열어 문제를 풀어보세요.</p>
        ${page.launchTarget ? `<button type="button" class="primary-action workbook-launch-btn" data-launch-target="${escapeHtml(page.launchTarget)}">학습 시작</button>` : ""}
      </div>
      <footer>${page.pageNumber}</footer>
    </article>`;
}

export async function renderWorkbookReaderView() {
  const root = documentRef?.querySelector("#workbookReaderContent");
  const navigator = documentRef?.querySelector("#workbookPageNavigator");
  if (!root || !navigator) return;
  const assignment = await resolveSelectedAssignment();
  if (!assignment || !currentCatalogItem) {
    root.innerHTML = "<p>문제집을 찾을 수 없습니다.</p>";
    return;
  }
  const pages = currentCatalogItem.edition.pages;
  currentPageIndex = Math.min(Math.max(0, currentPageIndex), pages.length - 1);
  const spread = resolveWorkbookSpread(currentPageIndex, pages.length, windowRef?.innerWidth || 0);
  root.dataset.spreadMode = spread.mode;
  root.classList.toggle("two-page", spread.mode === "TWO_PAGE");
  root.innerHTML = spread.visibleIndexes.map((index) => readerPageMarkup(pages[index])).join("");
  navigator.innerHTML = `
    <button type="button" id="workbookReaderExitBtn" class="secondary-action">차례</button>
    <button type="button" id="workbookPrevPageBtn" ${currentPageIndex === 0 ? "disabled" : ""}>이전</button>
    <label>페이지 <select id="workbookPageSelect">${pages.map((page, index) => `<option value="${index}" ${index === currentPageIndex ? "selected" : ""}>${page.pageNumber}</option>`).join("")}</select></label>
    <button type="button" id="workbookBookmarkBtn">책갈피</button>
    <button type="button" id="workbookNextPageBtn" ${currentPageIndex >= pages.length - 1 ? "disabled" : ""}>다음</button>`;
  const move = async (nextIndex) => {
    const targetIndex = Math.min(Math.max(0, nextIndex), pages.length - 1);
    try {
      await persistReaderPage(pages[targetIndex]);
      await renderWorkbookReaderView();
    } catch (error) {
      navigator.querySelector("#workbookPageSelect").value = String(currentPageIndex);
      windowRef?.alert?.("저장에 실패하여 페이지를 이동하지 않았습니다.");
    }
  };
  navigator.querySelector("#workbookReaderExitBtn")?.addEventListener("click", async () => {
    try {
      await persistReaderPage(pages[currentPageIndex]);
      navigate(ROUTES.WORKBOOK_DETAIL);
    } catch {
      windowRef?.alert?.("저장에 실패하여 차례로 이동하지 않았습니다.");
    }
  });
  navigator.querySelector("#workbookPrevPageBtn")?.addEventListener("click", () => move(currentPageIndex - 1));
  navigator.querySelector("#workbookNextPageBtn")?.addEventListener("click", () => move(currentPageIndex + 1));
  navigator.querySelector("#workbookPageSelect")?.addEventListener("change", (event) => move(Number(event.target.value)));
  navigator.querySelector("#workbookBookmarkBtn")?.addEventListener("click", async () => {
    try {
      await persistReaderPage(pages[currentPageIndex], { bookmark: true });
      await renderWorkbookReaderView();
    } catch {
      windowRef?.alert?.("책갈피 저장에 실패했습니다.");
    }
  });
  root.querySelectorAll(".workbook-launch-btn").forEach((button) => button.addEventListener("click", async () => {
    const page = pages.find((item) => item.pageId === button.closest(".workbook-page")?.dataset.pageId);
    if (!page) return;
    try {
      await persistReaderPage(page);
      writeJson(windowRef?.sessionStorage, CONTEXT_KEY, {
        workbookId: currentAssignment.workbookId,
        workbookAssignmentId: currentAssignment.assignmentId,
        workbookEditionVersion: currentAssignment.editionVersion,
        workbookPageId: page.pageId,
        launchTarget: button.dataset.launchTarget,
        createdAt: Date.now()
      });
      navigate(button.dataset.launchTarget);
    } catch {
      windowRef?.alert?.("저장에 실패하여 학습을 시작하지 않았습니다.");
    }
  }));
}

export async function renderWorkbookRoute(path) {
  if (path === ROUTES.BOOKSHELF) return renderBookshelfView();
  if (path === ROUTES.WORKBOOK_DETAIL) return renderWorkbookDetailView();
  if (path === ROUTES.WORKBOOK_READER) return renderWorkbookReaderView();
}

export function initWorkbookView(options = {}) {
  documentRef = options.documentRef || (typeof document !== "undefined" ? document : null);
  windowRef = options.windowRef || (typeof window !== "undefined" ? window : null);
  beforePageChange = typeof options.beforePageChange === "function" ? options.beforePageChange : null;
  documentRef?.querySelector("#openBookshelfBtn")?.addEventListener("click", () => navigate(ROUTES.BOOKSHELF));
  let resizeTimer = null;
  windowRef?.addEventListener?.("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (documentRef?.querySelector("#workbookReaderView")?.hidden === false) renderWorkbookReaderView();
    }, 120);
  });
}
