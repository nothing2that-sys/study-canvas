const CACHE_NAME = "math-canvas-pro-v20261003T065224180Z-8bd23fa";

//+_+// PWA 오프라인 구동을 위한 필수 App Shell 자산 목록
const APP_SHELL = [
  /* MODULES_PRECACHE_START */
  "./js/adaptiveEngine.js?v=20261003T065224180Z-8bd23fa",
  "./js/backupEngine.js?v=20261003T065224180Z-8bd23fa",
  "./js/canvasEngine.js?v=20261003T065224180Z-8bd23fa",
  "./js/canvasSceneGeometry.js?v=20261003T065224180Z-8bd23fa",
  "./js/confetti.js?v=20261003T065224180Z-8bd23fa",
  "./js/contentEligibility.js?v=20261003T065224180Z-8bd23fa",
  "./js/contentPackageLoader.js?v=20261003T065224180Z-8bd23fa",
  "./js/curriculumRegistry.js?v=20261003T065224180Z-8bd23fa",
  "./js/data/learningCommands.js?v=20261003T065224180Z-8bd23fa",
  "./js/data/learningQueries.js?v=20261003T065224180Z-8bd23fa",
  "./js/decimalDomain.js?v=20261003T065224180Z-8bd23fa",
  "./js/decimalGenerator.js?v=20261003T065224180Z-8bd23fa",
  "./js/decimalRepresentationView.js?v=20261003T065224180Z-8bd23fa",
  "./js/displayLabels.js?v=20261003T065224180Z-8bd23fa",
  "./js/draftEngine.js?v=20261003T065224180Z-8bd23fa",
  "./js/englishActivitySelector.js?v=20261003T065224180Z-8bd23fa",
  "./js/englishCoreV2Loader.js?v=20261003T065224180Z-8bd23fa",
  "./js/englishCoreV2Runtime.js?v=20261003T065224180Z-8bd23fa",
  "./js/englishCoreV2Session.js?v=20261003T065224180Z-8bd23fa",
  "./js/englishVocabularyStudy.js?v=20261003T065224180Z-8bd23fa",
  "./js/englishVocabularyView.js?v=20261003T065224180Z-8bd23fa",
  "./js/explainer.js?v=20261003T065224180Z-8bd23fa",
  "./js/f16dReviewEvidence.js?v=20261003T065224180Z-8bd23fa",
  "./js/fractionConcepts.js?v=20261003T065224180Z-8bd23fa",
  "./js/fractionOperationGenerator.js?v=20261003T065224180Z-8bd23fa",
  "./js/fractionOperations.js?v=20261003T065224180Z-8bd23fa",
  "./js/fractionRepresentationView.js?v=20261003T065224180Z-8bd23fa",
  "./js/guardianFeedbackPresets.js?v=20261003T065224180Z-8bd23fa",
  "./js/historicalGradingReference.js?v=20261003T065224180Z-8bd23fa",
  "./js/interactionGuard.js?v=20261003T065224180Z-8bd23fa",
  "./js/koreanActivitySelector.js?v=20261003T065224180Z-8bd23fa",
  "./js/learners/learnerCommands.js?v=20261003T065224180Z-8bd23fa",
  "./js/learners/learnerQueries.js?v=20261003T065224180Z-8bd23fa",
  "./js/learners/learnerView.js?v=20261003T065224180Z-8bd23fa",
  "./js/learningActivity.js?v=20261003T065224180Z-8bd23fa",
  "./js/learningRouteResolver.js?v=20261003T065224180Z-8bd23fa",
  "./js/masteryEngine.js?v=20261003T065224180Z-8bd23fa",
  "./js/mathArithmeticAdapter.js?v=20261003T065224180Z-8bd23fa",
  "./js/mathF16dCoverage.js?v=20261003T065224180Z-8bd23fa",
  "./js/mathF16dGenerator.js?v=20261003T065224180Z-8bd23fa",
  "./js/mathF16dRepresentation.js?v=20261003T065224180Z-8bd23fa",
  "./js/mathF16dRuntime.js?v=20261003T065224180Z-8bd23fa",
  "./js/mathF16dSelection.js?v=20261003T065224180Z-8bd23fa",
  "./js/mathF16dSpec.js?v=20261003T065224180Z-8bd23fa",
  "./js/mathGen.js?v=20261003T065224180Z-8bd23fa",
  "./js/measurementUnitCatalog.js?v=20261003T065224180Z-8bd23fa",
  "./js/measurementUnitGenerator.js?v=20261003T065224180Z-8bd23fa",
  "./js/migrationEngine.js?v=20261003T065224180Z-8bd23fa",
  "./js/modalEngine.js?v=20261003T065224180Z-8bd23fa",
  "./js/navigationHierarchy.js?v=20261003T065224180Z-8bd23fa",
  "./js/parentGrading.js?v=20261003T065224180Z-8bd23fa",
  "./js/platform/appBootstrap.js?v=20261003T065224180Z-8bd23fa",
  "./js/platform/appRouter.js?v=20261003T065224180Z-8bd23fa",
  "./js/platform/appShell.js?v=20261003T065224180Z-8bd23fa",
  "./js/platform/subjectRegistry.js?v=20261003T065224180Z-8bd23fa",
  "./js/practiceInteractionGuard.js?v=20261003T065224180Z-8bd23fa",
  "./js/questionAnswerDisplay.js?v=20261003T065224180Z-8bd23fa",
  "./js/recommendations/recommendationEngine.js?v=20261003T065224180Z-8bd23fa",
  "./js/responseEngine.js?v=20261003T065224180Z-8bd23fa",
  "./js/reviewRetryPresentation.js?v=20261003T065224180Z-8bd23fa",
  "./js/sessionEngine.js?v=20261003T065224180Z-8bd23fa",
  "./js/sessionHistoryLabel.js?v=20261003T065224180Z-8bd23fa",
  "./js/shortcuts.js?v=20261003T065224180Z-8bd23fa",
  "./js/sound.js?v=20261003T065224180Z-8bd23fa",
  "./js/storage.js?v=20261003T065224180Z-8bd23fa",
  "./js/submissionLifecycle.js?v=20261003T065224180Z-8bd23fa",
  "./js/theme.js?v=20261003T065224180Z-8bd23fa",
  "./js/timer.js?v=20261003T065224180Z-8bd23fa",
  "./js/typedInteractionSurface.js?v=20261003T065224180Z-8bd23fa",
  "./js/unifiedCurriculumRegistry.js?v=20261003T065224180Z-8bd23fa",
  "./js/updateEngine.js?v=20261003T065224180Z-8bd23fa",
  "./js/viewportEngine.js?v=20261003T065224180Z-8bd23fa",
  "./js/workbookCatalog.js?v=20261003T065224180Z-8bd23fa",
  "./js/workbookEngine.js?v=20261003T065224180Z-8bd23fa",
  "./js/workbookView.js?v=20261003T065224180Z-8bd23fa",
  /* MODULES_PRECACHE_END */
  "./",
  "./index.html",
  "./css/app.css?v=20261003T065224180Z-8bd23fa",
  "./js/app.js?v=20261003T065224180Z-8bd23fa",
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
  "./content/packages/english-core-v1/activities.json",
  "./content/packages/english-core-v1/curriculum.json",
  "./content/packages/english-core-v1/knowledge-catalog.json",
  "./content/packages/english-core-v1/manifest.json",
  "./content/packages/english-vocabulary-v1/activities.json",
  "./content/packages/english-vocabulary-v1/curriculum.json",
  "./content/packages/english-vocabulary-v1/manifest.json",
  "./content/packages/english-vocabulary-v1/words.json",
  "./content/packages/foundation-smoke/activities.json",
  "./content/packages/foundation-smoke/curriculum.json",
  "./content/packages/foundation-smoke/manifest.json",
  "./content/packages/korean-core-v1/activities.json",
  "./content/packages/korean-core-v1/curriculum.json",
  "./content/packages/korean-core-v1/knowledge-catalog.json",
  "./content/packages/korean-core-v1/manifest.json",
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
          if (key !== CACHE_NAME) {
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

  if (isNavigation) {
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
