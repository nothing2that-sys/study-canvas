# 다른 LLM에 수정 맡기기

저장소의 `AGENTS.md`를 먼저 읽히고, 구현 위치가 불명확하면 아래 아키텍처와 화면별 파일 표부터 조사하도록 요청하세요. 코드 전체·문제은행 전체를 매번 prompt에 붙일 필요는 없습니다.

## UI 수정 지시문 예시

```text
이 저장소의 README.md, AGENTS.md, docs/ARCHITECTURE.md,
docs/UI_CUSTOMIZATION.md, LICENSES/README.md를 먼저 읽어라.

목표: [예: 아이가 쓰기 편한 큰 버튼과 차분한 색상으로 홈/문제 카드 개선]
대상 화면: [홈 / 과목 / 입력 / 보호자 채점]
기기: [태블릿 가로·세로 / PC]

문항·정답·출처·이용 조건·AI/HUMAN 검토 플래그를 바꾸지 말고
학생 입력/저장/제출 잠금/보호자 채점/오답 재풀이와 기존 저장 데이터를 보존하라.
기존 DOM ID와 이벤트 연결, 캔버스 좌표 처리를 조사하고 필요한 UI 파일만 수정하라.
npm run check를 실행하고, 실제 브라우저 검증과 미확인 항목을 구분해 보고하라.
commit/push/배포는 요청할 때만 수행하라.
```

## 문제은행만 활용하는 지시문

```text
docs/DATA_FORMAT.md와 LICENSES/README.md를 읽고
app/content/registry.json → manifest → activities.json 경로로 문항을 읽어라.
[과목/스킬/학년]에 해당하는 문항을 scripts/export-bank.mjs로 추출하고,
정답·해설·sourceMetadata·metadata와 함께 라이선스 파일도 결과물에 포함하라.
원천 조건을 MIT로 통일하거나 AI 검토를 사람 승인으로 바꾸지 마라.
```

## 기능 변경과 데이터 변경은 분리

데이터의 철자 수정도 exact review binding을 바꿀 수 있습니다. 문항 수정이 필요하면 먼저 해당 항목의 원천·판정 근거와 영향을 제시하고 새 검토·버전 절차를 설계합니다. 자동 재승인, `humanReviewed=true` 전환, eligibility 우회로 UI 문제를 해결하면 안 됩니다.

브라우저 검증에 실제 학생의 이름·필기·백업을 prompt로 보내지 말고 가상 학습자를 사용하세요. 화면 테스트가 불가능하면 실제 실행했다고 쓰지 않도록 명시하세요.
