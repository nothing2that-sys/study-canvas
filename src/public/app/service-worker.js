const CACHE_NAME = "math-canvas-pro-v20261002T074441153Z-cc537ca";

//+_+// PWA 오프라인 구동을 위한 필수 App Shell 자산 목록
const APP_SHELL = [
  /* MODULES_PRECACHE_START */
  "./js/adaptiveEngine.js?v=20261002T074441153Z-cc537ca",
  "./js/backupEngine.js?v=20261002T074441153Z-cc537ca",
  "./js/canvasEngine.js?v=20261002T074441153Z-cc537ca",
  "./js/canvasSceneGeometry.js?v=20261002T074441153Z-cc537ca",
  "./js/confetti.js?v=20261002T074441153Z-cc537ca",
  "./js/contentEligibility.js?v=20261002T074441153Z-cc537ca",
  "./js/contentPackageLoader.js?v=20261002T074441153Z-cc537ca",
  "./js/curriculumRegistry.js?v=20261002T074441153Z-cc537ca",
  "./js/data/learningCommands.js?v=20261002T074441153Z-cc537ca",
  "./js/data/learningQueries.js?v=20261002T074441153Z-cc537ca",
  "./js/decimalDomain.js?v=20261002T074441153Z-cc537ca",
  "./js/decimalGenerator.js?v=20261002T074441153Z-cc537ca",
  "./js/decimalRepresentationView.js?v=20261002T074441153Z-cc537ca",
  "./js/displayLabels.js?v=20261002T074441153Z-cc537ca",
  "./js/draftEngine.js?v=20261002T074441153Z-cc537ca",
  "./js/englishActivitySelector.js?v=20261002T074441153Z-cc537ca",
  "./js/englishCoreV2Loader.js?v=20261002T074441153Z-cc537ca",
  "./js/englishCoreV2Runtime.js?v=20261002T074441153Z-cc537ca",
  "./js/englishCoreV2Session.js?v=20261002T074441153Z-cc537ca",
  "./js/englishVocabularyStudy.js?v=20261002T074441153Z-cc537ca",
  "./js/englishVocabularyView.js?v=20261002T074441153Z-cc537ca",
  "./js/explainer.js?v=20261002T074441153Z-cc537ca",
  "./js/f16dReviewEvidence.js?v=20261002T074441153Z-cc537ca",
  "./js/fractionConcepts.js?v=20261002T074441153Z-cc537ca",
  "./js/fractionOperationGenerator.js?v=20261002T074441153Z-cc537ca",
  "./js/fractionOperations.js?v=20261002T074441153Z-cc537ca",
  "./js/fractionRepresentationView.js?v=20261002T074441153Z-cc537ca",
  "./js/guardianFeedbackPresets.js?v=20261002T074441153Z-cc537ca",
  "./js/historicalGradingReference.js?v=20261002T074441153Z-cc537ca",
  "./js/interactionGuard.js?v=20261002T074441153Z-cc537ca",
  "./js/koreanActivitySelector.js?v=20261002T074441153Z-cc537ca",
  "./js/learners/learnerCommands.js?v=20261002T074441153Z-cc537ca",
  "./js/learners/learnerQueries.js?v=20261002T074441153Z-cc537ca",
  "./js/learners/learnerView.js?v=20261002T074441153Z-cc537ca",
  "./js/learningActivity.js?v=20261002T074441153Z-cc537ca",
  "./js/learningRouteResolver.js?v=20261002T074441153Z-cc537ca",
  "./js/masteryEngine.js?v=20261002T074441153Z-cc537ca",
  "./js/mathArithmeticAdapter.js?v=20261002T074441153Z-cc537ca",
  "./js/mathF16dCoverage.js?v=20261002T074441153Z-cc537ca",
  "./js/mathF16dGenerator.js?v=20261002T074441153Z-cc537ca",
  "./js/mathF16dRepresentation.js?v=20261002T074441153Z-cc537ca",
  "./js/mathF16dRuntime.js?v=20261002T074441153Z-cc537ca",
  "./js/mathF16dSelection.js?v=20261002T074441153Z-cc537ca",
  "./js/mathF16dSpec.js?v=20261002T074441153Z-cc537ca",
  "./js/mathGen.js?v=20261002T074441153Z-cc537ca",
  "./js/measurementUnitCatalog.js?v=20261002T074441153Z-cc537ca",
  "./js/measurementUnitGenerator.js?v=20261002T074441153Z-cc537ca",
  "./js/migrationEngine.js?v=20261002T074441153Z-cc537ca",
  "./js/modalEngine.js?v=20261002T074441153Z-cc537ca",
  "./js/navigationHierarchy.js?v=20261002T074441153Z-cc537ca",
  "./js/parentGrading.js?v=20261002T074441153Z-cc537ca",
  "./js/platform/appBootstrap.js?v=20261002T074441153Z-cc537ca",
  "./js/platform/appRouter.js?v=20261002T074441153Z-cc537ca",
  "./js/platform/appShell.js?v=20261002T074441153Z-cc537ca",
  "./js/platform/subjectRegistry.js?v=20261002T074441153Z-cc537ca",
  "./js/practiceInteractionGuard.js?v=20261002T074441153Z-cc537ca",
  "./js/questionAnswerDisplay.js?v=20261002T074441153Z-cc537ca",
  "./js/recommendations/recommendationEngine.js?v=20261002T074441153Z-cc537ca",
  "./js/responseEngine.js?v=20261002T074441153Z-cc537ca",
  "./js/reviewRetryPresentation.js?v=20261002T074441153Z-cc537ca",
  "./js/sessionEngine.js?v=20261002T074441153Z-cc537ca",
  "./js/sessionHistoryLabel.js?v=20261002T074441153Z-cc537ca",
  "./js/shortcuts.js?v=20261002T074441153Z-cc537ca",
  "./js/sound.js?v=20261002T074441153Z-cc537ca",
  "./js/storage.js?v=20261002T074441153Z-cc537ca",
  "./js/submissionLifecycle.js?v=20261002T074441153Z-cc537ca",
  "./js/theme.js?v=20261002T074441153Z-cc537ca",
  "./js/timer.js?v=20261002T074441153Z-cc537ca",
  "./js/typedInteractionSurface.js?v=20261002T074441153Z-cc537ca",
  "./js/unifiedCurriculumRegistry.js?v=20261002T074441153Z-cc537ca",
  "./js/updateEngine.js?v=20261002T074441153Z-cc537ca",
  "./js/viewportEngine.js?v=20261002T074441153Z-cc537ca",
  "./js/workbookCatalog.js?v=20261002T074441153Z-cc537ca",
  "./js/workbookEngine.js?v=20261002T074441153Z-cc537ca",
  "./js/workbookView.js?v=20261002T074441153Z-cc537ca",
  /* MODULES_PRECACHE_END */
  "./",
  "./index.html",
  "./css/app.css?v=20261002T074441153Z-cc537ca",
  "./js/app.js?v=20261002T074441153Z-cc537ca",
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
