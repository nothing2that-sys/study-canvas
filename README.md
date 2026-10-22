# Study Canvas

수학·국어·영어를 필기·선택·서술형으로 풀고, 보호자가 채점한 뒤 오답을 다시 푸는 정적 웹앱(PWA)입니다. 최종 앱 소스와 출처가 포함된 문제은행을 공개합니다. 과거 개발 기록·개인 학습 기록·이전 Git 이력은 포함하지 않습니다.

**Open source learning workspace and reusable question bank.** Application code is MIT; dictionary content keeps its per-item third-party terms. See [license scope](LICENSES/README.md).

| 포함된 자료 | 개수 |
| --- | ---: |
| 국어 활동 | 5,247 |
| 영어 활동 | 1,287 |
| 수학 정적 활동 | 33 |

생성형 수학 문제는 위 정적 문항 수와 별도입니다. 국어·영어의 AI 검토와 학년·난이도 제안은 사람 검토나 교육 효과 검증이 아닙니다. 서술형을 포함한 최종 채점은 보호자가 판정합니다.

## 설치 없이 써보기

**[Study Canvas 실제 서비스 바로가기](https://math-canvas-pro.vercel.app/)** — 브라우저에서 수학·국어·영어 학습을 시작할 수 있습니다. 학습 기록은 사용하는 브라우저에 저장됩니다.

소스·문제은행·이용 조건을 한 번에 받으려면 **[전체 저장소 ZIP 다운로드](https://github.com/nothing2that-sys/study-canvas/archive/refs/heads/main.zip)**를 이용하세요.

## 내 컴퓨터에서 실행

Node 22.13 이상을 사용합니다. 외부 npm 패키지 설치·API 키·로그인·서버 DB가 필요하지 않습니다.

```sh
npm start
# http://localhost:4173

npm run check
npm run build
node scripts/serve.mjs --dist --port 4174
```

빌드 결과는 `dist/`입니다. 도메인 루트에서 서비스하는 정적 호스팅을 기준으로 하며 SPA 경로를 `index.html`로 연결해야 합니다. 계정 정보가 없는 `vercel.json` 예시를 제공합니다. 하위 경로 호스팅은 절대 경로 링크·라우터·서비스워커 scope를 별도 점검하세요.

## 문제은행만 가져오기

### JSON 바로 다운로드

설치 없이 아래 링크로 원본 JSON을 받을 수 있습니다. 브라우저에 JSON이 표시되면 ‘다른 이름으로 저장’을 선택하세요.

| 과목·영역 | 문항 수 | 다운로드 |
| --- | ---: | --- |
| 국어 | 5,247 | [국어 문제은행 JSON](https://raw.githubusercontent.com/nothing2that-sys/study-canvas/main/app/content/packages/korean-ai-reviewed-v1/activities.json) |
| 영어 | 1,287 | [영어 문제은행 JSON](https://raw.githubusercontent.com/nothing2that-sys/study-canvas/main/app/content/packages/english-ai-reviewed-v1/activities.json) |
| 수학 · 측정 | 6 | [측정 JSON](https://raw.githubusercontent.com/nothing2that-sys/study-canvas/main/app/content/packages/math-measurement-v1/activities.json) |
| 수학 · 분수 개념 | 10 | [분수 개념 JSON](https://raw.githubusercontent.com/nothing2that-sys/study-canvas/main/app/content/packages/math-fraction-concepts-v1/activities.json) |
| 수학 · 분수 연산 | 7 | [분수 연산 JSON](https://raw.githubusercontent.com/nothing2that-sys/study-canvas/main/app/content/packages/math-fraction-operations-v1/activities.json) |
| 수학 · 소수 | 10 | [소수 JSON](https://raw.githubusercontent.com/nothing2that-sys/study-canvas/main/app/content/packages/math-decimal-v1/activities.json) |

수학 정적 문제은행은 위 4개 파일, 총 33문항입니다. 생성형 수학 문제는 앱의 생성기 코드에서 별도로 만들어집니다.

문항의 출처·정답 근거와 이용 조건을 함께 유지하세요. 코드의 MIT 라이선스와 외부 사전 자료의 이용 조건은 서로 다릅니다. 재사용 전에 [라이선스 범위](LICENSES/README.md), [출처·이용 조건 고지](app/review/NOTICES.txt), [WordNet 이용 조건](LICENSES/WordNet-3.0.txt)을 확인하세요. 고지 파일까지 함께 받으려면 전체 ZIP 또는 아래 추출 도구를 이용하세요.

### 조건별 추출

```sh
npm run bank:export -- --subject korean --format jsonl --out exports/korean/questions.jsonl
npm run bank:export -- --subject english --grade 6 --format json --out exports/english-grade6/questions.json
npm run bank:export -- --subject math --format json --out exports/math/questions.json
```

기존 폴더를 덮어쓰지 않습니다. 문항·출처·정답 근거와 라이선스 고지 파일을 함께 출력합니다. 다른 앱에 넣어도 provenance를 지우지 마세요. [데이터 형식·직접 읽기](docs/DATA_FORMAT.md)와 [Python 예제](examples/read-bank.py)를 참고하세요.

## 무엇을 수정할까요?

- 화면·테마·버튼 배치: [UI·UX 수정 가이드](docs/UI_CUSTOMIZATION.md)
- 다른 LLM에 작업 맡기기: [LLM 작업 가이드와 복사할 지시문](docs/LLM_GUIDE.md), [AGENTS.md](AGENTS.md)
- 구조·호출 흐름: [아키텍처](docs/ARCHITECTURE.md)
- 문제은행 이용 조건: [코드·데이터 라이선스 구분](LICENSES/README.md)
- 개인 학습 데이터와 공개 파일: [개인정보·공개 범위](docs/PRIVACY.md)
- 검증 범위: [테스트 안내](docs/TESTING.md)

```text
app/                 최종 실행 소스; content/와 review/는 문항·출처 자료
scripts/             실행·빌드·문항 추출·개인정보 패턴 점검
tests/               문항 무결성·추출·빌드·수학 검증
docs/                재사용·수정·LLM 가이드
examples/            Node/Python 문제은행 읽기 예제
LICENSES/            외부 원천의 이용 조건
content-snapshot.json 초기 공개본 파일 해시와 문항 수
```

개인 학습 기록은 이용자의 브라우저 IndexedDB/localStorage에 생성되며 이 저장소의 문제은행과 별개입니다. 실제 학습자의 백업·스크린샷·이름을 issue나 PR에 올리지 마세요.
