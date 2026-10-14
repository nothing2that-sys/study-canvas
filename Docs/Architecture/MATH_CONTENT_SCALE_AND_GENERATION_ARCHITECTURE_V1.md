# Math Canvas Pro — Math Content Scale & Generation Architecture v1

문서 상태: ARCHITECTURE_SSOT  
작성일: 2026-09-17  
적용 대상: Arithmetic, Measurement, Fraction, Decimal, Geometry, Pattern, Data/Graph, Story Problem  
상위 제품 정본: `Docs/UNIFIED_CURRICULUM_ACTIVITY_PLATFORM_v2.3.md`  
상위 콘텐츠 정본: `Docs/Architecture/CONTENT_SCALE_AND_GENERATION_ARCHITECTURE_V1.md`  
F16 실행 정본: `Docs/Implementation_Phases/34_PHASE_F16_CONTENT_FACTORY_AND_SCALE_PROGRAM_V2.md`  
수학 실행 Phase: `Docs/Implementation_Phases/33_PHASE_F16D_MATH_LARGE_SCALE_GENERATOR_AND_COVERAGE.md`

---

현재 진행 규칙 (2026-10-13 사용자 지시): F16D는 기술 구현 1차 종료, F16E 개발 착수다. [진행 판정과 검증 근거](../Implementation_Phases/F16D_TECHNICAL_FIRST_STAGE_CLOSE_2026-10-13.md). 교육·실기기·지정 최종 Reviewer 및 공개 Release는 별도로 남으며 아래 수량·Coverage·원본 호환 게이트는 보존한다.

# 1. 목적

수학은 국어/영어처럼 정적 원문 Bank를 단순히 수십만 개로 늘리는 방식으로 확장하지 않는다.

Math Canvas Pro의 수학 대규모 확장은 다음 세 축을 동시에 만족해야 한다.

```text
Curriculum Coverage Matrix
+ Large Mathematical Problem Space
+ Exposure-aware Rotation
```

연산형 문제는 제약식 기반 Generator를 중심으로 확장하고, 개념형/시각형/문장형 문제는 검증된 Representation/Context Bank와 Generator를 결합한다.

목표는 `문제 수가 많아 보이는 것`이 아니라 다음을 보장하는 것이다.

- 학년 1~6 교육과정 coverage
- 동일 Skill에서도 충분한 수학적 구조 다양성
- 몇 달 반복해도 같은 숫자/표현/문맥 반복 체감 최소화
- 생성 문제의 수학적 정합성 100%
- 기존 Draft -> Submission -> Guardian GradeDecision -> Review -> Progress 계약 유지

---

# 2. 절대 원칙

1. 수학 문제 규모는 정적 `activities.json` 항목 수만으로 평가하지 않는다.
2. Generator가 만들 수 있는 유효한 고유 Problem Space와 Feature Coverage를 함께 측정한다.
3. 동일 세션 중복 제거만으로 완료 처리하지 않는다. 학습자 최근 노출 이력을 회피해야 한다.
4. 같은 계산식에서 숫자만 무의미하게 바꾼 문제를 서로 다른 고품질 Activity로 간주하지 않는다.
5. Story Problem은 이름/사물 명칭만 치환하여 수량을 부풀리지 않는다.
6. 생성기는 학년, 단원, Skill, 난이도, 성취기준, Feature Vector를 역추적할 수 있어야 한다.
7. 모든 정답 도출은 deterministic해야 한다.
8. Fraction/Decimal 내부 정답 판정에 부동소수점 오차가 개입하지 않도록 정수/유리수 기반 검증을 우선한다.
9. 시각 모델은 문제의 의미와 정확히 일치해야 하며 장식용 그림으로 대체하지 않는다.
10. 기존 Submission Snapshot과 발행된 WorkbookEdition의 Activity identity를 제자리 변경하지 않는다.
11. 런타임 AI 문제 생성은 도입하지 않는다.
12. 수학 생성기 확대 때문에 초기 App Shell에 대규모 문제 Bank를 전부 precache하지 않는다.

---

# 3. 공통 Math Coverage Matrix

모든 수학 영역은 최소 다음 축으로 coverage를 측정한다.

```text
gradeLevel
semester
courseId
unitId
skillId
achievementStandardIds
representationType
responseType
difficulty
featureVector
generatorId
generatorVersion
reviewStatus
```

Coverage Report는 최소 다음을 출력한다.

```text
eligible problem space
validated problem space
materialized activity count
representation coverage
feature coverage
difficulty distribution
recent exposure overlap
known ambiguity count
invalid generation count
```

`문제가 많음`이라는 서술만으로 Release Gate를 통과할 수 없다.

---

# 4. Feature Vector 표준

## 4.1 Arithmetic

### Multiplication

- operand digit counts
- carry count
- zero inclusion
- partial product count
- fixed/multiple/random multiplier mode
- missing operand position
- inverse relation form
- verification form

### Division

- dividend/divisor/quotient digit counts
- exact/remainder division
- remainder size class
- estimation requirement
- trailing zero
- missing dividend/divisor/quotient
- multiplication inverse form
- verification form

## 4.2 Measurement

- dimension
- source unit
- target unit
- conversion direction
- integer/simple/composite unit form
- comparison
- unit selection
- context type
- error detection

## 4.3 Fraction

- proper/improper/mixed/unit fraction
- denominator class
- same/unlike denominator
- equivalence
- compare
- common denominator
- carry/borrow in mixed number
- representation type
- operation type

## 4.4 Decimal

- integer digits
- decimal places
- place value
- read/write
- compare/order
- fraction conversion
- add/subtract/multiply/divide
- trailing zero semantics

## 4.5 Geometry / Pattern / Data

Geometry:
- shape type
- property target
- symmetry
- perimeter/area
- angle/length relation
- composite shape

Pattern:
- numeric/shape/table pattern
- rule depth
- forward/backward inference
- missing term position

Data/Graph:
- table/bar/line/pictograph
- read/compare/sum/difference/inference
- scale interval
- multi-step reasoning

## 4.6 Story Problem

- mathematical structure
- number of reasoning steps
- operation sequence
- unit dimension
- irrelevant information presence
- context domain
- linguistic complexity
- diagram/table support

---

# 5. 영역별 Release Gate

## 5.1 Arithmetic

Minimum:

```text
Multiplication effective unique problem space >= 1,000,000
Division effective unique problem space >= 300,000
```

필수 확장:

- remainder division
- missing operand
- inverse operation
- equation completion
- verification
- estimate/selection
- mixed practice

단순 `a x b`와 `a ÷ b`만으로 목표 공간을 채우지 않는다.

Stretch:

```text
Arithmetic combined effective problem space >= 5,000,000
```

## 5.2 Measurement

Minimum:

```text
Validated variation >= 100,000
```

반드시 포함:

- simple unit conversion
- composite unit conversion
- mixed-unit read/write
- unit comparison
- appropriate-unit selection
- incorrect-unit detection
- real-world context
- multi-step measurement problem

Stretch >= 300,000 validated variations.

## 5.3 Fraction

Concept minimum:

```text
Validated concept variation >= 20,000
```

Operation minimum:

```text
Effective mathematical problem space >= 1,000,000
```

필수 representation:

- PART_WHOLE_BAR
- PART_WHOLE_GRID
- NUMBER_LINE
- SYMBOLIC_FRACTION
- EQUIVALENT_PAIR

필수 skill family:

- identify/read/write
- compare/order
- proper/improper/mixed conversion
- equivalent fraction
- reduction/common denominator
- same/unlike denominator operations
- mixed number operations

Stretch >= 2,000,000 operation space.

## 5.4 Decimal

Minimum:

```text
Effective problem space >= 1,000,000
```

필수:

- read/write
- place value
- compare/order
- fraction-decimal relation
- add/subtract
- multiply/divide within elementary curriculum
- measurement-linked decimal context

Stretch >= 2,000,000.

## 5.5 Geometry / Pattern / Data / Graph

각 영역 minimum:

```text
Validated variation >= 20,000
```

Stretch each >= 50,000.

## 5.6 Story Problem

Minimum:

```text
Approved semantic context/problem variants >= 50,000
```

Stretch >= 100,000.

수량 산정 시 단순 명사 치환은 별도 semantic variant로 세지 않는다.

---

# 6. Generator Architecture

모든 Generator는 다음 계약을 가진다.

```text
generatorId
version
subjectId = math
courseId
unitId
skillIds[]
gradeLevels[]
featureSchema
parameterConstraints
answerDerivation
representationPolicy
dedupSignature
qualityChecks
reviewStatus
```

Generator 수정 시 기존 published Activity를 제자리 재작성하지 않는다.

동일 generatorVersion + seed + parameters는 동일 문제를 재현해야 한다.

---

# 7. Problem Fingerprint

최근 반복 회피와 중복 검출에 수학 전용 fingerprint를 사용한다.

예:

```text
subject/course/skill
generatorId/version
canonical operation structure
normalized operands
featureVector
representationType
contextSemanticId
answerClass
```

교환법칙이 적용되는 문제는 필요한 경우 canonical operand order를 사용한다.

Story Problem은 표면 문자열이 달라도 동일 mathematical structure + 동일 semantic context이면 near-duplicate로 판정할 수 있어야 한다.

---

# 8. Exposure-aware Rotation

수학 신규 세션 후보 선택:

```text
curriculum eligible
→ skill/difficulty eligible
→ mathematically valid
→ recent exact fingerprint exclusion
→ recent operand-pattern penalty
→ recent feature concentration penalty
→ representation diversity boost
→ weak-skill boost
→ long-unexposed boost
→ deterministic final selection
```

기본 목표:

- 직전 5세션 exact fingerprint 제외
- 최근 100문제 동일 operand pair 재사용 최소화
- 최근 featureVector concentration 제한
- representation 편중 방지
- Story context 최근 반복 억제

후보 부족 시 fail-safe fallback 순서를 명시하고 무한 loop를 금지한다.

Retry는 원본 Activity identity를 유지한다.

---

# 9. Context Bank

수학 문장제는 Generator와 Context를 분리한다.

```text
Math Structure
+ Approved Context Template
+ Unit/Entity Constraint
+ Number Constraint
→ Candidate Story Problem
→ Semantic Validator
```

Context 분야 예:

- 학교
- 가족
- 장보기
- 음식
- 시간
- 거리
- 교통
- 운동
- 놀이
- 물건 배분
- 측정
- 일정
- 표/그래프 해석

Template은 단순 명사 슬롯 치환이 아니라 질문 의미와 단위, 연산 구조가 자연스럽게 연결되어야 한다.

---

# 10. Validator

최소 검사:

- answer derivation exactness
- multiple valid answer detection where applicable
- parameter bounds
- curriculum range
- division by zero
- negative result restriction by grade/skill
- remainder constraint
- fraction denominator validity
- decimal precision policy
- unit dimension mismatch
- impossible geometry spec
- graph scale validity
- duplicate/near-duplicate signature
- representation-answer mismatch

Invalid generation count는 CI report에서 확인 가능해야 한다.

---

# 11. Performance / Storage

- 거대한 정적 수학 문제 JSON을 생성하여 전부 배포하지 않는다.
- Generator spec, catalog, approved context/visual shards를 분리한다.
- 필요한 학년/영역 shard만 load한다.
- generated session은 기존 LearningActivity/Session 계약으로 materialize한다.
- historical published Activity는 contentRef로 재현 가능해야 한다.
- offline에서 이미 필요한 generator/catalog/shard가 cache되어 있으면 문제 생성과 학습이 가능해야 한다.

---

# 12. CI Count / Space Gate

F16D 이후 CI는 최소 다음을 검증한다.

```text
math.arithmetic.multiplication.problemSpace >= 1000000
math.arithmetic.division.problemSpace >= 300000
math.measurement.validatedVariation >= 100000
math.fraction.conceptVariation >= 20000
math.fraction.operationProblemSpace >= 1000000
math.decimal.problemSpace >= 1000000
math.geometry.validatedVariation >= 20000
math.pattern.validatedVariation >= 20000
math.dataGraph.validatedVariation >= 20000
math.storyProblem.approvedSemanticVariant >= 50000
```

Count/space 계산기는 deterministic해야 하며 test fixture, invalid candidate, duplicate candidate를 제외한다.

---

# 13. 완료 정의

수학 대규모 확장은 다음 모두를 만족해야 한다.

- [ ] Curriculum Coverage Matrix 생성
- [ ] Arithmetic Release Gate 통과
- [ ] Measurement Release Gate 통과
- [ ] Fraction Release Gate 통과
- [ ] Decimal Release Gate 통과
- [ ] Geometry Release Gate 통과 또는 F19 구현 범위와 명시적 연결
- [ ] Pattern Release Gate 통과 또는 F19 구현 범위와 명시적 연결
- [ ] Data/Graph Release Gate 통과 또는 F19 구현 범위와 명시적 연결
- [ ] Story Problem Release Gate 통과 또는 F19 구현 범위와 명시적 연결
- [ ] math-specific duplicate/fingerprint validator
- [ ] exposure-aware rotation
- [ ] learner isolation
- [ ] deterministic replay
- [ ] historical content compatibility
- [ ] full regression 0 failed / 0 skipped
- [ ] build/package/verify PASS
- [ ] CI success

Release Gate 수량을 구현자가 임의 축소할 수 없다. 변경하려면 본 Architecture SSOT와 F16 실행 정본을 함께 갱신하고 설계 검토 승인을 받아야 한다.


## 2026-09-30 F16D 실행 상태

F16D Implementer IN_PROGRESS / Reviewer PENDING. 48계열 생성·노출 선택·검토용 학습 연결 구현, 전체 unit 1,131 PASS. Minimum 6영역 중5 PASS, 곱셈577,318/1,000,000 NG이므로 READY_FOR_REVIEW 불가. 학년/학기/난이도와 교육 적합성은 미승인, 48계열 Coverage PARTIAL, 공개 승인 공급0. F16B/F16C FIRST_STAGE_APPROVED / AI_DOCUMENT_REVIEW 유지. F16E/F19 구현 미착수. [실행 계획](../Implementation_Phases/F16D_EXECUTION_PLAN_2026-09-30.md), [구현·검증 근거](../Implementation_Phases/F16D_IMPLEMENTATION_REPORT_2026-09-30.md), [F19 Minimum/Stretch 이관](../Implementation_Phases/F19_TRANSFER_GATES_FROM_F16D_2026-09-30.md). 기존 Release Gate는 축소하지 않는다.
