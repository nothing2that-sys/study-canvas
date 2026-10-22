const CACHE_NAME = "math-canvas-pro-vstudy-canvas-public-v1";

//+_+// PWA 오프라인 구동을 위한 필수 App Shell 자산 목록
const APP_SHELL = [
  "./review/WORDNET-LICENSE.txt",
  "./notices.html",
  "./content-scope.json",
  /* MODULES_PRECACHE_START */
  "./js/adaptiveEngine.js?v=study-canvas-public-v1",
  "./js/aiReviewAttribution.js?v=study-canvas-public-v1",
  "./js/aiReviewPolicy.js?v=study-canvas-public-v1",
  "./js/aiReviewResources.js?v=study-canvas-public-v1",
  "./js/backupEngine.js?v=study-canvas-public-v1",
  "./js/canvasEngine.js?v=study-canvas-public-v1",
  "./js/canvasSceneGeometry.js?v=study-canvas-public-v1",
  "./js/compactExactAiReviewPolicy.js?v=study-canvas-public-v1",
  "./js/confetti.js?v=study-canvas-public-v1",
  "./js/contentEligibility.js?v=study-canvas-public-v1",
  "./js/contentPackageLoader.js?v=study-canvas-public-v1",
  "./js/contentRotationAdapters.js?v=study-canvas-public-v1",
  "./js/contentRotationRuntime.js?v=study-canvas-public-v1",
  "./js/curriculumRegistry.js?v=study-canvas-public-v1",
  "./js/data/learningCommands.js?v=study-canvas-public-v1",
  "./js/data/learningQueries.js?v=study-canvas-public-v1",
  "./js/decimalDomain.js?v=study-canvas-public-v1",
  "./js/decimalGenerator.js?v=study-canvas-public-v1",
  "./js/decimalRepresentationView.js?v=study-canvas-public-v1",
  "./js/displayLabels.js?v=study-canvas-public-v1",
  "./js/draftEngine.js?v=study-canvas-public-v1",
  "./js/englishActivitySelector.js?v=study-canvas-public-v1",
  "./js/englishCoreV2Loader.js?v=study-canvas-public-v1",
  "./js/englishCoreV2Runtime.js?v=study-canvas-public-v1",
  "./js/englishCoreV2Session.js?v=study-canvas-public-v1",
  "./js/englishVocabularyStudy.js?v=study-canvas-public-v1",
  "./js/englishVocabularyView.js?v=study-canvas-public-v1",
  "./js/exactAiReviewPolicy.js?v=study-canvas-public-v1",
  "./js/explainer.js?v=study-canvas-public-v1",
  "./js/exposureSelector.js?v=study-canvas-public-v1",
  "./js/f16dReviewEvidence.js?v=study-canvas-public-v1",
  "./js/fractionConcepts.js?v=study-canvas-public-v1",
  "./js/fractionOperationGenerator.js?v=study-canvas-public-v1",
  "./js/fractionOperations.js?v=study-canvas-public-v1",
  "./js/fractionRepresentationView.js?v=study-canvas-public-v1",
  "./js/guardianFeedbackPresets.js?v=study-canvas-public-v1",
  "./js/historicalGradingReference.js?v=study-canvas-public-v1",
  "./js/interactionGuard.js?v=study-canvas-public-v1",
  "./js/koreanActivitySelector.js?v=study-canvas-public-v1",
  "./js/languageCandidateProgress.js?v=study-canvas-public-v1",
  "./js/languageCandidateVisibility.js?v=study-canvas-public-v1",
  "./js/learners/learnerCommands.js?v=study-canvas-public-v1",
  "./js/learners/learnerQueries.js?v=study-canvas-public-v1",
  "./js/learners/learnerView.js?v=study-canvas-public-v1",
  "./js/learningActivity.js?v=study-canvas-public-v1",
  "./js/learningRouteResolver.js?v=study-canvas-public-v1",
  "./js/masteryEngine.js?v=study-canvas-public-v1",
  "./js/mathArithmeticAdapter.js?v=study-canvas-public-v1",
  "./js/mathF16dCoverage.js?v=study-canvas-public-v1",
  "./js/mathF16dGenerator.js?v=study-canvas-public-v1",
  "./js/mathF16dRepresentation.js?v=study-canvas-public-v1",
  "./js/mathF16dRuntime.js?v=study-canvas-public-v1",
  "./js/mathF16dSelection.js?v=study-canvas-public-v1",
  "./js/mathF16dSpec.js?v=study-canvas-public-v1",
  "./js/mathGen.js?v=study-canvas-public-v1",
  "./js/measurementUnitCatalog.js?v=study-canvas-public-v1",
  "./js/measurementUnitGenerator.js?v=study-canvas-public-v1",
  "./js/migrationEngine.js?v=study-canvas-public-v1",
  "./js/modalEngine.js?v=study-canvas-public-v1",
  "./js/navigationHierarchy.js?v=study-canvas-public-v1",
  "./js/parentGrading.js?v=study-canvas-public-v1",
  "./js/platform/appBootstrap.js?v=study-canvas-public-v1",
  "./js/platform/appRouter.js?v=study-canvas-public-v1",
  "./js/platform/appShell.js?v=study-canvas-public-v1",
  "./js/platform/subjectRegistry.js?v=study-canvas-public-v1",
  "./js/practiceInteractionGuard.js?v=study-canvas-public-v1",
  "./js/publicReleasePolicy.js?v=study-canvas-public-v1",
  "./js/questionAnswerDisplay.js?v=study-canvas-public-v1",
  "./js/questionIdentity.js?v=study-canvas-public-v1",
  "./js/recommendations/recommendationEngine.js?v=study-canvas-public-v1",
  "./js/responseEngine.js?v=study-canvas-public-v1",
  "./js/reviewRetryPresentation.js?v=study-canvas-public-v1",
  "./js/sessionEngine.js?v=study-canvas-public-v1",
  "./js/sessionHistoryLabel.js?v=study-canvas-public-v1",
  "./js/shortcuts.js?v=study-canvas-public-v1",
  "./js/sound.js?v=study-canvas-public-v1",
  "./js/storage.js?v=study-canvas-public-v1",
  "./js/submissionLifecycle.js?v=study-canvas-public-v1",
  "./js/theme.js?v=study-canvas-public-v1",
  "./js/timer.js?v=study-canvas-public-v1",
  "./js/typedInteractionSurface.js?v=study-canvas-public-v1",
  "./js/unifiedCurriculumRegistry.js?v=study-canvas-public-v1",
  "./js/updateEngine.js?v=study-canvas-public-v1",
  "./js/viewportEngine.js?v=study-canvas-public-v1",
  "./js/workbookCatalog.js?v=study-canvas-public-v1",
  "./js/workbookEngine.js?v=study-canvas-public-v1",
  "./js/workbookView.js?v=study-canvas-public-v1",
  /* MODULES_PRECACHE_END */
  "./",
  "./index.html",
  "./css/app.css?v=study-canvas-public-v1",
  "./js/app.js?v=study-canvas-public-v1",
  "./js/canvasEngine.js",
  "./js/sessionEngine.js",
  "./js/sessionHistoryLabel.js",
  "./js/questionAnswerDisplay.js",
  "./js/reviewRetryPresentation.js",
  "./js/parentGrading.js",
  "./js/mathGen.js",
  "./js/storage.js",
  "./js/draftEngine.js",
  "./js/updateEngine.js",
  "./js/timer.js",
  "./js/explainer.js",
  "./js/sound.js",
  "./js/confetti.js",
  "./js/theme.js",
  "./js/shortcuts.js",
  "./js/backupEngine.js",
  "./js/curriculumRegistry.js",
  "./js/masteryEngine.js",
  "./js/adaptiveEngine.js",
  "./js/interactionGuard.js",
  "./js/modalEngine.js",
  "./js/viewportEngine.js",
  "./js/migrationEngine.js",
  "./js/platform/appBootstrap.js",
  "./js/platform/appRouter.js",
  "./js/platform/appShell.js",
  "./js/platform/subjectRegistry.js",
  "./js/learners/learnerCommands.js",
  "./js/learners/learnerQueries.js",
  "./js/learners/learnerView.js",
  "./js/data/learningCommands.js",
  "./js/data/learningQueries.js",
  "./js/learningActivity.js",
  "./js/contentEligibility.js",
  "./js/workbookEngine.js",
  "./js/workbookCatalog.js",
  "./js/workbookView.js",
  "./js/typedInteractionSurface.js",
  "./js/unifiedCurriculumRegistry.js",
  "./js/mathArithmeticAdapter.js",
  "./js/contentPackageLoader.js",
  "./js/learningRouteResolver.js",
  "./js/measurementUnitCatalog.js",
  "./js/measurementUnitGenerator.js",
  "./js/koreanActivitySelector.js",
  "./js/englishActivitySelector.js",
  "./js/englishCoreV2Loader.js",
  "./js/englishCoreV2Session.js",
  "./js/englishCoreV2Runtime.js",
  "./js/englishVocabularyStudy.js",
  "./js/englishVocabularyView.js",
  "./js/fractionConcepts.js",
  "./js/fractionOperations.js",
  "./js/fractionOperationGenerator.js",
  "./js/fractionRepresentationView.js",
  "./js/decimalDomain.js",
  "./js/decimalRepresentationView.js",
  "./js/decimalGenerator.js",
  "./js/mathF16dSpec.js",
  "./js/mathF16dGenerator.js",
  "./js/mathF16dSelection.js",
  "./js/mathF16dRuntime.js",
  "./js/mathF16dRepresentation.js",
  "./js/guardianFeedbackPresets.js",
  "./js/navigationHierarchy.js",
  /* CONTENT_PACKAGES_PRECACHE_START */
  "./content/registry.json",
  "./content/packages/english-ai-reviewed-v1/activities.json",
  "./content/packages/english-ai-reviewed-v1/curriculum.json",
  "./content/packages/english-ai-reviewed-v1/manifest.json",
  "./content/packages/korean-ai-reviewed-v1/activities.json",
  "./content/packages/korean-ai-reviewed-v1/curriculum.json",
  "./content/packages/korean-ai-reviewed-v1/manifest.json",
  "./content/packages/math-decimal-v1/activities.json",
  "./content/packages/math-decimal-v1/curriculum.json",
  "./content/packages/math-decimal-v1/manifest.json",
  "./content/packages/math-fraction-concepts-v1/activities.json",
  "./content/packages/math-fraction-concepts-v1/curriculum.json",
  "./content/packages/math-fraction-concepts-v1/manifest.json",
  "./content/packages/math-fraction-operations-v1/activities.json",
  "./content/packages/math-fraction-operations-v1/curriculum.json",
  "./content/packages/math-fraction-operations-v1/manifest.json",
  "./content/packages/math-measurement-v1/activities.json",
  "./content/packages/math-measurement-v1/curriculum.json",
  "./content/packages/math-measurement-v1/manifest.json",
  "./content/packages/math-measurement-v1/unit-catalog.json",
  /* CONTENT_PACKAGES_PRECACHE_END */
  "./manifest.webmanifest",
  "./build-manifest.json",
  "./icon.svg",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  //+_+// App Shell 사전 캐싱 완료 후 waiting 상태 유지 (사용자 확인 후 교체)
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          // Other scoped applications and private review tools own their caches.
          if (key.startsWith("math-canvas-pro-v") && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

//+_+// Navigation 요청과 정적 Asset 요청 분리 처리
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const isNavigation = event.request.mode === "navigate" || event.request.destination === "document";
  // Standalone documents (notices/QA/JSON) own their cache key. Only SPA routes
  // may refresh or fall back to the application shell.
  const appBase = new URL('./', self.location.href).pathname;
  const relativePath = url.pathname.startsWith(appBase) ? url.pathname.slice(appBase.length).replace(/\/+$/, '') : null;
  const isAppRoute = relativePath !== null && ["index.html","","learners","home","bookshelf","workbook","workbook/read","math","math/arithmetic","math/arithmetic/practice","math/arithmetic/grading","math/arithmetic/result","math/measurement","math/measurement/practice","math/fraction","math/fraction/practice","math/decimal","math/decimal/practice","korean","korean/core","korean/core/practice","english","english/core","english/core/practice"].includes(relativePath);

  if (isNavigation && isAppRoute) {
    // Navigation: Network First -> Cache Fallback (index.html)
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            try {
              const cache = await caches.open(CACHE_NAME);
              await cache.put("./index.html", copy);
            } catch {}
          }
          return response;
        })
        .catch(() => {
          return caches.open(CACHE_NAME).then(async (cache) => {
            return (await cache.match("./index.html")) || cache.match("./");
          });
        })
    );
    return;
  }

  //+_+// 정적 Asset은 BUILD_ID cache 단위로 Cache First와 Network Fallback을 사용한다.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then(async (response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          try {
            await cache.put(event.request, copy);
          } catch {}
        }
        return response;
      });
    })
  );
});
