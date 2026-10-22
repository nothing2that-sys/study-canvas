# 구조와 호출 흐름

브라우저에서 돌아가는 정적 ES module 앱입니다. 별도 서버 API·계정 시스템·클라우드 DB가 필요하지 않습니다. PWA service worker는 앱과 문항 파일을 캐시합니다.

```text
index.html → js/app.js → platform/appRouter.js
    → 학습자/과목/책장 → 과목별 session/selector
    → learningActivity.js → 선택·서술 입력 또는 canvasEngine.js
    → storage.js + draftEngine.js → 제출/입력 잠금
    → 보호자 parentGrading → 결과 → review queue → 재풀이 → 최종 확인

content/registry.json → package manifest → curriculum + activities
    → contentPackageLoader / contentEligibility / exposureSelector
    → UI 렌더러
```

`app/js/app.js`가 여러 화면의 연결과 DOM 이벤트를 담당합니다. 데이터 구조를 파악할 때 `learningActivity.js`의 normalize, 각 과목 selector, `storage.js`의 store 단위를 함께 읽으세요. 저장 데이터는 학습자·세션·attempt·필기·오답 복습으로 나뉩니다.

국어·영어는 `aiReviewPolicy.js`, `exactAiReviewPolicy.js`, `compactExactAiReviewPolicy.js`, `aiReviewResources.js`가 문항과 근거의 바이트·canonical binding을 검사합니다. `VERIFIED`라는 문자열만 바꿔 통과시키는 구조가 아닙니다. 프로젝트가 AI로 확인한 범위와 사람이 확인한 범위를 분리합니다.

UI 테마를 바꿀 때 원본 `app/`를 수정합니다. `scripts/build.mjs`는 소스 해시로 새 build ID를 만들고 `dist/`의 import map·service worker·app marker를 함께 갱신합니다. 개인 로컬 Git 정보는 build manifest에 넣지 않습니다. 문항 hash 파일은 UI 빌드 중 자동 재승인하지 않습니다.

`content-snapshot.json`은 최초 공개본의 파일 목록입니다. UI를 바꾼 뒤 해시가 달라지는 것은 자연스럽지만 문제은행 검증을 약화시킬 이유는 아닙니다. 앱 데이터 판본을 바꿀 때는 원천·license·검토와 함께 명시적으로 새 버전을 만드세요.
