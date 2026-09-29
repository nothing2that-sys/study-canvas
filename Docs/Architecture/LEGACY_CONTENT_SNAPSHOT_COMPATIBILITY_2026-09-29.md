# 공개 패키지 1.0.0 저장 기록의 1.0.1 호환성 확인

## 범위와 근거

- 기준 커밋: `d393794267144a257da41c85dbfa18dcd190efb6`의 국어·수학 공개 패키지 `1.0.0`.
- 테스트 고정 자료: [`legacy-content-v1.0.0.json`](../../src/tests/fixtures/legacy-content-v1.0.0.json)의 실제 Activity 5개. 각 Activity를 `JSON.stringify`한 SHA-256을 기록하고 테스트에서 재계산한다.
- 대상 패키지: `korean-core-v1`, `math-fraction-operations-v1`, `math-measurement-v1`, `math-fraction-concepts-v1`, `math-decimal-v1`. 현재 공개 manifest는 모두 `1.0.1`이다.
- 각 패키지에서 1개 대표 문항을 골라 저장 경로를 검사했다. 이 결과는 과거 모든 사용자 기록이나 모든 Activity를 전수 복원했다는 뜻이 아니다.

## 결과

Draft는 `normalizeDraft`가 문제 배열을 복사해 저장하고 복원한다. 제출은 `createSubmissionSnapshot`과 `saveSubmissionSnapshot`이 그 문제를 포함해 저장한다. 보호자 채점과 Review 재풀이는 원본 Submission의 문제를 사용한다. 테스트는 위 다섯 문항에 대해 Draft → Submission → WRONG 판정 → Review retry를 실행했고, 과거 `prompt`, `expectedAnswer`, `contentRef`가 유지됨을 확인했다. 이 경로에서 `1.0.0` 패키지 파일을 다시 로드하지 않는다.

국어 `KO_ACT_SENTENCE_CORRECTION_017`의 과거 Snapshot에는 `말씀이 있으시겠습니다`만 적혀 있다. 보호자 채점 화면에서 이를 그대로 표시하면 현재 확인된 다른 허용 답안인 `말씀이 있겠습니다`가 빠진다. 정확히 `korean-core-v1/1.0.0/KO_ACT_SENTENCE_CORRECTION_017/contentVersion 1`인 Snapshot의 **화면 표시**에서만 두 답안과 수정된 설명을 보여 준다. 저장된 문제, 학생 응답, 보호자 판정, 통계는 바꾸지 않는다. 판정은 여전히 보호자가 직접 한다.

## 검증과 제한

- 고정 문항 해시 5/5 일치, 현재 manifest 버전 5/5 `1.0.1` 확인.
- 새 호환성 테스트 3/3 PASS; 전체 unit 1,018/1,018 PASS; `validate:content`, `build`, `package`, `verify` PASS.
- 배포 산출물 `BUILD_ID`: `20260929T005726441Z-a3e7227`; ZIP SHA-256: `427b1708f49026eab4f535870e098dc8b7177caad3ec33bb3d5f14f7a6113cb0`; ZIP 내부 검증 103파일.
- 공개 registry는 여전히 최신 `1.0.1`만 가리킨다. 과거 `contentRef`만 가지고 `1.0.0` 패키지를 다시 로드하는 기능과 Snapshot이 없는 기록의 복원은 검증 또는 구현하지 않았다.
- 이 검사는 로컬 저장·렌더링 코드와 합성 IndexedDB에 대한 검증이다. 실제 기존 사용자 브라우저 DB의 마이그레이션이나 교육과정 적합성 승인은 확인하지 않았다. F16B Release는 별도 판정 전까지 `REJECTED / REWORK_REQUIRED`다.
