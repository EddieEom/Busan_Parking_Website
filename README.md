# 부산 공영주차장

**AI 코드 생성을 활용해 공공데이터 API·MCP 서버를 연결하고 Cloudflare에 배포한 수업 프로젝트입니다.**

[배포 사이트](https://busan-parking-website.pages.dev/) · [MCP 연결 안내](docs/MCP_README.md) · [실행 방법](#실행-방법)

<img src="https://raw.githubusercontent.com/EddieEom/EddieEom/271fbdfe2c28c3205336f3840425d5ac98fdad94/assets/screenshots/parking-search.jpg" alt="부산 주차장 검색 및 AI 질문 화면" width="100%"/>

<img src="https://raw.githubusercontent.com/EddieEom/EddieEom/271fbdfe2c28c3205336f3840425d5ac98fdad94/assets/screenshots/parking-results.jpg" alt="주차장별 요금·운영시간·잔여 면수를 표시하는 조회 결과" width="100%"/>

2026-10-26 배포 사이트에서 직접 캡처한 첫 화면과 ‘화명’ 검색 결과입니다. 잔여 면수는 당시 조회 시점 기준입니다.

## 담당 범위

| 구분 | 범위 |
| --- | --- |
| 제공받은 부분 | 수업 기능 요구사항, 공공데이터 API의 원천 정보 |
| 내가 맡은 일 | 요구사항 전달·수정 요청, 화면과 조회 결과 확인, 외부 서비스 연결·배포 설정 |
| AI 역할 | 코드 생성과 수정 지원. 모든 구현을 독립적으로 작성한 작업과 구분 |
| 결과물 | 주차장 검색, 실시간 현황, 지도 검색 연결, MCP 기반 AI 조회, PWA |

## 개발 과정

### 1. 화면에 목록을 띄우는 것부터 시작

목록과 실시간 현황을 가져온 다음, 필터·정렬·기본정보 표시로 확장했습니다. 데이터 출처마다 공통 식별자가 없어 모두 같은 방식으로 합칠 수는 없었습니다. 코드 기반 연결과 이름 정규화·매칭을 구분하고, 정보가 없을 때는 0으로 단정하지 않도록 구성했습니다.

### 2. MCP 연결 오류와 외부 모델 변경

개발 중 MCP 서버 연결 오류가 발생했고 Gemini 호출에서도 429·503 응답을 경험했습니다. 현재 웹은 OpenRouter와 MCP 도구를 연결하는 방식으로 구성했습니다. 서버 주소·인증 토큰·모델 응답을 따로 확인해야 했던 부분입니다.

### 3. 지도 링크는 이름보다 주소가 필요했다

주차장 이름으로 지도 검색을 연결했을 때 원하는 위치를 찾기 어려운 사례가 있었습니다. 공공데이터의 주소를 우선 사용하고 주소가 없을 때 이름 검색을 안내하도록 바꿨습니다. 일반 검색과 AI 결과는 같은 카드 모듈을 사용합니다.

### 4. 배포 이후의 사용 흐름도 수정

화면을 새 네온 디자인으로 바꾸고, 글자와 조회 요약·검색 버튼을 조정했습니다. PWA 업데이트도 사용자가 별도 버튼을 찾아야 하는 흐름을 줄이는 방향으로 수정했습니다. API·AI 응답은 오프라인 캐시 대상에서 제외했습니다.

이 과정의 코드는 AI 도움을 받아 생성·수정했습니다. 오류를 발견하고 요구사항을 구체화하며 결과를 확인한 작업을 제 수행 범위로 설명합니다.

## 코드와 확인 범위

| 내용 | 근거 |
| --- | --- |
| 원천 데이터 수집·병합 | [lib](lib) |
| MCP 도구 등록 | [createServer.js](mcp-server/createServer.js) |
| 지도 링크 생성 | [map-link.js](map-link.js) |
| 일반·AI 공통 카드 | [parking-card.js](parking-card.js) |
| 개발 단계별 기록 | [버전 기록](docs/VERSION_IMPLEMENTATION.md) |
| 요구사항과 구현 대조 | [구현 대조표](docs/IMPLEMENTATION_REVIEW.md) |

2026-10-26 파일 정리 후 자동 테스트 121개 통과를 확인했습니다. 이는 당시 코드의 테스트 결과이며 실제 AI 서비스·인증·모바일 설치의 상시 정상 동작을 뜻하지 않습니다.

## 실행 방법

<details>
<summary><b>⚙️ 로컬 실행 · API · 배포 · 검증</b></summary>

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

자동 테스트와 실제 외부 API·AI 호출은 구분해야 합니다. 실제 Turnstile, OpenRouter, 배포 연결은 각 환경의 키를 설정한 뒤 별도 확인합니다. MCP 도구·CLI·오류 진단은 [MCP 연결 안내](docs/MCP_README.md)를 참고하세요.

PWA는 HTTPS 배포에서 설치를 확인합니다. 정적 파일을 변경하면 `service-worker.js`의 `CACHE_NAME`을 갱신하세요. 오프라인에서는 캐시된 화면만 열 수 있으며, 최신 주차정보와 AI 안내에는 인터넷 연결이 필요합니다.

</details>

