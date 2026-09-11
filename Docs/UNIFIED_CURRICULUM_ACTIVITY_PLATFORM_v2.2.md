# Math Canvas Pro — Unified Curriculum & Activity Platform v2.2

> 문서 상태: SUPERSEDED. 제품 방향과 F13 이후 로드맵의 현재 정본은 `Docs/UNIFIED_CURRICULUM_ACTIVITY_PLATFORM_v2.3.md`이다. 본 문서는 v2.2 설계 이력 보존용이며 충돌 시 v2.3을 따른다.

문서 버전: v2.2  
작성일: 2026-09-08  
대상 저장소: `Study Canvas 개발 저장소`  
상태: SUPERSEDED_HISTORY  
기존 기준 문서: `Docs/통합_학습_웹앱_확장_설계_구조_구현계획서_v2.1.md`

---

# 1. 문서 목적

이 문서는 기존 Math Canvas Pro의 수학 연산 기능과 Phase F4~F9에서 완성된 제출, 보호자 채점, 결과, 복습, 진도, 추천 구조를 유지하면서 수학의 비연산 영역, 국어, 영어를 추가할 수 있도록 공통 학습 플랫폼 구조를 정의한다.

이번 변경의 핵심은 기존 수학 연산을 재작성하는 것이 아니다.

기존 수학 연산은 첫 번째 Production Subject Module로 유지한다.

새로운 공통 구조는 기존 연산 위에 추가되며, 기존 연산은 최소 Adapter만 통해 연결한다.

---

# 2. 최상위 결정

## 2.1 기존 수학 연산 보존

다음 기존 구현은 원칙적으로 유지한다.

- M1~M9
- D1~D6
- `STAGE_REGISTRY`
- 기존 수학 문제 생성기
- 기존 Canvas 입력
- Draft 저장과 복원
- Submission Snapshot
- Answer / Stroke Lock
- Guardian GradeDecision SSOT
- ReviewItem 및 재풀이
- Progress Aggregate
- Unified Recommendation Engine

공통 플랫폼을 만들기 위해 기존 연산 알고리즘을 전면 재작성하지 않는다.

## 2.2 새 기능은 추가 구조로 구현

목표 구조는 다음과 같다.

```text
Unified Curriculum & Activity Platform
├─ Math
│  ├─ Arithmetic
│  │  └─ Existing Production Module
│  ├─ Fraction / Decimal
│  ├─ Measurement
│  ├─ Geometry
│  ├─ Pattern
│  ├─ Data
│  └─ Problem Solving
├─ Korean
│  ├─ Vocabulary
│  ├─ Spelling
│  ├─ Spacing
│  ├─ Sentence
│  └─ Reading
└─ English
   ├─ Vocabulary
   ├─ Spelling
   ├─ Sentence
   ├─ Grammar
   └─ Reading
```

각 과목은 서로 다른 콘텐츠와 문제 생성 전략을 사용할 수 있지만, 학습 세션 이후의 공통 파이프라인은 공유한다.

```text
Activity
→ Response / Canvas
→ Draft
→ Submission Snapshot
→ Guardian Grading
→ Review
→ Progress
→ Recommendation
```

---

# 3. Curriculum, Knowledge, Content 분리

세 개념은 반드시 분리한다.

## 3.1 Curriculum

무엇을 배워야 하는지를 정의한다.

예:

```text
subjectId
courseId
unitId
skillId
gradeBand
difficulty
curriculumVersion
```

교육과정 또는 프로젝트 내부 학습 단계와 연결한다.

## 3.2 Knowledge

무엇이 맞는지를 정의한다.

예:

- 국어 맞춤법 규칙
- 국어 어휘 뜻
- 영어 단어 정보
- 수학 공식 및 단위 관계

Knowledge에는 출처와 라이선스를 기록한다.

## 3.3 Content

실제 아이에게 제시할 학습 재료를 정의한다.

예:

- 검증 문장
- 문제 Template
- 단어 항목
- 독해 지문
- 도형 Asset
- 표와 그래프 데이터

Knowledge와 Content를 동일한 데이터로 취급하지 않는다.

---

# 4. LearningActivity 공통 모델

새 과목과 새 수학 영역은 공통 Activity 모델을 사용한다.

권장 논리 모델:

```text
LearningActivity
- id
- version
- subjectId
- courseId
- unitId
- skillId
- gradeBand
- difficulty
- activityType
- responseType
- gradingMode
- contentRef
- solutionRef
- sourceMetadata
```

F10A에서는 전체 필드를 Production Schema로 고정하지 않는다.

F10A의 목적은 최소 공통 계약이 실제로 기존 파이프라인과 공존 가능한지 증명하는 것이다.

---

# 5. ActivityType과 ResponseType 분리

문제의 의미와 학생의 응답 방식을 분리한다.

## 5.1 초기 ActivityType 후보

```text
CALCULATION
MULTIPLE_CHOICE
SHORT_ANSWER
FILL_BLANK
CORRECTION
ORDERING
MATCHING
PASSAGE_READING
WRITING
```

## 5.2 초기 ResponseType 후보

```text
CANVAS
TEXT
CHOICE
ORDERING
MATCHING
```

F10A에서는 `CANVAS`, `TEXT`, `CHOICE`만 검증한다.

다른 ResponseType은 F10A 범위 밖이다.

---

# 6. 기존 Canvas와 신규 Response 공존 원칙

기존 Canvas 저장 경로를 신규 Response 모델에 억지로 통합하지 않는다.

F10A 권장 모델:

```text
Question
├─ existing Canvas / Stroke data
└─ optional typed ResponseRecord
```

기존 수학 연산:

```text
responseType = CANVAS
existing canvas persistence = 그대로 유지
```

신규 객관식 또는 텍스트 문제:

```text
responseType = CHOICE or TEXT
responseRecord = 존재
canvas = optional
```

기존 Canvas 데이터 구조와 저장 경로는 F10A에서 재설계하지 않는다.

---

# 7. ResponseRecord 계약

기존에 제거된 비정형 Draft 답안 필드를 되살리지 않는다.

다음 필드는 계속 사용 금지한다.

```text
draft.userAnswers
draft.studentAnswers
draft.answers
draft.retryAttemptId
draft.reviewItemId
```

신규 입력은 명시적인 typed contract로 다룬다.

권장 최소 모델:

```text
ResponseRecord
- questionId
- responseType
- value
- updatedAt
```

F10A에서는 기존 IndexedDB Store를 추가하지 않는 방식을 우선 검증한다.

즉 `draftSessions`의 명시적 `responseRecords` 컬렉션과 Submission의 불변 `responseSnapshots`를 사용하여 feasibility를 먼저 증명할 수 있다.

전용 Store 도입 여부는 F10B에서 실제 데이터 양과 조회 패턴을 검토한 뒤 결정한다.

---

# 8. Guardian GradeDecision SSOT 유지

새로운 문제 유형도 자동 비교 결과로 최종 채점하지 않는다.

예상 답안 또는 정답은 보호자 채점 지원 정보다.

```text
student response
expected answer
explanation
```

을 보호자에게 보여줄 수 있으나 최종 결과는 계속 다음 데이터가 결정한다.

```text
GradeDecision
```

다음과 같은 자동 확정 로직은 금지한다.

```text
studentResponse === expectedAnswer
→ automatically correct
```

---

# 9. Content Package 원칙

프로젝트가 제공하는 학습 콘텐츠와 학습자가 만든 데이터를 분리한다.

## 9.1 앱 제공 콘텐츠

권장:

```text
Static Content Package
```

예:

```text
content/
├─ manifest.json
├─ curriculum/
├─ korean/
├─ english/
└─ math/
```

PWA에서 오프라인 캐시 가능하도록 한다.

## 9.2 학습자 데이터

IndexedDB에 저장한다.

예:

- Draft
- ResponseRecord
- Canvas Stroke
- Submission
- GradeDecision
- ReviewItem
- Progress

콘텐츠 업데이트와 학습자 데이터 마이그레이션을 분리한다.

---

# 10. 콘텐츠 Source 및 License 원칙

모든 Content 또는 Knowledge는 출처를 추적할 수 있어야 한다.

권장 메타데이터:

```text
sourceType
sourceId
license
attribution
retrievedAt
derivedFrom
reviewStatus
```

정책:

1. 출처 없는 Knowledge 사용 금지
2. 저작권 상태가 불명확한 콘텐츠 사용 금지
3. 출판사 교과서 본문, 문제, 그림을 무단 대량 수집해 Content Bank에 저장하지 않음
4. 출판사 교과서는 교육 구조와 난이도 참고 자료로 사용할 수 있음
5. 라이선스가 허용된 공공 데이터와 공식 자료는 조건에 맞게 사용
6. 자체 제작 콘텐츠는 프로젝트 소유 콘텐츠로 관리

---

# 11. 콘텐츠 생성 전략

과목과 Skill에 따라 세 가지 전략을 사용한다.

## 11.1 Deterministic Generator

정답 규칙이 명확한 경우.

예:

- 기존 수학 연산
- 단위 변환
- 분수 계산
- 수 비교
- 영어 기본 철자 변형
- 검증 문장을 이용한 일부 맞춤법, 띄어쓰기 변형

## 11.2 Template + Generator

검증된 Template에 값만 주입한다.

예:

- 수학 문장제
- 시간과 돈
- 표와 그래프
- 영어 문장 Pattern

## 11.3 Approved Content Bank

문맥과 교육 품질 검증이 중요한 경우.

예:

- 국어 독해
- 영어 독해
- 복합 사고력 문제
- 서술형

실시간 AI 생성 결과를 학습자에게 즉시 출제하지 않는다.

---

# 12. AI Authoring 원칙

AI는 Production Runtime Generator가 아니라 Content Authoring 보조 도구로 사용할 수 있다.

권장 흐름:

```text
Curriculum Skill
→ Authoring Spec
→ AI Draft
→ Validation
→ Human / Independent Review
→ APPROVED Content Bank
→ Production Package
```

Content 상태 모델:

```text
DRAFT
AUTO_VALIDATED
REVIEWED
APPROVED
RETIRED
```

Production은 `APPROVED`만 포함한다.

---

# 13. 독해 전용 원칙

국어와 영어 독해는 Shared Reading Engine을 사용한다.

구조:

```text
Passage
├─ Question 1
├─ Question 2
├─ Question 3
└─ Question N
```

독해 문제는 가능한 경우 정답의 지문 근거를 보존한다.

권장:

```text
answer
evidence
skillId
passageId
```

대표 Skill:

```text
FACT
SEQUENCE
CAUSE_EFFECT
MAIN_IDEA
VOCAB_CONTEXT
CHARACTER_EMOTION
INFERENCE
SUMMARY
```

독해는 F10A 범위가 아니다.

---

# 14. 수학 확장 원칙

기존 Arithmetic은 유지하고 다음 영역을 추가할 수 있다.

```text
Math
├─ Arithmetic
├─ Fraction / Decimal
├─ Measurement
├─ Geometry
├─ Pattern
├─ Data
└─ Problem Solving
```

권장 확장 우선순위:

1. Measurement / Unit
2. Fraction / Decimal
3. Word Problem
4. Time / Money
5. Geometry
6. Pattern
7. Table / Graph
8. Complex Problem Solving

첫 실제 신규 수학 검증 영역은 `Measurement / Unit`을 권장한다.

이유:

- 정답이 명확함
- 기존 연산 Generator와 다름
- TEXT Response를 검증할 수 있음
- 새로운 Skill Progress를 검증할 수 있음
- UI Complexity가 낮음

---

# 15. 국어 초기 범위

초기 범위:

```text
Korean
├─ Vocabulary
├─ Spelling
├─ Spacing
└─ Sentence Understanding
```

독해는 Shared Reading Engine 이후 추가한다.

국어 콘텐츠의 핵심은 AI가 임의의 문제를 Runtime에서 만드는 것이 아니라 검증된 규칙, 어휘, 문장을 기반으로 Activity를 구성하는 것이다.

---

# 16. 영어 초기 범위

초기 범위:

```text
English
├─ Vocabulary
├─ Spelling
├─ Sentence
└─ Basic Grammar
```

Listening, Speaking, Reading은 후속 확장으로 둔다.

---

# 17. Progress 공통화 원칙

장기적으로 Progress는 과목별 특수 ID보다 공통 Skill을 중심으로 다룰 수 있어야 한다.

권장 논리 모델:

```text
learnerId
subjectId
courseId
skillId
attemptCount
gradedCorrectCount
gradedIncorrectCount
retryCount
lastPracticedAt
mastery
```

기존 수학 M/D 통계는 깨지지 않도록 유지하며 신규 Skill Progress는 병행 도입한다.

F10A에서는 기존 Aggregate를 전면 교체하지 않는다.

---

# 18. Recommendation 확장 원칙

현재 F9의 공통 Priority Tier와 Actor, Workload, Dedup 계약은 유지한다.

추천 후보가 참조하는 학습 단위를 기존 수학 Level뿐 아니라 Skill로 확장할 수 있는지만 검증한다.

예:

```text
M2-2
MATH_UNIT_LENGTH
KO_SPACING_DEPENDENT_NOUN
EN_VOCAB_BASIC
```

F10A에서는 새로운 추천 우선순위 알고리즘을 만들지 않는다.

---

# 19. Phase 재편

기존 v2.1의 `F10 국어`, `F11 영어`, `F12 백업 및 배포` 계획은 신규 구조를 반영하여 아래처럼 재편한다.

```text
F10A  Unified Learning Platform Feasibility
F10B  Unified Platform Foundation
F11   Math Expansion 1 — Measurement / Unit
F12   Korean Core
F13   English Core
F14   Fraction / Decimal
F15   Shared Reading Engine
F16   Geometry / Data / Word Problems
F17   Content Authoring & Validation Factory
F18   Multi-Subject Backup / Release Acceptance
```

정확한 후속 Phase 번호와 범위는 각 이전 Phase 승인 시 다시 확정할 수 있으나, F10A보다 후속 구현을 먼저 시작하지 않는다.

---

# 20. F10A의 목적

F10A는 기능 출시 Phase가 아니다.

검증 질문은 하나다.

> 현재 안정화된 수학 연산과 F4~F9 구조를 손상시키지 않고, TEXT와 CHOICE Response 및 새로운 Skill을 동일한 Session, Submission, Guardian Grading, Review, Progress, Recommendation 파이프라인에 연결할 수 있는가?

F10A는 이 질문에 코드와 테스트로 답한다.

---

# 21. F10A 최소 검증 Activity

다음 네 종류만 사용한다.

## A. 기존 수학 연산

Production 기존 문제 그대로.

## B. 신규 수학 Fixture

예:

```text
3 m = ___ cm
```

`TEXT` Response.

## C. 국어 Fixture

예:

```text
다음 중 바른 문장을 고르세요.
1. 할수 있다.
2. 할 수 있다.
```

`CHOICE` Response.

## D. 영어 Fixture

예:

```text
happy의 뜻을 고르세요.
```

`CHOICE` 또는 `TEXT` Response.

Fixture는 플랫폼 검증 목적이며 정식 Curriculum Content로 간주하지 않는다.

---

# 22. F10A에서 하지 않는 것

다음은 명시적으로 금지한다.

- 국어 콘텐츠 대량 구축
- 영어 콘텐츠 대량 구축
- 독해 지문
- AI Runtime Generation
- Listening
- Speaking
- Ordering
- Matching
- 도형 UI
- 수학 Fraction Production 구현
- 새로운 Recommendation Priority 알고리즘
- 기존 Canvas Engine 재작성
- 기존 Arithmetic Generator 재작성
- F4~F9 상태 머신 재설계

---

# 23. F10A 성공 판정

다음이 모두 PASS해야 한다.

## Existing Regression

- 기존 M1~M9 / D1~D6 생성 회귀 없음
- 기존 Canvas 동작 회귀 없음
- 기존 Draft 회귀 없음
- 기존 F4~F9 테스트 PASS
- 기존 Production Route 회귀 없음

## Typed Response

- TEXT 입력 저장
- CHOICE 입력 저장
- 새로고침 후 복원
- 앱 재실행 후 복원
- 학습자 격리

## Submission

- responseSnapshot 불변 저장
- 제출 후 수정 차단
- 제출 당시 Activity Version 보존

## Guardian Grading

- 문제
- 학생 Response
- 기준 답
- 설명

표시 가능.

최종 판정은 GradeDecision.

## Review

- 신규 Activity 오답에서 ReviewItem 생성
- Retry 연결
- 해결 상태 연결

## Progress

- 신규 Skill이 기존 수학 Aggregate를 깨지 않고 추적 가능

## Recommendation

- 신규 Skill 기반 Activity가 추천 후보가 될 수 있음
- 기존 Priority Tier 계약 유지

---

# 24. 실패 시 원칙

F10A가 실패하더라도 기존 수학 기능을 변경해 강제로 맞추지 않는다.

실패 원인을 다음 범주로 분리한다.

```text
RESPONSE_CONTRACT
DRAFT_PERSISTENCE
SUBMISSION_SNAPSHOT
GRADING_RENDERING
REVIEW_BINDING
PROGRESS_MODEL
RECOMMENDATION_MODEL
LEGACY_REGRESSION
```

구조적 수정이 필요하면 F10A Rework로 해결하며 후속 과목 구현으로 우회하지 않는다.

---

# 25. 최종 아키텍처 결정

1. 기존 수학 연산은 유지한다.
2. 신규 학습은 공통 Curriculum / Activity 구조를 통해 추가한다.
3. Canvas와 Typed Response는 공존한다.
4. 과거에 제거한 비정형 Draft Answer 필드는 복구하지 않는다.
5. Guardian GradeDecision은 모든 과목의 최종 채점 SSOT로 유지한다.
6. Content와 Learner Data를 분리한다.
7. 콘텐츠는 출처, 라이선스, 버전을 추적한다.
8. 실시간 AI 문제 출제를 기본 구조로 사용하지 않는다.
9. 독해는 Shared Reading Engine과 Approved Content Bank를 사용한다.
10. F10A에서 플랫폼 가능성을 먼저 증명한 뒤 실제 과목 확장을 시작한다.

이 문서의 신규 플랫폼 및 Phase 재편 사항은 기존 v2.1의 해당 부분보다 우선한다.
기존 v2.1에서 본 문서와 충돌하지 않는 F0~F9 제품 원칙과 승인된 구현 계약은 계속 유효하다.
