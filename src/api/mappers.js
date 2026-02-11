function guessChannel(item) {
  // mall_name 기반 분류 우선 (백엔드가 모든 상품에 channel: "naver"를 붙이므로)
  const mallName = (item.mall_name || "").trim();
  if (mallName === "쿠팡") return "coupang";
  if (["11번가", "G마켓", "옥션", "롯데몰"].includes(mallName)) return "others";

  // link 기반 분류 (mall_name이 없는 경우)
  const link = (item.link || "").toLowerCase();
  if (link.includes("coupang")) return "coupang";
  if (link.includes("gmarket") || link.includes("auction") || link.includes("11st")) return "others";

  if (item.channel) return item.channel;
  if (link.includes("smartstore") || link.includes("naver")) return "naver";
  return "others";
}

/** mall_name으로 채널 판별: 쿠팡→coupang, 11번가/G마켓/옥션/롯데몰→others, 그 외→naver */
function getChannelFromMallName(mallName) {
  const name = (mallName || "").trim();
  if (name === "쿠팡") return "coupang";
  if (["11번가", "G마켓", "옥션", "롯데몰"].includes(name)) return "others";
  return "naver";
}

function guessMarket(item) {
  // 백엔드에 market이 오면 사용, 없으면 calc_method/링크로 추정
  if (item.market) return item.market;
  const link = (item.link || "").toLowerCase();
  if (link.includes("smartstore")) return "스마트스토어";
  if (link.includes("coupang")) return "쿠팡";
  return item.calc_method || "-";
}

/**
 * /products/below-target 응답을 offers 형식으로 변환
 * 실제 형식: { target_price, snapshot_time, count, data: [{ product_name, unit_price, quantity, total_price, mall_name, link, image_url, created_at }] }
 */
export function mapBelowTargetToOffers(belowTarget) {
  const arr = belowTarget?.data ?? [];
  const snapshot = belowTarget?.snapshot_time ?? "-";
  return arr.map((item, idx) => {
    const pack = Number(item.quantity ?? 1) || 1;
    const unitPrice = Number(item.unit_price ?? 0) || 0;
    const price =
      Number(item.total_price) ||
      (unitPrice && pack ? unitPrice * pack : unitPrice);
    const channel = guessChannel(item);
    const market = guessMarket(item);
    return {
      id: `bt-${item.mall_name}-${item.product_name}-${unitPrice}-${idx}`,
      channel,
      market,
      seller: item.mall_name || "-",
      productName: item.product_name || "-",
      pack,
      price,
      unitPrice,
      url: item.link || "#",
      capturedAt: item.created_at ?? snapshot,
      captureThumb: item.image_url || "/o1.png",
    };
  });
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
 * /products/tracked-malls/summary + below-target으로 채널별 판매처 카드 생성
 * mall_name으로 채널 판별: 쿠팡→coupang, 11번가/G마켓/옥션/롯데몰→others, 그 외→naver
 */
export function mapSummaryToSellers(summary, belowTargetOffers = []) {
  const result = { naver: [], coupang: [], others: [] };

  const mapSummaryItem = (item) => ({
    seller: item.mall_name ?? item.seller ?? item.mallName ?? "-",
    currentConsideredUnitPrice:
      Number(item.current_price ?? item.currentPrice ?? item.unit_price ?? 0) ||
      0,
    last7dRange:
      Number(item.change_7d ?? item.range_7d ?? item.last7dRange ?? 0) || 0,
    belowCount:
      Number(
        item.below_target_count ?? item.below_count ?? item.belowCount ?? 0,
      ) || 0,
  });

  // 1) summary 데이터: mall_name으로 채널 판별 (below-target에서 매칭 시 해당 mall_name 사용)
  const arr = Array.isArray(summary?.data)
    ? summary.data
    : Array.isArray(summary)
    ? summary
    : [];
  arr.forEach((item) => {
    const mallName = (
      item.mall_name ??
      item.seller ??
      item.mallName ??
      "-"
    ).trim();
    const mapped = mapSummaryItem(item);
    let channel = "naver";
    const match = Array.isArray(belowTargetOffers)
      ? belowTargetOffers.find((o) => (o.seller || "").trim() === mallName)
      : null;
    channel = getChannelFromMallName(match?.seller ?? mallName);
    result[channel].push(mapped);
  });

  // 2) below-target에서 summary에 없는 채널별 mall 추가 (쿠팡, 11번가, G마켓, 옥션, 롯데몰 등)
  const summaryMallNames = new Set(
    arr.map((i) => (i.mall_name ?? i.seller ?? "").trim()),
  );
  const btByMall = new Map();
  (belowTargetOffers || []).forEach((o) => {
    const name = (o.seller || "").trim();
    if (!name || summaryMallNames.has(name)) return;
    if (!btByMall.has(name)) {
      btByMall.set(name, { prices: [], count: 0 });
    }
    const entry = btByMall.get(name);
    entry.prices.push(o.unitPrice ?? 0);
    entry.count += 1;
  });
  btByMall.forEach((entry, mallName) => {
    const channel = getChannelFromMallName(mallName);
    if (channel === "naver") return; // 개별 스토어는 summary에 있으므로 스킵
    result[channel].push({
      seller: mallName,
      currentConsideredUnitPrice:
        Math.min(...entry.prices.filter(Boolean)) || 0,
      last7dRange: 0,
      belowCount: entry.count,
    });
  });

  if (
    arr.length === 0 &&
    !belowTargetOffers?.length &&
    typeof summary === "object"
  ) {
    ["naver", "coupang", "others"].forEach((ch) => {
      const channelArr = summary[ch] ?? [];
      result[ch] = (Array.isArray(channelArr) ? channelArr : []).map(
        mapSummaryItem,
      );
    });
  }
  return result;
}

/**
 * /products/tracked-malls/trends 응답을 그래프용 데이터로 변환
 * 실제 형식: { days: 7, malls: ["레디투힐",...], data: [{ date: "02/04", "글루어트": 90000, "레디투힐": 82857, ... }] }
 */
export function mapTrendsToChartData(trends, channelKey = null) {
  if (!trends) return [];

  // 실제 API: { days, malls, data: [{ date, "mall1": price, "mall2": price, ... }] }
  if (trends.data && Array.isArray(trends.data) && trends.data.length > 0) {
    const mallKeys =
      trends.malls ||
      Object.keys(trends.data[0] || {}).filter(
        (k) => k !== "date" && k !== "x",
      );
    return trends.data.map((row) => {
      const x = row.date ?? row.x ?? "-";
      const point = { x };
      mallKeys.forEach((mall) => {
        const v = row[mall];
        point[mall] = v != null ? Number(v) : null;
      });
      return point;
    });
  }

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
