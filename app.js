const loadButton = document.getElementById("load-button");
const result = document.getElementById("result");
const parkingList = document.getElementById("parking-list");

loadButton.addEventListener("click", async () => {
  loadButton.disabled = true;
  result.textContent = "주차장 목록을 불러오는 중입니다.";
  parkingList.replaceChildren();

  try {
    const response = await fetch("/api/parking");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "서버 응답 오류");
    }

    if (!Array.isArray(data.items)) {
      throw new Error("주차장 목록의 응답 형식이 올바르지 않습니다.");
    }

    const fragment = document.createDocumentFragment();

    for (const parking of data.items) {
      const item = document.createElement("li");
      item.className = "parking-item";

      const name = document.createElement("h2");
      name.textContent = parking.parknm;

      const code = document.createElement("p");
      code.textContent = `주차장 코드: ${parking.parkgcd}`;

      item.append(name, code);
      fragment.append(item);
    }

    parkingList.append(fragment);

    result.textContent = data.items.length > 0
      ? `주차장 ${data.items.length}개를 조회했습니다.`
      : "조회된 주차장이 없습니다.";
  } catch (error) {
    result.textContent = error.message;
  } finally {
    loadButton.disabled = false;
  }
});