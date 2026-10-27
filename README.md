# 부산 공영주차장 · AI 코드 생성과 MCP 연결 실습

**AI를 활용해 코드를 생성·수정하고, 공공데이터 API와 MCP 서버를 연결해 Cloudflare에 배포했습니다.**

JavaScript · 공공데이터 API · MCP · OpenRouter · Cloudflare Pages / Functions

[배포 사이트](https://busan-parking-website.pages.dev/) · [MCP 연결 안내](docs/MCP_README.md)

<img src="https://raw.githubusercontent.com/EddieEom/EddieEom/main/assets/screenshots/parking-search.jpg" alt="배포된 주차장 웹의 검색·AI 안내 화면" width="100%"/>


## 이 프로젝트에서 시도한 것

| 작업 | 진행 내용 |
| --- | --- |
| AI 활용 | 요구사항 전달 → 코드 생성 → 실행 결과 확인 → 수정 요청 |
| MCP 연결 | 주차장 검색·빈자리순·상세·비교 도구 구성 |
| 외부 데이터 | 공공데이터 목록·현황·기본정보 수집과 병합 |
| 배포 | Cloudflare Pages와 Functions, 환경변수 설정 |

수업 요구사항을 바탕으로 AI 코드 생성을 적극 활용했습니다. 생성된 결과를 그대로 두기보다, 조회값과 실제 사용 흐름을 확인하고 필요한 수정사항을 구체적으로 전달하는 방식으로 진행했습니다.

## 개발 중 수정한 사례

### MCP가 연결되지 않을 때

MCP 서버 연결 오류와 Gemini의 429·503 응답을 경험했습니다. 현재 웹은 OpenRouter와 MCP 도구를 연결합니다. 서버 주소·인증 설정·모델 응답을 나눠 확인하면서, 화면에서 발생한 오류가 어느 연결 구간의 문제인지 살펴봤습니다.

### 지도에서 다른 위치가 검색될 때

주차장 이름만으로 지도를 검색하면 원하는 위치를 찾기 어려운 사례가 있었습니다. 공공데이터의 주소를 우선 사용하고, 주소가 없을 때 이름 검색을 안내하도록 바꿨습니다. 일반 검색과 AI 결과가 같은 카드 모듈을 쓰도록 구성했습니다.

### 사용자가 업데이트 버튼을 찾아야 할 때

PWA의 새 버전 반영을 사용자에게 맡기는 흐름을 줄이도록 수정했습니다. 정적 화면만 캐시하고, 실시간 주차정보와 AI 응답은 네트워크에서 가져오도록 구분했습니다.

이 과정에서 요구사항을 명확히 전달하는 것과 AI가 만든 결과를 확인하는 일이 함께 필요하다는 점을 배웠습니다.

## 코드와 결과

[공공데이터 처리](lib) · [MCP 도구](mcp-server/createServer.js) · [지도 링크](map-link.js) · [공통 카드](parking-card.js)

<img src="https://raw.githubusercontent.com/EddieEom/EddieEom/main/assets/screenshots/parking-results.jpg" alt="화명 검색 결과와 주차장별 정보" width="100%"/>


위 캡처는 2026-10-26 배포 화면입니다. 당시 파일 정리 후 자동 테스트 121개 통과를 확인했습니다. 실제 외부 서비스 연결은 환경변수와 API 상태에 따라 별도로 확인해야 합니다.

[버전별 개발 기록](docs/VERSION_IMPLEMENTATION.md) · [요구사항과 구현 대조](docs/IMPLEMENTATION_REVIEW.md)

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

