import {askGemini} from './geminiClient.js';

try {
  const result = await askGemini({
    apiKey: process.env.GEMINI_API_KEY,
    mcpUrl: process.env.MCP_SERVER_URL,
    mcpToken: process.env.MCP_AUTH_TOKEN,
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    question: process.argv.slice(2).join(' ') || '화명동 공영주차장을 찾아줘. 잔여 면수와 갱신 시각도 알려줘.'
  });
  console.log(result.text);
  console.log(`\n호출한 MCP 도구: ${result.toolCalls.join(', ')}`);
  if (result.interactionId) console.log(`\nInteraction ID: ${result.interactionId}`);
} catch (error) {
  // API 키를 출력하지 않습니다.
  const key = process.env.GEMINI_API_KEY?.trim();
  console.error(key ? String(error.message).replaceAll(key, '[redacted]') : error.message);
  process.exitCode = 1;
}
