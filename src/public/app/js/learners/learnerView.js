/**
 * Math Canvas Pro - 학습자 및 통합 홈 UI 관리자 (Learner & Home View)
 * SSOT Section 5, 6, 9, 10, 15, 17 및 Phase F3 명세 준수
 * - 학습자 선택 화면 (최근 학습자 강조, 큰 프로필 카드, 44px+ 터치 타깃)
 * - 학습자 추가/수정/보관 모달
 * - 통합 학습자 홈 (수학/국어/영어 카드, 준비 중 시각화)
 * - 수학 과목 홈 (/math)
 */

import { getLearners, getActiveLearner, getArchivedLearnersList, getLearnerById } from "./learnerQueries.js";
import { createLearner, updateLearner, archiveLearner, restoreLearner, selectLearner } from "./learnerCommands.js";
import { getAllSubjects, getSubject } from "../platform/subjectRegistry.js";
import { navigate, ROUTES } from "../platform/appRouter.js";
import { updateShellHeader } from "../platform/appShell.js";

const AVATAR_LIST = ["🌱", "🚀", "🐱", "🐶", "⭐", "🎨", "🦁", "🐬", "🦊", "🦉", "🐰", "🐯"];

let isInitialized = false;
let currentEditingLearnerId = null;

/**
 * 학습자 UI 및 홈 뷰 이벤트 바인딩
 */
export function initLearnerView(options = {}) {
  const doc = options.documentRef || (typeof document !== "undefined" ? document : null);
  if (!doc) return;

  const addLearnerBtn = doc.querySelector("#addLearnerBtn");
  const learnerModal = doc.querySelector("#learnerModal");
  const learnerForm = doc.querySelector("#learnerForm");
  const learnerModalCloseBtn = doc.querySelector("#learnerModalCloseBtn");
  const learnerCancelBtn = doc.querySelector("#learnerCancelBtn");
  const archiveLearnerBtn = doc.querySelector("#archiveLearnerBtn");
  const showArchivedBtn = doc.querySelector("#showArchivedBtn");
  const archivedLearnersSection = doc.querySelector("#archivedLearnersSection");

  // 1. 학습자 추가 버튼
  if (addLearnerBtn) {
    addLearnerBtn.onclick = () => {
      openLearnerModal(null, doc);
    };
  }

  // 2. 모달 닫기
  if (learnerModalCloseBtn) {
    learnerModalCloseBtn.onclick = () => closeLearnerModal(doc);
  }
  if (learnerCancelBtn) {
    learnerCancelBtn.onclick = () => closeLearnerModal(doc);
  }

  // 3. 학습자 저장 (추가 또는 수정)
  if (learnerForm) {
    learnerForm.onsubmit = async (e) => {
      e.preventDefault();
      const nameInput = doc.querySelector("#learnerNameInput");
      const selectedAvatar = doc.querySelector('input[name="learnerAvatar"]:checked')?.value || "🌱";
      const name = String(nameInput?.value || "").trim();

      if (!name) {
        alert("학습자 이름을 입력해 주세요.");
        return;
      }

      try {
        if (currentEditingLearnerId) {
          await updateLearner(currentEditingLearnerId, { name, avatar: selectedAvatar });
        } else {
          await createLearner({ name, avatar: selectedAvatar }, { makeActive: true });
        }

        closeLearnerModal(doc);
        await updateShellHeader();
        await renderLearnerSelectView(doc);
        navigate(ROUTES.HOME);
      } catch (err) {
        alert(`저장에 실패했습니다: ${err.message}`);
      }
    };
  }

  // 4. 학습자 보관
  if (archiveLearnerBtn) {
    archiveLearnerBtn.onclick = async () => {
      if (!currentEditingLearnerId) return;
      const confirmArchive = typeof window !== "undefined" && window.confirm
        ? window.confirm("이 학습자를 보관하시겠습니까?\n(기존 학습 기록은 안전하게 보존됩니다.)")
        : true;
      if (!confirmArchive) return;

      try {
        await archiveLearner(currentEditingLearnerId);
        closeLearnerModal(doc);
        await updateShellHeader();
        await renderLearnerSelectView(doc);
        
        const activeLearners = await getLearners();
        if (activeLearners.length === 0) {
          navigate(ROUTES.LEARNERS);
        } else {
          navigate(ROUTES.HOME);
        }
      } catch (err) {
        alert(`보관에 실패했습니다: ${err.message}`);
      }
    };
  }

  // 5. 보관된 학습자 토글
  if (showArchivedBtn && archivedLearnersSection) {
    showArchivedBtn.onclick = async () => {
      const isHidden = archivedLearnersSection.hidden;
      archivedLearnersSection.hidden = !isHidden;
      showArchivedBtn.textContent = isHidden ? "보관된 학습자 숨기기" : "보관된 학습자 보기";
      if (isHidden) {
        await renderArchivedLearnersList(doc);
      }
    };
  }

  isInitialized = true;
}

/**
 * 학습자 추가/수정 모달 열기
 */
export async function openLearnerModal(learnerId = null, docRef = null) {
  const doc = docRef || (typeof document !== "undefined" ? document : null);
  if (!doc) return;

  const modal = doc.querySelector("#learnerModal");
  const title = doc.querySelector("#learnerModalTitle");
  const nameInput = doc.querySelector("#learnerNameInput");
  const avatarListWrap = doc.querySelector("#learnerAvatarList");
  const archiveBtn = doc.querySelector("#archiveLearnerBtn");

  currentEditingLearnerId = learnerId;

  let existing = null;
  if (learnerId) {
    existing = await getLearnerById(learnerId);
  }

  if (title) {
    title.textContent = existing ? "학습자 프로필 수정" : "새 학습자 추가";
  }

  if (nameInput) {
    nameInput.value = existing ? existing.name : "";
  }

  if (archiveBtn) {
    archiveBtn.hidden = !existing;
  }

  // 아바타 선택 그리드 렌더링
  if (avatarListWrap) {
    const currentAvatar = existing ? existing.avatar : "🌱";
    avatarListWrap.innerHTML = AVATAR_LIST.map((av, idx) => `
      <label class="avatar-option ${av === currentAvatar ? "selected" : ""}">
        <input type="radio" name="learnerAvatar" value="${av}" ${av === currentAvatar ? "checked" : ""}>
        <span class="avatar-emoji">${av}</span>
      </label>
    `).join("");

    avatarListWrap.querySelectorAll('input[name="learnerAvatar"]').forEach((radio) => {
      radio.onchange = () => {
        avatarListWrap.querySelectorAll(".avatar-option").forEach((opt) => opt.classList.remove("selected"));
        radio.closest(".avatar-option")?.classList.add("selected");
      };
    });
  }

  if (modal) {
    if (typeof modal.showModal === "function") {
      modal.showModal();
    } else {
      modal.setAttribute("open", "");
    }
  }
}

/**
 * 학습자 모달 닫기
 */
export function closeLearnerModal(docRef = null) {
  const doc = docRef || (typeof document !== "undefined" ? document : null);
  if (!doc) return;

  const modal = doc.querySelector("#learnerModal");
  if (modal) {
    if (typeof modal.close === "function") {
      modal.close();
    } else {
      modal.removeAttribute("open");
    }
  }
  currentEditingLearnerId = null;
}

/**
 * 학습자 선택 화면 렌더링
 */
export async function renderLearnerSelectView(docRef = null) {
  const doc = docRef || (typeof document !== "undefined" ? document : null);
  if (!doc) return;

  const listContainer = doc.querySelector("#learnerListContainer");
  if (!listContainer) return;

  const learners = await getLearners();
  const activeLearner = await getActiveLearner();

  if (learners.length === 0) {
    listContainer.innerHTML = `
      <div class="learner-empty-state">
        <span class="empty-icon">🌱</span>
        <p>등록된 학습자가 없습니다.<br>아래 버튼을 눌러 첫 학습자를 등록해 보세요!</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = learners.map((learner, index) => {
    const isCurrent = activeLearner && activeLearner.id === learner.id;
    const isFirst = index === 0;
    const badgeText = isCurrent ? "현재 학습자" : (isFirst ? "지난번 학습 이어가기" : "");

    return `
      <div class="learner-card ${isCurrent ? "active-learner-card" : ""} ${isFirst ? "featured-learner-card" : ""}" data-learner-id="${learner.id}">
        <button type="button" class="learner-card-main-btn" aria-label="${learner.name} 학습 시작">
          <div class="learner-avatar-wrap">
            <span class="learner-avatar">${learner.avatar || "🌱"}</span>
          </div>
          <div class="learner-info">
            <div class="learner-name-row">
              <strong class="learner-name">${learner.name}</strong>
              ${badgeText ? `<span class="learner-badge">${badgeText}</span>` : ""}
            </div>
            <p class="learner-subtext">터치하여 학습 시작</p>
          </div>
          <span class="learner-arrow" aria-hidden="true">➔</span>
        </button>
        <button type="button" class="learner-edit-btn" aria-label="${learner.name} 프로필 수정" title="프로필 수정">
          ✏️
        </button>
      </div>
    `;
  }).join("");

  // 이벤트 바인딩
  listContainer.querySelectorAll(".learner-card").forEach((card) => {
    const learnerId = card.getAttribute("data-learner-id");
    const mainBtn = card.querySelector(".learner-card-main-btn");
    const editBtn = card.querySelector(".learner-edit-btn");

    if (mainBtn) {
      mainBtn.onclick = async () => {
        try {
          await selectLearner(learnerId);
          await updateShellHeader();
          navigate(ROUTES.HOME);
        } catch (err) {
          alert(err.message);
        }
      };
    }

    if (editBtn) {
      editBtn.onclick = (e) => {
        e.stopPropagation();
        openLearnerModal(learnerId, doc);
      };
    }
  });
}

/**
 * 보관된 학습자 목록 렌더링
 */
export async function renderArchivedLearnersList(docRef = null) {
  const doc = docRef || (typeof document !== "undefined" ? document : null);
  if (!doc) return;

  const container = doc.querySelector("#archivedLearnersList");
  if (!container) return;

  const archived = await getArchivedLearnersList();
  if (archived.length === 0) {
    container.innerHTML = `<p class="archived-empty">보관된 학습자가 없습니다.</p>`;
    return;
  }

  container.innerHTML = archived.map((l) => `
    <div class="archived-learner-item" data-learner-id="${l.id}">
      <span class="archived-avatar">${l.avatar || "🌱"}</span>
      <span class="archived-name">${l.name}</span>
      <button type="button" class="btn-restore-learner" aria-label="${l.name} 복원">복원</button>
    </div>
  `).join("");

  container.querySelectorAll(".btn-restore-learner").forEach((btn) => {
    btn.onclick = async (e) => {
      const item = e.target.closest(".archived-learner-item");
      const learnerId = item?.getAttribute("data-learner-id");
      if (learnerId) {
        await restoreLearner(learnerId);
        await renderLearnerSelectView(doc);
        await renderArchivedLearnersList(doc);
      }
    };
  });
}

/**
 * 통합 학습자 홈 뷰 렌더링
 */
export async function renderLearnerHomeView(docRef = null) {
  const doc = docRef || (typeof document !== "undefined" ? document : null);
  if (!doc) return;

  const activeLearner = await getActiveLearner();
  const greetingName = doc.querySelector("#learnerGreetingName");
  const subjectGrid = doc.querySelector("#homeSubjectGrid");

  if (greetingName) {
    greetingName.textContent = activeLearner ? activeLearner.name : "학습자";
  }

  if (subjectGrid) {
    const subjects = getAllSubjects();
    subjectGrid.innerHTML = subjects.map((subject) => {
      const isActive = subject.status === "active" && subject.enabled;

      return `
        <div class="subject-card ${isActive ? "subject-active" : "subject-coming-soon"}" data-subject-id="${subject.id}">
          <div class="subject-card-header">
            <span class="subject-icon" aria-hidden="true">${subject.icon}</span>
            <span class="subject-badge ${isActive ? "badge-active" : "badge-coming-soon"}">
              ${subject.badgeText || (isActive ? "학습 가능" : "준비 중")}
            </span>
          </div>
          <div class="subject-card-body">
            <h3 class="subject-title">${subject.title}</h3>
            <p class="subject-desc">${subject.description}</p>
          </div>
          <div class="subject-card-footer">
            ${isActive ? `
              <button type="button" class="btn-start-subject primary-action" aria-label="${subject.title} 시작하기">
                <span>학습하기</span><b>➔</b>
              </button>
            ` : `
              <span class="coming-soon-label" aria-disabled="true">곧 찾아옵니다</span>
            `}
          </div>
        </div>
      `;
    }).join("");

    // 과목 카드 클릭 이벤트 바인딩
    subjectGrid.querySelectorAll(".subject-card").forEach((card) => {
      const subjectId = card.getAttribute("data-subject-id");
      const subject = getSubject(subjectId);
      const startBtn = card.querySelector(".btn-start-subject");

      if (startBtn && subject && subject.status === "active") {
        startBtn.onclick = () => {
          navigate(subject.entryRoute || ROUTES.MATH_HOME);
        };
      }
    });
  }
}

/**
 * 수학 과목 홈 (/math) 뷰 렌더링
 */
export async function renderSubjectHomeView(docRef = null) {
  const doc = docRef || (typeof document !== "undefined" ? document : null);
  if (!doc) return;

  const mathSubject = getSubject("math");
  const moduleGrid = doc.querySelector("#mathModuleGrid");

  if (moduleGrid && mathSubject && Array.isArray(mathSubject.modules)) {
    moduleGrid.innerHTML = mathSubject.modules.map((mod) => {
      const isActive = mod.status === "active" && mod.enabled;

      return `
        <div class="module-card ${isActive ? "module-active" : "module-coming-soon"}" data-module-id="${mod.id}">
          <div class="module-card-header">
            <span class="module-icon">${mod.icon || "📐"}</span>
            <span class="module-badge ${isActive ? "badge-active" : "badge-coming-soon"}">
              ${mod.badgeText || (isActive ? "학습 가능" : "준비 중")}
            </span>
          </div>
          <div class="module-card-body">
            <h3 class="module-title">${mod.title}</h3>
            <p class="module-desc">${mod.description}</p>
          </div>
          <div class="module-card-footer">
            ${isActive ? `
              <button type="button" class="btn-start-module primary-action" aria-label="${mod.title} 시작">
                <span>학습 시작</span><b>➔</b>
              </button>
            ` : `
              <span class="coming-soon-label" aria-disabled="true">준비 중</span>
            `}
          </div>
        </div>
      `;
    }).join("");

    moduleGrid.querySelectorAll(".module-card").forEach((card) => {
      const moduleId = card.getAttribute("data-module-id");
      const mod = mathSubject.modules.find((m) => m.id === moduleId);
      const startBtn = card.querySelector(".btn-start-module");

      if (startBtn && mod && mod.status === "active") {
        startBtn.onclick = () => {
          navigate(mod.route || ROUTES.MATH_ARITHMETIC);
        };
      }
    });
  }
}
