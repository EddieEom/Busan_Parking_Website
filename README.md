
## OpenRouter AI 설정

현재 웹 AI는 OpenRouter를 사용합니다. Cloudflare Production에 `OPENROUTER_API_KEY`(Secret), `OPENROUTER_MODEL=openai/gpt-4.1-mini`를 저장하고 재배포하세요. 기존 Turnstile 및 주차장 API 키는 그대로 사용합니다. Gemini 설정은 웹에서 사용하지 않습니다. 로컬 CLI는 `npm --prefix mcp-server run openrouter -- "화명 주차장 찾아줘"`이며 상세 설정은 [MCP_README.md](MCP_README.md)의 현재 기본 AI 항목을 참고하세요. 기본 모델은 유료이므로 OpenRouter 크레딧이 필요합니다.
