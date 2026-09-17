# Math Canvas Pro — Unified Curriculum, Workbook & Activity Platform v2.3

문서 버전: v2.3  
작성일: 2026-09-11  
최종 갱신일: 2026-09-18  
대상 저장소: `Study Canvas 개발 저장소`  
문서 상태: PRODUCT_AND_ROADMAP_SSOT  
대체 문서: `Docs/UNIFIED_CURRICULUM_ACTIVITY_PLATFORM_v2.2.md`  

---

# 1. 문서 권한과 목적

이 문서는 Math Canvas Pro의 제품 방향, 공통 학습 구조와 F13 이후 구현 순서를 정의하는 최상위 정본이다.

문서 우선순위는 다음과 같다.

1. 본 문서 v2.3
2. `Docs/Architecture/CURRICULUM_LEVEL_AND_CONTENT_ELIGIBILITY_V1.md`
3. `Docs/Architecture/DIGITAL_WORKBOOK_UX_ARCHITECTURE_V1.md`
4. `Docs/Architecture/CONTENT_SCALE_AND_GENERATION_ARCHITECTURE_V1.md`
5. `Docs/Architecture/MATH_CONTENT_SCALE_AND_GENERATION_ARCHITECTURE_V1.md`
6. `Docs/Implementation_Phases/32_POST_F15_ROADMAP_V2_4.md`
7. `Docs/Implementation_Phases/34_PHASE_F16_CONTENT_FACTORY_AND_SCALE_PROGRAM_V2.md`
8. 승인된 개별 Phase 문서와 승인 기록
9. v2.2, v2.1 및 과거 계획 문서

과거 문서는 이력 보존용이며 본 문서와 충돌할 경우 v2.3을 따른다.

# 2. 현재 기준선

- Phase F4부터 F13까지의 승인된 Submission, Guardian Grading, Review, Progress, Recommendation 계약을 유지한다.
- 기존 수학 연산 M1부터 M9, D1부터 D6 및 Canvas 기반 풀이를 재작성하지 않는다.
- Math Measurement, Korean Core, English Core는 승인된 첫 다과목 콘텐츠 모듈로 유지한다.
- Phase E는 Apple Pencil 실제 기기 수용 검증 트랙이며 현재 PENDING이다.
- Phase E PENDING은 문서 설계, 로드맵 정리와 비기기 종속 기능의 설계를 막지 않는다.
- 실제 iPad 입력에 영향을 주는 릴리즈의 최종 승인은 Phase E 통과 전 확정하지 않는다.

# 3. 제품 정의

> 아이가 자신의 책장에서 학년과 수준에 맞는 문제집을 꺼내 실제 책처럼 펼쳐 풀고, 보호자가 제출된 풀이를 확인하며, 오답과 복습 문제집으로 다시 이어가는 가족 참여형 디지털 학습 문제집

제품의 최상위 흐름은 다음과 같다.

```text
학습자 선택
→ 내 책장
→ 문제집 선택
→ 표지와 차례
→ 이어서 풀기
→ 문제집 페이지
→ 제출
→ 보호자 채점
→ 결과와 오답
→ 복습 문제집
```

# 4. 절대 불변 원칙

## 4.1 승인된 학습 수명주기 유지

```text
LearningActivity
→ ResponseRecord 또는 Canvas Stroke
→ Draft
→ Submission Snapshot
→ Guardian GradeDecision
→ ReviewItem과 Retry
→ ProgressAggregate
→ Recommendation
```

- 제출 원본은 불변이다.
- 제출 이후 학생 답안과 필기는 잠근다.
- 보호자 GradeDecision만 공식 정답률, 진도와 숙달도의 최종 근거다.
- 학습자 간 Draft, Submission, Review, Progress를 격리한다.
- 기존 연산은 Adapter로 연결하며 공통화를 이유로 재작성하지 않는다.

## 4.2 콘텐츠와 학습 기록 분리

- Content Package는 배포되는 읽기 전용 학습 원본이다.
- WorkbookDefinition과 WorkbookEdition은 문제집 원본과 버전을 정의한다.
- WorkbookAssignment는 학습자별 진도와 책갈피를 정의한다.
- Draft, ResponseRecord, Stroke, Submission은 학습자별 기록이다.
- 같은 문제집을 여러 학습자가 사용해도 기록이 섞이지 않는다.

## 4.3 교육과정 범위를 엔진에서 강제

학년 표시는 장식용 라벨이 아니다. 검색, 문제집 구성, 추천과 복습 단계에서 모두 자격 조건으로 사용한다.

- 초등 학년은 1부터 6까지 명시한다.
- 학기, 과목, 영역, 단원, 난이도와 교육과정 버전을 분리한다.
- 학년을 알 수 없거나 검증되지 않은 콘텐츠는 추천학습에서 제외한다.
- 상위 학년 콘텐츠는 보호자가 선행학습을 허용한 경우에만 노출한다.
- 선수 학습을 충족하지 못한 상위 Skill은 자동 추천하지 않는다.

# 5. 학년과 수준 모델

## 5.1 학생 학년과 학습 수준 분리

`LearnerProfile.schoolGrade`는 학교 학년이다. 실제 학습 위치는 과목과 영역별 `LearningPlacement`로 별도 관리한다.

예:

```text
학교 학년: 3학년
수학 연산: 2학년 복습
수학 측정: 3학년 표준
국어 어휘: 3학년 표준
영어 단어: 3학년 기초
```

## 5.2 공통 범위 축

| 축 | 값 |
|---|---|
| `gradeLevel` | 1, 2, 3, 4, 5, 6 |
| `semester` | 1, 2, ALL |
| `difficulty` | FOUNDATION, STANDARD, ADVANCED |
| `studyDirection` | REVIEW, ON_GRADE, PREVIEW |
| `curriculumVersion` | 적용 교육과정 버전 |
| `achievementStandardIds` | 성취기준 식별자 목록 |
| `prerequisites` | 선행 Skill 식별자 목록 |
| `reviewStatus` | DRAFT, VERIFIED, APPROVED 등 |

기존 숫자형 `difficulty`와 기존 `gradeBand`는 마이그레이션 기간 동안 읽을 수 있지만 신규 콘텐츠는 위 명시적 축을 기준으로 작성한다.

과목별 기본 학년 범위:

| 과목 | 학교 교육과정 기본 범위 | 추가 범위 처리 |
|---|---|---|
| 수학 | 1학년부터 6학년 | 이전 학년 복습과 보호자 허용 선행 |
| 국어 | 1학년부터 6학년 | 이전 학년 복습과 보호자 허용 선행 |
| 영어 | 3학년부터 6학년 | 1학년과 2학년은 학교 교육과정이 아닌 기초 영어로 별도 표시하고 보호자 허용 필요 |

교육과정 기반 콘텐츠와 프로젝트 자체 기초 콘텐츠를 같은 라벨로 표시하지 않는다.

## 5.3 선택 권한

- 아이는 허용된 현재 학년과 복습 범위에서 문제집을 선택한다.
- 보호자는 학년, 학기, 과목, 영역, 난이도, 문제 수와 선행 허용 범위를 설정한다.
- 보호자 허용 없이 현재 학교 학년보다 높은 문제집을 추천하지 않는다.
- 직접 선택 화면에서도 잠긴 상위 범위는 보호자 확인 후 개방한다.

세부 계약은 `Docs/Architecture/CURRICULUM_LEVEL_AND_CONTENT_ELIGIBILITY_V1.md`를 따른다.

# 6. 디지털 문제집 모델

## 6.1 문제집 종류

| 종류 | 설명 |
|---|---|
| FIXED | 고정된 차례와 페이지를 가진 검증 문제집 |
| PERSONALIZED | 학습자 수준과 취약점으로 구성한 맞춤 문제집 |
| REVIEW | 틀린 문제와 복습 예정 항목을 모은 문제집 |
| GUARDIAN | 보호자가 범위와 문제 수를 정해 만든 문제집 |

네 종류는 동일한 Workbook 계약을 사용하고 구성 출처만 다르게 기록한다.

## 6.2 화면 구조

- 내 책장: 문제집 표지, 진행률, 마지막 페이지, 채점 대기 표시
- 문제집 상세: 학년, 학기, 난이도, 단원, 차례, 이어서 풀기
- 풀이 화면: 문제집 페이지를 중심으로 최소한의 도구만 표시
- 결과 화면: 제출, 보호자 채점, 오답, 다음 복습 연결

표시 원칙:

| 환경 | 기본 표시 |
|---|---|
| iPad 가로 | 두 페이지 펼침 또는 공간 부족 시 한 페이지 |
| iPad 세로 | 한 페이지 |
| 스마트폰 | 한 문제 또는 한 페이지 |
| PC | 한 페이지 또는 두 페이지와 마우스 입력 |

실제 책 넘김 효과보다 입력 안정성과 즉시 전환을 우선한다.

세부 계약은 `Docs/Architecture/DIGITAL_WORKBOOK_UX_ARCHITECTURE_V1.md`를 따른다.

# 7. 문제 유형과 입력 방식

문제집 형태와 입력 방식은 분리한다. 모든 문제에 필기를 강제하지 않는다.

| 문제 | 기본 입력 |
|---|---|
| 연산 풀이와 서술형 | CANVAS |
| 4지선다와 5지선다 | CHOICE |
| 단어 철자와 단답 | TEXT |
| 단어 암기 카드 | STUDY_CARD 활동, 답안 없음 또는 자기평가 |
| 순서 배열 | 후속 ORDERING |
| 연결 문제 | 후속 MATCHING |
| 독해 표시 | 후속 PASSAGE_ANNOTATION |

CHOICE는 선택지 수를 4개나 5개로 고정하지 않고 콘텐츠가 가진 2개 이상의 보기 수를 지원한다.

## 7.1 CHOICE 필수 UX

- 선택지 카드 전체가 터치 대상이어야 한다.
- 최소 터치 영역은 44 CSS pixel 이상, 권장 48 CSS pixel 이상이다.
- 선택 즉시 시각 상태와 Draft를 갱신한다.
- 제출 전 선택 변경을 허용한다.
- 복원 후 동일한 선택 상태가 표시되어야 한다.
- 제출 후에는 잠그며 보호자 화면에서 선택 답안과 기준 답안을 함께 확인할 수 있어야 한다.
- CHOICE와 TEXT 위에 투명 Canvas를 배치하거나 초기화하지 않는다.

# 8. 연습과 공식 평가 분리

## 8.1 Practice

- 암기 반복, 플래시 카드와 즉시 자기 확인에 사용한다.
- 즉시 피드백을 제공할 수 있다.
- 공식 정답률과 숙달도를 직접 확정하지 않는다.
- 반복 예약을 위한 비공식 기억 신호는 저장할 수 있다.

## 8.2 Check Session

- 단원 확인과 공식 학습 결과에 사용한다.
- 기존 Submission과 Guardian GradeDecision 파이프라인을 사용한다.
- 공식 Progress와 Mastery는 보호자 확정 결과로만 갱신한다.

연습 결과와 공식 결과를 같은 통계로 섞지 않는다.

# 9. 영단어 암기 학습

F14는 기존 English Core를 폐기하지 않고 학년별 단어 학습 루프를 추가한다.

학습 순서:

1. 단어, 뜻과 예문 익히기
2. 영어에서 한국어 뜻 고르기
3. 한국어에서 영어 단어 고르기
4. 철자 직접 입력하기
5. 문장 속 의미나 단어 고르기
6. 기억 상태 자기평가
7. 예정일 기반 반복 복습
8. 확인 학습 제출과 보호자 채점

단어 콘텐츠 필수 정보:

```text
wordId
headword
meanings
partOfSpeech
exampleSentence
exampleMeaning
gradeLevel
semester
topicId
difficulty
curriculumVersion
achievementStandardIds
sourceMetadata
reviewStatus
```

단어 학습 상태는 `NEW`, `LEARNING`, `REVIEW`, `MASTERED`를 사용한다. 반복 일정과 공식 성취도는 별도 필드로 관리한다.

발음 음원, 듣기와 말하기는 F14 필수 범위에서 제외하고 별도 콘텐츠 출처와 오프라인 정책이 확정된 뒤 추가한다.

# 10. 콘텐츠 제작과 검증

- 출판사 교과서와 문제집을 무단 복제하거나 크롤링하지 않는다.
- 교육과정과 공개 규범 자료는 교육과정 근거로 사용하되 문제와 예문은 자체 작성하거나 사용 허가된 자료를 사용한다.
- AI는 저작 보조와 후보 생성에만 사용할 수 있다.
- AI가 생성한 콘텐츠는 자동으로 APPROVED가 될 수 없다.
- 모든 Content Package는 출처, 라이선스, 검수 상태와 버전을 가진다.
- 학년, 성취기준, 정답, 선택지, 문맥, 중복과 금칙어를 자동 검증한다.
- 의미와 난이도는 사람의 검수를 통과해야 한다.

대규모 콘텐츠와 생성기 확장의 현재 정본은 다음을 따른다.

- 국어/영어 Bank, 생성, 검수, shard, provenance: `Docs/Architecture/CONTENT_SCALE_AND_GENERATION_ARCHITECTURE_V1.md`
- 수학 Generator, Problem Space, Feature Vector, Coverage Matrix: `Docs/Architecture/MATH_CONTENT_SCALE_AND_GENERATION_ARCHITECTURE_V1.md`
- F16A~F16E 통합 실행 및 Release Gate: `Docs/Implementation_Phases/34_PHASE_F16_CONTENT_FACTORY_AND_SCALE_PROGRAM_V2.md`
- 현재 실행 순서: `Docs/Implementation_Phases/32_POST_F15_ROADMAP_V2_4.md`

위 정본의 콘텐츠 수량 및 수학 Problem Space Release Gate는 구현자가 임의로 축소할 수 없다.

# 11. 추천과 문제집 구성 규칙

추천 후보는 다음 순서로 필터링한다.

```text
학습자 일치
→ 활성 과목과 코스
→ 승인 콘텐츠
→ 보호자가 허용한 학년 범위
→ 학기와 영역
→ 선수 학습 충족
→ 난이도와 학습 방향
→ 중복 제거
→ 기존 Tier 우선순위
```

- 기존 Recommendation Tier 1부터 7까지의 우선순위를 재작성하지 않는다.
- 새 Curriculum Eligibility는 후보 생성 전 필터로 추가한다.
- Resume과 Review 후보는 원래 세션의 콘텐츠 버전과 범위를 유지한다.
- 콘텐츠가 이후 개정돼도 기존 Submission이 참조한 문제는 변경되지 않는다.

# 12. 저장과 오프라인

- 마지막 문제집, 페이지와 책갈피를 원자적으로 저장한다.
- 페이지 이동 전에 현재 답안과 필기를 저장한다.
- 오프라인에서도 이미 받은 문제집의 풀이, 저장과 재개가 가능해야 한다.
- 동기화 기능이 추가되기 전까지 로컬 데이터 SSOT 원칙을 유지한다.
- 백업에는 학습자, 문제집 할당, 응답, 제출, 채점, 오답, 진도와 복습 일정을 포함한다.
- Content Package 원본은 백업 데이터와 분리하고 버전 참조만 저장한다.

# 13. 접근성과 iPad UX

- 학습 중 확대, 텍스트 선택과 우발 스크롤을 입력 유형별로 제어한다.
- Pencil Only는 Canvas 문제에만 영향을 주고 CHOICE와 TEXT 터치를 차단하지 않는다.
- 왼손잡이 도구 배치를 지원할 수 있도록 도구 영역을 논리적으로 분리한다.
- 글자 크기와 문제 간격을 조정해도 답안이 가려지지 않아야 한다.
- 페이지 전환 애니메이션은 `prefers-reduced-motion`을 존중한다.
- 빠른 필기, 선택, 텍스트 포커스와 페이지 이동이 서로 이벤트를 빼앗지 않아야 한다.

# 14. F13 이후 로드맵

Phase E는 아래 로드맵과 병행한다. 단, 실제 iPad 입력에 영향을 주는 최종 릴리즈 승인은 Phase E 결과를 포함한다.

| 순서 | Phase | 범위 | 선행 조건 |
|---:|---|---|---|
| 0 | F13-R1 | CHOICE와 TEXT 위 Canvas 차단 결함 수정, 실제 DOM 상호작용 검증 | F13 승인 기준선 |
| 1 | F13-R2 | 학년, 학기, 난이도, 학습 위치와 콘텐츠 자격 모델 | F13-R1 승인 |
| 2 | F13-R3 | 책장, 문제집, 차례, 페이지, 책갈피 UX 기반 | F13-R2 승인 |
| 3 | F14 | 학년별 영단어 암기와 반복 복습 | F13-R3 승인 |
| 4 | F15A | 분수 개념과 표현 | F14 승인 |
| 5 | F15B | 분수 연산 | F15A 승인 |
| 6 | F15C | 소수 개념과 연산 | F15B 승인 |
| 7 | F16A | Content Factory Foundation | F15C 승인 후 구현, 비충돌 설계는 선행 가능 |
| 8 | F16B | English Large-Scale Content Bank | F16A 승인 |
| 9 | F16C | Korean Large-Scale Content Bank | F16A 승인 |
| 10 | F16D | Math Large-Scale Generator & Coverage | F16A 승인 및 관련 수학 계약 확인 |
| 11 | F16E | 국어/영어/수학 반복 회피, Coverage, Migration, 대용량 성능 | F16B/C/D 승인 |
| 12 | F17 | 국어와 영어 공통 읽기 엔진 | F16 기반 승인 |
| 13 | F18A | 학년별 국어 읽기 콘텐츠 | F17 승인 |
| 14 | F18B | 학년별 영어 읽기 콘텐츠 | F17 승인 |
| 15 | F19 | 도형, 규칙, 자료와 그래프, 문장제의 실제 학습 모듈 확장 | F16D의 Coverage Matrix 및 이관 Gate 반영 |
| 16 | F20 | 다과목 백업, 복원, 성능과 최종 릴리즈 수용 | 모든 목표 Phase 승인 |

## 14.1 재번호 원칙

- 기존 승인 완료 F0부터 F13까지의 번호와 의미는 변경하지 않는다.
- 기존 v2.2의 미래 F14부터 F18은 미착수 계획이므로 본 표로 대체한다.
- F13-R1부터 R3는 승인된 F13 기능의 결함 수정과 기반 보강이며 F13 승인 이력을 취소하지 않는다.

# 15. 구현 진입 게이트

각 Phase는 다음을 만족해야 시작할 수 있다.

- 상위 정본과 개별 Phase 문서가 존재한다.
- 변경 허용 범위와 비목표가 명시되어 있다.
- 기존 승인 계약의 회귀 금지 항목이 적혀 있다.
- 데이터 마이그레이션과 롤백 전략이 있다.
- 단위, 통합, 실제 DOM과 Production 검증 시나리오가 정의되어 있다.
- 콘텐츠 Phase는 출처, 라이선스와 승인 증거가 있다.
- 구현자는 READY_FOR_REVIEW까지만 상태를 변경한다.

# 16. 즉시 작업 우선순위

2026-09-18 현재 실행 우선순위는 다음과 같다.

1. F15B 분수 연산 독립 검토를 완료한다.
2. F15B 승인 후 F15C 소수 개념과 연산을 진행한다.
3. F15C 승인 후 F16A Content Factory Foundation을 구현한다.
4. F16A 승인 후 F16B English, F16C Korean, F16D Math 대규모 확장을 각각 독립 검토한다.
5. F16B/C/D 승인 후 F16E에서 공통 recent exposure, coverage, migration, scale performance를 닫는다.
6. Phase E 실제 iPad/Apple Pencil 재검증은 독립 PENDING 트랙으로 유지한다.

세부 순서와 Release Gate는 `Docs/Implementation_Phases/32_POST_F15_ROADMAP_V2_4.md`와 `34_PHASE_F16_CONTENT_FACTORY_AND_SCALE_PROGRAM_V2.md`를 따른다.

# 17. 최종 결정

Math Canvas Pro의 후속 확장은 `과목 메뉴 → 문제 목록`이 아니라 `학생별 책장 → 학년별 문제집 → 단원과 페이지 → 적합한 응답 방식 → 제출과 보호자 채점 → 오답 및 반복 복습`을 기준으로 진행한다.

학년과 콘텐츠 자격은 추천의 부가 정보가 아니라 플랫폼 필수 계약이다. 디지털 문제집은 화면 장식이 아니라 콘텐츠, 페이지, 저장, 제출과 복습을 연결하는 제품 구조다.
