# Math Canvas Pro iPad 웹앱 안정화 및 UI UX 전면 보완 구현 지시서

- 문서 상태: 구현 지시용 확정본
- 작성일: 2026-08-23
- 대상 저장소: `Study Canvas 개발 저장소`
- 대상 브랜치: `main`
- 기준 커밋: `52d23a95b5f6b789be232beea4bebb82731c9646`
- 기준 커밋 메시지: `feat: complete Math Canvas Pro implementation (Checkpoint A ~ Milestone H)`
- 구현 방식: 다른 작업자가 이 문서 하나만 읽고 순서대로 전체 구현

---

# 1. 실행 지시

구현 담당자에게 다음 문장만 전달하면 된다.

> GitHub 저장소 `Study Canvas 개발 저장소`의 `Docs/CODEX_IPAD_WEBAPP_STABILIZATION_AND_UX_IMPLEMENTATION.md`를 읽고, 기준 커밋 이후 변경 사항을 확인한 다음 문서의 작업 순서와 완료 조건에 따라 전체 구현, 테스트, 문서 갱신, 커밋까지 완료해줘. 중간에 임의로 범위를 축소하지 말고 모든 체크리스트와 실기 검증 항목을 처리해줘.

구현 시작 전 반드시 최신 `main`을 확인한다. 기준 커밋 이후 다른 변경이 있으면 삭제하거나 덮어쓰지 말고 이 문서의 요구사항과 병합한다. 충돌하는 변경은 현재 동작과 테스트를 분석한 뒤 더 안전한 구현을 선택하고 작업 기록에 남긴다.

---

# 2. 목표

Math Canvas Pro를 일반 웹페이지가 아니라 iPad에서 장시간 문제풀이에 사용하는 전용 학습 웹앱으로 안정화한다.

최종 사용 경험은 다음과 같아야 한다.

1. Apple Pencil 필기는 첫 진입부터 정확하게 동작한다.
2. 손바닥과 손가락이 필기로 오인되지 않는다.
3. 빠르게 숫자를 써도 선이 누락되거나 끊기지 않는다.
4. 손가락은 현재 입력 모드 정책에 따라 세로 스크롤 또는 필기로만 사용된다.
5. 텍스트 선택, 길게 누르기 메뉴, 확대, 드래그 등 브라우저 기본 동작이 학습을 방해하지 않는다.
6. 화면 회전, Split View, 백그라운드 전환, PWA 종료 후에도 풀이가 보존된다.
7. 설정, 문제풀이, 채점 화면은 필요한 행동이 명확하고 필기 면적이 충분하다.
8. 배포 후 사용자가 구버전 JavaScript나 Service Worker를 계속 실행하지 않는다.
9. 오프라인 Cold Start가 가능하고 업데이트 중에도 진행 중인 학습을 잃지 않는다.

---

# 3. 제품 정책 확정

## 3.1 앱 전역 기본 정책

이 앱에서 기본적으로 허용하는 사용자 동작은 다음으로 제한한다.

- 세로 스크롤
- 버튼과 메뉴 탭
- Apple Pencil 또는 허용된 입력 장치의 필기
- 입력창의 키보드 입력과 커서 조작
- 모달과 패널 내부의 세로 스크롤

다음 브라우저 기본 동작은 앱 전체에서 차단한다.

- 텍스트 선택
- 이미지와 링크 드래그
- 길게 누르기 Callout 및 링크 미리보기
- 컨텍스트 메뉴
- 핀치 확대 축소
- 더블 탭 확대
- 가로 오버스크롤과 불필요한 화면 끌기
- 브라우저 드래그 앤드 드롭
- 허용되지 않은 멀티터치

모든 이벤트를 무조건 `preventDefault`하지 않는다. 화면 상태, 대상 요소, 입력 프로필을 판정하는 허용 목록 방식으로 처리한다. 세로 스크롤, 버튼, 입력창까지 막히는 구현은 실패로 판정한다.

## 3.2 입력 프로필

기존 `pencilOnly` Boolean 하나에 모든 플랫폼 정책을 넣지 않는다. 내부적으로 다음과 같은 명시적 입력 프로필을 사용한다.

| 프로필 | 대상 | Pen | Touch | Mouse |
|---|---|---:|---:|---:|
| `IPAD_PEN_ONLY` | iPad 기본 | 필기 | 세로 스크롤 | 무시 |
| `IPAD_PEN_TOUCH` | 손과 펜 공용 | 필기 | 필기 | 무시 |
| `DESKTOP_MOUSE_PEN` | Windows 기본 | 필기 | 무시 또는 스크롤 | 필기 |
| `DESKTOP_ALL_INPUT` | 터치 PC 선택 | 필기 | 필기 | 필기 |
| `READ_ONLY` | 결과 및 기록 보기 | 무시 | 세로 스크롤 | 선택 및 스크롤 |

외부 UI는 기존 표현을 유지할 수 있지만 Canvas 엔진에는 최종 입력 프로필을 전달한다. 플랫폼 자동 감지는 기본값을 정하는 용도로만 사용한다. 사용자가 선택한 명시적 설정을 임의로 다시 바꾸지 않는다.

## 3.3 화면 상태

앱 루트 또는 `body`에 현재 상태를 하나만 적용한다.

```text
mode-setup
mode-practice
mode-grading
mode-result
mode-modal-open
```

Interaction Guard, 고정 툴바, 스크롤 정책, 접근성 알림은 이 상태를 기준으로 동작한다.

## 3.4 웹앱 한계 처리

웹 코드만으로 iPadOS 홈 인디케이터, 앱 전환 제스처, 제어센터, OS 프로세스 종료를 완전히 차단할 수 없다. 이를 우회하려 하지 않는다.

대신 다음으로 대응한다.

- 홈 화면 추가 후 Standalone 실행 안내
- 진행 상태의 지속적 Draft 저장
- 종료 또는 프로세스 제거 후 이어하기
- Safe Area 대응
- 어린이 전용 사용 시 iPad 사용법 유도를 선택적으로 안내

---

# 4. 현재 코드에서 확인된 문제

## 4.1 입력 및 Canvas

- `src/public/app/js/canvasEngine.js`의 펜 전용 판정이 touch만 거부하며 엄격한 pen 허용 방식이 아니다.
- `getCoalescedEvents`를 사용하지 않아 빠른 필기의 중간 좌표가 누락될 수 있다.
- 각 `pointermove`에서 모든 Stroke를 다시 그려 획이 많아질수록 비용이 증가한다.
- `pointercancel`에서 현재 Stroke를 버린다.
- `lostpointercapture`를 처리하지 않는다.
- 명세에 있는 Pen Active Lock과 pen 종료 직후 touch 보호 구간이 구현되지 않았다.
- Canvas의 `touch-action: none`과 UI의 펜 전용 손가락 스크롤 설명이 충돌한다.

## 4.2 이벤트 차단

- 선택, 드래그, 컨텍스트 메뉴 차단이 대부분 Canvas에만 적용되어 있다.
- 앱 전역 Interaction Guard가 없다.
- `gesturestart`, `gesturechange`, `gestureend` 차단만으로 iPad 문제풀이 환경을 보장할 수 없다.
- 입력창, 버튼, 스크롤 영역의 예외 정책이 중앙화되어 있지 않다.

## 4.3 세션 생존성

- `storage.js`에 `saveDraftSession`, `getDraftSession`, `clearDraftSession`이 있으나 `app.js`의 실제 흐름에 연결되어 있지 않다.
- 새로고침, 백그라운드 종료, PWA 종료 시 진행 중 풀이 복구가 보장되지 않는다.
- 종료 확인 문구와 Draft 기능 요구가 일치하지 않는다.

## 4.4 PWA 및 배포

- `src/public/app`과 `src/dist-package`의 JavaScript와 Service Worker가 서로 다르다.
- 배포 산출물이 구버전이면 최초 Pencil Only 오류가 재현될 수 있다.
- 정적 자산이 Cache First이고 원자적인 Release 버전 관리가 부족하다.
- HTML의 CSS와 JS 쿼리 버전이 Service Worker 캐시 버전과 일치하지 않는다.
- 업데이트 감지, 사용자 안내, 안전한 재시작 흐름이 없다.
- Manifest 아이콘이 SVG 하나뿐이다.

## 4.5 UI 및 반응형

- 설정 화면에 일반 사용자용 선택과 고급 설정이 한 번에 노출된다.
- 문제풀이 중 상단 메뉴, 펜 툴바, 카드별 버튼, 플로팅 툴바, 문제 이동 바, 페이지 툴바가 중복된다.
- 왼쪽과 오른쪽 하단 고정 바가 좁은 화면과 키보드 표시 중 겹칠 수 있다.
- 하단 Safe Area만 일부 적용되고 상단과 가로 모드 좌우 Safe Area가 부족하다.
- `.practice-header`는 Grid인데 작은 화면에서 `flex-direction`을 지정해 반응형 규칙이 적용되지 않는다.
- 화면 키보드가 표시될 때 `visualViewport` 기반 위치 보정이 없다.
- iPad Split View와 Stage Manager 너비에 대한 별도 검증이 없다.

## 4.6 문서 및 테스트

- 통합 명세서의 Pen Active Lock 요구와 실제 구현이 다르다.
- 통합 명세서의 브라우저 UI 확대 정책과 실제 `user-scalable=no` 설정이 충돌한다.
- Canvas 테스트가 단순 down, move, up만 검증하며 iPad 입력 실패 시나리오를 포함하지 않는다.
- 진행 현황 문서에는 구현 전 상태와 구현 완료 선언이 혼재한다.

---

# 5. 구현 원칙

1. `src/public/app`을 정적 앱의 유일한 원본으로 사용한다.
2. `src/dist-package`는 빌드 결과물로만 생성한다.
3. 입력 수락 여부는 하나의 함수 또는 입력 컨트롤러에서 결정한다.
4. 입력 좌표 수집과 화면 렌더링을 분리한다.
5. 진행 데이터는 종료 시 한 번 저장하지 않고 사용 중 지속적으로 저장한다.
6. 문제풀이 중 UI는 기능 수보다 필기 면적과 집중도를 우선한다.
7. 파괴적 동작은 가능한 한 Undo 또는 복구 가능한 Toast로 처리한다.
8. 실제 iPad 검증 전 Apple Pencil 및 팜 리젝션 완료로 표시하지 않는다.
9. 기존 학습 엔진, 적응형 출제, 저장 데이터와 사용자 변경을 보존한다.
10. 새 코드 주석이 필요하면 프로젝트 규칙에 맞춰 `//+_+//`로 시작한다.

---

# 6. 구현 체크리스트

## 작업 1. 기준선 확인과 배포 SSOT 정리

- [ ] 최신 `main`과 기준 커밋 이후 변경을 비교한다.
- [ ] `src/public/app`을 원본으로 확정한다.
- [ ] `src/dist-package` 직접 수정 경로를 제거하거나 빌드 산출물임을 명확히 한다.
- [ ] 빌드 스크립트가 원본에서 배포 패키지를 재생성하도록 한다.
- [ ] 빌드 후 핵심 HTML, CSS, JS, Service Worker의 해시 또는 내용 일치를 검증한다.

관련 파일:

- `src/scripts/build-verified.sh`
- `src/public/app/**`
- `src/dist-package/**`
- `src/package.json`
- `.github/workflows/**`

완료 조건:

- 배포 패키지의 Pencil Only 초기값과 Canvas 엔진이 원본과 동일하다.
- 원본 변경 후 산출물을 갱신하지 않으면 CI가 실패한다.
- 중복 원본을 어느 쪽에서 수정해야 하는지 혼동할 수 없다.

검증:

```bash
cd src
npm test
npm run build
```

빌드 후 원본과 산출물의 핵심 파일 비교 검사를 실행한다.

---

## 작업 2. 입력 프로필과 중앙 입력 판정기 구현

- [ ] 명시적 입력 프로필 Enum 또는 상수 집합을 만든다.
- [ ] `shouldAcceptPointer(event, profile, state)`와 같은 단일 판정 경로를 만든다.
- [ ] `IPAD_PEN_ONLY`에서는 `pointerType === "pen"`만 필기로 수락한다.
- [ ] `mouse`, `touch`, 빈 값, 알 수 없는 타입을 펜 전용 필기로 수락하지 않는다.
- [ ] Windows 마우스 허용 정책을 iPad Pencil Only와 분리한다.
- [ ] Canvas 생성 시 현재 프로필을 즉시 적용한다.
- [ ] 프로필 전환 중 활성 Stroke를 안전하게 종료한다.

관련 파일:

- `src/public/app/js/canvasEngine.js`
- `src/public/app/js/app.js`
- 필요 시 `src/public/app/js/interactionController.js` 신규 생성

완료 조건:

- LocalStorage가 없는 첫 실행에서 iPad는 펜 전용으로 시작한다.
- 첫 문제 진입 직후 손가락이 선을 만들지 않는다.
- 모드를 바꿨다가 되돌리지 않아도 초기 상태가 정확하다.
- Windows에서는 기본 마우스 필기가 계속 동작한다.

검증:

- pen, touch, mouse, unknown PointerEvent 단위 테스트
- 새 Canvas 생성 직후 프로필 테스트
- 프로필 전환 중 포인터 입력 테스트

---

## 작업 3. Pen Active Lock과 팜 리젝션 상태 머신 구현

- [ ] `activePenPointerId`를 관리한다.
- [ ] Pencil Stroke 중 모든 touch와 추가 pointer를 무시한다.
- [ ] 손바닥 touch가 먼저 들어온 상태에서도 Pencil을 우선한다.
- [ ] Pencil 종료 후 300ms에서 500ms 범위의 touch 보호 구간을 둔다.
- [ ] `pointerup`, `pointercancel`, `lostpointercapture`, blur 상황에서 Lock을 해제한다.
- [ ] Pointer ID가 다른 move와 up 이벤트를 현재 Stroke에 섞지 않는다.
- [ ] 에러 또는 예외 후 입력 상태가 고착되지 않도록 reset 경로를 만든다.

권장 내부 상태:

```text
idle
touch-scroll
touch-drawing
pen-drawing
pen-cooldown
canceling
```

완료 조건:

- 손바닥이 먼저 닿은 후 Pencil로 써도 Pencil 획만 남는다.
- Pencil 필기 중 다른 손가락으로 눌러도 추가 선이 생기지 않는다.
- Pencil을 뗀 직후 손바닥이 선으로 변하지 않는다.
- 취소 이벤트 후 다음 Pencil Stroke가 정상 시작된다.

검증:

- 포인터 순서 조합 자동 테스트
- 실제 iPad에서 손바닥 먼저 접촉, Pencil 우선, 멀티터치 테스트

---

## 작업 4. 고속 필기 파이프라인과 렌더링 최적화

- [ ] `event.getCoalescedEvents()`가 있으면 모든 좌표를 시간 순서대로 수집한다.
- [ ] 일반 `pointermove` 좌표를 Fallback으로 유지한다.
- [ ] 좌표 수집 큐와 Canvas 렌더링을 분리한다.
- [ ] 한 프레임에 한 번만 렌더링하도록 `requestAnimationFrame`을 사용한다.
- [ ] 활성 Stroke는 새 구간만 증분 렌더링한다.
- [ ] Undo, Redo, Clear, Resize, Restore에서만 전체 다시 그리기를 수행한다.
- [ ] 중복 좌표와 지나치게 가까운 좌표를 안전하게 정리하되 숫자 모서리를 훼손하지 않는다.
- [ ] `pointercancel`과 `lostpointercapture`에서 좌표가 있는 Stroke를 보존한다.
- [ ] Eraser도 동일한 프레임 스케줄과 정규화 좌표계를 사용한다.

완료 조건:

- 합쳐진 100개 좌표 이벤트를 전달하면 Stroke에 좌표가 순서대로 보존된다.
- 빠른 원, 8, 0, 3, 세로획 반복에서 눈에 띄는 누락이 없다.
- Stroke 수가 늘어도 move 이벤트마다 전체 이력을 다시 그리지 않는다.
- 회전과 Resize 후 지우개 위치가 맞는다.

검증:

- Coalesced Event 단위 테스트
- 1000개 좌표 합성 입력 테스트
- RAF 호출 수 테스트
- Resize 및 지우개 Hit Test
- 실제 iPad에서 30초 이상 빠른 연속 숫자 필기

---

## 작업 5. 앱 전역 Interaction Guard 구현

- [ ] 화면 상태별 허용 이벤트 표를 코드로 구현한다.
- [ ] `selectstart`, `dragstart`, `contextmenu`를 앱 루트에서 차단한다.
- [ ] Safari `gesturestart`, `gesturechange`, `gestureend`를 차단한다.
- [ ] 앱 전역 `user-select`, `-webkit-user-select`, `-webkit-touch-callout` 정책을 적용한다.
- [ ] 입력창, Select, Textarea, Dialog 내부의 필요한 조작은 예외 처리한다.
- [ ] 링크 미리보기와 이미지 끌기를 방지한다.
- [ ] 가로 오버스크롤을 억제하고 세로 스크롤은 유지한다.
- [ ] 이벤트 리스너를 Capture 단계에서 중앙 관리하고 종료 시 제거 가능하게 한다.

필수 CSS 방향:

```text
앱 기본 영역
선택과 Callout 금지
세로 스크롤 허용

손과 펜 공용 Canvas
기본 터치 동작 금지

펜 전용 Canvas
손가락 세로 스크롤 정책 적용

입력 요소
키보드 입력과 커서 조작 허용
```

완료 조건:

- 문제풀이와 채점 중 긴 터치로 숫자 또는 설명 텍스트가 선택되지 않는다.
- 길게 눌러도 Safari Callout이 나타나지 않는다.
- 핀치와 더블 탭으로 화면이 확대되지 않는다.
- 버튼, Select, 숫자 입력, 세로 스크롤은 정상 동작한다.

검증:

- Interaction Guard DOM 테스트
- 허용 대상과 차단 대상 테스트
- Setup, Practice, Grading, Result별 실제 iPad 테스트

---

## 작업 6. 펜 필기와 손가락 스크롤의 공존 구현

- [ ] 펜 전용 프로필에서 손가락은 선을 만들지 않고 페이지 세로 스크롤을 수행한다.
- [ ] 손과 펜 공용 프로필에서 손가락은 Canvas 필기로 동작한다.
- [ ] Pencil 필기 중에는 페이지가 스크롤되지 않는다.
- [ ] 스크롤 시작을 필기로 잘못 변환하지 않는다.
- [ ] iPad Safari에서 Canvas의 동적 `touch-action` 정책을 실기 검증한다.
- [ ] `pan-y`가 Pencil 안정성을 해치면 카드 좌우 또는 별도 스크롤 Gutter를 제공한다.
- [ ] 현재 입력 모드가 화면에 항상 명확하게 표시되도록 한다.

완료 조건:

- 펜 전용에서 문제 카드 위로 손가락을 움직여 다음 문제로 이동할 수 있다.
- Pencil은 동일 영역에서 즉시 필기한다.
- 손과 펜 공용으로 전환하면 손가락 필기가 가능하다.
- 모드 변경 후 새로고침 없이 모든 활성 Canvas에 즉시 반영된다.

검증:

- 동적 입력 프로필 테스트
- iPad Safari와 홈 화면 PWA 양쪽에서 테스트
- 세로 모드, 가로 모드, Split View 테스트

---

## 작업 7. Draft 자동 저장과 세션 복구 연결

- [ ] 기존 Draft API를 `app.js`의 실제 세션 흐름에 연결한다.
- [ ] Stroke 종료 후 Debounce 방식으로 Draft를 저장한다.
- [ ] 페이지 이동, 채점 전환, 모드 전환 시 즉시 저장한다.
- [ ] `visibilitychange`, `pagehide` 이전에도 최신 상태가 이미 저장되어 있도록 지속 저장한다.
- [ ] 앱 시작 시 미완료 Draft를 감지한다.
- [ ] `이어하기`, `처음부터` 선택 UI를 제공한다.
- [ ] 완료된 채점 저장 후 해당 Draft를 삭제한다.
- [ ] 저장 실패, Quota 오류, IndexedDB 오류를 사용자에게 알린다.
- [ ] `navigator.storage.persist()`는 지원되는 경우 최선 노력 방식으로 요청한다.
- [ ] DB Version 변경 시 Migration과 Rollback 가능한 검증을 추가한다.

Draft에 포함할 최소 데이터:

- 세션 ID와 생성 시각
- 문제 목록과 순서
- 현재 페이지와 현재 문제
- 입력 프로필과 펜 설정
- 문제별 Stroke
- 문제별 실제 풀이 시간
- 채점 진행 상태와 빨간펜 데이터
- 앱 및 데이터 Schema 버전

완료 조건:

- 풀이 중 홈 화면으로 나갔다 돌아오면 그대로 이어진다.
- PWA를 종료하고 다시 열어도 마지막 저장 시점에서 이어진다.
- 회전 직후 종료해도 Stroke가 복원된다.
- 채점 완료 세션은 중복 Draft로 다시 나타나지 않는다.

검증:

- Draft 저장, 복원, 삭제 단위 테스트
- 강제 Reload 통합 테스트
- PWA 종료 후 재실행 실기 테스트
- IndexedDB Migration 테스트

---

## 작업 8. Service Worker와 Release 업데이트 안정화

- [ ] 빌드마다 하나의 Build ID를 생성한다.
- [ ] HTML, JS, CSS, Service Worker가 동일한 Build ID를 사용한다.
- [ ] 버전이 없는 Cache First 정적 자산 운영을 제거한다.
- [ ] Revision이 포함된 자산명 또는 일관된 Cache Name 교체 방식을 사용한다.
- [ ] 새 Service Worker 발견 시 업데이트 준비 상태를 앱에 알린다.
- [ ] 활성 Practice 또는 Grading 중에는 강제 Reload하지 않는다.
- [ ] Draft 저장 후 사용자가 안전하게 새 버전을 적용할 수 있게 한다.
- [ ] `controllerchange`와 Reload 중복을 방지한다.
- [ ] Navigation Offline Fallback과 JS 요청 Fallback을 분리한다.
- [ ] 오래된 Cache 정리와 오프라인 Cold Start를 검증한다.

완료 조건:

- 배포 직후 새로 설치한 사용자는 새 버전을 실행한다.
- 기존 사용자는 업데이트 안내 후 안전하게 새 버전으로 전환한다.
- 활성 세션이 업데이트 때문에 갑자기 새로고침되지 않는다.
- 오프라인에서 앱을 완전히 종료 후 다시 실행할 수 있다.
- JS 요청 실패 시 HTML이 JavaScript로 반환되지 않는다.

검증:

- Service Worker 자동 테스트
- 구버전 Cache를 가진 상태에서 업데이트 테스트
- 온라인 설치 후 오프라인 Cold Start
- 오프라인에서 풀이, 저장, 재실행 테스트

---

## 작업 9. PWA Manifest, Safe Area, Viewport 보완

- [ ] Apple Touch Icon 180 PNG를 추가한다.
- [ ] PWA Icon 192 PNG와 512 PNG를 추가한다.
- [ ] Maskable 512 PNG를 추가한다.
- [ ] Manifest의 아이콘 Purpose를 올바르게 분리한다.
- [ ] 상단, 하단, 좌측, 우측 Safe Area를 모두 반영한다.
- [ ] Standalone과 Safari 탭 실행 상태를 구분해 안내한다.
- [ ] 화면 회전과 `visualViewport` 변경을 처리한다.
- [ ] 화면 키보드가 채점 입력과 완료 버튼을 가리지 않게 한다.
- [ ] `user-scalable=no` 정책을 유지한다면 앱 내부 큰 글자 또는 1문제 집중 보기를 제공한다.

완료 조건:

- iPad 홈 화면 아이콘이 정상 표시된다.
- 가로 모드에서 좌우 시스템 영역과 UI가 겹치지 않는다.
- 키보드가 열린 채점 화면에서 현재 입력창과 완료 버튼을 사용할 수 있다.
- Split View에서도 가로 스크롤 없이 핵심 기능을 사용할 수 있다.

검증:

- Manifest 검사
- 768, 810, 820, 834, 1024 CSS Pixel 너비 검증
- 가로와 세로 Safe Area 검증
- 화면 키보드 표시 상태 실기 검증

---

## 작업 10. 문제풀이 UI 단순화

- [ ] Practice 중 전역 상단 메뉴를 학습용 Compact Header로 축소한다.
- [ ] 상단에는 진행률, 경과 시간, 나가기만 우선 표시한다.
- [ ] 기본 펜 툴바와 플로팅 툴바의 중복을 제거한다.
- [ ] 하단 컨트롤을 하나의 Adaptive Dock으로 통합한다.
- [ ] Dock에는 이전, 다음, 펜, 지우개, Undo, 제출의 핵심 동작을 우선 배치한다.
- [ ] 색상, 굵기, 입력 모드는 보조 패널로 이동한다.
- [ ] 카드별 Undo와 Clear는 중복 여부를 검토해 최소화한다.
- [ ] 전체 지우기와 문제 지우기는 Undo 가능한 상태로 만든다.
- [ ] Dock 높이를 CSS 변수로 관리하고 본문 하단 Padding에 반영한다.
- [ ] 현재 활성 문제를 명확하게 표시한다.
- [ ] 다음 미완료 문제 이동이 한 번의 탭으로 가능해야 한다.

완료 조건:

- 문제풀이 중 동시에 보이는 주요 조작 영역은 Compact Header와 하단 Dock 두 개를 넘지 않는다.
- 1문제 모드에서 필기 영역이 화면의 핵심 면적을 차지한다.
- 4문제 이상 모드에서도 고정 UI가 문제를 가리지 않는다.
- Clear를 실수로 눌러도 복구 가능하다.

검증:

- 각 Breakpoint에서 요소 겹침 검사
- 마지막 문제까지 스크롤했을 때 Dock 가림 검사
- 실제 Pencil을 쥔 상태에서 한 손 조작 검사

---

## 작업 11. 설정 및 채점 UI UX 개편

- [ ] 첫 화면의 최우선 행동을 `오늘의 추천 학습 시작`으로 둔다.
- [ ] 현재 단계, 추천 이유, 보완할 기술, 예상 문제 수를 한 카드에 보여준다.
- [ ] 오답 복습과 직접 설정을 두 번째 행동으로 둔다.
- [ ] 자릿수, 행열, 특수 조건은 고급 설정으로 접는다.
- [ ] 기존 전체 기능은 삭제하지 않고 Progressive Disclosure로 재배치한다.
- [ ] 채점 화면은 학생 풀이를 우선 크게 보여준다.
- [ ] 정답과 오답 버튼을 최소 44px 이상의 큰 버튼으로 제공한다.
- [ ] 오답 선택 시에만 모범 풀이, 오답 원인, 피드백을 확장한다.
- [ ] 채점 완료 후 다음 미채점 문제로 이동한다.
- [ ] 빨간펜은 선택 기능으로 유지하고 학생 원본 Stroke와 별도 Layer로 보존한다.
- [ ] Grid 요소의 잘못된 `flex-direction` 반응형 규칙을 수정한다.

완료 조건:

- 신규 사용자가 고급 설정을 열지 않고 추천 학습을 시작할 수 있다.
- 채점자는 정답 또는 오답을 한 번의 탭으로 기록할 수 있다.
- 오답 처리 후 다음 행동이 명확하다.
- 기존 직접 설정 기능과 학습 기록 접근이 유지된다.

검증:

- Setup에서 추천 학습 시작까지 탭 수 확인
- Grading에서 10문제 연속 채점 흐름 확인
- 세로, 가로, 좁은 Split View 반응형 검사
- 키보드와 Dialog Focus 검사

---

## 작업 12. 접근성, 자동 테스트, 실기 검증, 문서 완료

- [ ] 진행률, 저장 상태, 오프라인 상태, 채점 상태에 적절한 `aria-live`를 적용한다.
- [ ] 모든 핵심 버튼의 접근 가능한 이름과 Focus 표시를 확인한다.
- [ ] 색상만으로 정답과 오답을 구분하지 않는다.
- [ ] `prefers-reduced-motion`을 유지한다.
- [ ] 입력 엔진, Interaction Guard, Draft, PWA, UI 상태 테스트를 추가한다.
- [ ] 기존 전체 테스트를 실행하고 실패를 해결한다.
- [ ] 실제 iPad 실기 검증 결과를 기록한다.
- [ ] README의 iPad 검증 상태를 사실대로 갱신한다.
- [ ] 통합 명세서에 확정된 전역 이벤트 정책과 입력 프로필을 반영한다.
- [ ] 버그 문서와 진행 현황 문서를 최신 상태로 갱신한다.
- [ ] 완료되지 않은 실기 항목을 완료로 표시하지 않는다.

완료 조건:

- 전체 자동 테스트 통과
- 빌드 통과
- 배포 산출물 일치 검사 통과
- iPad 실기 검증표 작성
- 남은 제한 사항과 웹앱 한계가 문서에 명확히 남아 있음

검증:

```bash
cd src
npm test
npm run build
```

최종 검증 결과와 테스트 환경을 `Docs`에 기록한다.

---

# 7. 필수 자동 테스트 목록

## 7.1 입력 프로필

- [ ] 첫 실행 iPad 기본값은 `IPAD_PEN_ONLY`
- [ ] Pen Only에서 pen 수락
- [ ] Pen Only에서 touch 거부
- [ ] Pen Only에서 mouse 거부
- [ ] Pen Only에서 unknown 거부
- [ ] Windows 기본에서 왼쪽 mouse 수락
- [ ] 읽기 전용 Canvas에서 모든 필기 거부

## 7.2 Palm 및 Pointer 상태

- [ ] touch down 후 pen down 시 pen 우선
- [ ] pen down 후 touch down 무시
- [ ] 다른 Pointer ID의 move 무시
- [ ] `pointercancel` 후 다음 Stroke 정상
- [ ] `lostpointercapture` 후 다음 Stroke 정상
- [ ] pen cooldown 중 touch 필기 거부
- [ ] 입력 프로필 전환 중 활성 Stroke 안전 종료

## 7.3 고속 필기

- [ ] Coalesced 좌표 전체 수집
- [ ] 좌표 시간 순서 보장
- [ ] 합성 1000 좌표 처리
- [ ] RAF당 렌더링 1회 제한
- [ ] Cancel 시 유효 Stroke 보존
- [ ] Resize 후 Stroke 위치 보존
- [ ] Resize 후 Eraser Hit Test 일치

## 7.4 Interaction Guard

- [ ] Practice에서 선택 차단
- [ ] Grading에서 선택 차단
- [ ] Result에서 필요 없는 선택 차단
- [ ] 입력창 키보드 입력 허용
- [ ] 버튼 탭 허용
- [ ] 세로 스크롤 허용
- [ ] 핀치와 Safari Gesture 차단
- [ ] Listener 등록과 제거 대칭성

## 7.5 Draft와 수명주기

- [ ] Stroke 변경 후 Draft 저장
- [ ] 페이지 변경 즉시 저장
- [ ] 복원 시 현재 페이지와 Stroke 일치
- [ ] 채점 상태 복원
- [ ] 완료 후 Draft 삭제
- [ ] Schema Migration
- [ ] 저장 실패 UI

## 7.6 PWA

- [ ] App Shell 설치
- [ ] Offline Navigation Fallback
- [ ] JS 실패 시 HTML 반환 금지
- [ ] 이전 Cache 제거
- [ ] 새 Build ID 감지
- [ ] 활성 세션 중 자동 Reload 금지
- [ ] 안전한 업데이트 후 한 번만 Reload

## 7.7 UI 상태

- [ ] 화면 상태 Class가 하나만 존재
- [ ] Practice에서 하단 Dock만 표시
- [ ] Grading에서 채점 Dock 표시
- [ ] Result에서 필기 Dock 숨김
- [ ] 좁은 화면에서 Header Grid 재배치
- [ ] 모달 Focus 복귀
- [ ] 고정 UI와 마지막 문제 미겹침

---

# 8. 실제 iPad 필수 검증표

테스트 환경마다 Safari 탭과 홈 화면 PWA를 모두 확인한다.

## 8.1 첫 실행

- [ ] 사이트 데이터와 LocalStorage를 삭제한다.
- [ ] 첫 문제풀이 진입 직후 손가락으로 선이 생기지 않는다.
- [ ] 설정 토글을 건드리지 않아도 Pencil Only가 실제 적용된다.
- [ ] Apple Pencil로 즉시 필기 가능하다.

## 8.2 팜 리젝션

- [ ] 손바닥을 먼저 올리고 Pencil로 필기한다.
- [ ] Pencil 필기 중 다른 손가락을 움직인다.
- [ ] Pencil을 뗀 직후 손바닥을 움직인다.
- [ ] 손과 펜 공용 모드 전환 후 손가락 필기를 확인한다.
- [ ] 다시 펜 전용으로 전환 후 손가락 필기가 차단되는지 확인한다.

## 8.3 필기 품질

- [ ] 0부터 9까지 빠르게 반복한다.
- [ ] 긴 세로선과 짧은 모서리를 빠르게 반복한다.
- [ ] 원과 8을 연속으로 그린다.
- [ ] 30초 이상 멈추지 않고 필기한다.
- [ ] Undo, Redo, Eraser를 반복한다.

## 8.4 스크롤과 제스처

- [ ] 펜 전용에서 카드 위 손가락 세로 스크롤이 된다.
- [ ] Pencil 필기 중 페이지가 움직이지 않는다.
- [ ] 텍스트가 선택되지 않는다.
- [ ] 길게 누르기 메뉴가 나타나지 않는다.
- [ ] 핀치와 더블 탭으로 확대되지 않는다.
- [ ] 버튼과 입력창은 정상 동작한다.

## 8.5 화면 상태

- [ ] 세로에서 가로로 회전한다.
- [ ] 가로에서 세로로 회전한다.
- [ ] 회전 후 Stroke와 Eraser 좌표가 맞는다.
- [ ] Split View 너비를 변경한다.
- [ ] 화면 키보드를 열고 닫는다.
- [ ] 하단 Dock과 시스템 영역이 겹치지 않는다.

## 8.6 종료와 복구

- [ ] 풀이 중 홈으로 나갔다 돌아온다.
- [ ] Safari 탭을 닫고 다시 연다.
- [ ] 홈 화면 PWA를 종료하고 다시 연다.
- [ ] 네트워크를 끊고 다시 연다.
- [ ] 미완료 세션 이어하기를 실행한다.
- [ ] 채점 완료 후 Draft가 다시 나타나지 않는다.

## 8.7 업데이트

- [ ] 구버전을 실행한 상태에서 새 버전을 배포한다.
- [ ] 활성 세션 중 강제 Reload가 없는지 확인한다.
- [ ] 세션 저장 후 업데이트를 적용한다.
- [ ] 표시 Build ID와 실제 파일 버전이 일치한다.
- [ ] 다시 오프라인으로 실행한다.

---

# 9. UI UX 최종 구조

## 9.1 Setup

첫 화면 우선순위:

```text
오늘의 추천 학습
현재 단계와 추천 이유
추천 학습 시작
오답 복습
직접 설정
학습 기록
```

직접 설정 안에서만 다음을 노출한다.

- 연산 종류
- 상세 단계
- 자릿수
- 세로셈과 가로셈
- 문제 수
- 한 화면 배치
- 특정 숫자와 배수 조건

## 9.2 Practice

```text
Compact Header
진행률, 시간, 나가기

Problem Area
문제, 모눈, 필기 Canvas

Adaptive Bottom Dock
이전, 다음, 펜, 지우개, Undo, 제출
```

## 9.3 Grading

```text
Grading Header
채점 진행률, 미채점 수

Student Work
학생 문제와 필기

Primary Grade Actions
정답, 오답

Wrong Detail
모범 풀이, 오답 원인, 피드백, 빨간펜

Bottom Dock
이전 미채점, 다음 미채점, 채점 완료
```

## 9.4 Result

- 정확도
- 실제 풀이 시간
- 가장 오래 걸린 기술
- 반복 오답 유형
- 다음 추천 학습
- 오답 다시 풀기
- 기록 상세 보기

결과 화면에서는 필기용 고정 Dock을 숨긴다.

---

# 10. 성능 및 안정성 기준

- Pointer move 처리에서 동기식 전체 Stroke 재렌더링을 반복하지 않는다.
- 화면에 보이지 않는 Canvas 인스턴스는 정리하거나 읽기 전용으로 최소화한다.
- View 재렌더링 전 Canvas 인스턴스와 Listener를 대칭적으로 해제한다.
- Draft 저장은 입력을 막지 않도록 Debounce하고 명시적 전환에서는 Flush한다.
- 저장 실패를 무시하지 않고 상태를 표시한다.
- Service Worker 업데이트 때문에 진행 중 화면을 자동 Reload하지 않는다.
- 회전과 Resize 중 이미 저장된 Stroke를 잃지 않는다.
- 20문제 이상 장시간 사용 후에도 입력 지연이 누적되지 않아야 한다.

---

# 11. 변경 금지 및 비범위

이번 작업에서 다음을 임의로 추가하지 않는다.

- 손글씨 OCR
- 자동 정답 인식
- 외부 서버 계정 시스템
- 클라우드 동기화
- 광고와 결제
- 학습 엔진의 단계 정의 전면 교체
- 기존 사용자 데이터 삭제
- 기존 곱셈 및 나눗셈 문제 생성 기능 축소

UI 재배치 과정에서 기존 기능을 삭제하지 않는다. 사용 빈도가 낮은 설정은 고급 패널로 이동한다.

---

# 12. Git 및 커밋 원칙

권장 커밋 순서:

1. `fix: unify source and deployment artifacts`
2. `fix: add strict input profiles and pen active lock`
3. `perf: preserve fast pencil strokes with frame rendering`
4. `fix: add app interaction guard and scroll policy`
5. `feat: connect draft autosave and session resume`
6. `fix: make pwa updates atomic and recoverable`
7. `refactor: simplify practice and grading controls`
8. `test: add ipad input lifecycle and pwa regression coverage`
9. `docs: record ipad stabilization verification results`

각 커밋은 관련 테스트가 통과하는 독립적인 복구 지점이어야 한다. 기존 사용자 변경이나 관련 없는 파일을 되돌리지 않는다.

---

# 13. 최종 완료 정의

다음 조건을 모두 만족해야 전체 완료다.

- [ ] 첫 문제 진입부터 Pencil Only가 실제 적용된다.
- [ ] 손바닥이 먼저 닿아도 touch Stroke가 생기지 않는다.
- [ ] 빠른 필기 누락이 실기에서 재현되지 않는다.
- [ ] 펜 전용에서 손가락 세로 스크롤이 가능하다.
- [ ] Pencil 필기 중 페이지가 스크롤되지 않는다.
- [ ] 텍스트 선택, Callout, 확대, 드래그가 학습을 방해하지 않는다.
- [ ] 화면 회전 후 Stroke와 Eraser 좌표가 맞는다.
- [ ] 종료와 재실행 후 미완료 세션을 이어갈 수 있다.
- [ ] 오프라인 Cold Start가 가능하다.
- [ ] 구버전 Cache에서 새 버전으로 안전하게 전환된다.
- [ ] 원본과 배포 산출물이 일치한다.
- [ ] 문제풀이 고정 조작부가 하나의 Dock으로 정리된다.
- [ ] 설정 화면에서 추천 학습을 바로 시작할 수 있다.
- [ ] 채점 흐름이 한 문제당 정답 또는 오답 한 번의 탭으로 진행된다.
- [ ] 전체 자동 테스트와 빌드가 통과한다.
- [ ] 실제 iPad 검증 결과가 문서화된다.
- [ ] 완료하지 않은 항목은 완료로 표시하지 않는다.

---

# 14. 구현 완료 후 보고 형식

구현 담당자는 마지막에 다음 형식으로 보고한다.

```text
기준 커밋
최종 커밋

완료한 작업 1부터 12
각 작업의 주요 변경 파일

자동 테스트 결과
빌드 결과
배포 산출물 비교 결과

iPad 실기 검증 결과
Safari 탭 결과
홈 화면 PWA 결과

남은 제한 사항
실기 장비가 없어 확인하지 못한 항목

문서 갱신 목록
```

실제 iPad 장비로 확인하지 않은 항목은 `자동 테스트 완료, 실기 검증 대기`로 구분한다.

