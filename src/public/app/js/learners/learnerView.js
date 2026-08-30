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

import { getLearnerHomeSummary } from "../data/learningQueries.js";
import { getAllSubjects, getSubject } from "../platform/subjectRegistry.js";
import { navigate, ROUTES } from "../platform/appRouter.js";

let dom = {};
let isSessionActiveFn = null;

//+_+// 학습자 뷰 초기화 및 이벤트 리스너 바인딩
export function initLearnerView(options = {}) {
  const doc = options.documentRef || (typeof document !== "undefined" ? document : null);
  if (!doc) return;

  if (options.isSessionActive) {
    isSessionActiveFn = options.isSessionActive;
  }

  dom = {
    //+_+// 학습자 선택 화면 요소
    learnerSelectView: doc.querySelector("#learnerSelectView"),
    activeLearnersList: doc.querySelector("#activeLearnersList"),
    addLearnerBtn: doc.querySelector("#addLearnerBtn"),
    archivedLearnersToggleBtn: doc.querySelector("#archivedLearnersToggleBtn"),
    archivedLearnersContainer: doc.querySelector("#archivedLearnersContainer"),
    archivedLearnersList: doc.querySelector("#archivedLearnersList"),

    //+_+// 통합 학습자 홈 요소
    learnerHomeView: doc.querySelector("#learnerHomeView"),
    homeLearnerAvatar: doc.querySelector("#homeLearnerAvatar"),
    homeLearnerGreeting: doc.querySelector("#homeLearnerGreeting"),
    subjectCardsGrid: doc.querySelector("#subjectCardsGrid"),
    recentLearningStats: doc.querySelector("#recentLearningStats"),

    //+_+// 과목 홈 요소
    subjectHomeView: doc.querySelector("#subjectHomeView"),
    subjectHomeTitle: doc.querySelector("#subjectHomeTitle"),
    subjectHomeDescription: doc.querySelector("#subjectHomeDescription"),
    moduleCardsGrid: doc.querySelector("#moduleCardsGrid"),
    backToHomeBtn: doc.querySelector("#backToHomeBtn"),

    //+_+// 학습자 모달 요소
    learnerModal: doc.querySelector("#learnerModal"),
    learnerModalTitle: doc.querySelector("#learnerModalTitle"),
    learnerNameInput: doc.querySelector("#learnerNameInput"),
    avatarOptionsGrid: doc.querySelector("#avatarOptionsGrid"),
    saveLearnerBtn: doc.querySelector("#saveLearnerBtn"),
    archiveLearnerBtn: doc.querySelector("#archiveLearnerBtn"),
    cancelLearnerModalBtn: doc.querySelector("#cancelLearnerModalBtn"),
    learnerModalError: doc.querySelector("#learnerModalError")
  };

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

  if (dom.saveLearnerBtn) {
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
  if (dom.homeLearnerGreeting) dom.homeLearnerGreeting.textContent = `${learner.name}님, 환영합니다!`;

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
