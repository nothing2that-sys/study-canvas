//+_+// Math Canvas Pro - 앱 부트스트랩 오케스트레이터 (App Bootstrap)
//+_+// SSOT Section 4 & 5 및 Phase F3 재검토 명세 준수
//+_+//
//+_+// 부트스트랩 순서:
//+_+// 1. IndexedDB 준비 (getDB)
//+_+// 2. F2 legacy migration 필요 여부 확인 (detectLegacyData)
//+_+// 3. 필요한 경우 migration 실행 (migrateLegacyData)
//+_+// 4. migration 성공 확인 (실패 시 안전 에러 화면 표출 및 홈 진입 차단)
//+_+// 5. restoreActiveLearner()
//+_+// 6. learner 상태 및 Persisted Draft 확인 (0명 / 1명 / 2명 이상 정책)
//+_+// 7. initRouter를 통한 단일 SSOT 최종 route 확정
//+_+// 8. App Shell render 및 뷰 활성화

import { getDB } from "../storage.js";
import { detectLegacyData, migrateLegacyData } from "../migrationEngine.js";
import { restoreActiveLearner, getLearners, getActiveLearner } from "../learners/learnerQueries.js";
import { getDraft, getSubmissionBySessionId, getAllSubmissions } from "../data/learningQueries.js";
import { evaluateStartupDraftResumePolicy } from "../submissionLifecycle.js";
import { LEARNING_ROUTES, resolvePracticeRouteForSession } from "../learningRouteResolver.js";
import { initRouter, ROUTES, getCurrentRoute, normalizePath } from "./appRouter.js";
import { initAppShell, updateShellHeader, renderRouteView, showMigrationError } from "./appShell.js";

export const BootstrapState = Object.freeze({
  IDLE: "IDLE",
  RUNNING: "RUNNING",
  SUCCESS: "SUCCESS",
  MIGRATION_ERROR: "MIGRATION_ERROR",
  ERROR: "ERROR"
});

let currentBootstrapState = BootstrapState.IDLE;
let lastBootstrapResult = null;

//+_+// 앱 시작 메인 부트스트랩 실행
export async function bootstrapApp(options = {}) {
  currentBootstrapState = BootstrapState.RUNNING;

  const win = options.windowRef || (typeof window !== "undefined" ? window : null);
  const doc = options.documentRef || (typeof document !== "undefined" ? document : null);

  try {
    //+_+// 1. IndexedDB 준비 (Composition Root 차원에서 getDB 호출)
    await getDB();

    //+_+// 2. F2 legacy migration 필요 여부 확인 (의존성 주입 지원)
    const detectFn = options.detectLegacyData || detectLegacyData;
    const detection = await detectFn();

    //+_+// 3. 필요한 경우 migration 실행
    if (detection && detection.hasLegacyData) {
      console.log(`[Bootstrap] Legacy data detected (${detection.counts?.total || 0} items). Starting migration...`);
      const migrateFn = options.migrateLegacyData || migrateLegacyData;
      const migrationResult = await migrateFn();

      //+_+// 4. migration 성공 확인
      if (!migrationResult || !migrationResult.success) {
        console.error("[Bootstrap] Migration failed:", migrationResult);
        currentBootstrapState = BootstrapState.MIGRATION_ERROR;
        const errorMsg = migrationResult?.error || migrationResult?.reason || "기존 학습 기록 마이그레이션에 실패했습니다.";

        if (doc) {
          initAppShell({ documentRef: doc, windowRef: win });
          showMigrationError(errorMsg, () => {
            bootstrapApp(options);
          });
        }

        lastBootstrapResult = {
          success: false,
          state: BootstrapState.MIGRATION_ERROR,
          error: errorMsg,
          migrationResult,
          retry: () => bootstrapApp(options)
        };
        return lastBootstrapResult;
      }
      console.log("[Bootstrap] Legacy migration completed successfully.");
    }

    //+_+// 5. restoreActiveLearner()
    const restoredLearnerId = await restoreActiveLearner();

    //+_+// 6. learner 상태 및 요청 URL 분석하여 초기 목적지 결정
    const activeLearners = await getLearners();
    const requestedUrl = options.initialPath !== undefined
      ? options.initialPath
      : (win && win.location ? win.location.pathname : "/");
    const normalizedUrl = normalizePath(requestedUrl);

    let desiredRoute = ROUTES.HOME;

    if (activeLearners.length === 0) {
      //+_+// 활성 학습자 0명 -> 학습자 생성/관리 화면
      desiredRoute = ROUTES.LEARNERS;
    } else if (activeLearners.length === 1) {
      //+_+// 활성 학습자 1명 -> 루트 요청 시 홈으로 빠른 진입, 하위 경로 요청 시 해당 경로 존중
      desiredRoute = normalizedUrl === ROUTES.ROOT ? ROUTES.HOME : normalizedUrl;
    } else {
      //+_+// 활성 학습자 2명 이상 -> 루트 진입 시 반드시 /learners 선택 화면으로 유도
      desiredRoute = normalizedUrl === ROUTES.ROOT ? ROUTES.LEARNERS : normalizedUrl;
    }

    //+_+// 6.1 Persisted Draft 및 Submission-First Policy 조회 (active learner 기준 deep link 검증에 활용)
    let persistedDraft = null;
    let persistedSubmission = null;
    let activeGradingSubmission = null;
    let draftResumePolicy = null;

    if (restoredLearnerId) {
      try {
        persistedDraft = await getDraft({ learnerId: restoredLearnerId });
        if (persistedDraft?.sessionId) {
          try {
            persistedSubmission = await getSubmissionBySessionId(persistedDraft.sessionId, {
              learnerId: restoredLearnerId
            });
          } catch (subErr) {
            console.warn("[Bootstrap] Submission query failed:", subErr);
          }
        }
        //+_+// 동일 세션 Submission이 아닌 다른 제출본이 Draft 복구 정책을 방해하지 않도록 격리
        draftResumePolicy = evaluateStartupDraftResumePolicy({
          draft: persistedDraft,
          submission: persistedSubmission
        });

        //+_+// 채점 화면 전용 대기/진행 중 제출본 조회
        activeGradingSubmission = persistedSubmission;
        const isRequestedGradingSubmission = (submission) => submission &&
          (submission.status === "PARENT_GRADING_PENDING" || submission.status === "GRADING_ACTIVE") &&
          (normalizedUrl !== ROUTES.MATH_DECIMAL_PRACTICE ||
            (submission.config?.courseId || submission.courseId) === "decimal") &&
          (normalizedUrl !== ROUTES.MATH_PRACTICE ||
            ((submission.config?.subjectId || submission.subjectId || "math") === "math" &&
             (submission.config?.courseId || submission.courseId || "arithmetic") === "arithmetic"));
        if (!isRequestedGradingSubmission(activeGradingSubmission)) {
          try {
            const submissions = await getAllSubmissions({ learnerId: restoredLearnerId });
            activeGradingSubmission = submissions.find(isRequestedGradingSubmission) || null;
          } catch (subErr) {
            console.warn("[Bootstrap] Active grading submission query failed:", subErr);
          }
        }
      } catch (draftErr) {
        console.warn("[Bootstrap] Persisted draft query failed:", draftErr);
      }
    }

    const canRestorePractice = draftResumePolicy?.canResumePractice &&
      persistedDraft?.sessionState !== "GRADING_ACTIVE" && persistedDraft?.sessionType !== "grading";
    if (canRestorePractice && Object.values(LEARNING_ROUTES).some(route => route.endsWith("/practice") && route === desiredRoute)) {
      desiredRoute = resolvePracticeRouteForSession(persistedDraft);
    }
    if ([ROUTES.MATH_DECIMAL_PRACTICE, ROUTES.MATH_PRACTICE].includes(desiredRoute) && !canRestorePractice && activeGradingSubmission) {
      desiredRoute = ROUTES.MATH_GRADING;
    }

    //+_+// 세션 활성 및 복원 가능 여부 콜백 구성
    const hasActiveSession = (mode) => {
      //+_+// 인메모리 세션 우선 확인 (practice_active, grading_active, active_session 등)
      if (options.hasActiveSession && options.hasActiveSession(mode)) {
        return true;
      }
      if (mode === "practice_active" || mode === "grading_active" || mode === "active_session") {
        return false;
      }
      if (mode === "grading" && (
        activeGradingSubmission?.status === "PARENT_GRADING_PENDING" ||
        activeGradingSubmission?.status === "GRADING_ACTIVE"
      )) {
        return true;
      }
      //+_+// 영구 저장된 Draft 소유권 및 Submission-First policy 검증
      if (persistedDraft && persistedDraft.learnerId === restoredLearnerId && persistedDraft.questions?.length > 0) {
        if (mode === "practice") {
          return Boolean(
            draftResumePolicy?.canResumePractice === true &&
            persistedDraft.sessionState !== "GRADING_ACTIVE" &&
            persistedDraft.sessionType !== "grading"
          );
        }
        if (mode === "grading") {
          return Boolean(
            draftResumePolicy?.canResumeGrading === true ||
            persistedDraft.sessionState === "GRADING_ACTIVE" ||
            persistedDraft.sessionType === "grading"
          );
        }
      }
      return false;
    };

    //+_+// 7. Router 초기화 및 최종 단일 SSOT route 확정
    const finalRoute = initRouter({
      initialPath: desiredRoute,
      windowRef: win,
      hasActiveSession
    });

    //+_+// 8. App Shell 초기화 및 뷰 렌더
    if (doc) {
      initAppShell({
        documentRef: doc,
        windowRef: win,
        isSessionActive: options.isSessionActive
      });

      await updateShellHeader({ learner: await getActiveLearner() });
      renderRouteView(finalRoute);
    }

    const resumableDraft = draftResumePolicy?.canResumePractice || draftResumePolicy?.canResumeGrading
      ? persistedDraft
      : null;

    currentBootstrapState = BootstrapState.SUCCESS;
    lastBootstrapResult = {
      success: true,
      state: BootstrapState.SUCCESS,
      route: finalRoute,
      restoredLearnerId,
      learnerCount: activeLearners.length,
      persistedDraft: finalRoute === ROUTES.MATH_GRADING && activeGradingSubmission &&
        resumableDraft?.sessionId !== activeGradingSubmission.sessionId ? null : resumableDraft,
      persistedSubmission: finalRoute === ROUTES.MATH_GRADING ? (activeGradingSubmission || persistedSubmission) : persistedSubmission,
      draftResumePolicy
    };

    return lastBootstrapResult;
  } catch (error) {
    console.error("[Bootstrap] Fatal initialization error:", error);
    currentBootstrapState = BootstrapState.ERROR;

    if (doc) {
      initAppShell({ documentRef: doc, windowRef: win });
      showMigrationError(error.message || "앱 초기화 중 오류가 발생했습니다.", () => {
        bootstrapApp(options);
      });
    }

    lastBootstrapResult = {
      success: false,
      state: BootstrapState.ERROR,
      error: error.message,
      retry: () => bootstrapApp(options)
    };
    return lastBootstrapResult;
  }
}

//+_+// 현재 부트스트랩 상태 조회
export function getBootstrapState() {
  return currentBootstrapState;
}

//+_+// 마지막 부트스트랩 결과 조회
export function getLastBootstrapResult() {
  return lastBootstrapResult;
}
