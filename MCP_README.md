# 부산 공영주차장 MCP 및 AI 설정

현재 구현은 읽기 전용 MCP 도구 4종, 로컬 stdio 서버, Cloudflare Pages의 Streamable HTTP 서버, OpenRouter 기반 웹 AI·CLI로 구성됩니다. V6.2 문서의 검색·빈자리순·상세 3종에 기존 비교 도구를 함께 제공합니다. 웹 실행·배포의 기본 안내는 [README.md](README.md)를 참고하세요.

## 구성과 호출 흐름

```text
브라우저 → /api/chat → Turnstile 검증 → OpenRouter
                       ↕ MCP SDK (initialize / listTools / callTool)
                    /api/mcp → parkingService → /api/parking 데이터

로컬 MCP 클라이언트 → stdio server.js → parkingService → PARKING_API_URL
OpenRouter CLI → MCP_SERVER_URL → HTTP MCP 서버
```

`functions/api/mcp.js`는 통합 주차장 API 함수를 직접 재사용합니다. 웹 AI가 같은 Origin의 `/api/mcp`에 연결하면 인터넷으로 자기 사이트를 재호출하지 않고 MCP HTTP 처리기로 전달합니다. 외부 MCP 주소는 일반 HTTP로 연결합니다. 인증과 MCP 프로토콜 처리는 두 경우 모두 적용됩니다.

## 설치

프로젝트 루트 PowerShell에서 Node.js 22 이상으로 실행합니다.

```powershell
npm ci
npm --prefix mcp-server ci
```

루트 의존성은 Pages Functions에, `mcp-server` 의존성과 Inspector는 로컬 도구에 사용합니다. `services/package.json`은 ES Modules 선언용이며 별도 설치가 필요하지 않습니다.

## MCP 도구

| 도구 | 입력 | 동작 |
| --- | --- | --- |
| `search_parking` | `keyword`(기본 `""`, 최대 100자), `district`(기본 `""`, 부산의 정확한 구·군), `availableOnly`(기본 `false`), `limit`(기본 10, 1~50) | 이름·주소·구·군·코드 검색 |
| `find_available_parking` | 검색과 같은 조건 | 전체 검색 결과를 빈자리 내림차순으로 정렬 후 limit 적용. 만차는 0, 지연·미확인은 마지막 |
| `get_parking_detail` | `id`(조회 결과의 id, 1~2000자) 또는 `name`(1~100자). 이름 조회 시 `district` 선택 가능 | 정확한 이름 우선 상세조회. 중복되면 `requiresSelection`, `candidates`, `matchedCount`, `returnedCount` 반환 |
| `compare_parkings` | 서로 다른 `ids` 2~5개, `sortBy`(`available` 또는 `fee`, 기본 `available`) | 빈자리 내림차순 또는 시간당 환산요금 오름차순 비교 |

검색 예시:

```json
{"keyword":"화명","district":"북구","availableOnly":false,"limit":10}
```

정상 도구 응답은 `content`의 JSON 텍스트와 `structuredContent`를 제공합니다. 서비스 오류는 `isError: true`와 오류 코드·메시지를 반환합니다. 검색 결과에는 조회 시각, 경고, 안내, 적용 필터, 일치/반환 건수, 항목이 포함됩니다.

- 빈자리 필터는 최근 10분 내 현황이 확인되고 잔여 면수가 1 이상인 곳만 반환합니다. 미래 시각은 1분 이내까지만 허용합니다.
- 상세는 `{ "name": "화명역" }` 또는 조회한 id로 호출합니다. id와 name을 동시에 지정할 수 없습니다. 중복 이름은 지역·주소로 구분하여 다시 조회하세요. 비교에는 조회 결과의 id를 사용합니다. 실시간 코드는 `realtime:...`, 기본정보 기반 id는 `place:...`입니다. 기본정보의 이름·주소 등이 바뀌면 id도 바뀔 수 있습니다.
- 도구를 호출할 때마다 데이터를 새로 조회합니다. 비교는 한 번 조회한 데이터로 대상들을 비교합니다.
- 시간당 요금은 기본요금의 단순 환산값입니다. 실제 청구액·거리·현재 영업 여부는 계산하지 않으며 미확인 값은 정렬 마지막에 둡니다.

## 로컬 웹 및 stdio 확인

`.dev.vars.example`을 `.dev.vars`로 복사하고 공공데이터 키를 채웁니다. 기존 파일이 있으면 덮어쓰지 말고 수정하세요.

```powershell
npx wrangler pages dev . --port 8788
```

다른 터미널에서 프로젝트 루트 기준으로 실행합니다.

```powershell
node scripts/check-parking-api.mjs 화명
npm --prefix mcp-server run check -- 화명
```

첫 명령은 통합 API를, 두 번째는 stdio 연결·도구 목록·검색을 확인합니다. 기본 데이터 주소는 `http://localhost:8788/api/parking`입니다. 다른 주소를 사용하려면 환경변수를 지정합니다.

```powershell
$env:PARKING_API_URL = 'https://YOUR_DEPLOYMENT.pages.dev/api/parking'
npm --prefix mcp-server run check -- 화명
Remove-Item Env:PARKING_API_URL
```

`npm --prefix mcp-server start`는 stdio 서버를 직접 실행합니다. MCP 클라이언트에 등록할 때는 실행 명령 `node`, 인자에 `mcp-server/server.js`의 절대 경로를 지정하고 필요하면 `PARKING_API_URL`을 환경변수로 전달하세요. stdout은 MCP 통신용이며 일반 로그는 stderr로 출력합니다.

`start`, `check`, `inspect` 스크립트는 `.env`를 자동으로 읽지 않습니다. `PARKING_API_URL`은 프로세스 환경변수로 전달해야 합니다.

## Inspector

```powershell
npm --prefix mcp-server run inspect
```

Inspector에서 연결한 뒤 Tools에 도구 4종이 표시되는지 확인합니다. `search_parking`에 `keyword=화명`, `find_available_parking`에 `keyword=화명, limit=5`, `get_parking_detail`에 `name=화명역`을 입력하세요. 조회된 id 2~5개로 기존 비교도 확인할 수 있습니다. `PARKING_API_URL`을 지정하지 않았다면 로컬 웹 서버가 실행 중이어야 합니다.

## HTTP MCP 확인 및 인증

```powershell
npm --prefix mcp-server run check:http -- http://localhost:8788/api/mcp 화명
npm --prefix mcp-server run check:http -- https://YOUR_DEPLOYMENT.pages.dev/api/mcp 화명
```

`check:http`는 연결·도구 목록·검색을 확인합니다. 주소 인자가 없으면 `MCP_SERVER_URL`, 그것도 없으면 로컬 주소를 사용합니다. 검색어 기본값은 `화명`입니다. `.env`가 있으면 읽으며 없어도 실행할 수 있습니다.

Cloudflare의 `MCP_AUTH_TOKEN`을 설정하면 HTTP 요청에 `Authorization: Bearer <token>`이 필요합니다. 클라이언트의 `mcp-server/.env` 또는 프로세스 환경에도 같은 토큰을 설정하세요. 서버는 Origin 헤더가 있는 요청에 대해 동일 Origin을 검증합니다.

HTTP 서버는 요청마다 MCP 서버를 생성하는 stateless 방식입니다. `/api/mcp`는 MCP 프로토콜 엔드포인트이므로 브라우저 주소창에서 열어 일반 목록 JSON이 나오지 않아도 이상이라고 단정할 수 없습니다.

## OpenRouter CLI

```powershell
Copy-Item mcp-server/.env.example mcp-server/.env
```

기존 `.env`가 있으면 필요한 항목만 수정하세요.

```dotenv
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-4.1-mini
MCP_SERVER_URL=https://YOUR_DEPLOYMENT.pages.dev/api/mcp
MCP_AUTH_TOKEN=
```

```powershell
npm --prefix mcp-server run openrouter -- "화명 주차장 찾아줘"
```

CLI는 `.env`를 읽고 HTTP MCP에 연결합니다. 배포된 MCP를 이용하면 로컬 웹·stdio 서버는 필요하지 않습니다. 로컬 HTTP MCP를 확인하려면 웹 서버를 실행하고 주소를 `http://localhost:8788/api/mcp`로 설정하세요. OpenRouter CLI에는 Turnstile이 필요하지 않습니다.

기본 모델 문자열은 코드의 `openai/gpt-4.1-mini`입니다. 다른 모델을 지정할 때는 도구 호출을 지원하는 모델과 제공자를 사용해야 합니다. 실제 모델 이용 가능 여부와 과금·잔액은 OpenRouter 계정에서 확인하세요.

## 웹 AI 설정

로컬 웹은 루트 `.dev.vars`, Cloudflare 배포는 해당 환경의 Variables and Secrets를 사용합니다. CLI의 `mcp-server/.env`와 별개의 설정입니다.

```dotenv
DATA_API_KEY=
BASIC_API_KEY=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-4.1-mini
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
# 생략 또는 빈 값이면 현재 사이트의 /api/mcp 사용
MCP_SERVER_URL=
MCP_AUTH_TOKEN=
```

`BASIC_API_KEY`는 생략하면 `DATA_API_KEY`를 사용합니다. 웹 AI 활성화에 필요한 설정은 `OPENROUTER_API_KEY`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`입니다. 활성 상태는 `GET /api/chat`으로 확인할 수 있지만, 활성 상태만으로 공공데이터·MCP·모델 연결 성공까지 보장하지는 않습니다.

Turnstile 위젯에는 실제 접속 호스트를 등록합니다. 로컬은 `localhost`, 배포는 Production/Preview 호스트를 사용하세요. 서버는 동일 Origin의 JSON 요청만 허용하고 Turnstile의 hostname과 `parking_chat` action을 검증합니다. 질문은 1~1000자이며 매 질문 후 새 사용자 확인 토큰을 사용합니다. 대화 이력은 다음 질문에 전달하지 않습니다.

웹은 OpenRouter Chat Completions를 사용합니다. MCP SDK로 조회한 결과를 모델의 `tool_call_id`와 연결하며, 첫 라운드는 도구 사용을 필수로 하고 요청에 맞는 도구는 모델이 선택합니다. 이름 상세조회는 바로 가능하고, id 기반 상세·비교는 이번 질문의 실제 조회 결과에서 얻은 id만 허용합니다. 중복 이름 후보를 같은 질문에서 임의로 확정하는 호출은 차단합니다. 도구 호출 최대 6회, 모델 응답 최대 4라운드, 전체 처리 제한 110초, 출력 최대 1200토큰이며 검색·빈자리순 결과는 최대 8개입니다. 조회가 검증되지 않았거나 잘린 답변은 반환하지 않습니다. 오류 시 자동 모델 변경이나 반복 재시도는 하지 않습니다.

`POST /api/chat`은 설명과 함께 `parkings`(최신 도구 결과 최대 5개), `fetchedAt`, `checkedAt`, `requiresSelection`, `matchedCount`를 반환합니다. 카드는 모델이 생성한 항목이 아닌 검증된 MCP 결과로 만듭니다. 제공기관 경고·비교 안내는 `warnings`로 전달합니다. 일반 검색과 AI 결과는 `parking-card.js`를 공유하며, 페이지를 오래 열어둔 경우에도 1분마다 현황의 지연 여부를 다시 표시합니다.

현재 요청은 `provider.require_parameters=true`를 사용하고 `parallel_tool_calls`는 보내지 않습니다. 모델이 여러 도구를 요청해도 서버는 순차 실행합니다.

## 남아 있는 Gemini 진단 CLI

`gemini.js`, `geminiClient.js`, `npm run gemini`는 이전 Gemini Interactions 기반 Remote MCP 연결을 진단하는 경로입니다. 현재 웹은 이 코드를 사용하거나 Gemini로 자동 전환하지 않습니다.

사용하려면 `mcp-server/.env`에 `GEMINI_API_KEY`, `GEMINI_MODEL`, `MCP_SERVER_URL`과 필요한 `MCP_AUTH_TOKEN`을 별도로 설정합니다. 코드상 모델 기본값은 `gemini-3.6-flash`이며 실제 제공 여부는 별도 확인이 필요합니다. `.env.example`에는 Gemini 항목이 포함되어 있지 않습니다.

```powershell
npm --prefix mcp-server run gemini -- "화명동 공영주차장 찾아줘"
```

이 경로는 Gemini가 접근할 수 있는 배포된 MCP 주소를 사용해야 합니다. 기본적으로 503에 최대 2회 재시도합니다.

## 검증과 오류 진단

```powershell
# MCP 패키지에서 정의한 테스트
npm --prefix mcp-server test
# 웹·PWA·서비스·MCP·AI 전체 자동 테스트
node --test scripts/*.test.mjs mcp-server/test/*.test.js
```

자동 테스트에는 모의 모델 응답과 로컬 MCP 프로토콜 검증이 포함됩니다. 실제 OpenRouter/Gemini 응답, 공공데이터 인증, 배포된 MCP, 실제 Turnstile 통과는 각 환경에서 별도로 확인해야 합니다.

| 증상 | 확인할 설정 |
| --- | --- |
| `/api/parking` 503 | `DATA_API_KEY` 누락 |
| 주차정보 실패 또는 일부 정보 누락 | 공공데이터 키, 각 API 활용승인·호출 한도, 응답 `warnings` |
| AI 준비 중 | `/api/chat`의 `missingSettings`, 해당 환경의 AI·Turnstile 설정 |
| 사용자 확인 실패 | 위젯 허용 호스트, site/secret 키 쌍, hostname, action, 토큰 만료 |
| `MCP_CONNECTION_FAILED` | `MCP_SERVER_URL`, MCP 배포 상태, 양쪽 `MCP_AUTH_TOKEN` |
| `OPENROUTER_AUTH_FAILED` | `OPENROUTER_API_KEY` 인증 실패 |
| `OPENROUTER_MODEL_UNAVAILABLE` | 모델 또는 요청 조건을 처리할 제공자 부재. 모델·도구 지원 확인 |
| AI 잔액 부족 / 한도 / 혼잡 | OpenRouter 402 / 429 / 503에 따른 안내 |

실제 키·토큰을 문서나 Git에 추가하지 마세요. `.dev.vars`, `.env`와 Wrangler 로컬 상태는 `.gitignore`에서 제외됩니다.
