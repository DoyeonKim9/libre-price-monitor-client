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

/**
 * /products/config 응답에서 target_price 추출
 */
export function mapConfigToTargetPrice(config) {
  if (!config) return null;
  const v = config.target_price ?? config.targetPrice;
  return typeof v === "number" ? v : Number(v) || null;
}

/**
 * /products/tracked-malls/summary 응답을 채널별 판매처 카드 형식으로 변환
 * 예상 형식: { naver: [...], coupang: [...], others: [...] } 또는 배열
 */
export function mapSummaryToSellers(summary) {
  if (!summary) return { naver: [], coupang: [], others: [] };
  const result = { naver: [], coupang: [], others: [] };
  const channelMap = { naver: "naver", coupang: "coupang", others: "others" };

  if (Array.isArray(summary)) {
    summary.forEach((item) => {
      const ch = (item.channel || "others").toLowerCase();
      const channel = channelMap[ch] || "others";
      result[channel].push({
        seller: item.mall_name ?? item.seller ?? item.mallName ?? "-",
        currentConsideredUnitPrice:
          Number(
            item.current_price ?? item.currentPrice ?? item.unit_price ?? 0,
          ) || 0,
        last7dRange:
          Number(item.change_7d ?? item.range_7d ?? item.last7dRange ?? 0) || 0,
        belowCount: Number(item.below_count ?? item.belowCount ?? 0) || 0,
      });
    });
  } else if (typeof summary === "object") {
    ["naver", "coupang", "others"].forEach((ch) => {
      const arr = summary[ch] ?? [];
      result[ch] = (Array.isArray(arr) ? arr : []).map((item) => ({
        seller: item.mall_name ?? item.seller ?? item.mallName ?? "-",
        currentConsideredUnitPrice:
          Number(
            item.current_price ?? item.currentPrice ?? item.unit_price ?? 0,
          ) || 0,
        last7dRange:
          Number(item.change_7d ?? item.range_7d ?? item.last7dRange ?? 0) || 0,
        belowCount: Number(item.below_count ?? item.belowCount ?? 0) || 0,
      }));
    });
  }
  return result;
}

/**
 * /products/tracked-malls/trends 응답을 그래프용 데이터로 변환
 * 예상 형식: { mall_name: [{ date, price }], ... } 또는 { dates: [], malls: {} }
 */
export function mapTrendsToChartData(trends, channelKey = null) {
  if (!trends) return [];
  const list = [];

  if (Array.isArray(trends)) {
    // [{ mall_name, channel, data: [{ date, price }] }, ...]
    const datePoints = new Map();
    trends
      .filter(
        (t) => !channelKey || (t.channel || "").toLowerCase() === channelKey,
      )
      .forEach((t) => {
        const arr = t.data ?? t.trends ?? [];
        const mallName = t.mall_name ?? t.seller ?? t.mallName ?? "-";
        arr.forEach((p) => {
          const x = p.date ?? p.x ?? p.day ?? "-";
          if (!datePoints.has(x)) datePoints.set(x, { x });
          datePoints.get(x)[mallName] = Number(p.price ?? p.value ?? 0) || null;
        });
      });
    return Array.from(datePoints.values()).sort((a, b) =>
      String(a.x).localeCompare(String(b.x)),
    );
  }

  if (typeof trends === "object" && trends.dates && trends.malls) {
    const { dates, malls } = trends;
    return (dates || []).map((x, i) => {
      const point = { x };
      Object.entries(malls || {}).forEach(([mall, prices]) => {
        const v = Array.isArray(prices) ? prices[i] : null;
        point[mall] = Number(v) || null;
      });
      return point;
    });
  }

  // { "mall1": [{ date, price }], "mall2": [...] }
  const dateKeys = new Set();
  const mallData = {};
  Object.entries(trends).forEach(([mall, arr]) => {
    if (!Array.isArray(arr)) return;
    mallData[mall] = arr;
    arr.forEach((p) => {
      const x = p.date ?? p.x ?? p.day ?? "-";
      dateKeys.add(x);
    });
  });

  return Array.from(dateKeys)
    .sort()
    .map((x) => {
      const point = { x };
      Object.entries(mallData).forEach(([mall, arr]) => {
        const entry = arr.find((a) => (a.date ?? a.x ?? a.day) === x);
        point[mall] = entry
          ? Number(entry.price ?? entry.value ?? 0) || null
          : null;
      });
      return point;
    });
}
