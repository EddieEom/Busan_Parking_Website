import {interpretLocally,interpretWithGemini} from '../../services/parkingIntent.js';
import {searchByIntent} from '../../services/intentSearch.js';
import {json,readQuestion,verifyQuestion,verificationConfigured} from '../../services/aiRequest.js';
import {onRequestGet as getParking} from './parking.js';
import {handleChat} from './chat.js';
const version='V6.4.1-hybrid-local-first';
export async function handleAiParking(context,{fetchImpl=globalThis.fetch,loadParking=getParking,interpret=interpretWithGemini,legacyChat=handleChat}={}) {
  const {request,env}=context;
  const remoteEnabled=verificationConfigured(env)&&!!(env.GEMINI_API_KEY?.trim()||env.OPENROUTER_API_KEY?.trim());
  if(request.method==='GET')return json({version,enabled:true,remoteEnabled,siteKey:remoteEnabled?env.TURNSTILE_SITE_KEY.trim():null});
  if(request.method!=='POST')return json({version,message:'지원하지 않는 요청입니다.'},405);
  if(request.headers.get('Origin')!==new URL(request.url).origin)return json({message:'현재 사이트에서 질문해 주세요.'},403);
  let body;try{body=await readQuestion(request);}catch{return json({message:'질문(1~1000자) 형식을 확인해 주세요.'},400);}
  try {
    let plan=interpretLocally(body.question),source='local';
    if(!plan) {
      if(!remoteEnabled)return json({version,answer:'지역이나 주차장 이름, 빈자리 조건을 구체적으로 입력해 주세요. 예: 화명역 요금과 운영시간 알려줘',parkings:[],warnings:[],requiresSelection:false,matchedCount:0,source:'clarify'});
      if(!env.GEMINI_API_KEY?.trim() || (/비교/.test(body.question) && env.OPENROUTER_API_KEY?.trim())) {
        // 기존 OpenRouter→MCP 비교 등 확장 기능 유지. 검증은 기존 처리기가 수행합니다.
        return legacyChat({...context,request:new Request(new URL('/api/chat',request.url),{method:'POST',headers:request.headers,body:JSON.stringify(body)})},fetchImpl);
      }
      if(!await verifyQuestion(context,body.turnstileToken,fetchImpl))return json({version,needsVerification:true,message:'사용자 확인을 완료한 뒤 다시 보내주세요.'},403);
      plan=await interpret(body.question,env,fetchImpl);source='gemini';
    }
    if(plan.intent==='clarify')return json({version,source,...searchByIntent([],plan),warnings:[]});
    const response=await loadParking(context);
    const data=await response.json();
    if(!response.ok||!Array.isArray(data.items))return json({version,message:'최신 주차정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'},502);
    const result=searchByIntent(data.items,plan);
    if(/근처|주변/.test(body.question)&&source==='local')result.answer+=' 입력한 이름·주소 기준 검색입니다. 현재 위치와의 거리는 GPS 버튼으로 확인해 주세요.';
    return json({version,source,...result,fetchedAt:data.fetchedAt,
      warnings:Array.isArray(data.warnings)?data.warnings:[]});
  } catch(error) {
    return json({version,message:error.message==='AI_BUSY'?'현재 AI 요청이 몰려 잠시 처리하지 못했습니다. 잠시 후 다시 보내주세요.':
      '요청을 처리하지 못했습니다. 지역이나 주차장 이름과 조건을 간단히 입력해 주세요.'},503);
  }
}
export const onRequest=context=>handleAiParking(context);
