import { getSessionHistoryLabel } from "../sessionHistoryLabel.js";
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

import { getLearnerDashboard, getLearnerHomeSummary, getAllSubmissions, getActiveReviewItems, getLearningRecommendations } from "../data/learningQueries.js";
import { getAllSubjects, getSubject } from "../platform/subjectRegistry.js";
import { navigate, ROUTES } from "../platform/appRouter.js";
import { formatTime } from "../timer.js";
import { resolvePracticeRoute, resolveLandingRoute } from "../learningRouteResolver.js";
import { clearDraft } from "../data/learningCommands.js";
import { getDraftVersion } from "../draftEngine.js";

let dom = {};
let isSessionActiveFn = null;
let openPendingGradingFn = null;
let openReviewQueueFn = null;
let restoreDraftFn = null;
let showSessionDetailFn = null;

export function setOpenPendingGradingHandler(fn) {
  openPendingGradingFn = fn;
}

export function setOpenReviewQueueHandler(fn) {
  openReviewQueueFn = fn;
}

export function setRestoreDraftHandler(fn) {
  restoreDraftFn = fn;
}

export function setShowSessionDetailHandler(fn) {
  showSessionDetailFn = fn;
}

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
  if (options.onOpenReviewQueue) {
    openReviewQueueFn = options.onOpenReviewQueue;
  }
  if (options.onRestoreDraftSession) {
    restoreDraftFn = options.onRestoreDraftSession;
  }
  if (options.onShowSessionDetail) {
    showSessionDetailFn = options.onShowSessionDetail;
  }

  dom = {
    //+_+// 학습자 선택 화면 요소 - 현재 index.html ID를 우선하고 이전 ID는 호환 fallback으로 유지
    learnerSelectView: doc.querySelector("#learnerSelectView"),
    activeLearnersList: queryFirst(doc, "#learnerListContainer", "#activeLearnersList"),
    addLearnerBtn: doc.querySelector("#addLearnerBtn"),
    archivedLearnersToggleBtn: queryFirst(doc, "#showArchivedBtn", "#archivedLearnersToggleBtn"),
    archivedLearnersContainer: queryFirst(doc, "#archivedLearnersSection", "#archivedLearnersContainer"),
    archivedLearnersList: doc.querySelector("#archivedLearnersList"),

    //+_+// 통합 학습자 홈 요소 (Phase F8 Read Model 기반)
    learnerHomeView: doc.querySelector("#learnerHomeView"),
    homeLearnerAvatar: doc.querySelector("#homeLearnerAvatar"),
    homeLearnerGreeting: queryFirst(doc, "#learnerGreetingName", "#homeLearnerGreeting"),
    homeActionCardsSection: doc.querySelector("#homeActionCardsSection"),
    //+_+// Phase F9: 오늘의 추천 섹션 요소
    homeRecommendationSection: doc.querySelector("#homeRecommendationSection"),
    homeOverallStatsSection: doc.querySelector("#homeOverallStatsSection"),
    subjectCardsGrid: queryFirst(doc, "#homeSubjectGrid", "#subjectCardsGrid"),
    recentSessionsSection: doc.querySelector("#homeRecentSessionsSection"),
    recentSessionsList: queryFirst(doc, "#homeRecentSessionsList", "#recentSessionsList"),
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
    learnerSchoolGradeInput: doc.querySelector("#learnerSchoolGradeInput"),
    learnerAllowPreviewInput: doc.querySelector("#learnerAllowPreviewInput"),
    learnerAllowAdvancedInput: doc.querySelector("#learnerAllowAdvancedInput"),
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
        <div class="learner-card-badge">${learner.schoolGrade ? `초등 ${learner.schoolGrade}학년` : "학년 설정 필요"}${learner.id === activeId ? " · 최근 학습" : ""}</div>
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

//+_+// Phase F8: 통합 학습자 홈 (#learnerHomeView) 렌더링
export async function renderLearnerHomeView() {
  const learner = await getActiveLearner();
  if (!learner) return;

  if (dom.homeLearnerAvatar) dom.homeLearnerAvatar.textContent = learner.avatar || "🌱";
  if (dom.homeLearnerGreeting) {
    dom.homeLearnerGreeting.textContent = dom.homeLearnerGreeting.id === "learnerGreetingName"
      ? learner.name
      : `${learner.name}님, 환영합니다!`;
  }

  // Phase F8 단일 Read Model 쿼리
  const dashboard = await getLearnerDashboard(learner.id);
  if (!dashboard || getActiveLearnerId() !== learner.id) return;

  // 1. Action Cards 렌더링 (#homeActionCardsSection)
  // 우선순위: 1) 채점 대기/진행 중, 2) 복습 필요, 3) 이어서 풀기
  const actionSection = dom.homeActionCardsSection || dom.learnerHomeView?.querySelector("#homeActionCardsSection");
  if (actionSection) {
    actionSection.innerHTML = "";
    const { pendingGrading = [], reviewRequired = [], inProgress = [], recoveryDrafts = [] } = dashboard.actionCards;

    // 1) 보호자 채점 대기/진행 중
    if (pendingGrading.length > 0) {
      const topPending = pendingGrading[0];
      const entry = document.createElement("section");
      entry.id = "pendingParentGradingEntry";
      entry.className = "parent-grading-home-entry action-card";
      entry.setAttribute("role", "region");
      entry.setAttribute("aria-label", "보호자 채점");
      entry.innerHTML = `
        <div class="action-card-copy">
          <p class="eyebrow">보호자 채점</p>
          <h2>${escapeHtml(topPending.title)}</h2>
          <p>${topPending.gradedQuestions} / ${topPending.totalQuestions} 문제 채점 완료</p>
        </div>
        <button type="button" class="primary-action" id="openPendingGradingBtn" aria-label="${escapeHtml(topPending.actionLabel)}">
          ${escapeHtml(topPending.actionLabel)}
        </button>
      `;
      entry.querySelector("#openPendingGradingBtn")?.addEventListener("click", () => {
        openPendingGradingFn?.(topPending.rawSubmission);
      });
      actionSection.appendChild(entry);
    }

    // 2) 복습 필요
    if (reviewRequired.length > 0) {
      const retryingCount = reviewRequired.filter((i) => i.state === "retrying").length;
      const pendingCount = reviewRequired.filter((i) => i.state === "review_pending").length;
      const unresolvedCount = reviewRequired.filter((i) => i.state === "unresolved").length;

      let desc = `복습 필요 ${unresolvedCount}개`;
      if (retryingCount > 0) desc += ` · 다시 푸는 중 ${retryingCount}개`;
      if (pendingCount > 0) desc += ` · 보호자 확인 대기 ${pendingCount}개`;

      const entry = document.createElement("section");
      entry.id = "activeReviewQueueEntry";
      entry.className = "review-queue-home-entry action-card";
      entry.setAttribute("role", "region");
      entry.setAttribute("aria-label", "오답 함께 보기");
      entry.innerHTML = `
        <div class="action-card-copy">
          <p class="eyebrow">오답 함께 보기</p>
          <h2>함께 복습할 오답이 ${reviewRequired.length}개 있어요</h2>
          <p>${desc}</p>
        </div>
        <button type="button" class="primary-action review-open-btn" id="openReviewQueueBtn" aria-label="오답 함께 보기">
          오답 함께 보기
        </button>
      `;
      entry.querySelector("#openReviewQueueBtn")?.addEventListener("click", () => {
        openReviewQueueFn?.(reviewRequired);
      });
      actionSection.appendChild(entry);
    }

    // 3) 이어서 풀기
    if (inProgress.length > 0) {
      const topDraft = inProgress[0];
      const entry = document.createElement("section");
      entry.id = "inProgressSessionEntry";
      entry.className = "in-progress-home-entry action-card";
      entry.setAttribute("role", "region");
      entry.setAttribute("aria-label", "풀이 이어서 하기");
      entry.innerHTML = `
        <div class="action-card-copy">
          <p class="eyebrow">풀이 중인 학습</p>
          <h2>${escapeHtml(topDraft.levelName || "연산 학습")} 풀이를 이어하세요</h2>
          <p>진행: ${topDraft.solvedQuestions} / ${topDraft.totalQuestions} 문제 작성</p>
        </div>
        <button type="button" class="primary-action resume-draft-btn" id="resumeDraftBtn" aria-label="이어서 풀기">
          이어서 풀기
        </button>
      `;
      entry.querySelector("#resumeDraftBtn")?.addEventListener("click", () => {
        if (restoreDraftFn) {
          restoreDraftFn(topDraft.rawDraft);
        } else {
          const targetPracticeRoute = resolvePracticeRoute({
            subjectId: topDraft.rawDraft?.subjectId,
            courseId: topDraft.rawDraft?.config?.courseId || topDraft.rawDraft?.courseId,
            moduleId: topDraft.rawDraft?.config?.moduleId || topDraft.rawDraft?.moduleId
          });
          navigate(targetPracticeRoute);
        }
      });
      actionSection.appendChild(entry);
    }

    for (const recovery of recoveryDrafts) {
      const draft = recovery.rawDraft;
      const entry = document.createElement("section");
      entry.className = "in-progress-home-entry action-card";
      entry.id = "draftRecoveryEntry";
      entry.setAttribute("role", "region");
      entry.setAttribute("aria-label", "저장된 풀이 복구");
      entry.innerHTML = `
        <div class="action-card-copy">
          <p class="eyebrow">저장된 풀이 확인 필요</p>
          <h2>새 학습을 시작하기 전에 저장본을 확인해 주세요</h2>
          <p>${recovery.hasSubmission
            ? "제출된 학습의 임시 저장본이 남아 있습니다. 제출 기록은 그대로 유지됩니다."
            : "이 저장본은 바로 이어풀 수 없는 상태입니다. 문제와 필기를 내려받아 보관할 수 있습니다."}</p>
        </div>
        <button type="button" class="secondary-action" id="downloadRecoveryDraftBtn">저장본 내려받기</button>
        <button type="button" class="secondary-action" id="discardRecoveryDraftBtn">이 임시 저장본 삭제</button>`;
      entry.querySelector("#downloadRecoveryDraftBtn").addEventListener("click", () => {
        if (getActiveLearnerId() !== learner.id) return;
        const url = URL.createObjectURL(new Blob([JSON.stringify({ format: "math-canvas-draft-recovery-v1", draft }, null, 2)], { type: "application/json" }));
        const anchor = document.createElement("a");
        anchor.href = url; anchor.download = "math-canvas-saved-practice.json";
        anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
      const discardButton = entry.querySelector("#discardRecoveryDraftBtn");
      discardButton.addEventListener("click", async () => {
        if (getActiveLearnerId() !== learner.id) return;
        if (isSessionActiveFn?.()) {
          window.alert("열려 있는 학습을 먼저 종료한 뒤 다시 확인해 주세요.");
          return;
        }
        if (!window.confirm("이 임시 저장본의 문제와 필기를 삭제할까요? 되돌릴 수 없으므로 필요한 내용은 먼저 내려받아 주세요. 제출된 학습 기록은 삭제하지 않습니다.")) return;
        if (getActiveLearnerId() !== learner.id) return;
        discardButton.disabled = true;
        try {
          const version = getDraftVersion(draft);
          const removed = await clearDraft({ learnerId: learner.id, expectedSessionId: version.sessionId,
            expectedUpdatedAt: version.updatedAt, expectedRevision: version.revision, expectedWriteId: version.writeId,
            expectedRecoveryToken: recovery.recoveryToken });
          if (!removed) window.alert("다른 화면에서 저장본이 변경되어 삭제하지 않았습니다. 최신 저장본을 다시 확인해 주세요.");
          if (getActiveLearnerId() === learner.id) await renderLearnerHomeView();
        } catch (error) {
          window.alert("저장본을 삭제하지 못했습니다. 내용은 유지됩니다. 다시 시도해 주세요.");
        } finally { discardButton.disabled = false; }
      });
      actionSection.appendChild(entry);
    }

    actionSection.hidden = (pendingGrading.length === 0 && reviewRequired.length === 0 && inProgress.length === 0 && recoveryDrafts.length === 0);
  }

  //+_+// Phase F9: 오늘의 추천 렌더링 (#homeRecommendationSection)
  const recSection = dom.homeRecommendationSection || dom.learnerHomeView?.querySelector("#homeRecommendationSection");
  if (recSection) {
    const recData = dashboard.recommendations || await getLearningRecommendations(learner.id);
    const topRec = recData?.topRecommendation;
    const candidates = recData?.candidates || [];

    if (!topRec) {
      recSection.innerHTML = `
        <div class="recommendation-empty-card" role="region" aria-label="오늘의 추천">
          <div class="recommendation-header">
            <span class="eyebrow">오늘의 추천</span>
          </div>
          <h2 class="recommendation-title">모든 주요 할 일을 완료했어요!</h2>
          <p class="recommendation-desc">새로운 학습을 시작하거나 아래 과목을 선택해 자유롭게 공부해 보세요.</p>
        </div>
      `;
    } else {
      let actorBadgeClass = "actor-learner";
      let actorBadgeText = "아이 할 일";
      if (topRec.actor === "guardian") {
        actorBadgeClass = "actor-guardian";
        actorBadgeText = "보호자 할 일";
      } else if (topRec.actor === "family") {
        actorBadgeClass = "actor-family";
        actorBadgeText = "함께 할 일";
      }

      let workloadHtml = "";
      if (topRec.estimatedProblemCount !== null && topRec.estimatedProblemCount !== undefined) {
        workloadHtml += `<span class="workload-pill">${topRec.estimatedProblemCount}문제</span>`;
      }
      if (topRec.estimatedDurationMs !== null && topRec.estimatedDurationMs !== undefined && topRec.estimatedDurationMs > 0) {
        workloadHtml += `<span class="workload-pill">${formatTime(topRec.estimatedDurationMs, "korean")}</span>`;
      }

      const alternatives = candidates.slice(1, 3);
      let alternativesHtml = "";
      if (alternatives.length > 0) {
        alternativesHtml = `
          <div class="rec-alternatives-container">
            <span class="rec-alternatives-label">다른 추천:</span>
            <div class="rec-alternatives-chips">
              ${alternatives.map((alt, altIdx) => `
                <button type="button" class="rec-alt-chip" data-alt-idx="${altIdx}" aria-label="${escapeHtml(alt.reasonText)}">
                  <span class="alt-chip-tier">Tier ${alt.priorityTier}</span>
                  <span class="alt-chip-reason">${escapeHtml(alt.reasonText)}</span>
                  <span class="alt-chip-action">${escapeHtml(alt.action.label)} →</span>
                </button>
              `).join("")}
            </div>
          </div>
        `;
      }

      recSection.innerHTML = `
        <div class="recommendation-card" role="region" aria-label="오늘의 추천">
          <div class="recommendation-header">
            <div class="recommendation-badge-group">
              <span class="eyebrow">오늘의 추천</span>
              <span class="rec-actor-badge ${actorBadgeClass}">${actorBadgeText}</span>
              ${workloadHtml}
            </div>
          </div>
          <div class="recommendation-body">
            <h2 class="recommendation-title">${escapeHtml(topRec.reasonText)}</h2>
            <p class="recommendation-desc">우선순위가 가장 높은 학습 활동을 바로 진행할 수 있어요.</p>
          </div>
          <div class="recommendation-footer">
            <button type="button" class="primary-action rec-main-action-btn" id="topRecActionBtn" aria-label="${escapeHtml(topRec.action.label)}">
              ${escapeHtml(topRec.action.label)}
            </button>
          </div>
          ${alternativesHtml}
        </div>
      `;

      const executeAction = (actionCandidate) => {
        if (!actionCandidate || !actionCandidate.action) return;
        const kind = actionCandidate.action.kind;
        if (kind === "OPEN_GRADING") {
          openPendingGradingFn?.(actionCandidate.rawItem || { id: actionCandidate.action.targetId });
        } else if (kind === "OPEN_REVIEW") {
          openReviewQueueFn?.(actionCandidate.rawItem ? [actionCandidate.rawItem] : [{ id: actionCandidate.action.targetId }]);
        } else if (kind === "RESUME_SESSION") {
          if (restoreDraftFn && actionCandidate.rawItem) {
            restoreDraftFn(actionCandidate.rawItem);
          } else {
            const targetPracticeRoute = resolvePracticeRoute({
              subjectId: actionCandidate.subjectId,
              courseId: actionCandidate.courseId,
              moduleId: actionCandidate.courseId
            });
            navigate(targetPracticeRoute);
          }
        } else if (kind === "OPEN_LEARNING_SETUP") {
          const targetLandingRoute = resolveLandingRoute({
            subjectId: actionCandidate.subjectId,
            courseId: actionCandidate.courseId,
            moduleId: actionCandidate.courseId
          });
          navigate(targetLandingRoute);
        } else if (kind === "OPEN_SUBJECT") {
          let route = ROUTES.MATH_HOME;
          if (actionCandidate.subjectId === "korean") route = ROUTES.KOREAN_HOME;
          else if (actionCandidate.subjectId === "english") route = ROUTES.ENGLISH_HOME;
          navigate(route);
        }
      };

      const topBtn = recSection.querySelector("#topRecActionBtn");
      if (topBtn) {
        topBtn.onclick = () => executeAction(topRec);
      }

      recSection.querySelectorAll(".rec-alt-chip").forEach((chip) => {
        const altIdx = Number(chip.getAttribute("data-alt-idx"));
        const altItem = alternatives[altIdx];
        if (altItem) {
          chip.onclick = () => executeAction(altItem);
          chip.onkeydown = (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              executeAction(altItem);
            }
          };
        }
      });
    }
  }

  // 2. 전체 요약 통계 렌더링 (#homeOverallStatsSection)
  const statsSection = dom.homeOverallStatsSection || dom.learnerHomeView?.querySelector("#homeOverallStatsSection");
  if (statsSection) {
    const { gradedAttemptCount = 0, accuracy = 0, sessionCount = 0 } = dashboard.overall || {};
    const hasData = gradedAttemptCount > 0;
    statsSection.innerHTML = `
      <div class="overall-stats-grid">
        <div class="stat-card">
          <span class="stat-label">확정 문제 수</span>
          <strong class="stat-value">${hasData ? `${gradedAttemptCount}개` : "-"}</strong>
        </div>
        <div class="stat-card">
          <span class="stat-label">확정 정답률</span>
          <strong class="stat-value">${hasData ? `${Math.round(accuracy)}%` : "-"}</strong>
        </div>
        <div class="stat-card">
          <span class="stat-label">완료한 학습</span>
          <strong class="stat-value">${sessionCount > 0 ? `${sessionCount}회` : "-"}</strong>
        </div>
      </div>
    `;
  }

  // 3. 과목별 진도 렌더링 (#homeSubjectGrid)
  const subjectGrid = dom.subjectCardsGrid || dom.learnerHomeView?.querySelector("#homeSubjectGrid");
  if (subjectGrid) {
    subjectGrid.innerHTML = "";
    (dashboard.subjects || []).forEach((subj) => {
      const card = document.createElement("div");
      const isActive = subj.status === "active";
      card.className = `subject-card ${isActive ? "subject-active enabled" : "subject-coming-soon disabled"}`;
      card.setAttribute("role", isActive ? "button" : "region");
      if (isActive) {
        card.setAttribute("tabindex", "0");
        card.setAttribute("aria-label", `${subj.title} 학습하기`);
      }

      let contentHtml = `
        <div class="subject-card-header">
          <span class="subject-icon">${escapeHtml(subj.icon || "📚")}</span>
          <span class="subject-badge ${isActive ? "badge-active" : "badge-coming-soon"}">${["국어", "영어"].includes(subj.title) ? "AI 검토 자료" : isActive ? "학습 가능" : "준비 중"}</span>
        </div>
        <div class="subject-card-content">
          <h3 class="subject-title">${escapeHtml(subj.title)}</h3>
          <p class="subject-desc">${escapeHtml(subj.description || "")}</p>
      `;

      if (isActive && subj.stats) {
        const accText = subj.stats.gradedAttemptCount > 0 ? `${Math.round(subj.stats.accuracy)}%` : "-";
        const progressItem = subj.progress?.progressRate != null
          ? `<span>진행률: <strong>${subj.progress.progressRate}%</strong></span>`
          : `<span>스킬: <strong>${subj.progress?.attemptedSkills ?? 0}/${subj.progress?.totalSkills ?? 8}</strong></span>`;
        contentHtml += `
          <div class="subject-stats-row">
            <span>문제: <strong>${subj.stats.gradedAttemptCount}개</strong></span>
            <span>정답률: <strong>${accText}</strong></span>
            ${progressItem}
          </div>
        `;
      }

      contentHtml += `</div>
        <div class="subject-card-footer">
          ${isActive ? `<button type="button" class="btn-start-subject primary-action">${escapeHtml(subj.title || "과목")} 학습하기</button>` : '<span class="coming-soon-label">준비 중</span>'}
        </div>
      `;

      card.innerHTML = contentHtml;

      if (isActive) {
        const subjectKey = subj.subjectId || subj.id;
        const goSubject = () => {
          if (subj.entryRoute) {
            navigate(subj.entryRoute);
          } else if (subjectKey === "english") {
            navigate(ROUTES.ENGLISH_HOME);
          } else if (subjectKey === "korean") {
            navigate(ROUTES.KOREAN_HOME);
          } else {
            navigate(ROUTES.MATH_HOME);
          }
        };
        card.onclick = goSubject;
        card.onkeydown = (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            goSubject();
          }
        };
      }

      subjectGrid.appendChild(card);
    });
  }

  // 4. 최근 세션 목록 렌더링 (#homeRecentSessionsList)
  const recentList = dom.recentSessionsList || dom.learnerHomeView?.querySelector("#homeRecentSessionsList");
  if (recentList) {
    const recent = dashboard.recentSessions || [];
    if (recent.length === 0) {
      recentList.innerHTML = `<div class="empty-sessions-note">아직 완료된 학습 기록이 없습니다. 문제를 풀고 실력을 확인해 보세요!</div>`;
    } else {
      recentList.innerHTML = recent.map((s, idx) => {
        const dateStr = s.completedAt
          ? new Date(s.completedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
          : "-";
        const op = escapeHtml(getSessionHistoryLabel(s));
        const accClass = s.accuracyRate >= 80 ? "high" : "low";

        let reviewBadgeHtml = "";
        if (s.reviewState === "unresolved") {
          reviewBadgeHtml = `<span class="review-status-pill unresolved">복습 필요</span>`;
        } else if (s.reviewState === "retrying") {
          reviewBadgeHtml = `<span class="review-status-pill retrying">다시 푸는 중</span>`;
        } else if (s.reviewState === "review_pending") {
          reviewBadgeHtml = `<span class="review-status-pill pending">확인 대기</span>`;
        }

        return `
          <div class="session-history-item" data-session-idx="${idx}" role="button" tabindex="0" aria-label="${dateStr} ${op} ${s.totalQuestions}문제 상세 결과 보기">
            <div class="session-history-main">
              <strong>${op} ${s.totalQuestions}문제 <small class="detail-link-text">🔍 상세보기</small></strong>
              <small>${dateStr} ${reviewBadgeHtml}</small>
            </div>
            <div class="session-history-stats">
              <span class="session-acc-badge ${accClass}">${s.accuracyRate}% 정답</span>
              <span class="session-time-text">${formatTime(s.totalSolveTimeMs, "korean")}</span>
            </div>
          </div>
        `;
      }).join("");

      recentList.querySelectorAll(".session-history-item").forEach((item) => {
        const idx = Number(item.getAttribute("data-session-idx"));
        const session = recent[idx];
        if (!session) return;

        const openDetail = () => {
          if (showSessionDetailFn) {
            showSessionDetailFn(session.rawSession || session);
          }
        };

        item.onclick = openDetail;
        item.onkeydown = (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openDetail();
          }
        };
      });
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
    if (dom.learnerSchoolGradeInput) dom.learnerSchoolGradeInput.value = learner.schoolGrade ? String(learner.schoolGrade) : "";
    if (dom.learnerAllowPreviewInput) dom.learnerAllowPreviewInput.checked = Boolean(learner.guardianPolicy?.allowPreviewAboveGrade);
    if (dom.learnerAllowAdvancedInput) dom.learnerAllowAdvancedInput.checked = Boolean(learner.guardianPolicy?.allowedDifficulties?.includes("ADVANCED"));
    selectedAvatarKey = learner.avatar || "🌱";
    if (dom.archiveLearnerBtn) dom.archiveLearnerBtn.hidden = false;
  } else {
    if (dom.learnerModalTitle) dom.learnerModalTitle.textContent = "새 학습자 추가";
    if (dom.learnerNameInput) dom.learnerNameInput.value = "";
    if (dom.learnerSchoolGradeInput) dom.learnerSchoolGradeInput.value = "";
    if (dom.learnerAllowPreviewInput) dom.learnerAllowPreviewInput.checked = false;
    if (dom.learnerAllowAdvancedInput) dom.learnerAllowAdvancedInput.checked = false;
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
  const schoolGrade = dom.learnerSchoolGradeInput ? Number(dom.learnerSchoolGradeInput.value) : null;
  if (dom.learnerSchoolGradeInput && !schoolGrade) {
    if (dom.learnerModalError) {
      dom.learnerModalError.textContent = "현재 초등학교 학년을 선택해주세요.";
      dom.learnerModalError.hidden = false;
    }
    return;
  }
  const allowPreviewAboveGrade = Boolean(dom.learnerAllowPreviewInput?.checked);
  const allowedDifficulties = ["FOUNDATION", "STANDARD"];
  if (dom.learnerAllowAdvancedInput?.checked) allowedDifficulties.push("ADVANCED");
  const guardianPolicy = {
    allowReviewBelowGrade: true,
    maxReviewGradeDelta: 2,
    allowPreviewAboveGrade,
    maxPreviewGradeDelta: allowPreviewAboveGrade ? 1 : 0,
    allowedDifficulties,
    requireGuardianForLockedRange: true
  };

  try {
    if (editingLearnerId) {
      await updateLearner(editingLearnerId, {
        name,
        avatar: selectedAvatarKey,
        icon: selectedAvatarKey,
        avatarKey: selectedAvatarKey,
        schoolGrade,
        guardianPolicy
      });
    } else {
      await createLearner({
        name,
        avatar: selectedAvatarKey,
        icon: selectedAvatarKey,
        avatarKey: selectedAvatarKey,
        schoolGrade,
        guardianPolicy
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
