export async function onRequestGet(context) {
  const apiKey = context.env.DATA_API_KEY;

  if (!apiKey) {
    return Response.json(
      { message: "DATA_API_KEY가 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  try {
    // Encoding 키가 들어와도 이중 인코딩되지 않도록 처리합니다.
    const decodedKey = decodeURIComponent(apiKey.trim());

    const endpoint =
      "https://apis.data.go.kr/B552587/ParkingInfoService_v2/getParkingList_v2";

    const parkingList = [];
    const numOfRows = 100;
    const maxPages = 30;

    for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
      const url = new URL(endpoint);

      url.searchParams.set("serviceKey", decodedKey);
      url.searchParams.set("pageNo", String(pageNo));
      url.searchParams.set("numOfRows", String(numOfRows));
      url.searchParams.set("resultType", "json");

      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error("목록 API 요청 실패");
      }

      const data = await response.json();
      const header = data.response?.header;
      const body = data.response?.body;

      if (header?.resultCode !== "00" || !body) {
        throw new Error("목록 API 응답 오류");
      }

      const totalCount = Number(body.totalCount);

      if (!Number.isInteger(totalCount) || totalCount < 0) {
        throw new Error("전체 건수 확인 실패");
      }

      // 결과가 여러 개면 배열, 하나면 객체일 수 있습니다.
      const item = body.items?.item;
      const items = Array.isArray(item)
        ? item
        : item && typeof item === "object"
          ? [item]
          : [];

      parkingList.push(...items);

      // 전체 목록을 가져왔으면 반환합니다.
      if (parkingList.length >= totalCount) {
        return Response.json(
          {
            message: `주차장 목록 ${parkingList.length}개를 가져왔습니다.`,
            totalCount,
            items: parkingList
          },
          {
            headers: { "Cache-Control": "no-store" }
          }
        );
      }

      // 전체 건수가 남았는데 빈 페이지가 오면 오류로 처리합니다.
      if (items.length === 0) {
        throw new Error("목록 일부 누락");
      }
    }

    throw new Error("최대 페이지 수 초과");
  } catch (error) {
    return Response.json(
      {
        message:
          "주차장 목록을 가져오지 못했습니다. 인증키, 활용승인 여부, API 응답을 확인해 주세요."
      },
      { status: 502 }
    );
  }
}