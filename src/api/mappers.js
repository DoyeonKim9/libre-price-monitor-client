function guessChannel(item) {
    // 백엔드에 channel/market이 이미 오면 그걸 우선 사용
    if (item.channel) return item.channel;
    const link = (item.link || "").toLowerCase();
    if (link.includes("smartstore") || link.includes("naver")) return "naver";
    if (link.includes("coupang")) return "coupang";
    return "others";
  }
  
  function guessMarket(item) {
    // 백엔드에 market이 오면 사용, 없으면 calc_method/링크로 추정
    if (item.market) return item.market;
    const link = (item.link || "").toLowerCase();
    if (link.includes("smartstore")) return "스마트스토어";
    if (link.includes("coupang")) return "쿠팡";
    return item.calc_method || "-";
  }
  
  export function mapLatestToOffers(latest) {
    const snapshot = latest?.snapshot_time || "-";
    const arr = Array.isArray(latest?.data) ? latest.data : [];
  
    return arr.map((item, idx) => {
      const pack = Number(item.quantity ?? 1) || 1;
      const unitPrice = Number(item.unit_price ?? 0) || 0;
      const price =
        Number(item.total_price) ||
        (unitPrice && pack ? unitPrice * pack : unitPrice);
  
      const channel = guessChannel(item);
      const market = guessMarket(item);
  
      return {
        id: `${channel}-${item.mall_name}-${item.product_name}-${unitPrice}-${idx}`,
        channel,
        market,
        seller: item.mall_name || "-",
        productName: item.product_name || "-",
        pack,
        price,
        unitPrice,
        url: item.link || "#",
        capturedAt: snapshot,
        // 백엔드에 image_url이 있으면 사용, 없으면 public에 있는 기본 이미지로 대체
        captureThumb: item.image_url || "/o1.png",
      };
    });
  }
  