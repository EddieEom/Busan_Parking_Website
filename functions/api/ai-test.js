import {interpretWithGemini} from '../../services/parkingIntent.js';
import {json,readQuestion,verifyQuestion} from '../../services/aiRequest.js';
// GET은 상태 확인만 합니다. 과금 가능한 연결 테스트는 검증된 POST로만 실행합니다.
export async function onRequest(context) {
  const {request,env}=context;
  if(request.method==='GET')return json({version:'V6.3-structured-intent',configured:!!env.GEMINI_API_KEY?.trim(),message:'연결 테스트는 사용자 확인 후 POST 요청으로 실행합니다.'});
  if(request.method!=='POST')return json({message:'지원하지 않는 요청입니다.'},405);
  if(request.headers.get('Origin')!==new URL(request.url).origin)return json({message:'현재 사이트에서 요청해 주세요.'},403);
  try {
    const body=await readQuestion(request);
    if(!await verifyQuestion(context,body.turnstileToken))return json({message:'사용자 확인이 필요합니다.'},403);
    const intent=await interpretWithGemini(body.question,env);
    return json({success:true,intent,finishReason:'STOP'});
  } catch {return json({message:'Gemini 연결을 확인하지 못했습니다. 서버 설정과 사용량을 확인해 주세요.'},502);}
}
