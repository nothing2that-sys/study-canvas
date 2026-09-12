# Curriculum Level & Content Eligibility Architecture v1

문서 상태: ARCHITECTURE_SSOT  
작성일: 2026-09-11  
상위 정본: `Docs/UNIFIED_CURRICULUM_ACTIVITY_PLATFORM_v2.3.md`  
구현 정본: `Docs/Implementation_Phases/26_PHASE_F13_R2_GRADE_LEVEL_FOUNDATION.md`  

---

# 1. 목적

초등 1학년부터 6학년까지의 콘텐츠가 학습자 수준과 보호자 설정에 맞게 검색, 문제집 구성, 추천과 복습에 사용되도록 공통 데이터 계약과 자격 판정 규칙을 정의한다.

현재 `gradeBand: elementary`, `3_4`, `5_6`만으로는 3학년 학습자에게 4학년 또는 상위 수준 콘텐츠가 섞이는 것을 충분히 차단할 수 없다. 본 설계는 이를 명시적 학년 계약으로 보완한다.

# 2. 핵심 원칙

- 학교 학년과 실제 과목별 학습 위치를 분리한다.
- 학년, 학기와 난이도는 서로 다른 축이다.
- 콘텐츠의 대상 학년은 단일 값 또는 명시적 범위로 저장한다.
- 상위 학년 노출은 보호자 허용이 필요하다.
- 학년 미분류 또는 미승인 콘텐츠는 자동 추천하지 않는다.
- 기존 콘텐츠는 명시적 매핑과 검수 없이 자동 승격하지 않는다.
- 공식 성취도는 Guardian GradeDecision만 사용한다.

# 3. 데이터 계약

## 3.1 LearnerProfile 확장

```json
{
  "id": "learner-1",
  "schoolGrade": 3,
  "schoolYear": 2026,
  "curriculumVersion": "2022-revised",
  "guardianPolicyId": "policy-1"
}
```

F13-R2 로컬 우선 구현에서는 별도 Object Store를 추가하지 않고 프로필에 `guardianPolicyId`, 정책 Snapshot과 과목별 Placement를 함께 저장한다. 정책 ID는 향후 별도 저장소나 동기화 계층으로 분리할 때도 안정적으로 유지한다.

검증:

- `schoolGrade`는 1부터 6까지의 정수 또는 미설정 상태다.
- 학년 미설정 시 보호자 범위 설정 전 자동 추천을 제한한다.
- 학년 변경은 과거 Submission의 범위를 변경하지 않는다.

## 3.2 LearningPlacement

```json
{
  "learnerId": "learner-1",
  "subjectId": "english",
  "courseId": "english-core",
  "unitId": "vocabulary",
  "gradeLevel": 3,
  "semester": "ALL",
  "difficulty": "FOUNDATION",
  "placementSource": "GUARDIAN",
  "updatedAt": 0
}
```

`placementSource` 후보:

- `GUARDIAN`: 보호자가 직접 설정
- `OBSERVED`: 확정된 학습 결과로 계산한 제안값
- `DIAGNOSTIC`: 선택형 진단 결과
- `DEFAULT`: 학교 학년 기반 초기값

`OBSERVED`와 `DIAGNOSTIC`은 제안값이며 보호자 정책을 넘어서 상위 콘텐츠를 자동 개방하지 않는다.

## 3.3 GuardianLearningPolicy

```json
{
  "id": "policy-1",
  "learnerId": "learner-1",
  "allowReviewBelowGrade": true,
  "maxReviewGradeDelta": 2,
  "allowPreviewAboveGrade": false,
  "maxPreviewGradeDelta": 0,
  "allowedDifficulties": ["FOUNDATION", "STANDARD"],
  "requireGuardianForLockedRange": true
}
```

## 3.4 SkillDefinition v2 확장

```json
{
  "skillId": "EN_G3_VOCAB_MEANING",
  "subjectId": "english",
  "courseId": "english-core",
  "unitId": "vocabulary",
  "gradeLevel": 3,
  "semester": "ALL",
  "difficulty": "FOUNDATION",
  "curriculumVersion": "2022-revised",
  "achievementStandardIds": [],
  "prerequisites": [],
  "status": "ACTIVE"
}
```

기존 `gradeBand`와 숫자형 `difficulty`는 호환 읽기만 지원한다. 신규 등록과 콘텐츠 승인에는 명시적 필드를 요구한다.

마이그레이션 제안 매핑은 승인값이 아니라 검수 시작점이다.

| 기존 값 | 후보 의미 |
|---|---|
| `difficulty: 1` | FOUNDATION 후보 |
| `difficulty: 2` 또는 `3` | STANDARD 후보 |
| `difficulty: 4` 또는 `5` | ADVANCED 후보 |

사람 검수 없이 위 후보를 APPROVED 메타데이터로 저장하지 않는다.

## 3.5 LearningActivity 확장

```json
{
  "id": "EN_G3_VOCAB_001",
  "subjectId": "english",
  "courseId": "english-core",
  "unitId": "vocabulary",
  "skillId": "EN_G3_VOCAB_MEANING",
  "gradeLevel": 3,
  "semester": "ALL",
  "difficulty": "FOUNDATION",
  "curriculumVersion": "2022-revised",
  "achievementStandardIds": [],
  "responseType": "CHOICE",
  "reviewStatus": "APPROVED"
}
```

Activity 범위는 연결된 Skill 범위를 벗어날 수 없다.

# 4. 학습 방향 판정

학교 학년과 선택 콘텐츠 학년을 비교해 다음으로 분류한다.

| 조건 | `studyDirection` |
|---|---|
| 콘텐츠 학년이 낮음 | REVIEW |
| 콘텐츠 학년이 같음 | ON_GRADE |
| 콘텐츠 학년이 높음 | PREVIEW |

`LearningPlacement.gradeLevel`은 세부 추천 중심값으로 사용하고, `schoolGrade`는 보호자 정책과 표시 기준으로 사용한다.

## 4.1 과목별 교육과정 범위

- 수학과 국어는 초등 1학년부터 6학년까지를 학교 교육과정 범위로 취급한다.
- 영어는 초등 3학년부터 6학년까지를 학교 교육과정 범위로 취급한다.
- 영어 1학년과 2학년용 콘텐츠가 필요하면 `curriculumScope: PROJECT_FOUNDATION`으로 별도 분류한다.
- `PROJECT_FOUNDATION`을 학교 학년 정규 교육과정으로 표시하거나 성취기준 달성으로 합산하지 않는다.
- 모든 과목에서 상위 학년 선행은 GuardianLearningPolicy를 따른다.

# 5. Content Eligibility 판정

입력:

```text
learnerId
content 또는 skill
requestedMode
guardianPolicy
learningPlacement
```

출력:

```json
{
  "eligible": true,
  "studyDirection": "ON_GRADE",
  "reasonCode": "ELIGIBLE_ON_GRADE",
  "requiresGuardianUnlock": false
}
```

필수 판정 순서:

1. 학습자와 정책이 유효한지 확인
2. 과목, 코스와 Skill이 활성인지 확인
3. Content Package와 Activity가 APPROVED인지 확인
4. 교육과정 버전 호환 여부 확인
5. 학년과 학기 필드 존재 여부 확인
6. 복습, 현행 또는 선행 범위 판정
7. 보호자 허용 범위 확인
8. 난이도 허용 범위 확인
9. 선수 학습 충족 여부 확인
10. 최종 자격과 사유 코드 반환

주요 거절 사유:

- `MISSING_GRADE_METADATA`
- `CONTENT_NOT_APPROVED`
- `SUBJECT_DISABLED`
- `PREVIEW_NOT_ALLOWED`
- `REVIEW_RANGE_EXCEEDED`
- `DIFFICULTY_NOT_ALLOWED`
- `PREREQUISITE_NOT_MET`
- `CURRICULUM_VERSION_MISMATCH`

# 6. 추천 엔진 연결

Content Eligibility는 기존 Tier 1부터 7까지를 대체하지 않는다.

```text
원본 후보 수집
→ Content Eligibility 필터
→ Resume와 Review 불변성 처리
→ 중복 제거
→ 기존 Tier 순위 결정
→ 화면 표시
```

- 신규 학습만 현재 보호자 정책으로 필터링한다.
- 기존 Draft Resume은 시작 당시 범위와 콘텐츠 버전을 유지한다.
- 기존 Review Retry는 원본 ReviewItem 범위를 유지한다.
- 정책 변경으로 현재 허용 범위를 벗어난 Resume과 Retry는 삭제하지 않고 보호자 확인 대상으로 표시한다.

# 7. 직접 선택 UX

필터 순서는 다음을 권장한다.

```text
과목
→ 학년
→ 학기
→ 영역과 단원
→ 기초, 표준, 심화
→ 문제집
```

- 초기값은 현재 LearningPlacement다.
- 낮은 학년은 `복습`으로 표시한다.
- 같은 학년은 `현재 학년`으로 표시한다.
- 높은 학년은 `미리보기` 또는 잠금으로 표시한다.
- 잠금 해제는 보호자 영역에서만 수행한다.

# 8. 기존 콘텐츠 마이그레이션

## 8.1 금지

- `3_4` 콘텐츠를 검수 없이 3학년과 4학년에 동시에 복제하지 않는다.
- 단어 길이나 문제 번호로 학년을 추정하지 않는다.
- 기존 `difficulty: 1`을 자동으로 FOUNDATION으로 확정하지 않는다.

## 8.2 절차

1. 기존 Skill과 Activity 목록 추출
2. 교육과정 근거와 실제 난이도 검토
3. 1부터 6까지의 명시적 학년 할당
4. 학기, 난이도와 성취기준 할당
5. 검수자와 검수일 기록
6. 새 패키지 버전 발행
7. 기존 Submission은 이전 packageVersion 유지

# 9. 검증 기준

- 모든 APPROVED Skill과 Activity가 유효한 `gradeLevel`을 가진다.
- 3학년 정책에서 허용되지 않은 4학년부터 6학년 신규 콘텐츠가 0건이다.
- 복습 허용 범위보다 낮은 콘텐츠가 추천되지 않는다.
- 선행 허용 시에도 지정한 상한을 넘지 않는다.
- 선수 학습 미충족 콘텐츠가 추천되지 않는다.
- 동일 입력에서 eligibility와 추천 결과가 결정론적이다.
- 두 학습자의 학년, 정책과 LearningPlacement가 섞이지 않는다.
- 마이그레이션 전 Submission과 Review의 콘텐츠 참조가 유지된다.

# 10. 비목표

- 국가 단위 교육과정 원문 전체 저장
- 학교별 진도 자동 수집
- AI 기반 학년 자동 판정
- 보호자 승인 없는 자동 선행학습
- 공식 성취도의 자동 확정
