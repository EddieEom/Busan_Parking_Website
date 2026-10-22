# 문서와 구현 대조

첨부된 V1~V8 개발 설명서를 기준으로 기존 `main`(99cd939)을 대조했습니다. 설명서의 과거 테스트 수치(주차장 수·빈자리 수)는 실시간 값이므로 하드코딩하지 않습니다. 초기 로드맵 이미지보다 상세 버전 문서의 최종 흐름을 기준으로 합니다.

| 단계 | 기존 상태 / 보완 | 구현 위치 |
| --- | --- | --- |
| V1~V3 | 3개 공공 API 통합, 모듈 분리, 검색 정규화·관련도·빈자리 정렬·새로고침 유지 | `lib/`, `functions/api/parking.js`, `app.js` |
| V4 | 원본 주소와 품질 안내, 부산+이름 카카오맵 검색 유지 | `parking-card.js` |
| V5 | 설치 UI, 정적 캐시, API 비캐시, 자동 업데이트 유지 | manifest, `pwa.js`, `service-worker.js` |
| V6.0~V6.2 | AI UI 및 MCP 3종+비교 도구 유지. 상세조회 일반 접미사 정규화 보완 | `mcp-server/`, `services/parkingService.js` |
| V6.3 | Remote MCP 의존 없이 Gemini가 JSON 조건만 반환하는 서버 경로 추가. GET 상태 확인·검증된 POST 연결 테스트 | `services/parkingIntent.js`, `functions/api/ai-test.js` |
| V6.4.1 | 로컬 규칙 우선, 최소 빈자리·개수·상세·후보·무관 질문·빈 결과 처리. Gemini 429/503 최대 2회 재시도. 실제 데이터로만 결과 생성 | `functions/api/ai-parking.js`, `services/intentSearch.js`, `chat.js` |

## 서버 설정

- 필수: 기존 `DATA_API_KEY` (다른 키를 쓰는 기본정보 API는 `BASIC_API_KEY`).
- 기본 자연어 검색: 추가 AI 설정 없이 동작합니다.
- 복잡한 자연어를 Gemini가 해석하도록 하려면 `GEMINI_API_KEY`, 선택적으로 `GEMINI_INTENT_MODEL`을 설정합니다.
- 유료 외부 호출은 기존 `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` 사용자 확인 후 실행합니다.
- Gemini 키가 없고 기존 OpenRouter와 Turnstile이 구성되어 있으면 복잡한 요청은 기존 `/api/chat` → OpenRouter → MCP 경로를 사용합니다. 기존 MCP/비교 기능을 삭제하지 않았습니다.
- 키가 모두 없으면 기본 자연어 검색은 동작하고 복잡한 요청에는 다시 질문하도록 안내합니다.
- `/api/ai-parking` GET의 `version` 값은 `V6.4.1-hybrid-local-first`입니다.
- `/api/ai-test` GET은 키 구성 상태만 반환합니다. 키와 사용자 확인 없이는 과금 요청을 실행하지 않습니다. POST는 `question`, `turnstileToken`, 같은 출처의 Origin이 필요합니다.

## 검증 방법

```bash
npm ci
npm --prefix mcp-server ci
npm test
```

테스트는 가짜 AI·주차장 API 응답과 실제 MCP 프로토콜을 사용합니다. 실제 공공데이터·AI 키나 사용자의 브라우저 권한이 필요한 배포 검증은 자동 테스트 성공과 구분합니다. 실제 키는 저장소에 추가하지 않습니다.
