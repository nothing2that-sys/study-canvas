# 문제은행 직접 활용

## 파일 위치와 수록 범위

`app/content/registry.json`의 활성 package와 manifest를 읽으면 현재 정적 문항을 모두 얻습니다. manifest의 `files.activities`가 실제 JSON 파일을 가리킵니다.

| package | 과목 | 문항 수 |
| --- | --- | ---: |
| korean-ai-reviewed-v1 | 국어 | 5,247 |
| english-ai-reviewed-v1 | 영어 | 1,287 |
| math-measurement-v1 | 수학 단위 | 6 |
| math-fraction-concepts-v1 | 수학 분수 개념 | 10 |
| math-fraction-operations-v1 | 수학 분수 연산 | 7 |
| math-decimal-v1 | 수학 소수 | 10 |

원본 JSON은 `{schemaVersion, packageId, packageVersion, activities:[...]}` 형태입니다. 그대로 복사하거나 추출 도구로 가져갈 수 있습니다. 수학 생성기는 `app/js/mathGen.js`, `mathF16dGenerator.js`, `fractionOperationGenerator.js`, `measurementUnitGenerator.js`, `decimalGenerator.js`에 별도로 있습니다. 가능한 수학 출제 조합 수를 정적 은행 수와 합산하지 마세요.

## 문항에서 유지할 필드

| 필드 | 의미 |
| --- | --- |
| id, version, contentRef | 문항·판본 식별; 이력을 덮어쓰는 새 ID 재사용 금지 |
| subjectId, courseId, unitId, skillId | 과목·영역·스킬 |
| gradeLevel, semester, difficulty | 프로젝트의 배치안; 공식 교육 인증 아님 |
| activityType, responseType, prompt, choices | 화면 표시·응답 형식 |
| expectedAnswer, gradingReference | 정답과 설명·수동 판정 기준 |
| sourceMetadata | 원 출처 URL·license·attribution·reviewer |
| metadata | 원천 연결·변경 내역·AI 검토·humanReviewed 등의 범위 |

메타데이터는 모두 동일한 깊이가 아닙니다. 사전 문항은 `metadata` 아래 구체적인 원천·뜻풀이·학년 근거가 있으며, 외부 사전 원천 상세는 `app/review/source-bank-evidence.json` 등에 있습니다. 모르는 필드를 삭제하지 않는 방식으로 옮기세요.

## 추출

```sh
npm run bank:export -- --subject all --format jsonl --out exports/all/questions.jsonl
npm run bank:export -- --subject korean --skill KO_REVIEW_VOCAB_CONTEXT --format json --out exports/korean-context/questions.json
```

필터: `subject=all|math|korean|english`, `grade=1..6`, 정확한 `skill` ID. 학년 필터는 **gradeLevel의 정확한 값**이며 UI의 복습·현재 학년·예습 eligibility 판정과 다릅니다. JSONL 한 줄이 문항 하나이며 원래 문항 필드를 그대로 유지합니다. JSON은 `activities` 배열을 제공합니다. 두 형식 모두 주변 고지 파일과 export manifest를 함께 보관해야 합니다.

`examples/read-bank.mjs`, `examples/read-bank.py`는 외부 의존성 없이 읽는 예제입니다. 다른 앱에서 자체 정답 판정기를 붙일 수 있지만, 기존 `GUARDIAN_MANUAL` 과제를 검증 없이 자동 정답 처리했다고 홍보하지 마세요.

## 새 문항을 넣으려면

원천 이용 조건 → 단일 의미·정답 근거 → 학년·난이도 제안 → 중복·선택지 검토 → 새 문항/패키지 버전 → exact-review binding과 resource hash의 명시적 갱신이 필요합니다. 현재 앱은 해시가 바뀐 미검토 데이터가 조용히 통과하지 않도록 막습니다. 이 저장소에는 중간 수집 스크립트·보류 후보·학습자 데이터가 없으며, 단순히 해시 검사 코드를 지워 문항을 늘리면 안 됩니다.
