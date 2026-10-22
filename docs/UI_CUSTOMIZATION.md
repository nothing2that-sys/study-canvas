# UI·UX를 바꾸는 위치

문항 데이터와 렌더러가 분리돼 있어 색·폰트·카드·동선은 문제은행을 건드리지 않고 바꿀 수 있습니다.

| 변경 대상 | 먼저 볼 파일 |
| --- | --- |
| 색상·종이/칠판 테마·반응형 간격 | app/css/app.css |
| 페이지 기본 DOM·고정 도구 모음 | app/index.html |
| 페이지 전환 | app/js/platform/appRouter.js, app/js/navigationHierarchy.js |
| 학습자 선택 화면 | app/js/learners/learnerView.js |
| 책장·문제집 | app/js/workbookView.js, workbookCatalog.js |
| 문항 공통 형식 | app/js/learningActivity.js |
| 선택형·서술형 입력 | app/js/typedInteractionSurface.js |
| 수학 필기 | app/js/canvasEngine.js, canvasSceneGeometry.js |
| 제출·채점·결과 통합 연결 | app/js/app.js, parentGrading.js, questionAnswerDisplay.js |
| 출처 표시 | app/js/aiReviewAttribution.js, app/notices.html |

## 안전한 첫 변경

CSS 색·간격 → 카드 배치 → renderer 분리 → navigation 변경 순으로 작게 진행하세요. 기존 `id`, input name, label 연결을 로직이 참조할 수 있으므로 이름을 바꾸기 전에 검색합니다. HTML의 script/import map을 지우지 마세요. data field와 저장 key는 화면 label과 다릅니다.

필기 캔버스는 시각적 CSS 크기, 실제 bitmap 크기, 좌표 변환이 일치해야 합니다. 화면 확대·기기 회전·터치·펜에서 필기 위치가 밀리지 않는지 확인합니다. 제출 뒤 학생 답안은 잠기고 보호자 빨간펜은 별도로 저장되는 구분을 유지합니다.

## 완료 확인

1. `npm run check`로 데이터·무결성·빌드를 검사합니다.
2. `node scripts/serve.mjs --dist --port 4174`로 실제 빌드를 엽니다.
3. 가상 학습자로 입력 → 저장됨 → 새로고침 복원 → 제출 → 보호자 채점 → 오답 재풀이 → 최종 확인을 수행합니다.
4. 키보드 focus, label, 버튼 구별, 작은 화면의 도구 모음 겹침을 확인합니다.
5. 재빌드한 새 버전이 오래된 PWA 캐시 대신 적용되는지 확인합니다.

단위 테스트는 필기 입력·터치·실제 화면 검증을 대체하지 않습니다. 외부 analytics나 원격 LLM API를 추가하려면 학습자 데이터를 전송하기 전에 별도의 고지·설계를 검토해야 합니다.
