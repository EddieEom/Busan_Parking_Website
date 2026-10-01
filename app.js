// 1단계: 브라우저에서 Cloudflare Function을 호출합니다.
const checkButton = document.getElementById("check-button");
const result = document.getElementById("result");

checkButton.addEventListener("click", async () => {
  checkButton.disabled = true;
  result.textContent = "서버에 연결하는 중입니다.";

  try {
    const response = await fetch("/api/parking");

    if (!response.ok) {
      throw new Error("서버 응답 오류");
    }

    const data = await response.json();
    result.textContent = data.message;
  } catch (error) {
    result.textContent = "연결하지 못했습니다. Cloudflare Pages에 배포한 뒤 다시 확인해 주세요.";
  } finally {
    checkButton.disabled = false;
  }
});
