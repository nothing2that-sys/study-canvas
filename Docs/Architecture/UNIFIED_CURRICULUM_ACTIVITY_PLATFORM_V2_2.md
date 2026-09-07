# Math Canvas Pro — Unified Curriculum & Activity Platform v2.2 Architecture Amendment

문서 상태: ARCHITECTURE_BASELINE  
작성일: 2026-09-07  
적용 기준: Math Canvas Pro Software Platform v1 승인 이후 확장 작업  
기준 Release HEAD: `b20bcd28e2fef371fd18f519ec79411da5dee2c4`  
상위 문서: `Docs/통합_학습_웹앱_확장_설계_구조_구현계획서_v2.1.md`  

---

# 1. 문서 목적

이 문서는 기존 v2.1의 다과목 확장 방향을 구체화하여, 수학 연산 중심의 현재 제품을 다음 형태로 안전하게 확장하기 위한 아키텍처 기준을 정의한다.

- 기존 수학 연산 M1~M9, D1~D6는 재작성하지 않고 그대로 유지한다.
- 기존 F4~F9의 Submission, Guardian Grading, Review, Progress, Recommendation 계약을 재작성하지 않는다.
- 그 앞단에 Curriculum, Skill, LearningActivity, Response, Content 계층을 추가한다.
- 신규 과목과 신규 수학 영역은 동일한 공통 학습 파이프라인을 사용한다.
- AI는 실시간 출제 엔진이 아니라 콘텐츠 제작 보조 도구로 제한한다.
- 콘텐츠의 출처, 라이선스, 버전, 승인 상태를 추적 가능하게 한다.

v2.1의 F10 이후 미래 확장 계획은 본 문서의 Phase 재구성을 우선 적용한다.

---

# 2. 절대 불변 원칙

## 2.1 기존 수학 연산 보존

현재 수학 연산은 이미 Production 검증된 첫 번째 Subject Module로 간주한다.

유지 대상:

- M1~M9 / D1~D6 Macro Level
- Stage Registry 및 제약 기반 Generator
- mathGen 계열 생성 규칙
- Canvas / Stroke 저장 및 입력 UX
- 기존 문제 중복 방지
- 기존 세션 설정 및 10/20/30/50 문제 구성
- 현재 통계, Review, Recommendation 연결

신규 플랫폼을 위해 기존 연산 생성 규칙을 일반화하거나 재작성하지 않는다.

공통 플랫폼은 Adapter를 통해 기존 연산을 호출한다.

```text
Unified Platform
    ↓
MathArithmeticAdapter
    ↓
기존 STAGE_REGISTRY / mathGen / Canvas flow
```

## 2.2 F4~F9 승인 계약 보존

다음은 재오픈하지 않는다.

- Submission Snapshot 불변성
- 학생 답안 및 학생 필기 Lock
- Guardian GradeDecision 최종 SSOT
- Forward-only grading lifecycle
- ReviewItem lifecycle
- ProgressAggregate 확정 통계 SSOT
- Recommendation Tier 1~7 우선순위
- Recommendation read-only / deterministic 계약
- learner isolation

신규 입력 타입이 추가되어도 보호자 최종 판정 원칙은 유지한다.

## 2.3 기존 F9 Canvas-only Draft 계약 훼손 금지

다음 legacy answer map을 부활시키지 않는다.

```text
draft.userAnswers
draft.studentAnswers
draft.answers
```

질문의 `answer`, `expectedAnswer`, fixture-only typed answer field를 학생 응답으로 추측하지 않는다.

신규 typed response는 명시적 `ResponseRecord` 계약으로만 표현한다.

---

# 3. 목표 전체 구조

```text
Official Curriculum
        ↓
Curriculum Registry
        ↓
Course / Unit / Skill
        ↓
Content / Generator / Template
        ↓
LearningActivity
        ↓
Response
        ↓
LearningSession
        ↓
Submission Snapshot
        ↓
Guardian GradeDecision
        ↓
ReviewItem
        ↓
ProgressAggregate
        ↓
Recommendation
```

이 구조에서 과목 차이는 Curriculum, Content, Generator, Renderer에 집중한다.

Submission 이후의 공통 학습 lifecycle은 과목에 독립적이어야 한다.

---

# 4. Curriculum 계층

권장 계층:

```text
Subject
  └ Course
      └ Unit
          └ Skill
              └ Difficulty
```

예시:

```text
math
  └ measurement
      └ length
          └ convert-m-cm

korean
  └ language-basics
      └ spacing
          └ dependent-noun

english
  └ vocabulary
      └ basic-emotion
          └ meaning-recognition
```

필수 식별자:

- `subjectId`
- `courseId`
- `unitId`
- `skillId`
- `curriculumVersion`
- `gradeBand`
- `difficulty`

초기 초등 콘텐츠는 학년군을 기본 단위로 관리한다.

- Korean: `1_2`, `3_4`, `5_6`
- English: 기본 정규 교과 범위는 `3_4`, `5_6`
- Math: 필요 시 `1_2`, `3_4`, `5_6` + 기존 연산 Stage 병행

---

# 5. LearningActivity 공통 계약

개념 계약:

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
- prompt
- contentRef
- gradingReference
- sourceMetadata
```

`gradingReference`는 보호자 채점 화면에 기준 답과 설명을 제공하기 위한 값이다.

이 값은 학생 응답 SSOT가 아니며 Recommendation의 학생 답변 추론 근거로 사용하지 않는다.

---

# 6. ActivityType과 ResponseType 분리

## 6.1 ActivityType

초기 허용 후보:

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

## 6.2 ResponseType

초기 우선 구현:

```text
CANVAS
TEXT
CHOICE
```

후속:

```text
ORDERING
MATCHING
AUDIO
```

ActivityType과 ResponseType은 독립적이다.

예:

```text
PASSAGE_READING + CHOICE
PASSAGE_READING + TEXT
CORRECTION + TEXT
MULTIPLE_CHOICE + CHOICE
```

---

# 7. ResponseRecord 계약

신규 typed input은 기존 Canvas 저장을 대체하지 않는다.

개념 모델:

```text
ResponseRecord
- questionId
- activityId
- responseType
- value
- updatedAt
```

필요 시 session/learner context는 상위 record에서 제공할 수 있다.

초기 value 형태:

```text
TEXT   -> string
CHOICE -> optionId string
```

Canvas는 계속 기존 `studentStrokesMap`을 사용한다.

```text
Question
├ studentStrokesMap
└ responseRecords
```

F10A에서는 신규 IndexedDB Store를 만들지 않는다.

`responseRecords`는 Draft 및 Submission record 내부의 명시적 필드로 round-trip 검증한다.

F10B에서 실제 규모와 조회 요구를 검토한 뒤 별도 Store 필요 여부를 재결정한다.

---

# 8. Draft 확장 원칙

기존 Draft Schema의 의미는 유지한다.

신규 필드 후보:

```text
responseRecords: []
```

요구사항:

- `normalizeDraft()`가 명시적으로 normalize한다.
- 없는 구버전 Draft는 빈 배열로 안전하게 처리한다.
- 기존 Canvas-only Draft의 동작은 동일해야 한다.
- legacy answer map을 생성하지 않는다.
- ResponseRecord가 존재한다고 해서 F9 Recommendation이 임의로 answered workload를 추론하지 않는다.

F10A에서는 DB_VERSION = 6을 유지한다.

---

# 9. Submission Snapshot 확장 원칙

학생이 제출하면 typed response도 학생 불변 영역으로 고정한다.

개념적으로 Submission은 다음을 보존한다.

```text
questions
studentStrokesMap
responseRecords
config
solveTime
```

`responseRecords`는 `questions`, `studentStrokesMap`, `config`와 동일한 immutable student payload로 취급한다.

보호자 채점 API가 다음을 수정해서는 안 된다.

- questions
- studentStrokesMap
- responseRecords
- config

가변 영역은 기존과 동일하게 grading payload만 허용한다.

---

# 10. 기존 수학과 신규 Activity의 관계

## 10.1 기존 수학 연산

```text
subjectId = math
courseId = arithmetic
responseType = CANVAS
```

기존 Generator 및 Canvas flow를 유지한다.

## 10.2 신규 수학 예시

측정/단위:

```text
subjectId = math
courseId = measurement
unitId = length
skillId = convert-m-cm
activityType = SHORT_ANSWER
responseType = TEXT
```

## 10.3 국어 예시

```text
subjectId = korean
courseId = language-basics
unitId = spacing
skillId = dependent-noun
activityType = MULTIPLE_CHOICE
responseType = CHOICE
```

## 10.4 영어 예시

```text
subjectId = english
courseId = vocabulary
unitId = basic-word
skillId = meaning-recognition
activityType = MULTIPLE_CHOICE
responseType = CHOICE
```

---

# 11. Content Source 정책

## 11.1 Curriculum SSOT

국가 교육과정과 공식 성취기준을 학습 범위와 학년군 설계의 기준으로 사용한다.

교과서 출판사별 구성은 난이도, 학습 순서, 문제 유형 분석의 참고 자료로 활용할 수 있으나, 별도 이용허락이 없는 교과서 원문, 지문, 문제, 그림을 서비스 DB에 직접 복제하지 않는다.

## 11.2 Korean Knowledge SSOT

국어 맞춤법, 띄어쓰기, 어휘 등은 공식 규범 및 이용 조건이 명확한 공공 자료를 우선한다.

## 11.3 Public / Original Content

독해 소재 및 예문은 다음 출처만 허용한다.

- 프로젝트 자체 제작
- 라이선스가 명확한 공공 데이터
- 사용 권리가 확보된 자료
- 저작권 만료 또는 명시적으로 허용된 자료

출처 또는 라이선스가 불명확한 콘텐츠는 `APPROVED`가 될 수 없다.

---

# 12. Content Provenance 필수 필드

콘텐츠에는 최소 다음 메타데이터를 유지한다.

```text
sourceType
sourceId
license
attribution
retrievedAt
curriculumVersion
contentVersion
reviewStatus
```

reviewStatus 기본 lifecycle:

```text
DRAFT
→ AUTO_VALIDATED
→ REVIEWED
→ APPROVED
→ RETIRED
```

Production Content Package에는 `APPROVED`만 포함한다.

---

# 13. AI 사용 정책

Production 학습 세션에서 AI API를 실시간 호출하여 바로 문제를 출제하지 않는다.

허용:

```text
AI Authoring
↓
초안 생성
↓
자동 검증
↓
검토
↓
APPROVED Content Bank
↓
Production 배포
```

금지:

```text
학생 학습 시작
↓
AI에게 문제 요청
↓
검증 없이 즉시 출제
```

이 원칙은 오프라인 동작, 재현성, 품질, 비용, 저작권 추적성을 위한 것이다.

---

# 14. Content Package 구조

권장 구조:

```text
content/
├ source/
│  ├ curriculum/
│  ├ korean/
│  └ english/
├ curated/
├ generated/
├ approved/
├ licenses/
└ manifest.json
```

실제 PWA에는 compile된 approved package만 포함한다.

사용자 학습 데이터와 앱 제공 콘텐츠는 분리한다.

```text
Static Content Package
→ 앱 제공 문제/지식

IndexedDB
→ learner/session/submission/review/progress
```

---

# 15. Content Validation 원칙

향후 CI에서 최소 다음을 검증한다.

- contentId unique
- skillId 존재
- curriculumVersion 존재
- sourceMetadata 존재
- license 존재
- 문제 기준 답 존재
- CHOICE 정답 후보의 결정성
- Passage 문제 Evidence 존재
- 학년군 및 difficulty 존재
- 금지된 publisher raw content source 없음
- Content Manifest hash 일치

---

# 16. Reading Engine 원칙

국어/영어 독해는 별도 공통 엔진으로 구현한다.

```text
Passage
├ Question
├ Question
└ Question
```

독해 문제에는 다음을 필수화한다.

```text
skillId
answerReference
evidence
passageId
```

Evidence가 없는 독해 문제는 Production 승인 대상에서 제외한다.

초기 Reading Skill 예시:

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

---

# 17. 수학 확장 방향

현재 연산 외 수학은 공통 Platform 위에 추가한다.

권장 순서:

1. Measurement / Unit
2. Fraction / Decimal
3. Word Problems
4. Geometry
5. Pattern
6. Data / Graph
7. Complex Problem Solving

유형별 생성 정책:

```text
Generator 중심
- 사칙연산
- 분수/소수 계산
- 단위 변환
- 수 비교
- 규칙 찾기

Template + Generator
- 문장제
- 시간
- 돈
- 표/그래프
- 분수 시각화

Content Bank
- 복합 추론
- 사고력 문제
- 고정 도형 문제
```

---

# 18. 향후 Phase 재구성

v2.1의 기존 `F10 국어`, `F11 영어`, `F12 백업/배포` 미래 계획은 아래 순서를 우선 적용한다.

| Phase | 목표 |
|---|---|
| F10A | Unified Platform Feasibility — 기존 수학 무회귀 상태에서 TEXT/CHOICE가 F4~F9 pipeline을 통과하는지 증명 |
| F10B | Unified Curriculum & Activity Platform Foundation |
| F10C | Content Provenance / Package / Validation Foundation |
| F11 | Math Expansion 1 — Measurement / Unit |
| F12 | Korean Core — Vocabulary / Spelling / Spacing / Sentence |
| F13 | English Core — Vocabulary / Spelling / Sentence / Basic Grammar |
| F14 | Math Fraction / Decimal |
| F15 | Shared Reading Engine — Korean / English |
| F16 | Math Geometry / Pattern / Data / Word Problems |

각 Phase는 기존 운영 규칙에 따라 READY_FOR_REVIEW에서 중단하고 독립 검증 후에만 다음 단계로 이동한다.

---

# 19. F10A 진입 조건

F10A는 기존 소프트웨어 승인 상태를 재오픈하지 않는다.

진입 기준:

- F0~F9 APPROVED 유지
- 현재 DB_VERSION = 6
- 기존 463 테스트 baseline 유지
- 기존 수학 연산 Generator 및 Canvas behavior freeze
- F10A는 Production 사용자에게 미완성 과목 기능을 노출하지 않음
- Phase E 실기기 수용은 별도 독립 트랙으로 유지

---

# 20. 최종 아키텍처 결정

Math Canvas Pro의 향후 확장은 `과목별 별도 앱`이 아니라 다음 원칙으로 진행한다.

```text
공통 Curriculum / Activity / Response Platform
        +
과목별 Content / Generator / Renderer
        +
기존 Submission / Guardian / Review / Progress / Recommendation
```

현재 수학 연산은 이 플랫폼의 첫 번째 Production Module로 유지한다.

신규 Platform은 기존 수학을 대체하는 것이 아니라, 기존 수학을 포함하고 추가 수학 영역, 국어, 영어를 확장하기 위한 상위 계층이다.
