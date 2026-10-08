# 부산 공영주차장 MCP — 첫 검색 도구

기존 `/api/parking`을 재사용하는 `search_parking` MCP 도구입니다.
로컬 stdio 서버와 Cloudflare Pages의 Streamable HTTP `/api/mcp`를 지원합니다.
Google AI Studio에서 발급한 API 키로 Gemini Interactions API의 Remote MCP를 호출합니다.
AI Studio 웹 채팅 화면에 서버를 직접 등록하는 UI는 이번 구현 범위에 포함되지 않습니다.

## 완료한 작업과 검증 범위

- 공통 검색 함수: 이름·주소·구/군 검색, 지역 필터, 빈자리 필터, 최대 50건 반환.
- MCP 도구: 이름·설명·입력 스키마, 읽기 전용 도구 등록.
- MCP 클라이언트와 Inspector CLI로 연결, 도구 목록, 정상/빈 결과/오류 응답 검증.
- Cloudflare용 HTTP 어댑터와 Functions 빌드 검증.
- 배포된 기존 API의 630개 항목에서 `화명` 검색 5건을 실제 stdio MCP 호출로 확인.
- Gemini 요청 생성/응답 처리 검증은 모의 응답으로 수행. 실제 Gemini 답변은 키와 MCP 배포 후 확인해야 합니다.

주차장 상세·지역별 전용 도구는 첫 Gemini 호출 검증 후 추가합니다.
현재 `basic:번호` id는 목록 순서에 따라 바뀔 수 있으므로 상세 도구의 영구 식별자로 사용하지 않습니다.

## 설치

Node.js 22 이상을 사용하세요. 프로젝트 루트에서 실행합니다.

```powershell
npm ci
npm --prefix mcp-server ci
npm --prefix mcp-server test
```

루트 의존성은 Cloudflare Functions용, `mcp-server`의 의존성은 로컬 MCP 및 검사 도구용입니다.
루트 `package.json`을 추가했으므로 Cloudflare 빌드에서도 npm 의존성이 설치되어야 합니다.

## 로컬에서 기존 API 확인

기존 `.dev.vars`의 `DATA_API_KEY`를 그대로 사용합니다. 필요하면 `BASIC_API_KEY`도 유지합니다.
프로젝트 루트의 첫 터미널에서 실행합니다.

```powershell
npx wrangler pages dev .
```

두 번째 터미널에서 실행합니다.

```powershell
node scripts/check-parking-api.mjs 화명
npm --prefix mcp-server run check -- 화명
npm --prefix mcp-server run check:http -- http://localhost:8788/api/mcp
```

`check`는 stdio MCP, `check:http`는 Streamable HTTP MCP를 검증합니다.
서버 연결만 성공하고 검색이 실패하면 `/api/parking`, 인증키, 활용 승인 및 호출 한도를 확인하세요.

## Inspector 화면으로 확인

```powershell
cd mcp-server
npm run inspect
```

열린 Inspector에서 연결하고 Tools에 `search_parking`이 있는지 확인합니다.
`keyword=화명`, `district=북구`, `availableOnly=false`, `limit=10`으로 호출하세요.
`PARKING_API_URL` 환경변수로 stdio 서버의 API 주소를 바꿀 수 있습니다.

## Cloudflare 배포와 HTTP 확인

Cloudflare Pages에서 해당 브랜치의 preview 배포를 먼저 확인하세요.
기존 프로젝트의 정적 파일 설정은 그대로 사용하고, 루트 npm 의존성 설치가 성공했는지 빌드 로그를 확인합니다.
`DATA_API_KEY`와 선택적 `BASIC_API_KEY`는 실제 테스트하는 배포 환경에도 설정해야 합니다.
이 단계에서는 Gemini 키가 Cloudflare 서버에 필요하지 않습니다.

배포 성공한 주소에 `/api/mcp`를 붙입니다. 아래 주소는 실제 preview 또는 production 주소로 교체하세요.

```powershell
npm --prefix mcp-server run check:http -- https://YOUR_DEPLOYMENT.pages.dev/api/mcp
```

MCP 주소는 프로토콜 요청을 받는 주소입니다. 브라우저 주소창으로 열어 목록 JSON이 나오지 않아도 정상일 수 있습니다.
Cloudflare에 선택적으로 `MCP_AUTH_TOKEN`을 설정하면 요청의 Bearer 토큰을 검사합니다.
사용하는 경우 로컬 `.env`에도 동일한 토큰을 설정하세요.

## Google AI Studio 키로 Gemini에 연결

1. [Google AI Studio](https://aistudio.google.com/apikey)에서 Gemini API 키를 발급합니다.
2. 배포된 `/api/mcp`의 `check:http`가 먼저 성공해야 합니다.
3. `mcp-server/.env.example`을 `.env`로 복사하고 키와 실제 MCP 배포 주소를 설정합니다.

```powershell
cd mcp-server
Copy-Item .env.example .env
```

`.env`에 설정할 값:

```dotenv
GEMINI_API_KEY=직접_발급한_키
MCP_SERVER_URL=https://실제_배포주소.pages.dev/api/mcp
GEMINI_MODEL=gemini-3.8-flash
MCP_AUTH_TOKEN=
```

공공데이터의 `DATA_API_KEY`와 Gemini의 `GEMINI_API_KEY`는 서로 다른 키입니다.
`.env`는 Git에서 제외되며 키를 HTML/브라우저 JavaScript에 넣지 않습니다.

```powershell
npm run gemini -- "화명동 공영주차장을 찾아줘. 잔여 면수와 갱신 시각도 알려줘."
```

한국어 답변과 `호출한 MCP 도구: search_parking`이 출력되면 첫 연동 검증을 마칩니다.
Gemini는 인터넷에서 MCP 서버를 조회하므로 localhost 주소를 사용할 수 없습니다.
모델 접근 오류가 있으면 AI Studio 프로젝트에서 사용 가능한 Remote MCP 지원 모델로 `GEMINI_MODEL`을 설정하세요.
실제 요청은 프로젝트의 Gemini API 한도를 사용합니다.

## 응답 해석

- `matchedCount`: 조건에 맞는 전체 항목 수. `returnedCount`: 제한을 적용해 반환한 수.
- `availableSpaces=0`: 최근 현황상 만차. `null`: 현재 빈자리 판단 불가.
- `stale`: 10분 초과 지연 또는 확인할 수 없는 갱신 시각. 빈자리 필터에서 제외.
- `warnings`: 공공데이터 API 일부 실패 시 전달되는 안내.
- 주소는 공공데이터 기준이고 실제 위치와 다를 수 있습니다.
- API 실패는 MCP `isError: true`, 검색 결과 없음은 정상 응답의 `matchedCount=0`입니다.

## 참고 문서

- [MCP SDK: 웹 표준 런타임](https://ts.sdk.modelcontextprotocol.io/v2/serving/web-standard.html)
- [Gemini: Remote MCP](https://ai.google.dev/gemini-api/docs/function-calling#remote-mcp-model-context-protocol)
- [Gemini Interactions API](https://ai.google.dev/gemini-api/docs/interactions-overview)

## Gemini 완료 상태
도구 선택은 `auto`로 두어 검색 후 답변을 마칠 수 있게 합니다. `completed`와 검색 결과만 확인된 `verified_result`를 구분합니다. `requires_action`에 미처리 호출이 남으면 실패하며, 모든 호출 결과와 답변이 확인된 경우에만 경고와 함께 표시합니다. 원격 상태를 임의로 completed로 바꾸거나 이미 수행한 도구를 다시 실행하지 않습니다.
