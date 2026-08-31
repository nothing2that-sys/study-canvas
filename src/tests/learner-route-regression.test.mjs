//+_+// 학습자 추가 후 native form reload/Vercel 404 회귀 방지 테스트
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "fake-indexeddb/auto";

import { initLearnerView } from "../public/app/js/learners/learnerView.js";
import { getLearners, getActiveLearnerId } from "../public/app/js/learners/learnerQueries.js";
import { _resetLearnerSessionGuardForTesting } from "../public/app/js/learners/learnerCommands.js";
import { initRouter, getCurrentRoute, ROUTES, _resetRouterForTesting } from "../public/app/js/platform/appRouter.js";
import { clearAllData, _resetActiveLearnerInMemoryForTesting } from "../public/app/js/storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createFakeWindow(initialPath = ROUTES.LEARNERS) {
  let pathname = initialPath;
  return {
    location: { get pathname() { return pathname; } },
    history: {
      pushState(_state, _title, url) { pathname = url; },
      replaceState(_state, _title, url) { pathname = url; }
    },
    addEventListener() {},
    removeEventListener() {}
  };
}

function createFakeLearnerDocument() {
  const learnerForm = { onsubmit: null };
  const learnerNameInput = { value: "민준" };
  const learnerModal = {
    closed: false,
    close() { this.closed = true; }
  };
  const avatarGrid = {
    innerHTML: "",
    onclick: null,
    querySelectorAll() { return []; }
  };

  const elements = new Map([
    ["#learnerForm", learnerForm],
    ["#learnerNameInput", learnerNameInput],
    ["#learnerModal", learnerModal],
    ["#learnerAvatarList", avatarGrid]
  ]);

  return {
    learnerForm,
    learnerModal,
    querySelector(selector) {
      return elements.get(selector) || null;
    }
  };
}

async function resetEnvironment() {
  _resetRouterForTesting();
  _resetLearnerSessionGuardForTesting();
  _resetActiveLearnerInMemoryForTesting();
  await clearAllData();
}

test("Learner regression: 실제 learnerForm submit은 preventDefault 후 생성하고 SPA /home으로 이동한다", async () => {
  await resetEnvironment();

  const fakeWindow = createFakeWindow();
  initRouter({ initialPath: ROUTES.LEARNERS, windowRef: fakeWindow });

  const fakeDocument = createFakeLearnerDocument();
  initLearnerView({ documentRef: fakeDocument, isSessionActive: () => false });

  assert.equal(typeof fakeDocument.learnerForm.onsubmit, "function", "실제 #learnerForm에 submit handler가 연결되어야 함");

  let prevented = false;
  await fakeDocument.learnerForm.onsubmit({
    preventDefault() { prevented = true; }
  });

  assert.equal(prevented, true, "native form navigation을 막아야 함");
  const learners = await getLearners();
  assert.equal(learners.length, 1);
  assert.equal(learners[0].name, "민준");
  assert.equal(getActiveLearnerId(), learners[0].id, "신규 학습자는 생성 직후 활성 학습자가 되어야 함");
  assert.equal(getCurrentRoute(), ROUTES.HOME);
  assert.equal(fakeWindow.location.pathname, ROUTES.HOME, "브라우저 URL은 History API로 /home에 머물러야 함");
  assert.equal(fakeDocument.learnerModal.closed, true);
});

test("Learner regression: 현재 index.html의 학습자 DOM ID와 learnerView production selector가 일치한다", () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, "../public/app/index.html"), "utf8");
  const learnerViewSource = fs.readFileSync(path.join(__dirname, "../public/app/js/learners/learnerView.js"), "utf8");

  for (const id of ["learnerListContainer", "showArchivedBtn", "archivedLearnersSection", "learnerGreetingName", "homeSubjectGrid", "mathModuleGrid", "learnerForm", "learnerAvatarList", "learnerCancelBtn", "learnerModalCloseBtn"]) {
    assert.match(indexHtml, new RegExp(`id=["']${id}["']`), `index.html에 #${id}가 존재해야 함`);
    assert.match(learnerViewSource, new RegExp(`#${id}`), `learnerView가 실제 #${id}를 사용해야 함`);
  }
});

test("Learner regression: Vercel client route는 정적 asset 다음 SPA index fallback으로 처리한다", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, "../vercel.json"), "utf8"));
  assert.ok(Array.isArray(vercel.rewrites));
  assert.equal(vercel.rewrites.length, 1);
  assert.equal(vercel.rewrites[0].source, "/(.*)");
  assert.equal(vercel.rewrites[0].destination, "/index.html", "/home, /learners 등 client route는 SPA index로 fallback되어야 함");
});
