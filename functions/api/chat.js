import {askOpenRouter, DEFAULT_MODEL} from '../../mcp-server/openrouterClient.js';
const json = (data, status = 200) => Response.json(data, {status, headers: {'Cache-Control':'no-store'}});
const requiredSettings = ['OPENROUTER_API_KEY','TURNSTILE_SITE_KEY','TURNSTILE_SECRET_KEY'];
const missingSettings = env => requiredSettings.filter(name => !env[name]?.trim());
const configured = env => missingSettings(env).length === 0;
async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('EMPTY');
  const chunks = []; let size = 0;
  try {
    while (true) {
      const {done,value} = await reader.read(); if(done) break;
      size += value.byteLength;
      if(size > 8192) {await reader.cancel(); throw new Error('TOO_LARGE');}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes = new Uint8Array(size); let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function handleChat(context, fetchImpl = globalThis.fetch, ask = askOpenRouter) {
  const {request,env} = context;
  const url = new URL(request.url);
  if(request.method==='GET') {
    const missing=missingSettings(env);
    return json({enabled:missing.length===0,siteKey:missing.length===0?env.TURNSTILE_SITE_KEY.trim():null,
      missingSettings:missing,configVersion:'openrouter-config-v1'});
  }
  if(request.method!=='POST') return json({message:'지원하지 않는 요청입니다.'},405);
  if(request.headers.get('Origin')!==url.origin) return json({message:'현재 사이트에서 질문해 주세요.'},403);
  if(!configured(env)) return json({message:'AI 안내를 준비 중입니다. 주차장 목록 검색을 이용해 주세요.'},503);
  if(!request.headers.get('Content-Type')?.startsWith('application/json')) return json({message:'JSON 요청이 필요합니다.'},415);
  let body;
  try {body=await readBody(request);} catch(error) {return json({message:'질문 형식을 확인해 주세요.'},error.message==='TOO_LARGE'?413:400);}
  if(typeof body?.question!=='string'||!body.question.trim()||body.question.length>1000 ||
    typeof body.turnstileToken!=='string'||!body.turnstileToken||body.turnstileToken.length>2048) {
    return json({message:'질문(1~1000자)과 사용자 확인을 완료해 주세요.'},400);
  }
  try {
    const verification=await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY.trim(),response:body.turnstileToken,
        remoteip:request.headers.get('CF-Connecting-IP')||undefined}),signal:AbortSignal.timeout(10000)
    });
    const checked=await verification.json();
    if(!verification.ok||!checked.success||checked.hostname!==url.hostname||checked.action!=='parking_chat') {
      return json({message:'사용자 확인이 만료됐습니다. 다시 확인한 뒤 질문해 주세요.'},403);
    }
    const result=await ask({apiKey:env.OPENROUTER_API_KEY,model:env.OPENROUTER_MODEL?.trim()||DEFAULT_MODEL,
      mcpUrl:env.MCP_SERVER_URL?.trim()||new URL('/api/mcp',url).href,
      mcpToken:env.MCP_AUTH_TOKEN?.trim(),question:body.question.trim(),timeoutMs:110000},fetchImpl);
    return json({answer:result.text,toolCalls:result.toolCalls,warnings:result.warnings,completion:result.completion});
  } catch(error) {
    // 외부 오류에는 키/인증 헤더가 포함될 수 있으므로 브라우저에 그대로 전달하지 않습니다.
    if(error.status===402) return json({message:'AI 안내의 사용 잔액이 부족합니다. 주차장 목록 검색을 이용해 주세요.'},503);
    if(error.status===429) return json({message:'AI 요청 한도에 도달했습니다. 잠시 후 다시 질문해 주세요.'},429);
    if(error.status===503) return json({message:'AI 서버가 일시적으로 혼잡합니다. 잠시 후 다시 질문해 주세요.'},503);
    return json({message:'AI가 주차장 정보를 확인하지 못했습니다. 잠시 후 다시 질문하거나 목록 검색을 이용해 주세요.'},502);
  }
}
export const onRequest = context => handleChat(context);
