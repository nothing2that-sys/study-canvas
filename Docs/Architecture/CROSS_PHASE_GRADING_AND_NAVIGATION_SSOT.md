# CROSS-PHASE GRADING UX AND GLOBAL LEARNING NAVIGATION SSOT

> **Document Status**: APPROVED & ACTIVE  
> **Phase Origin**: Phase F15B Independent Validation & Cross-Phase Rework  
> **Target Scope**: Universal (Math, Korean, English, Workbooks, Practice, Grading)  
> **Database Schema Compatibility**: `DB_VERSION = 8` (0 Schema Migrations Required)  

---

## 1. 배경 및 목적

Math Canvas Pro는 기초 연산(Phase F1~F9)에서 시작하여 측정 및 단위(F11), 국어(F12), 영어(F14), 분수(F15A/B) 등으로 확장되면서 드로잉 캔버스형 문제뿐만 아니라 선택형(CHOICE) 및 단답형(TEXT) 문제가 대거 추가되었습니다.

그러나 다음 3가지 핵심 영역에서 Cross-Phase UX 불일치가 관찰되었습니다:
1. **선택형/단답형 문제 채점 첨삭 불가**: 보호자 채점 모드에서도 학생용 라디오/입력 인터랙션이 살아있어, 애플 펜슬이나 마우스로 문제 영역 위에 자유롭게 첨삭(Red-pen annotation)하기 어렵거나 충돌하는 문제.
2. **채점 피드백 코멘트 칩의 교과 불일치**: 국어, 영어, 분수 채점 시에도 "받아올림 실수", "구구단 오류" 등 자연수 곱셈/나눗셈 전용 칩만 표시되는 문제.
3. **학습 네비게이션 부재/단절**: 복잡해진 13개 이상의 서브 뷰/교과 간 1단계 상위(Up) 또는 홈(Home)으로 안전하게 이동할 수 있는 통일된 네비게이션의 부재로 인해, 뒤로가기 시 풀이 Draft나 부분 채점 결과가 유실될 위험.

본 문서는 상기 3개 문제를 근본적으로 해결하기 위한 **플랫폼 전역 불변 계약(Single Source of Truth)**을 정의합니다.

---

## 2. Requirement A: 보호자 채점 첨삭 및 선택형 열람 전용화 계약

### 2.1 UI/상태 격리 원칙
- **열람 전용화(Read-Only Surface)**:
  - 채점 모드(`ROUTES.MATH_GRADING`) 진입 시, 모든 `CHOICE` 및 `TEXT` 컴포넌트는 즉시 비활성화(`disabled`) 및 클릭 차단(`pointer-events: none; user-select: none;`) 상태로 전환된다.
  - 컨테이너에 `.grading-choice-read-only`, `.is-read-only` 클래스가 부여된다.
- **학생 제출 응답 시각화**:
  - 학생이 선택한 번호/항목에는 `.selected-choice`, `.is-student-selected` 클래스가 적용되며, `<span class="student-selection-tag">학생 선택</span>` 배지가 명확히 노출된다.
  - 선택되지 않은 항목은 흐리게 처리(`opacity: 0.65`)되어 학생의 선택 여부를 채점자가 1초 만에 식별할 수 있다.
- **첨삭 캔버스 전면 탑재(Red-Pen Canvas Layer)**:
  - 모든 문제(CHOICE, TEXT, CANVAS 불문)의 `.problem-canvas-stage` 내에 `<canvas class="drawing-canvas grading-red-pen-canvas">`가 전면 배치된다.
  - CSS 레이어 스택:
    ```css
    .grading-card .problem-canvas-stage {
      position: relative;
    }
    .grading-card .problem-canvas-stage .drawing-canvas.grading-red-pen-canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10;
      pointer-events: auto !important;
      touch-action: none;
    }
    .grading-card .typed-activity-stage.grading-choice-read-only,
    .grading-card .typed-activity-stage.is-read-only {
      pointer-events: none !important;
      user-select: none !important;
    }
    ```
  - 결과적으로 보호자의 펜/마우스 스트로크는 캔버스(z-index: 10)에서 완벽히 수신되며, 하부의 선택지(z-index: 1)로 이벤트가 누수되거나 차단되지 않는다.

---

## 3. Requirement B: 교과 및 도메인 맞춤형 보호자 피드백 프리셋 계약

### 3.1 Taxonomy 및 모듈
- 모듈: `src/public/app/js/guardianFeedbackPresets.js`
- 단일 API: `getGuardianFeedbackPresets(params)` (문자열 `subjectId` 또는 `{ subjectId, courseId }` 객체 지원)

### 3.2 교과별 프리셋 정의
1. **공통 (Common)**:
   - `⭕ 완벽해요!`
   - `✏️ 다시 풀어보기`
   - `🔍 다시 한번 확인해 보세요`
   - `💭 조금만 더 생각해 보세요`
2. **수학 (Math - 연산/측정/분수)**:
   - `⚠️ 받아올림 실수`
   - `📐 자리맞춤 확인`
   - `✖ 구구단 오류`
   - `➗ 약분/통분 확인`
   - `🔢 분모/분자 확인`
   - `📏 단위 확인`
3. **국어 (Korean)**:
   - `📝 받침 확인`
   - `📐 띄어쓰기 확인`
   - `✏️ 맞춤법 확인`
   - `✍️ 글씨/획순 바르게`
   - `📖 문맥 다시 확인`
4. **영어 (English)**:
   - `✏️ 스펠링/철자 오류`
   - `🔤 대소문자 구분`
   - `🔊 파닉스 규칙`
   - `💡 단어 뜻 확인`
   - `📌 문장 부호 확인`

---

## 4. Requirement C: Compact Topbar 글로벌 학습 네비게이션 체계

> **Updated**: Phase F15C UX Rework — Breadcrumb UI 제거, Home/Up 버튼 Topbar 내부 통합

### 4.1 UI 구조 및 배치
- `<div id="topbarNavActions" class="topbar-nav-actions">` 가 `<header class="topbar">` **내부** (Brand 옆)에 위치한다.
- **2개 액션 버튼 (Topbar 내 통합)**:
  1. `홈(Home)` `[id="globalNavHomeBtn"]`: 어떤 깊이의 화면에서든 1클릭으로 통합 학습 대시보드(`/home`)로 복귀.
  2. `위로(Up)` `[id="globalNavUpBtn"]`: 현재 학습 컨텍스트의 논리적 1단계 상위 뷰로 복귀.
- **Breadcrumb UI는 제거되었으나**, `getNavigationHierarchy()`가 반환하는 `breadcrumbs[]` 배열 데이터는 내부적으로 **유지**된다 (미래 확장 및 Up 버튼 로직에 활용).
- Home 및 Learners 화면에서는 `topbarNavActions` 컨테이너 전체가 `hidden` 처리된다.
- **이전 `<nav id="globalLearningNav">` 요소는 DOM에서 완전히 제거**되었다.

### 4.2 안전 상태 보존 (Data Loss Prevention)
네비게이션 클릭(`handleSafeLearningNavigation(targetRoute)`) 시 다음 무손실 보존 로직이 필수 실행된다:
1. **보호자 채점 화면 (`ROUTES.MATH_GRADING`)**:
   - `persistCurrentGradingProgress()` 실행 -> 채점된 GradeDecision 및 빨간펜 스트로크가 원자적으로 `GRADING_ACTIVE` 상태로 IndexedDB에 저장.
   - `flushDraftSave()` 완료 후 안전 이동.
   - 홈 대시보드에 "채점 진행 중 (X/Y)" 카드가 유지되어 언제든 재개 가능.
2. **학생 풀이 화면 (`PRACTICE`)**:
   - `flushDraftSave()` 즉시 실행 -> 풀이 시간, 체크된 선택지, 텍스트 입력값, 필기 스트로크 무손실 저장.
   - 캔버스 인스턴스 정상 destroy 후 안전 이동.
   - 홈 또는 단원 화면에 "이어서 풀기" Draft 카드가 유지되어 언제든 재개 가능.

---

## 5. 검증 매트릭스

| 요구사항 ID | 검증 항목 | 대상 모듈 | 테스트 파일 | 상태 |
|---|---|---|---|---|
| **REQ-A** | Choice/Text Read-only + 캔버스 전면 탑재 | `typedInteractionSurface.js`, `app.js` | `phase-cross-phase-grading-nav.test.mjs` | ✅ PASS |
| **REQ-B** | 교과 특화 채점 피드백 프리셋 | `guardianFeedbackPresets.js` | `phase-cross-phase-grading-nav.test.mjs` | ✅ PASS |
| **REQ-C** | Compact Topbar 네비게이션 (Home/Up in Topbar) | `navigationHierarchy.js`, `app.js` | `phase-cross-phase-grading-nav.test.mjs` | ✅ PASS |
| **REQ-BRAND**| Study Canvas 브랜딩 (title, manifest, aria) | `index.html`, `manifest.webmanifest` | `phase-cross-phase-grading-nav.test.mjs` | ✅ PASS |
| **REG-ALL**| 전체 플랫폼 883개+ 단위/통합/E2E 테스트 | 전체 시스템 | `npm run test:unit` | ✅ PASS |
