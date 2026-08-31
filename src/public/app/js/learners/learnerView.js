//+_+// Math Canvas Pro - 학습자 UI 뷰 렌더러 (Learner View)
//+_+// SSOT Section 6 & 8 및 Phase F3 재검토 명세 준수
//+_+// - 학습자 선택 화면 (#learnerSelectView)
//+_+// - 통합 학습자 홈 화면 (#learnerHomeView)
//+_+// - 과목 홈 화면 (#subjectHomeView)
//+_+// - 학습자 생성/수정/보관 모달 관리 (#learnerModal)
//+_+// - 활성 세션 진행 중 학습자 전환 원천 차단

import {
  createLearner,
  updateLearner,
  archiveLearner,
  restoreLearner,
  selectLearner
} from "./learnerCommands.js";

import {
  getActiveLearner,
  getActiveLearnerId,
  getLearners,
  getArchivedLearnersList,
  getLearnerById
} from "./learnerQueries.js";

import { getLearnerHomeSummary, getAllSubmissions } from "../data/learningQueries.js";
import { getAllSubjects, getSubject } from "../platform/subjectRegistry.js";
import { navigate, ROUTES } from "../platform/appRouter.js";

let dom = {};
let isSessionActiveFn = null;
let openPendingGradingFn = null;

const DEFAULT_AVATARS = ["🌱", "🚀", "⭐", "🦊", "🐳", "🐰", "🦖", "🦁"];

function queryFirst(doc, ...selectors) {
  for (const selector of selectors) {
    const element = doc.querySelector(selector);
    if (element) return element;
  }
  return null;
}

//+_+// 현재 index.html의 learnerAvatarList가 비어 있어도 학습자 모달에서 기본 아바타를 선택할 수 있게 보장
function ensureAvatarOptions() {
  if (!dom.avatarOptionsGrid) return;
  const existing = dom.avatarOptionsGrid.querySelectorAll(".avatar-choice-btn");
  if (existing && existing.length > 0) return;

  dom.avatarOptionsGrid.innerHTML = DEFAULT_AVATARS.map((avatar) => `
    <button type="button" class="avatar-choice-btn${avatar === selectedAvatarKey ? " selected" : ""}" data-avatar="${avatar}" aria-label="${avatar} 아바타 선택">
      ${avatar}
    </button>
  `).join("");
}

//+_+// 학습자 뷰 초기화 및 이벤트 리스너 바인딩
export function initLearnerView(options = {}) {
  const doc = options.documentRef || (typeof document !== "undefined" ? document : null);
  if (!doc) return;

  if (options.isSessionActive) {
    isSessionActiveFn = options.isSessionActive;
  }
  if (options.onOpenPendingGrading) {
    openPendingGradingFn = options.onOpenPendingGrading;
  }

  dom = {
    //+_+// 학습자 선택 화면 요소 - 현재 index.html ID를 우선하고 이전 ID는 호환 fallback으로 유지
    learnerSelectView: doc.querySelector("#learnerSelectView"),
    activeLearnersList: queryFirst(doc, "#learnerListContainer", "#activeLearnersList"),
    addLearnerBtn: doc.querySelector("#addLearnerBtn"),
    archivedLearnersToggleBtn: queryFirst(doc, "#showArchivedBtn", "#archivedLearnersToggleBtn"),
    archivedLearnersContainer: queryFirst(doc, "#archivedLearnersSection", "#archivedLearnersContainer"),
    archivedLearnersList: doc.querySelector("#archivedLearnersList"),

    //+_+// 통합 학습자 홈 요소
    learnerHomeView: doc.querySelector("#learnerHomeView"),
    homeLearnerAvatar: doc.querySelector("#homeLearnerAvatar"),
    homeLearnerGreeting: queryFirst(doc, "#learnerGreetingName", "#homeLearnerGreeting"),
    subjectCardsGrid: queryFirst(doc, "#homeSubjectGrid", "#subjectCardsGrid"),
    recentLearningStats: doc.querySelector("#recentLearningStats"),

    //+_+// 과목 홈 요소
    subjectHomeView: doc.querySelector("#subjectHomeView"),
    subjectHomeTitle: queryFirst(doc, "#mathSubjectTitle", "#subjectHomeTitle"),
    subjectHomeDescription: doc.querySelector("#subjectHomeDescription"),
    moduleCardsGrid: queryFirst(doc, "#mathModuleGrid", "#moduleCardsGrid"),
    backToHomeBtn: doc.querySelector("#backToHomeBtn"),

    //+_+// 학습자 모달 요소
    learnerModal: doc.querySelector("#learnerModal"),
    learnerForm: doc.querySelector("#learnerForm"),
    learnerModalTitle: doc.querySelector("#learnerModalTitle"),
    learnerNameInput: doc.querySelector("#learnerNameInput"),
    avatarOptionsGrid: queryFirst(doc, "#learnerAvatarList", "#avatarOptionsGrid"),
    saveLearnerBtn: doc.querySelector("#saveLearnerBtn"),
    archiveLearnerBtn: doc.querySelector("#archiveLearnerBtn"),
    cancelLearnerModalBtn: queryFirst(doc, "#learnerCancelBtn", "#cancelLearnerModalBtn"),
    closeLearnerModalBtn: doc.querySelector("#learnerModalCloseBtn"),
    learnerModalError: doc.querySelector("#learnerModalError")
  };

  ensureAvatarOptions();
  bindEvents();
}

let editingLearnerId = null;
let selectedAvatarKey = "🌱";

function bindEvents() {
  if (dom.addLearnerBtn) {
    dom.addLearnerBtn.onclick = () => openLearnerModal(null);
  }

  if (dom.archivedLearnersToggleBtn) {
    dom.archivedLearnersToggleBtn.onclick = () => {
      if (dom.archivedLearnersContainer) {
        const isHidden = dom.archivedLearnersContainer.hidden;
        dom.archivedLearnersContainer.hidden = !isHidden;
        dom.archivedLearnersToggleBtn.textContent = isHidden
          ? "보관된 학습자 접기"
          : "보관된 학습자 보기";
        if (isHidden) {
          renderArchivedLearners();
        }
      }
    };
  }

  if (dom.cancelLearnerModalBtn) {
    dom.cancelLearnerModalBtn.onclick = () => closeLearnerModal();
  }

  if (dom.closeLearnerModalBtn) {
    dom.closeLearnerModalBtn.onclick = () => closeLearnerModal();
  }

  //+_+// 실제 HTML은 type=submit 버튼을 사용하므로 form submit을 차단하고 SPA 내부 Command/Router 흐름으로 저장한다.
  if (dom.learnerForm) {
    dom.learnerForm.onsubmit = async (event) => {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      await handleSaveLearner();
    };
  } else if (dom.saveLearnerBtn) {
    //+_+// 이전 마크업 호환 fallback
    dom.saveLearnerBtn.onclick = async () => {
      await handleSaveLearner();
    };
  }

  if (dom.archiveLearnerBtn) {
    dom.archiveLearnerBtn.onclick = async () => {
      await handleArchiveLearner();
    };
  }

  if (dom.avatarOptionsGrid) {
    dom.avatarOptionsGrid.onclick = (e) => {
      const btn = e.target.closest(".avatar-choice-btn");
      if (!btn) return;
      selectedAvatarKey = btn.dataset.avatar || "🌱";
      dom.avatarOptionsGrid.querySelectorAll(".avatar-choice-btn").forEach((b) => {
        b.classList.toggle("selected", b.dataset.avatar === selectedAvatarKey);
      });
    };
  }

  if (dom.backToHomeBtn) {
    dom.backToHomeBtn.onclick = () => navigate(ROUTES.HOME);
  }
}

//+_+// 학습자 선택 화면 렌더링
export async function renderLearnerSelectView() {
  if (!dom.activeLearnersList) return;

  const learners = await getLearners();
  const activeId = getActiveLearnerId();

  dom.activeLearnersList.innerHTML = "";

  if (learners.length === 0) {
    dom.activeLearnersList.innerHTML = `
      <div class="empty-learners-message">
        <p>등록된 학습자가 없습니다.</p>
        <p class="subtitle">새 학습자를 추가하여 학습을 시작하세요!</p>
      </div>
    `;
    return;
  }

  learners.forEach((learner) => {
    const card = document.createElement("div");
    card.className = `learner-card ${learner.id === activeId ? "active-learner-card" : ""}`;
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `${learner.name} 학습자 선택`);

    card.innerHTML = `
      <div class="learner-card-avatar">${escapeHtml(learner.avatar || "🌱")}</div>
      <div class="learner-card-info">
        <div class="learner-card-name">${escapeHtml(learner.name)}</div>
        <div class="learner-card-badge">${learner.id === activeId ? "최근 학습" : "학습자"}</div>
      </div>
      <button type="button" class="edit-learner-btn icon-btn" title="프로필 수정" aria-label="프로필 수정">
        ✏️
      </button>
    `;

    //+_+// 카드 클릭 시 학습자 선택 (활성 세션 중 변경 차단)
    card.onclick = async (e) => {
      if (e.target.closest(".edit-learner-btn")) return;

      if (isSessionActiveFn && isSessionActiveFn()) {
        const msg = "현재 학습 세션이 진행 중입니다. 학습자를 변경하려면 먼저 세션을 종료해야 합니다.";
        if (typeof window !== "undefined" && typeof window.alert === "function") {
          window.alert(msg);
        } else {
          console.warn(`[LearnerView] ${msg}`);
        }
        return;
      }

      await selectLearner(learner.id);
      navigate(ROUTES.HOME);
    };

    const editBtn = card.querySelector(".edit-learner-btn");
    if (editBtn) {
      editBtn.onclick = (e) => {
        e.stopPropagation();
        openLearnerModal(learner.id);
      };
    }

    dom.activeLearnersList.appendChild(card);
  });
}

//+_+// 보관된 학습자 목록 렌더링
export async function renderArchivedLearners() {
  if (!dom.archivedLearnersList) return;

  const archived = await getArchivedLearnersList();
  dom.archivedLearnersList.innerHTML = "";

  if (archived.length === 0) {
    dom.archivedLearnersList.innerHTML = `<p class="empty-hint">보관된 학습자가 없습니다.</p>`;
    return;
  }

  archived.forEach((learner) => {
    const item = document.createElement("div");
    item.className = "archived-learner-item";
    item.innerHTML = `
      <div class="archived-info">
        <span class="avatar">${escapeHtml(learner.avatar || "🌱")}</span>
        <span class="name">${escapeHtml(learner.name)}</span>
      </div>
      <button type="button" class="btn secondary sm restore-btn">보관 해제</button>
    `;

    const restoreBtn = item.querySelector(".restore-btn");
    if (restoreBtn) {
      restoreBtn.onclick = async () => {
        await restoreLearner(learner.id);
        await renderLearnerSelectView();
        await renderArchivedLearners();
      };
    }

    dom.archivedLearnersList.appendChild(item);
  });
}

//+_+// 통합 학습자 홈 (#learnerHomeView) 렌더링
export async function renderLearnerHomeView() {
  const learner = await getActiveLearner();
  if (!learner) return;

  if (dom.homeLearnerAvatar) dom.homeLearnerAvatar.textContent = learner.avatar || "🌱";
  if (dom.homeLearnerGreeting) {
    dom.homeLearnerGreeting.textContent = dom.homeLearnerGreeting.id === "learnerGreetingName"
      ? learner.name
      : `${learner.name}님, 환영합니다!`;
  }

  //+_+// Phase F5: 활성 학습자의 보호자 채점 대기 또는 진행 중 Submission을 홈에 표시한다.
  if (dom.learnerHomeView) {
    let gradingEntry = dom.learnerHomeView.querySelector("#pendingParentGradingEntry");
    const submissions = await getAllSubmissions({ learnerId: learner.id });
    const pendingSubmission = submissions.find((submission) => (
      submission.status === "PARENT_GRADING_PENDING" || submission.status === "GRADING_ACTIVE"
    ));
    if (!pendingSubmission) {
      gradingEntry?.remove();
    } else {
      if (!gradingEntry) {
        gradingEntry = document.createElement("section");
        gradingEntry.id = "pendingParentGradingEntry";
        gradingEntry.className = "parent-grading-home-entry";
        dom.learnerHomeView.querySelector(".subject-section")?.before(gradingEntry);
      }
      const progress = pendingSubmission.gradingProgress || {};
      gradingEntry.innerHTML = `
        <div>
          <p class="eyebrow">보호자 채점</p>
          <h2>${pendingSubmission.status === "GRADING_ACTIVE" ? "진행 중인 채점을 이어가세요" : "채점을 기다리는 풀이가 있어요"}</h2>
          <p>${progress.graded || 0} / ${progress.total || pendingSubmission.questions?.length || 0} 문제 채점 완료</p>
        </div>
        <button type="button" class="primary-action" id="openPendingGradingBtn">${pendingSubmission.status === "GRADING_ACTIVE" ? "채점 이어하기" : "보호자 채점 열기"}</button>
      `;
      gradingEntry.querySelector("#openPendingGradingBtn")?.addEventListener("click", () => {
        openPendingGradingFn?.(pendingSubmission);
      });
    }
  }

  //+_+// 과목 목록 렌더링
  if (dom.subjectCardsGrid) {
    const subjects = getAllSubjects();
    dom.subjectCardsGrid.innerHTML = "";

    subjects.forEach((subj) => {
      const card = document.createElement("div");
      card.className = `subject-card ${subj.enabled ? "enabled" : "disabled"}`;
      card.setAttribute("role", subj.enabled ? "button" : "region");
      if (subj.enabled) card.setAttribute("tabindex", "0");

      card.innerHTML = `
        <div class="subject-card-icon">${escapeHtml(subj.icon || "📚")}</div>
        <div class="subject-card-content">
          <div class="subject-card-title">${escapeHtml(subj.title)}</div>
          <div class="subject-card-desc">${escapeHtml(subj.description)}</div>
        </div>
        <div class="subject-card-status">
          ${subj.enabled ? '<span class="status-badge active">학습하기</span>' : '<span class="status-badge coming-soon">준비 중</span>'}
        </div>
      `;

      if (subj.enabled) {
        card.onclick = () => {
          navigate(subj.entryRoute);
        };
      }

      dom.subjectCardsGrid.appendChild(card);
    });
  }

  //+_+// 최근 학습 요약 통계 렌더링
  if (dom.recentLearningStats) {
    try {
      const summary = await getLearnerHomeSummary(learner.id);
      dom.recentLearningStats.innerHTML = `
        <div class="stats-summary-card">
          <div class="stat-item">
            <span class="stat-label">완료한 학습</span>
            <span class="stat-value">${summary.recentSessionsCount}회</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">평균 정답률</span>
            <span class="stat-value">${summary.stats?.accuracyRate || 0}%</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">연속 학습</span>
            <span class="stat-value">${summary.currentStreak}일 🔥</span>
          </div>
        </div>
      `;
    } catch (statsErr) {
      dom.recentLearningStats.innerHTML = "";
    }
  }
}

//+_+// 수학 과목 홈 (#subjectHomeView) 렌더링
export async function renderSubjectHomeView() {
  const math = getSubject("math");
  if (!math) return;

  if (dom.subjectHomeTitle) dom.subjectHomeTitle.textContent = "수학 학습관";
  if (dom.subjectHomeDescription) dom.subjectHomeDescription.textContent = math.description;

  if (dom.moduleCardsGrid) {
    dom.moduleCardsGrid.innerHTML = "";

    (math.modules || []).forEach((mod) => {
      const card = document.createElement("div");
      const isEnabled = mod.status === "active";
      card.className = `module-card ${isEnabled ? "enabled" : "disabled"}`;
      card.setAttribute("role", isEnabled ? "button" : "region");
      if (isEnabled) card.setAttribute("tabindex", "0");

      card.innerHTML = `
        <div class="module-card-icon">${escapeHtml(mod.icon || "✏️")}</div>
        <div class="module-card-content">
          <div class="module-card-title">${escapeHtml(mod.title)}</div>
          <div class="module-card-desc">${escapeHtml(mod.description)}</div>
        </div>
        <div class="module-card-status">
          ${isEnabled ? '<span class="status-badge active">시작하기</span>' : '<span class="status-badge coming-soon">준비 중</span>'}
        </div>
      `;

      if (isEnabled) {
        card.onclick = () => {
          navigate(mod.route);
        };
      }

      dom.moduleCardsGrid.appendChild(card);
    });
  }
}

//+_+// 학습자 생성/수정 모달 열기
export async function openLearnerModal(learnerId = null) {
  editingLearnerId = learnerId;
  if (!dom.learnerModal) return;

  if (dom.learnerModalError) dom.learnerModalError.hidden = true;

  if (learnerId) {
    const learner = await getLearnerById(learnerId);
    if (!learner) return;
    if (dom.learnerModalTitle) dom.learnerModalTitle.textContent = "학습자 프로필 수정";
    if (dom.learnerNameInput) dom.learnerNameInput.value = learner.name;
    selectedAvatarKey = learner.avatar || "🌱";
    if (dom.archiveLearnerBtn) dom.archiveLearnerBtn.hidden = false;
  } else {
    if (dom.learnerModalTitle) dom.learnerModalTitle.textContent = "새 학습자 추가";
    if (dom.learnerNameInput) dom.learnerNameInput.value = "";
    selectedAvatarKey = "🌱";
    if (dom.archiveLearnerBtn) dom.archiveLearnerBtn.hidden = true;
  }

  ensureAvatarOptions();

  //+_+// 아바타 그리드 선택 상태 갱신
  if (dom.avatarOptionsGrid) {
    dom.avatarOptionsGrid.querySelectorAll(".avatar-choice-btn").forEach((b) => {
      b.classList.toggle("selected", b.dataset.avatar === selectedAvatarKey);
    });
  }

  if (typeof dom.learnerModal.showModal === "function") {
    dom.learnerModal.showModal();
  }
}

//+_+// 학습자 모달 닫기
export function closeLearnerModal() {
  if (dom.learnerModal && typeof dom.learnerModal.close === "function") {
    dom.learnerModal.close();
  }
  editingLearnerId = null;
}

//+_+// 학습자 저장 (생성 또는 수정)
async function handleSaveLearner() {
  const name = dom.learnerNameInput ? dom.learnerNameInput.value.trim() : "";
  if (!name) {
    if (dom.learnerModalError) {
      dom.learnerModalError.textContent = "이름을 입력해주세요.";
      dom.learnerModalError.hidden = false;
    }
    return;
  }

  try {
    if (editingLearnerId) {
      await updateLearner(editingLearnerId, {
        name,
        avatar: selectedAvatarKey,
        icon: selectedAvatarKey,
        avatarKey: selectedAvatarKey
      });
    } else {
      await createLearner({
        name,
        avatar: selectedAvatarKey,
        icon: selectedAvatarKey,
        avatarKey: selectedAvatarKey
      });
    }
    closeLearnerModal();
    navigate(ROUTES.HOME);
  } catch (error) {
    if (dom.learnerModalError) {
      dom.learnerModalError.textContent = error.message || "저장에 실패했습니다.";
      dom.learnerModalError.hidden = false;
    } else {
      console.error("[LearnerView] 학습자 저장 실패:", error);
    }
  }
}

//+_+// 학습자 보관 처리
async function handleArchiveLearner() {
  if (!editingLearnerId) return;

  const confirmed = typeof window !== "undefined" && typeof window.confirm === "function"
    ? window.confirm("이 학습자를 보관하시겠습니까? 학습 기록은 안전하게 보존되며 나중에 다시 복원할 수 있습니다.")
    : true;

  if (!confirmed) return;

  try {
    await archiveLearner(editingLearnerId);
    closeLearnerModal();
    await renderLearnerSelectView();
  } catch (error) {
    if (dom.learnerModalError) {
      dom.learnerModalError.textContent = error.message || "보관 처리에 실패했습니다.";
      dom.learnerModalError.hidden = false;
    }
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
