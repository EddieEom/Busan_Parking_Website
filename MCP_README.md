# 부산 공영주차장 MCP

현재 웹 AI와 기본 CLI는 OpenRouter를 사용합니다. 설정은 아래 **현재 기본 AI: OpenRouter** 항목을 참고하세요. 앞부분의 Gemini 설명은 이전 단계의 기록이며, Gemini CLI는 진단용으로 남아 있습니다.

## 이전 단계: 첫 검색 도구

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

## 웹 AI 안내 (5단계)
`/api/chat`은 서버에서 Gemini를 호출하고 같은 MCP 서버의 검색·상세·비교 도구를 사용합니다. 브라우저에는 Gemini 키나 MCP 토큰을 보내지 않습니다. 질문마다 새로 조회하는 단일 질문 방식입니다.

Cloudflare Pages → Settings → Variables and Secrets의 **Production**에 다음을 설정하고 재배포합니다.
- `GEMINI_API_KEY`: AI Studio 키 (Secret)
- `GEMINI_MODEL`: `gemini-3.6-flash` 권장, 선택 사항
- `TURNSTILE_SITE_KEY`: Cloudflare Turnstile의 공개 사이트 키
- `TURNSTILE_SECRET_KEY`: 같은 위젯의 비밀 키 (Secret)
- `MCP_SERVER_URL`: 선택 사항. 생략하면 현재 사이트 `/api/mcp`. 로컬 개발에서는 배포된 HTTPS 주소를 입력
- `MCP_AUTH_TOKEN`: 기존 MCP 서버와 같은 값. 미설정이면 생략
- 기존 `DATA_API_KEY`, `BASIC_API_KEY`는 유지

Turnstile 위젯의 허용 호스트에는 `busan-parking-website.pages.dev`를 등록합니다. Preview를 테스트하려면 해당 Preview 호스트도 등록하고 Preview 환경변수도 설정하세요. 서버는 hostname과 `parking_chat` action을 검증하므로 테스트용 키로 실제 사용자 확인을 우회하지 않습니다.

로컬 웹에서 실제 Turnstile 키를 사용할 때는 위젯의 허용 호스트에 `localhost`도 등록하세요.

로컬 웹 설정: `.dev.vars.example`을 `.dev.vars`로 복사하고 값을 채웁니다. 로컬 CLI Gemini 설정: `mcp-server/.env.example`을 `mcp-server/.env`로 복사합니다. 두 파일은 서로 다른 실행 환경이며 실제 값은 커밋하지 않습니다.

```powershell
npm ci
npm --prefix mcp-server ci
npx wrangler pages dev . --port 8788
```
설정이 없으면 AI 안내는 준비 중으로 표시되고 기존 주차장 목록은 계속 사용할 수 있습니다. Gemini 503은 최대 2회 재시도(CLI), 웹은 최대 1회 재시도합니다. 사용자 확인 토큰은 매 질문마다 새로 발급받습니다.

## 프로젝트 V4 지도보기
각 검색 카드의 카카오맵 링크는 `부산 + 주차장명`으로 검색하며 공공데이터 주소를 지도 검색어에 넣지 않습니다. 원본 주소는 보존하고 참고정보라는 안내를 표시합니다. Kakao JavaScript SDK를 사용하지 않으므로 카카오 API 키는 필요 없습니다.

## 프로젝트 V5 PWA
manifest, 192/512 PNG 아이콘, 설치 안내와 Service Worker를 추가했습니다. Android/PC는 브라우저 설치 버튼, iPhone은 Safari 공유→홈 화면에 추가를 사용합니다. 설치 화면은 HTTPS에서 확인하세요. 정적 화면만 캐시하고 모든 `/api/` 요청과 AI 응답은 캐시하지 않습니다. 오프라인에서 실시간 주차 현황이나 AI 답변을 새로 받을 수 없습니다. 배포로 정적 파일 목록/내용을 변경할 때 `service-worker.js`의 CACHE_NAME도 올립니다. 새 Worker는 사용자 새로고침 버튼으로 활성화하며 이미 열린 앱의 요청을 강제로 중단하지 않습니다.

검증 명령: `node --test scripts/*.test.mjs mcp-server/test/*.test.js`. 실 서비스 확인 순서: 목록 조회 → 지도 링크 → AI 질문(키 설정 후) → 모바일 설치 → 비행기 모드에서 정적 화면과 API 실패 안내 → 온라인 새로고침.

## 현재 기본 AI: OpenRouter

Cloudflare 웹에서 같은 사이트의 `/api/mcp`는 SDK 요청을 서버 내부의 기존 MCP HTTP 처리기로 전달합니다. 자기 Pages 주소를 외부 HTTP로 재호출하지 않으며 MCP 인증과 프로토콜 검증은 유지합니다. 웹의 MCP_SERVER_URL은 생략하거나 현재 사이트의 `/api/mcp` 주소로 설정하세요. 별도 외부 MCP 주소를 지정하면 일반 HTTP로 연결합니다. 로컬 CLI는 배포 주소를 사용하는 기존 방식입니다.

무료 모델 설정 예: `OPENROUTER_MODEL=nvidia/nemotron-3.5-lightning:free`. 이 제공자는 `parallel_tool_calls`를 지원하지 않으므로 요청에서 생략합니다. `require_parameters=true`와 필수 첫 검색은 유지하며 MCP 도구는 서버에서 순차 실행합니다. HTTP 404와 `failed_routing_step: Filter by Parameters`는 키 오류가 아니라 요청 옵션을 처리할 제공자가 없다는 뜻입니다.

웹 `/api/chat`은 OpenRouter Chat Completions를 사용합니다. Gemini Interactions 파일과 `gemini` 명령은 이전 연결의 비교 진단용으로만 남겨 두었습니다. 웹은 Gemini 키를 사용하거나 자동으로 Gemini에 재시도하지 않습니다.

Cloudflare Pages **Production**에 아래 값을 저장한 후 재배포하세요.

```dotenv
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-4.1-mini
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

API 키는 Secret으로 저장합니다. 기존 DATA_API_KEY/BASIC_API_KEY/MCP_AUTH_TOKEN과 Turnstile 키는 유지하세요. GEMINI_API_KEY/GEMINI_MODEL은 현재 웹에 필요하지 않습니다. Cloudflare의 MCP_SERVER_URL은 생략하면 같은 사이트의 `/api/mcp`를 사용합니다. 로컬 웹 `.dev.vars`에는 `.dev.vars.example`을 참고해 OpenRouter 키를 넣으세요.

CLI `mcp-server/.env`:

```dotenv
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-4.1-mini
MCP_SERVER_URL=https://busan-parking-website.pages.dev/api/mcp
MCP_AUTH_TOKEN=
```

```powershell
npm ci
npm --prefix mcp-server ci
npm --prefix mcp-server run openrouter -- "화명 주차장 찾아줘"
```

Cloudflare가 배포한 MCP를 사용하면 별도 로컬 MCP 서버 실행은 필요하지 않습니다. 로컬 MCP를 테스트할 때는 MCP_SERVER_URL에 localhost HTTP 주소를 사용할 수 있습니다. 키·인증 토큰은 브라우저 또는 Git에 넣지 마세요. 기존 PowerShell의 GEMINI_MODEL 환경변수는 OpenRouter에 영향을 주지 않습니다.

흐름: 서버가 MCP SDK로 initialize/listTools → 모델의 function tool call → SDK callTool → tool_call_id에 연결된 조회 결과 → 모델의 최종 답변. 외부 모델이 MCP URL을 직접 방문하는 방식이 아닙니다. 조회가 검증되지 않은 답변이나 잘린 답변은 사용자에게 반환하지 않습니다. 상세·비교 id는 실제 검색에서 얻은 값만 허용합니다. 도구 6회·모델 4라운드·전체 110초·출력 1200토큰·검색 8개로 제한하며 오류 시 자동 모델 변경 및 반복 재시도는 하지 않습니다.

OpenRouter에서 사용하는 모델은 도구 호출을 지원해야 합니다. 기본 모델은 유료이며 OpenRouter 크레딧이 필요합니다. 가격은 선택한 모델의 현재 페이지에서 확인하고 키 사용 한도를 설정하세요. 402(잔액 부족), 429(요청 한도), 503(혼잡)은 웹에서 구분하여 안내합니다. 비밀값을 포함할 수 있는 외부 오류 원문은 반환하지 않습니다.

전환 검증: 자동 테스트는 모델 응답 모의 + 실제 SDK/stateless HTTP MCP 연결을 포함합니다. 실제 유료 모델 호출과 웹 Turnstile 테스트는 사용자의 OpenRouter 키 설정 후 확인해야 합니다.
