/**
 * Math Canvas Pro - 앱 부트스트랩 오케스트레이터 (App Bootstrap)
 * SSOT Section 4 & 5 및 Phase F3 명세 준수
 * 
 * 부트스트랩 순서:
 * 1. IndexedDB 준비
 * 2. F2 legacy migration 필요 여부 확인
 * 3. 필요한 경우 migration 실행
 * 4. migration 성공 확인 (실패 시 안전 화면 표출 및 홈 진입 차단)
 * 5. restoreActiveLearner()
 * 6. learner 상태 확인 (0명 / 1명 / 2명 이상 정책)
 * 7. 초기 route 결정
 * 8. App Shell render
 */

import { getDB } from "../storage.js";
import { detectLegacyData, migrateLegacyData } from "../migrationEngine.js";
import { restoreActiveLearner, getLearners, getActiveLearner } from "../learners/learnerQueries.js";
import { initRouter, ROUTES, navigate, replace, resolveGuardedPath, getCurrentRoute, normalizePath } from "./appRouter.js";
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

/**
 * 앱 시작 메인 부트스트랩 실행
 */
export async function bootstrapApp(options = {}) {
  currentBootstrapState = BootstrapState.RUNNING;

  try {
    // 1. IndexedDB 준비
    const db = await getDB();

    // 2. F2 legacy migration 필요 여부 확인
    const detection = await detectLegacyData();

    // 3. 필요한 경우 migration 실행
    if (detection.hasLegacyData) {
      console.log(`[Bootstrap] Legacy data detected (${detection.counts.total} items). Starting migration...`);
      const migrationResult = await migrateLegacyData();

      // 4. migration 성공 확인
      if (!migrationResult.success) {
        console.error("[Bootstrap] Migration failed:", migrationResult);
        currentBootstrapState = BootstrapState.MIGRATION_ERROR;
        const errorMsg = migrationResult.error || migrationResult.reason || "기존 학습 기록 마이그레이션에 실패했습니다.";
        
        showMigrationError(errorMsg, () => {
          bootstrapApp(options);
        });

        lastBootstrapResult = {
          success: false,
          state: BootstrapState.MIGRATION_ERROR,
          error: errorMsg,
          migrationResult
        };
        return lastBootstrapResult;
      }
      console.log("[Bootstrap] Legacy migration completed successfully.");
    }

    // 5. restoreActiveLearner()
    const restoredLearnerId = await restoreActiveLearner();

    // 6. learner 상태 확인
    const activeLearners = await getLearners();
    let initialRoute = ROUTES.HOME;

    if (activeLearners.length === 0) {
      // 활성 학습자 0명 -> 학습자 생성/관리 화면
      initialRoute = ROUTES.LEARNERS;
    } else if (activeLearners.length === 1) {
      // 활성 학습자 1명 -> 복원된 학습자로 홈 빠른 진입
      initialRoute = ROUTES.HOME;
    } else {
      // 활성 학습자 2명 이상 -> 최초 진입(/) 시 선택 화면 유도, 직접 URL이 있다면 해당 경로 존중
      const requestedUrl = options.initialPath || (typeof window !== "undefined" ? window.location.pathname : "/");
      const normalized = normalizePath(requestedUrl);
      if (normalized === ROUTES.ROOT) {
        initialRoute = ROUTES.LEARNERS;
      } else {
        initialRoute = normalized;
      }
    }

    // 7. 초기 route 결정 (Route Guard 적용)
    const targetUrl = options.initialPath || (typeof window !== "undefined" ? window.location.pathname : initialRoute);
    const resolvedRoute = resolveGuardedPath(targetUrl === ROUTES.ROOT ? initialRoute : targetUrl);

    // 8. App Shell 초기화 및 렌더
    initAppShell({
      documentRef: options.documentRef,
      isSessionActive: options.isSessionActive
    });

    // 라우터 초기화
    initRouter({
      initialPath: resolvedRoute,
      hasActiveSession: options.hasActiveSession
    });

    await updateShellHeader();
    renderRouteView(resolvedRoute);

    currentBootstrapState = BootstrapState.SUCCESS;
    lastBootstrapResult = {
      success: true,
      state: BootstrapState.SUCCESS,
      route: resolvedRoute,
      restoredLearnerId,
      learnerCount: activeLearners.length
    };

    return lastBootstrapResult;
  } catch (error) {
    console.error("[Bootstrap] Fatal initialization error:", error);
    currentBootstrapState = BootstrapState.ERROR;
    showMigrationError(error.message || "앱 초기화 중 오류가 발생했습니다.", () => {
      bootstrapApp(options);
    });

    lastBootstrapResult = {
      success: false,
      state: BootstrapState.ERROR,
      error: error.message
    };
    return lastBootstrapResult;
  }
}

/**
 * 현재 부트스트랩 상태 조회
 */
export function getBootstrapState() {
  return currentBootstrapState;
}

/**
 * 마지막 부트스트랩 결과 조회
 */
export function getLastBootstrapResult() {
  return lastBootstrapResult;
}
