export async function onRequestGet(context) {
  const apiKey = context.env.DATA_API_KEY;

  if (!apiKey) {
    return Response.json({
      message: "서버 연결 성공! 인증키가 설정되지 않았습니다."
    });
  }

  return Response.json({
    message: "서버 연결 성공! 인증키 설정도 확인했습니다."
  });
}