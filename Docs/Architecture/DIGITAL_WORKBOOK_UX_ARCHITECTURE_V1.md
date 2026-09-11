# Digital Workbook UX Architecture v1

문서 상태: ARCHITECTURE_SSOT  
작성일: 2026-09-11  
상위 정본: `Docs/UNIFIED_CURRICULUM_ACTIVITY_PLATFORM_v2.3.md`  

---

# 1. 목적

Math Canvas Pro의 학습 경험을 앱 메뉴 중심에서 실제 문제집 중심으로 전환한다. 사용자는 책장에서 문제집을 선택하고 표지와 차례를 확인한 뒤 마지막 페이지부터 이어서 풀 수 있어야 한다.

문제집 표현은 친숙한 탐색 모델이며, 종이 질감이나 무거운 페이지 애니메이션을 구현하는 것이 목적은 아니다. 입력 안정성, 저장과 접근성을 우선한다.

# 2. 정보 구조

```text
Learner
└─ Bookshelf
   ├─ Fixed Workbook
   ├─ Personalized Workbook
   ├─ Review Workbook
   └─ Guardian Workbook
      └─ Workbook Edition
         └─ Unit
            └─ Page
               └─ Activity
```

학습 결과 구조:

```text
WorkbookAssignment
→ PageProgress
→ LearningSession
→ Draft
→ Submission
→ GradeDecision
→ ReviewItem
```

# 3. 핵심 엔터티

## 3.1 WorkbookDefinition

```json
{
  "workbookId": "english-g3-vocab-1",
  "type": "FIXED",
  "subjectId": "english",
  "courseId": "english-core",
  "title": "3학년 영어 핵심 단어 1권",
  "gradeLevel": 3,
  "semester": "ALL",
  "difficulty": "FOUNDATION",
  "status": "ACTIVE"
}
```

## 3.2 WorkbookEdition

```json
{
  "workbookId": "english-g3-vocab-1",
  "editionVersion": 1,
  "contentPackageRefs": [],
  "unitIds": [],
  "publishedAt": 0,
  "reviewStatus": "APPROVED"
}
```

발행된 Edition은 변경하지 않는다. 수정은 새 버전으로 발행한다.

## 3.3 WorkbookPage

```json
{
  "pageId": "page-001",
  "workbookId": "english-g3-vocab-1",
  "editionVersion": 1,
  "unitId": "school",
  "pageNumber": 1,
  "activityRefs": [],
  "layout": "SINGLE_COLUMN"
}
```

## 3.4 WorkbookAssignment

```json
{
  "assignmentId": "assignment-1",
  "learnerId": "learner-1",
  "workbookId": "english-g3-vocab-1",
  "editionVersion": 1,
  "status": "IN_PROGRESS",
  "lastPageId": "page-001",
  "lastOpenedAt": 0,
  "completedPageIds": []
}
```

## 3.5 PageProgress

페이지 완료와 제출은 분리한다.

- `NOT_STARTED`
- `IN_PROGRESS`
- `READY_TO_SUBMIT`
- `SUBMITTED`
- `GRADING_PENDING`
- `GRADED`
- `REVIEW_DUE`
- `COMPLETED`

기존 Session 상태를 복제하지 않고 표시용 집계로 계산하는 것을 우선한다.

# 4. 화면 계약

## 4.1 내 책장

필수 표시:

- 문제집 표지와 제목
- 학년, 학기, 과목과 난이도
- 완료 페이지 수와 진행률
- 마지막으로 연 페이지
- 채점 대기와 복습 예정 수
- 이어서 풀기

정렬 기본값은 최근 학습 순서다. 미완료, 복습 예정과 채점 대기 필터를 제공한다.

## 4.2 문제집 상세

- 표지
- 대상 학년과 학기
- 학습 영역과 단원
- 기초, 표준 또는 심화
- 차례와 단원별 진행률
- 이어서 풀기
- 원하는 페이지 열기
- 보호자 범위 설정

## 4.3 펼침 화면

- 문제 영역이 화면의 중심을 차지한다.
- 페이지 번호와 단원은 항상 식별 가능해야 한다.
- 이전, 다음과 제출은 필기 도구와 분리한다.
- 도구는 현재 페이지에 필요한 것만 표시한다.
- 페이지를 넘기기 전에 현재 상태를 저장한다.
- 저장 실패 시 페이지 이동을 완료 처리하지 않는다.

## 4.4 반응형 표시

| 조건 | 기본 레이아웃 |
|---|---|
| 가로 폭이 충분한 iPad와 PC | 2페이지 펼침 |
| 세로 iPad와 작은 PC 창 | 1페이지 |
| 스마트폰 | 한 문제 중심 |

두 페이지 표시에서도 각 Activity의 터치 영역과 Canvas 해상도가 축소되어서는 안 된다. 기준을 충족하지 못하면 자동으로 한 페이지로 전환한다.

# 5. 입력 Surface 계약

한 Activity에는 하나의 주 응답 Surface만 활성화한다.

| `responseType` | 활성 Surface | Canvas 생성 |
|---|---|---|
| CANVAS | Drawing Canvas | 예 |
| CHOICE | Option Cards | 아니오 |
| TEXT | Text Input | 아니오 |

- `responseType`이 CHOICE나 TEXT인 Activity에 Drawing Canvas를 중첩하지 않는다.
- CSS의 `pointer-events` 우회만으로 해결하지 않고 DOM 생성과 Canvas 초기화를 조건부로 분리한다.
- 혼합 페이지는 Activity별 Surface를 독립 배치한다.
- Pencil Only 정책은 Drawing Canvas Surface에만 적용한다.

# 6. CHOICE UX 계약

- 2개 이상의 가변 선택지 수를 지원한다.
- 4지선다와 5지선다 모두 동일 컴포넌트를 사용한다.
- 카드 전체가 클릭과 터치 대상이다.
- 카드 내부 label과 input의 접근성 연결을 유지한다.
- 최소 높이 44 CSS pixel, 권장 48 CSS pixel 이상이다.
- 선택 상태는 색상만으로 표현하지 않는다.
- 선택 즉시 ResponseRecord와 Draft에 저장한다.
- 선택 변경은 제출 전까지 가능하다.
- 제출 후 모든 선택 Surface를 잠근다.

# 7. TEXT UX 계약

- 첫 터치로 포커스와 키보드가 열려야 한다.
- IME 조합 중 값을 손상시키지 않는다.
- 영어 입력의 대소문자, 공백, 구두점과 apostrophe를 원형 보존한다.
- 입력 중 Draft 저장이 포커스를 잃게 하지 않는다.
- 제출 후 읽기 전용으로 전환한다.

# 8. CANVAS UX 계약

- Apple Pencil 빠른 획의 시작점과 종료점을 보존한다.
- 손바닥과 스크롤 정책은 선택 Surface와 분리한다.
- 페이지 전환 전 예약 렌더와 현재 획을 안전하게 확정한다.
- Canvas 크기 변경 전 원본 좌표와 stroke를 보존한다.
- 두 페이지와 한 페이지 전환으로 필기가 사라지지 않는다.

# 9. 저장과 복원

저장 단위:

- 현재 workbook assignment
- workbook edition version
- 현재 unit과 page
- 페이지별 ResponseRecord
- 페이지별 Canvas stroke
- 세션 시간
- 제출과 잠금 상태

복원 순서:

1. 학습자 확인
2. WorkbookAssignment와 Edition 확인
3. Session과 Draft 확인
4. 마지막 페이지 열기
5. Activity별 응답 Surface 생성
6. 응답과 stroke 복원
7. 저장 상태와 잠금 상태 반영

# 10. 보호자 채점 연결

- 제출 전에는 정답과 해설을 기본적으로 노출하지 않는다.
- 보호자는 페이지 단위와 문제 단위로 이동할 수 있다.
- 학생 응답, 기준 답안, 원본 필기와 보호자 첨삭을 분리 표시한다.
- `CORRECT`, `WRONG`, `RETRY` 판정은 기존 GradeDecision 계약을 사용한다.
- 채점 완료 후 Workbook 진행률과 Review Workbook 후보를 갱신한다.

# 11. 오답과 복습 문제집

- 오답 문제집은 ReviewItem의 보기 방식이며 원본 Submission을 복사해 변형하지 않는다.
- 같은 문제를 다시 풀 때 새 Attempt와 Submission을 만든다.
- 복습 예정 문제집은 due date, 과목, 학년과 Skill을 표시한다.
- 해결된 ReviewItem은 기본 목록에서 제외하되 과거 이력에서 확인할 수 있다.

# 12. 성능 기준

- 페이지 이동은 전체 책을 다시 렌더링하지 않는다.
- 보이지 않는 페이지의 Canvas를 초기화하지 않는다.
- CHOICE와 TEXT Activity에 Canvas 인스턴스를 만들지 않는다.
- 두 페이지 모드에서도 활성 Canvas 수를 현재 보이는 CANVAS Activity로 제한한다.
- 긴 문제집은 차례와 페이지를 지연 로드할 수 있어야 한다.
- 전환 애니메이션은 입력과 저장 완료를 지연시키지 않는다.

# 13. 접근성 기준

- 모든 선택지와 버튼에 명확한 accessible name을 제공한다.
- 키보드만으로 선택, 페이지 이동과 제출이 가능해야 한다.
- 현재 페이지와 진행 상태를 스크린 리더에 알린다.
- 색상 외에 테두리, 아이콘 또는 텍스트로 선택과 상태를 구분한다.
- `prefers-reduced-motion`에서는 페이지 전환 효과를 제거한다.

# 14. 검증 시나리오

1. iPad에서 4지선다와 5지선다 카드 전체 터치
2. 선택 변경, 자동 저장, 새로고침 복원과 제출 후 잠금
3. TEXT 첫 터치 포커스와 키보드 표시
4. CANVAS 빠른 필기 중 선택 문제로 페이지 이동
5. 혼합 페이지에서 Surface 간 이벤트 격리
6. iPad 가로와 세로 전환 후 답안과 stroke 유지
7. 두 페이지에서 한 페이지 전환 후 책갈피 유지
8. 오프라인 종료 후 마지막 페이지 복원
9. 두 학습자의 동일 문제집 진도 격리
10. 보호자 채점 후 오답 문제집 생성

# 15. 비목표

- 사실적인 3차원 종이 시뮬레이션
- 무거운 페이지 말림 애니메이션
- 종이 질감을 위한 고해상도 배경 이미지 의존
- 모든 문제 유형을 Canvas로 통일
- Workbook과 Submission 원본의 결합
