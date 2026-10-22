export const json = (body,status=200) => Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function readQuestion(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new Error('INVALID_BODY');
  const reader=request.body?.getReader();if(!reader)throw new Error('INVALID_BODY');
  const chunks=[];let size=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
      if(size>8192){await reader.cancel();throw new Error('INVALID_BODY');}chunks.push(value);}
  } finally {reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const body=JSON.parse(new TextDecoder().decode(bytes));
  if(typeof body?.question!=='string'||!body.question.trim()||body.question.length>1000)throw new Error('INVALID_BODY');
  return {...body,question:body.question.trim()};
}
export const verificationConfigured = env => !!(env.TURNSTILE_SITE_KEY?.trim() && env.TURNSTILE_SECRET_KEY?.trim());
export async function verifyQuestion(context, token, fetchImpl=globalThis.fetch) {
  if(!verificationConfigured(context.env)||typeof token!=='string'||!token||token.length>2048)return false;
  const response=await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({secret:context.env.TURNSTILE_SECRET_KEY.trim(),response:token,
      remoteip:context.request.headers.get('CF-Connecting-IP')||undefined}),signal:AbortSignal.timeout(10000)});
  const result=await response.json();
  return response.ok && result.success === true && result.hostname===new URL(context.request.url).hostname && result.action==='parking_chat';
}
