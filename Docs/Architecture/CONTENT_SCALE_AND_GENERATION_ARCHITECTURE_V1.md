# Math Canvas Pro — Content Scale & Generation Architecture v1

문서 상태: ARCHITECTURE_SSOT  
작성일: 2026-09-17  
적용 대상: Korean Core, English Core, English Vocabulary, 후속 Reading Content  
상위 정본: `Docs/UNIFIED_CURRICULUM_ACTIVITY_PLATFORM_v2.3.md`  
F16 통합 실행 정본: `Docs/Implementation_Phases/34_PHASE_F16_CONTENT_FACTORY_AND_SCALE_PROGRAM_V2.md`

현재 Phase 진행 규칙 (2026-09-30 사용자 지시): F16B는 구현·기술 검증과 교육부 원문 기반 AI 1차 검토로 `FIRST_STAGE_APPROVED / AI_DOCUMENT_REVIEW` 종료한다. [승인 근거와 항목별 범위](../Implementation_Phases/F16B_DOCUMENT_BASED_FIRST_APPROVAL_2026-09-30.md)를 따른다. 교육 전문가 최종 검수는 미실시·추후 과제이며 F16C 개발 착수를 막지 않는다. 아래 공개 콘텐츠 Release의 HUMAN·실제 runtime·최종 설계·무결성 Gate는 별도로 유지한다. 1차 승인으로 source/candidate의 생산용 APPROVED 상태를 만들지 않는다.

---

현재 진행 규칙 추가 (2026-10-13 사용자 지시): F16D의 기술 구현 1차 종료를 인정하고 F16E 개발을 시작한다. [정확한 범위와 미완료 수용 조건](../Implementation_Phases/F16D_TECHNICAL_FIRST_STAGE_CLOSE_2026-10-13.md)을 따른다. 사용자 진행 결정은 HUMAN 문항 검수 또는 제품 최종/공개 Release 승인이 아니며 아래 모든 수량·품질·공개 게이트를 보존한다.

# 1. 목적

현재 Korean Core와 English Core는 각각 8개 Skill x 20개 Activity = 160개 Activity로 구성되어 있고, 기본 세션도 20문제라 한 Skill을 한 번 수행하면 해당 Skill의 원천 문제를 사실상 모두 노출한다. English Vocabulary도 현재 48개 단어 규모이므로 실제 반복 학습 서비스 기준으로 콘텐츠 폭이 부족하다.

이 문서는 이 문제를 단순히 `스킬당 200문제` 정도로 늘리는 방식으로 해결하지 않는다.

Math Canvas Pro의 콘텐츠 구조를 다음과 같이 전환한다.

```text
공식/검증 원천
→ 정규화된 Knowledge Bank
→ Word Family / Expression / Rule / Sentence Bank
→ 승인된 Generation Rule
→ Build-time Candidate Generation
→ 자동 Validator
→ 중복/품질/난이도 검증
→ Review Gate
→ Immutable Activity Shard
→ Workbook / Session Selection
→ Exposure-aware Rotation
```

핵심 목표는 `몇 달 이상 반복 사용해도 동일 문제 반복이 빠르게 체감되지 않는 규모`다.

---

# 2. 절대 원칙

1. 런타임 AI 문제 생성은 도입하지 않는다.
2. Production 학습 중 외부 AI/API 연결이 없어도 모든 문제를 풀 수 있어야 한다.
3. AI는 개발 단계 후보 생성, 분류 보조, 검수 보조에만 사용할 수 있다.
4. AI 후보는 자동으로 APPROVED가 될 수 없다.
5. 원천 어휘와 파생형을 분리한다.
6. `play / plays / played / playing`을 4개의 기본 영어 단어로 세지 않는다.
7. 동일 지식 요소에서 파생된 문제라도 prompt, context, distractor, response task가 실질적으로 달라야 한다.
8. 단순 문자열 치환으로 의미 없는 대량 문제를 만들지 않는다.
9. 학년, 난이도, 성취기준, 출처, 라이선스, 생성 규칙을 모든 Production Activity에서 역추적할 수 있어야 한다.
10. 기존 Submission Snapshot과 발행된 WorkbookEdition이 참조하는 Activity는 제자리 수정하지 않는다.
11. 대규모 콘텐츠 때문에 초기 로딩, PWA, 저장공간, 오프라인 성능이 악화되어서는 안 된다.
12. 콘텐츠 수량 목표를 테스트 수량으로 대체하지 않는다.

---

# 3. 콘텐츠 규모 목표

아래 수량은 F16B의 장기 확장 목표다. 2026-09-29 설계 재검토에서 교육적 최소 출시 조건과 분리했다. 품질 검증을 통과하지 못한 항목을 숫자를 맞추기 위해 승인하지 않는다. 국어·수학의 수량 Gate는 이 변경의 범위 밖이다.

## 3.1 English

| Bank | 확장 목표 | 추가 확장 | 비고 |
|---|---:|---:|---|
| Base Word Family | 800 | 1,200 | 초등 기본 어휘를 우선하며 굴절형은 별도 count 금지 |
| Morphology Variant | 4,000 | 8,000 | 복수, 3인칭 단수, 과거, 진행, 비교 등 파생형 |
| Expression / Chunk | 2,000 | 3,500 | 일상 표현, 구동사, 숙어, 기능 표현 |
| Sentence Pattern | 500 | 1,000 | 의사소통 문형 및 문장 구조 |
| Approved Context Sentence | 20,000 | 40,000 | 단어/표현/문형을 실제 문맥에서 사용 |
| Materialized Activity | 80,000 | 150,000+ | Core + Vocabulary + Check/Workbook용 |

English의 `Base Word Family`는 headword 중심 SSOT다. 불규칙 활용은 Morphology Rule 또는 Lexeme metadata에 명시한다.

F16B 최소 출시는 위 수량과 별도 판정한다. 출시 cohort의 범위(학년군·학습목표·활성 Activity family·선택한 source/candidate ID)를 exact hash로 고정하고, 포함된 source와 모든 문항의 교육적 적합성 및 HUMAN 결정을 확인한다. 원천·정답·모든 오답·허용 형태·파생 관계를 함께 검수하며, 보류/반려 항목은 제외 이유를 남긴다. 선택한 학습 경로의 누적 학습 어휘는 초등 3~6학년 600개 이내로 관리하고 기본 어휘 비율 및 학년군 적합성을 검증한다. Bank의 800개 headword는 선택 가능한 풀이지 한 학습 경로의 학습량이 아니다. 각 출시 학습 경로는 실제 세션 길이·재노출 KPI를 감당하는지 검증하고, 무효/중복/복수 정답/출처 누락 0건, package 무결성·역사적 호환성 PASS를 요구한다. 정량 cohort 범위는 실제 학습 경로와 검수 가능량을 근거로 별도 확정하며 임의의 70% 환산이나 새 고정 수량으로 대체하지 않는다. 현재 exact cohort는 준비됐으나 HUMAN 및 실제 runtime·최종 설계 evidence가 없으므로 공개 최소 출시는 `PUBLIC_RELEASE_PENDING_FINAL_REVIEW`다. F16B Phase 자체는 2026-09-30 문서 기반 AI 1차 승인으로 종료했다.

예:

```text
go
├─ goes
├─ went
├─ gone
├─ going
├─ go home
├─ go to school
├─ go shopping
└─ go to bed
```

`went`를 별도 기본 단어로 세어 수량을 부풀리지 않는다.

## 3.2 Korean

| Bank | Release Gate | Stretch Goal | 비고 |
|---|---:|---:|---|
| Elementary Candidate Lexeme | 20,000 | 30,000+ | 공식 사전에서 후보 수집, 미승인 상태 포함 |
| Approved Elementary Lexeme | 8,000 | 12,000 | 실제 초등 학습 적합성 검수 완료 |
| Idiom / Proverb / Fixed Expression | 1,000 | 2,500 | 관용구, 속담, 고정 표현 |
| Spelling / Spacing / Usage Rule Cases | 8,000 | 15,000 | 규칙 및 예외 사례 |
| Approved Context Sentence | 30,000 | 60,000 | 어휘, 맞춤법, 띄어쓰기, 문장 적용 |
| Materialized Activity | 150,000 | 300,000+ | 어휘 + 맞춤법 + 띄어쓰기 + 문장 + 표현 |

국어는 사전 표제어 수를 그대로 학습 콘텐츠 수로 간주하지 않는다. 후보를 대량 확보한 뒤 초등 적합성, 의미 난이도, 사용 빈도, 추상성, 금칙어, 전문어 여부를 별도로 평가한다.

---

# 4. 공식 원천과 라이선스 정책

## 4.1 English

우선 원천:

- 교육부 2022 개정 영어과 교육과정
- 교육과정의 기본 어휘 관련 공식 자료
- 교육과정 성취기준과 의사소통 기능

원칙:

- 영어 기본어휘 목록은 학습 범위와 headword 선정 근거로 사용한다.
- 뜻풀이, 예문, distractor와 문제 문장은 프로젝트 자체 저작을 기본으로 한다.
- 출판사 교과서, 문제집, 유료 단어장 문장을 크롤링하거나 복제하지 않는다.
- Word Family의 정확한 수량은 importer가 공식 원천을 파싱한 결과와 사람이 검증한 manifest를 모두 일치시켜 확정한다.

## 4.2 Korean

우선 원천:

- 국립국어원 한국어기초사전
- 국립국어원 표준국어대사전
- 국립국어원 어문 규범
- 필요 시 우리말샘은 후보 탐색용으로 별도 provenance를 기록

한국어기초사전 Open API는 어휘, 관용구/속담, 뜻풀이, 용례를 검색할 수 있으므로 후보 Bank 수집에 활용한다.

직접 가져온 텍스트는 해당 서비스의 라이선스를 그대로 추적한다. 한국어기초사전에서 별도 명시가 없는 텍스트 자료는 CC BY-SA 2.0 KR 조건을 적용하고 저작자 표시와 동일조건변경허락을 보존한다. 멀티미디어는 텍스트와 다른 개별 조건일 수 있으므로 F16에서는 기본적으로 수집 대상에서 제외한다.

가능하면 다음 두 계층을 분리한다.

```text
External Reference Layer
  공식 표제어, 품사, 등급, 규범 식별자, 출처 링크

Project-owned Learning Layer
  자체 뜻풀이, 자체 예문, 자체 문제 prompt, 자체 distractor
```

외부 텍스트를 직접 재사용한 경우 sourceMetadata와 license를 절대 PROJECT_OWNED로 덮어쓰지 않는다.

---

# 5. 핵심 데이터 모델

## 5.1 English Lexeme

```text
lexemeId
headword
wordFamilyId
partOfSpeech
meanings[]
gradeLevels[]
topics[]
difficulty
curriculumVersion
morphology
irregularForms
collocations[]
expressionRefs[]
sentenceRefs[]
sourceMetadata
reviewStatus
```

## 5.2 English Morphology

```text
wordFamilyId
baseForm
thirdPersonSingular
pluralForms[]
pastForms[]
pastParticipleForms[]
presentParticipleForms[]
comparativeForms[]
superlativeForms[]
ruleIds[]
exceptions[]
```

적용되지 않는 변형은 생성하지 않는다. 명사/동사/형용사 품사에 맞지 않는 형태를 단순 조합하지 않는다.

## 5.3 Expression / Chunk

```text
expressionId
surfaceForm
canonicalForm
meaning
function
register
gradeLevels[]
topics[]
exampleRefs[]
sourceMetadata
reviewStatus
```

표현 예:

```text
How are you?
Nice to meet you.
Would you like ...?
Can I ...?
go to school
have breakfast
look for
be good at
```

## 5.4 Korean Lexeme

```text
lexemeId
headword
homonymNo
partOfSpeech
meanings[]
wordGrade
origin
pronunciation
usageTags[]
gradeLevels[]
difficulty
synonymRefs[]
antonymRefs[]
relatedWordRefs[]
idiomRefs[]
exampleRefs[]
sourceMetadata[]
reviewStatus
```

## 5.5 Knowledge Rule

맞춤법, 띄어쓰기, 어휘 관계, 문장 규칙은 문자열 문제 묶음이 아니라 Rule SSOT를 가진다.

```text
ruleId
subjectId
domainId
ruleType
title
summary
positiveCases[]
negativeCases[]
exceptionCases[]
sourceMetadata[]
gradeLevels[]
difficulty
reviewStatus
```

## 5.6 Generation Rule

```text
generatorId
version
subjectId
skillId
inputBankTypes[]
responseType
preconditions[]
transform
answerDerivation
distractorPolicy
qualityChecks[]
maxPerSource
reviewStatus
```

Generator는 버전 불변으로 관리한다. Generator 수정 시 기존 materialized Activity를 제자리 재작성하지 않고 새 content edition을 만든다.

---

# 6. English 문제 생성 전략

## 6.1 Vocabulary

한 Word Family에서 가능한 유형:

- English -> Korean meaning CHOICE
- Korean meaning -> English CHOICE
- Context meaning CHOICE
- Context word selection
- Spelling recall TEXT
- Missing letter / syllable support
- Collocation selection
- Similar word discrimination
- Part-of-speech selection

동일 headword에서 같은 뜻과 같은 문장을 반복 사용하지 않는다.

## 6.2 Word Form

- singular/plural
- 3rd person singular
- regular/irregular past
- present progressive
- past participle는 실제 초등 문맥에서 필요한 범위만 적용
- comparative/superlative
- pronoun/possessive 등 교육과정 범위에 맞는 변형

형태 변화 자체를 Base Word 수에 포함하지 않는다.

## 6.3 Expressions

숙어보다 초등 학습에서는 `chunk / fixed expression / communication function`을 폭넓게 포함한다.

- greeting
- introduction
- request
- permission
- offer
- preference
- time/date
- location/direction
- shopping
- food
- school
- family
- health
- weather
- hobby
- ability
- plan
- past event

문제 유형:

- 상황에 맞는 표현
- 대화 순서
- 응답 선택
- 빈칸 완성
- 부자연스러운 표현 찾기
- 동일 기능 표현 비교

## 6.4 Sentence

Sentence Pattern Bank와 Context Sentence Bank를 분리한다.

하나의 Pattern에 다양한 approved lexeme/expression을 결합하되 다음을 검사한다.

- 의미 자연스러움
- 시제 일관성
- 주어-동사 일치
- 관사/수 일치
- 선택지가 복수 정답이 되지 않음
- 초등 수준을 벗어나는 구조 금지

---

# 7. Korean 문제 생성 전략

## 7.1 Vocabulary

- 뜻 알기
- 문맥에 맞는 낱말
- 유의어
- 반의어
- 다의어
- 상위어/하위어
- 낱말 관계
- 같은 형태 다른 의미
- 어휘를 이용한 문장 완성

## 7.2 Spelling

Rule Bank에 연결하여 생성한다.

- 자주 틀리는 표기
- 소리와 표기의 차이
- 준말/본말
- 사이시옷 등 학년 적합 규칙
- 활용형에서 나타나는 맞춤법
- 외래어/표준어는 초등 적합 범위만 포함

단순 오탈자를 무작위 삽입하여 정답이 자명한 문제를 만들지 않는다.

## 7.3 Spacing

- 조사
- 의존 명사
- 단위 명사
- 보조 용언
- 수 표현
- 자주 혼동되는 결합

각 문제는 어떤 Rule과 Case에서 파생됐는지 추적 가능해야 한다.

## 7.4 Idiom / Proverb

- 뜻 고르기
- 상황에 맞는 표현
- 문장 완성
- 비슷한 뜻 구분
- 실제 문맥 적용

관용구와 속담은 문자 뜻만 보고 쉽게 답할 수 있는 선택지를 피한다.

## 7.5 Sentence

- 자연스러운 문장
- 호응
- 중복 표현
- 어색한 연결
- 문장 다듬기
- 문맥 연결
- 어휘 선택

긴 독해 Passage 기반 문항은 F17/F18 읽기 엔진으로 분리한다.

---

# 8. 대량 생성 파이프라인

Production 콘텐츠는 아래 순서 외에는 발행할 수 없다.

```text
1. ingest
2. normalize
3. classify
4. provenance validation
5. candidate generation
6. structural validation
7. linguistic validation
8. duplicate detection
9. difficulty and eligibility validation
10. review batch creation
11. approval
12. materialize immutable shards
13. build integrity verification
14. runtime selection test
```

## 8.1 Candidate와 Approved를 분리

대규모 생성 과정에서 생성되는 모든 중간 산출물을 Production `activities.json`에 바로 넣지 않는다.

```text
candidate
→ VALIDATED
→ REVIEW_REQUIRED
→ APPROVED
→ MATERIALIZED
```

FAILED 또는 REJECTED 콘텐츠는 Production package에 들어갈 수 없다.

---

# 9. 자동 품질 검증

최소 Validator:

## 공통

- activityId unique
- source identity unique
- prompt empty 금지
- answer empty 금지
- answer가 선택지에 정확히 1개 존재
- duplicate option 금지
- 동일 prompt + answer signature 중복 금지
- 학년 범위 누락 금지
- sourceMetadata 누락 금지
- reviewStatus 누락 금지
- 금칙어/성인/폭력/차별적 문맥 필터
- 지나치게 긴 prompt 제한

## English

- 품사와 morphology 호환성
- irregular form table 일치
- subject-verb agreement
- article/countability 기본 규칙
- tense marker와 정답 시제 일치
- distractor가 동일하게 정답이 되는 경우 차단
- 대소문자만 다른 가짜 선택지 제한

## Korean

- 맞춤법 Rule reference 필수
- spacing Rule reference 필수
- 동형어 meaning identity 분리
- 유의어/반의어 relation provenance 확인
- 조사/의존명사/단위명사 혼동 검증
- 정답이 단순 길이/기호 차이로 노출되는 문제 제한

---

# 10. 중복 검출

수량 증가만으로 다양성이 확보되지 않는다. 다음 중복 계층을 모두 검사한다.

1. exact activityId duplicate
2. normalized prompt duplicate
3. prompt + answer signature duplicate
4. option-set duplicate
5. sentence skeleton duplicate
6. same lexeme + same context duplicate
7. same rule + near-identical surface duplicate
8. workbook 내 source concentration 과다

Normalized text에는 공백/기호/대소문자 정규화를 적용하지만, 의미가 달라지는 정보를 제거하지 않는다.

Build report에 다음 지표를 출력한다.

```text
total candidates
accepted
rejected
exact duplicates
near duplicates
per skill count
per grade count
per source count
per generator count
unique context ratio
unique answer ratio
```

---

# 11. 반복 회피와 노출 다양성

큰 Bank를 만들어도 selector가 계속 같은 문제를 뽑으면 실패다.

Selection은 다음 순서를 적용한다.

```text
eligible content
→ unresolved review priority
→ due review priority
→ recent exact activity exclusion
→ recent source lexeme/rule penalty
→ recent context sentence exclusion
→ coverage deficit priority
→ deterministic seeded selection
```

최소 계약:

- 같은 세션 exact duplicate 0
- 직전 5개 세션의 exact Activity는 신규 학습 세션에서 기본 제외
- 충분한 후보가 있으면 직전 3개 세션에서 같은 context sentence 재사용 금지
- 같은 Word Family/Knowledge Rule 과다 집중 방지
- 모든 eligible source가 장기적으로 노출될 수 있도록 coverage score 사용
- Retry는 원문 Activity identity를 유지하며 신규 랜덤 문제로 바꾸지 않음

Recent history가 후보보다 큰 경우에는 가장 오래된 exposure부터 완화한다.

---

# 12. Sharding과 성능

수십만 Activity를 단일 `activities.json`으로 만들지 않는다.

권장 경로:

```text
content/packages/english-core-v2/
  manifest.json
  catalog.json
  shards/
    g3/vocabulary/...
    g3/expression/...
    g4/...
    g5/...
    g6/...

content/packages/korean-core-v2/
  manifest.json
  catalog.json
  shards/
    g1/...
    g2/...
    ...
    g6/...
```

Shard 기준:

- subject
- grade
- domain
- skill
- optional difficulty

Manifest는 각 shard의 SHA-256, item count, byte size, generation version을 기록한다.

초기 App Shell에서 전체 Bank를 precache하지 않는다.

- manifest/catalog는 precache
- 현재 학습에 필요한 shard는 요청 시 load/cache
- 열어 본 Workbook의 shard는 오프라인 cache 가능
- Content Package가 바뀌어도 기존 Submission은 content edition identity로 복원 가능

Shard 크기와 캐시 정책은 F16A 성능 테스트로 확정한다.

---

# 13. 검수 전략

수십만 파생 Activity를 사람이 한 줄씩 검토하는 방식은 지속 가능하지 않다. 대신 승인 단위를 계층화한다.

## 사람 필수 검수

- Base Lexeme 의미와 학년 적합성
- Expression/Chunk 의미와 용법
- Knowledge Rule
- Generator Rule
- irregular/exception table
- AI가 작성한 자유 문장 후보
- 라이선스/출처가 불명확한 데이터

## 자동 + Batch Review 가능

- 사람이 승인한 source와 deterministic rule로 생성된 형태 변형
- 형식적으로 정답이 유일하며 규칙으로 완전히 검증 가능한 Activity

각 batch는 통계와 대표 sample을 제공하며 Reviewer가 batch를 승인해야 materialize할 수 있다.

자동 Validator 통과만으로 AI 자유 생성 문장을 APPROVED 처리하지 않는다.

---

# 14. 품질 KPI

2026-10-14 기술1차종료의 공개 기본 경로는 기존 APPROVED 국어/영어 각160문항에서8 Skill을 고르게 선택하는 **종합20문항**이다. recent5 exact 제외를 유지하고 실제 native 저장소 full window2240문항 반복0%를 확인했다. 유형별 집중20은 별도의 반복 연습으로 명시한다. 새 콘텐츠의 승인/학년/Release Gate와 아래 KPI 임계값을 바꾸지 않는다. [실행·검증·종료 범위](../Implementation_Phases/F16E_TECHNICAL_FIRST_STAGE_CLOSE_2026-10-14.md).

수량 외에 다음 KPI를 Release Gate로 사용한다.

- invalid activity = 0
- duplicate activityId = 0
- exact prompt duplicate = 0
- multiple-valid-answer known cases = 0
- missing provenance = 0
- unapproved content in Production = 0
- runtime AI generation = 0
- session exact duplicate = 0
- recent-session repeat rate 목표: 5% 이하, Bank가 충분한 영역은 2% 이하
- skill별 최소 source coverage 충족
- grade별 minimum bank size 충족
- deterministic build reproducibility PASS
- Source/Dist/ZIP shard hash 일치 PASS

---

# 15. Migration 원칙

기존 `korean-core-v1`, `english-core-v1`, `english-vocabulary-v1`을 즉시 삭제하지 않는다.

1. v2 Bank를 별도 package로 생성한다.
2. 기존 Submission과 ReviewItem은 v1 identity를 계속 읽을 수 있어야 한다.
3. 새 Workbook만 v2를 참조하도록 전환한다.
4. v1과 v2의 결과 데이터가 learner/subject/course 집계에서 올바르게 공존하는지 검증한다.
5. 충분한 호환 기간 후 v1은 신규 선택 대상에서만 제외하고 historical resolver는 유지한다.

---

# 16. 외부 근거

- 교육부 2022 개정 교육과정 확정 발표: https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=294&boardSeq=93459&lev=0
- 한국어기초사전 Open API: https://krdict.korean.go.kr/kor/openApi/openApiInfo
- 한국어기초사전 저작권 정책: https://krdict.korean.go.kr/kor/kboardPolicy/copyRightTermsInfo
- 표준국어대사전: https://stdict.korean.go.kr/

구현 시 URL 존재 여부만 확인하지 말고 실제 source field와 라이선스 조건을 validator fixture로 고정한다.

---

# 17. 완료 정의

이 아키텍처는 단순 문서 작성으로 완료되지 않는다.

최종적으로 다음이 모두 구현되어야 한다.

- Content Factory
- English large-scale Bank
- Korean large-scale Bank
- sharded package loader
- deterministic compiler
- provenance/license validator
- morphology/rule validator
- duplicate detector
- coverage report
- exposure-aware selector
- v1 historical compatibility
- CI artifact 및 Production package integrity

세부 실행 순서는 `31_PHASE_F16_CONTENT_FACTORY_AND_SCALE_PROGRAM.md`를 따른다.

## F16C 문서 기반 1차 구현 계약 (2026-09-30)

[완료 정본](../Implementation_Phases/F16C_DOCUMENT_BASED_FIRST_APPROVAL_2026-09-30.md): A의 7계열 bank→결정적 recipe→candidate→검증→개별 AI 검토→private staging→매 읽기 hash 검증→공용 CHOICE/TEXT preview를 완료했다. private curriculum15 Skill, 68원천/105문항이며 기존 공개160문항과 공용 runtime 계약을 보존한다. B의 후보Lexeme20,000/승인Lexeme8,000/Activity150,000 등 장기 공급 게이트는 미달·보존한다. C의 전문가 배치·자연스러움·교육적 적합성 확정은 DEFERRED_BY_USER다. FIRST_STAGE_APPROVED / AI_DOCUMENT_REVIEW는 HUMAN/공개 production APPROVED가 아니다.

구현은 src/content-factory/banks/korean/{koreanBank,koreanPipeline}.js, review/koreanFirstStage.js 및 scripts/f16c-content.mjs. 국어 정규화는 단어 사이 공백을 보존하고 source/recipe/구현/sense/문항/approval/curriculum/package hash를 연결한다. production materializer 승인 게이트를 우회하지 않는다. 외부 텍스트 입력의 permission·license·attribution은 오답 의존 원천까지 전파한다. F16D 착수 가능이나 구현 미착수.


## 2026-09-30 F16D 실행 상태

F16D Implementer IN_PROGRESS / Reviewer PENDING. 48계열 생성·노출 선택·검토용 학습 연결 구현, 전체 unit 1,131 PASS. Minimum 6영역 중5 PASS, 곱셈577,318/1,000,000 NG이므로 READY_FOR_REVIEW 불가. 학년/학기/난이도와 교육 적합성은 미승인, 48계열 Coverage PARTIAL, 공개 승인 공급0. F16B/F16C FIRST_STAGE_APPROVED / AI_DOCUMENT_REVIEW 유지. F16E/F19 구현 미착수. [실행 계획](../Implementation_Phases/F16D_EXECUTION_PLAN_2026-09-30.md), [구현·검증 근거](../Implementation_Phases/F16D_IMPLEMENTATION_REPORT_2026-09-30.md), [F19 Minimum/Stretch 이관](../Implementation_Phases/F19_TRANSFER_GATES_FROM_F16D_2026-09-30.md). 기존 Release Gate는 축소하지 않는다.
