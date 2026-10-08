import {askOpenRouter, DEFAULT_MODEL} from './openrouterClient.js';
try {
  const result=await askOpenRouter({apiKey:process.env.OPENROUTER_API_KEY,
    model:process.env.OPENROUTER_MODEL?.trim()||DEFAULT_MODEL,
    mcpUrl:process.env.MCP_SERVER_URL,mcpToken:process.env.MCP_AUTH_TOKEN,
    question:process.argv.slice(2).join(' ')||'화명 주차장 찾아줘'});
  console.log(result.text);
  console.log(`\n호출한 MCP 도구: ${result.toolCalls.join(', ')}`);
} catch(error) {
  let message=String(error.message);
  for(const secret of [process.env.OPENROUTER_API_KEY,process.env.MCP_AUTH_TOKEN])if(secret)message=message.replaceAll(secret,'[redacted]');
  console.error(message);
  process.exitCode=1;
}
