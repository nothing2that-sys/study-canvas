# LLM / coding agent instructions

- 먼저 README, docs/ARCHITECTURE.md, docs/UI_CUSTOMIZATION.md, LICENSES/README.md를 읽는다.
- 기본 작업은 현재 기능과 문항을 유지하는 UI·UX 수정이다. 화면 수정 때문에 content/review의 출처·정답·학년·승인 플래그를 바꾸지 않는다.
- app/index.html, app/css/app.css, app/js/의 역할을 구분한다. 디자이너가 바꿀 수 있는 DOM class와 로직이 참조하는 ID를 구분하고 event handler 연결을 보존한다.
- 학생 입력 → 저장 → 제출/잠금 → 보호자 채점 → 결과 → 오답 재풀이/최종 확인 흐름과 기존 IndexedDB 데이터를 보존한다. 저장소 초기화·스키마 변경은 별도 요청이 있어야 한다.
- MIT를 외부 사전 자료 전체에 적용하지 않는다. 문항별 원천, CC BY-SA와 WordNet 고지를 유지한다. HUMAN 승인·학습 효과를 만들어 기록하지 않는다.
- 문항 변경은 UI 수정과 분리한다. 기존 exact-review binding/resource hash 검사를 제거하거나 자동으로 재승인하지 않는다. 새 콘텐츠 버전·근거·검토를 설계한다.
- npm run check를 실행한다. 화면 변경이면 실제 브라우저에서 저장·새로고침·제출·채점·재풀이와 좁은 화면을 확인하고, 실행하지 못한 검증을 구분한다.
- 소스 수정 후 npm run build로 새 캐시 ID와 import map을 생성한다. dist는 수동 수정하지 않는다.
- 실제 학습자의 이름·필기·백업·인증 정보와 기기 경로를 코드·예제·로그·commit에 넣지 않는다. 예제는 가상 데이터로 만든다.
- 요청 범위 밖의 commit/push/배포는 하지 않는다. 최종 답변에 변경 파일·검증·남은 제한을 짧게 적는다.
