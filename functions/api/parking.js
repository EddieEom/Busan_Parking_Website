// 1단계: Function이 실행되는지만 확인합니다.
// 다음 단계에서 context.env.DATA_API_KEY로 인증키를 읽고 API를 연결합니다.
export async function onRequestGet(context) {
  return Response.json(
    { message: "Parking API works — 서버 연결 성공!" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
