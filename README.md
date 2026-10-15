# 부산 공영주차장 웹사이트

부산 공영주차장의 기본정보와 실시간 현황을 조회하는 웹사이트입니다. HTML/CSS/JavaScript와 Cloudflare Pages Functions로 구성되며, OpenRouter 기반 AI 안내와 MCP, PWA를 지원합니다.

## 수업에서 진행한 방식

AI로 결과물을 만들고 배포하는 학교 수업에서 진행한 실습입니다. 교수님이 AI로 정리한 기능 요구사항 문서를 제공했고, 그 문서를 바탕으로 AI에 코드를 생성하도록 요청했습니다.

코드는 AI가 생성했으며, 수업에서 수행한 부분은 요구사항을 AI에 전달하고, 결과물을 Cloudflare에 배포한 뒤 기능이 동작하는지 확인하는 작업입니다.

아래에는 생성된 결과물의 기능과 기존 실행·배포 안내를 정리했습니다.

## 주요 기능

- 주차장 이름·주소·코드 검색, 구·군 및 주차 상태 필터, 빈자리·요금 정렬
- 잔여 면수, 갱신 시각, 기본요금, 요일별 운영시간, 관리기관 및 원본 데이터 표시
- `부산 + 주차장명`으로 카카오맵 검색 연결. Kakao SDK나 API 키는 사용하지 않습니다.
- MCP 검색·빈자리순 추천·상세조회·비교 도구를 사용하는 단일 질문 방식의 AI 안내와 주차장 카드
- 설치 가능한 PWA와 오프라인 정적 화면. API 응답과 AI 답변은 캐시하지 않습니다.

실시간 정보가 10분을 초과했거나 갱신 시각을 확인할 수 없으면 주차 가능으로 판단하지 않습니다. 잔여 면수는 도착 시 주차를 보장하지 않으며, 주소·요금·운영시간은 제공기관 정보입니다.

## 프로젝트 구조

```text
├─ index.html / style.css       # 화면과 스타일
├─ app.js                       # 목록 조회·필터·정렬·카드 표시
├─ parking-card.js              # 일반 목록과 AI 결과가 공유하는 카드
├─ chat.js / answer-renderer.js  # AI 질문과 답변 표시
├─ pwa.js / service-worker.js    # 설치 및 정적 파일 캐시
├─ manifest.webmanifest         # PWA 정보 (icon-192.png, icon-512.png)
├─ functions/api/
│  ├─ parking.js                # 공공데이터 3종 통합 API
│  ├─ mcp.js                    # Streamable HTTP MCP
│  └─ chat.js                   # Turnstile 검증 및 OpenRouter 호출
├─ lib/                         # 공공데이터 수집·정규화·병합
├─ services/parkingService.js    # MCP 공통 검색·상세·비교 서비스
├─ mcp-server/                  # MCP 서버·AI CLI·프로토콜 테스트
├─ scripts/                     # API 확인 스크립트 및 테스트
├─ .dev.vars.example            # 로컬 웹 환경변수 예제
└─ MCP_README.md                # MCP/AI 연결 상세 안내
```

## 로컬 실행

전체 도구를 함께 사용하려면 Node.js 22 이상과 npm을 준비합니다. 루트 패키지는 Node.js 20 이상, `mcp-server` 패키지는 22 이상을 선언합니다. 아래 명령은 프로젝트 루트 PowerShell에서 실행합니다.

```powershell
npm ci
npm --prefix mcp-server ci
Copy-Item .dev.vars.example .dev.vars
```

이미 `.dev.vars`가 있으면 복사 대신 기존 파일을 수정하세요.

| 환경변수 | 용도 |
| --- | --- |
| `DATA_API_KEY` | 주차장 목록·실시간 현황 공공데이터 인증키. 목록 조회에 필수 |
| `BASIC_API_KEY` | 부산시 주차장 기본정보 인증키. 생략하면 `DATA_API_KEY` 사용 |
| `OPENROUTER_API_KEY` | AI 안내에 필요한 OpenRouter 인증키 |
| `OPENROUTER_MODEL` | 기본값 `openai/gpt-4.1-mini` |
| `TURNSTILE_SITE_KEY` | AI 사용자 확인 위젯의 공개 키 |
| `TURNSTILE_SECRET_KEY` | 같은 Turnstile 위젯의 비밀 키 |
| `MCP_SERVER_URL` | AI가 연결할 MCP 주소. 생략하면 현재 사이트의 `/api/mcp` |
| `MCP_AUTH_TOKEN` | 선택적 MCP Bearer 인증. 외부 MCP 사용 시 해당 서버와 동일하게 설정 |

`.dev.vars.example`의 `MCP_SERVER_URL`은 비어 있습니다. 이 기본값은 웹과 AI가 현재 환경의 같은 통합 데이터를 사용하게 합니다. 기존 `.dev.vars`에 외부 배포 주소가 남아 있다면, 로컬 데이터를 함께 확인할 때 비우거나 `http://localhost:8788/api/mcp`로 바꾸세요.

```powershell
npx wrangler pages dev . --port 8788
```

`http://localhost:8788`에서 확인합니다. 별도 프런트엔드 빌드 과정이나 `npm run dev` 스크립트는 없습니다. 정적 파일 서버만으로는 `/api/*`가 실행되지 않습니다. AI 필수 설정이 없으면 준비 중 안내를 표시하며, 공공데이터 키가 설정된 주차장 목록은 사용할 수 있습니다.

Turnstile 위젯에 사용할 호스트를 등록하세요. 로컬은 `localhost`, 배포는 실제 Production/Preview 호스트입니다. 서버는 요청 hostname과 `parking_chat` action을 검증합니다.

## 데이터와 API

`lib/`는 시설공단 목록(`getParkingList_v2`), 시설공단 실시간 현황(`getParkingInfoList_v2`), 부산시 기본정보(`getPblcPrkngInfo`)를 수집하고 병합합니다. 일부 API가 실패하면 나머지 결과와 경고를 반환합니다.

| 경로 | 동작 |
| --- | --- |
| `GET /api/parking` | 전체 통합 목록. `message`, `fetchedAt`, `warnings`, `stats`, `totalCount`, `items` 반환 |
| `/api/mcp` | SDK 기반 Streamable HTTP MCP. 검색·빈자리순·상세·비교 도구 4종 제공 |
| `GET /api/chat` | AI 활성 상태, 공개 Turnstile 키, 누락 설정 이름, 모델 정보 반환 |
| `POST /api/chat` | 동일 Origin의 JSON 요청 `{question, turnstileToken}` 처리. 질문은 1~1000자 |

AI는 서버에서 OpenRouter와 MCP를 연결합니다. 일반 검색은 `search_parking`, 빈자리순 추천은 `find_available_parking`, 이름 상세조회는 `get_parking_detail`을 선택할 수 있습니다. id 기반 상세·비교에는 이번 질문에서 조회한 id만 사용합니다. 이름이 중복되면 후보를 안내하고 사용자 선택을 요청합니다. 답변과 함께 최신 도구 결과의 카드 최대 5개를 표시하며, 설명의 경고와 카드의 갱신 시각을 함께 확인할 수 있습니다. 브라우저에는 OpenRouter 키와 MCP 인증 토큰을 전달하지 않습니다. 현재 웹 AI는 Gemini를 사용하지 않습니다.

첨부 V1~V6.2 문서와 개발 방향에 대한 항목별 반영 내역·검증 한계는 [구현 대조표](docs/IMPLEMENTATION_REVIEW.md)에 기록했습니다.

## Cloudflare Pages 배포

- 정적 파일 출력 디렉터리는 프로젝트 루트(`.`)입니다. 루트 npm 의존성을 설치해야 Functions의 MCP SDK를 번들링할 수 있습니다.
- Pages의 Variables and Secrets에서 위 환경변수를 사용 환경에 설정합니다. 인증키·비밀 키·인증 토큰은 Secret으로 저장하세요.
- Production과 Preview 설정은 각각 확인하고, 변경 후 재배포합니다.
- 같은 배포의 MCP를 사용할 때 `MCP_SERVER_URL`은 생략할 수 있습니다. 이 경우 서버 내부에서 MCP HTTP 처리기로 전달합니다.
- 저장소에는 Wrangler 설정 파일과 배포용 npm 스크립트가 없습니다. 연결된 Pages 프로젝트의 빌드·배포 설정을 확인하세요.

## 검증

```powershell
node --test scripts/*.test.mjs mcp-server/test/*.test.js
```

로컬 웹 서버를 실행한 상태에서 공공데이터 조회를 확인합니다.

```powershell
node scripts/check-parking-api.mjs 화명
npm --prefix mcp-server run check -- 화명
npm --prefix mcp-server run check:http -- http://localhost:8788/api/mcp
```

자동 테스트와 실제 외부 API·AI 호출은 구분해야 합니다. 실제 Turnstile, OpenRouter, 배포 연결은 각 환경의 키를 설정한 뒤 별도 확인합니다. MCP 도구·CLI·오류 진단은 [MCP_README.md](MCP_README.md)를 참고하세요.

PWA는 HTTPS 배포에서 설치를 확인합니다. 정적 파일을 변경하면 `service-worker.js`의 `CACHE_NAME`을 갱신하세요. 오프라인에서는 캐시된 화면만 열 수 있으며, 최신 주차정보와 AI 안내에는 인터넷 연결이 필요합니다.
