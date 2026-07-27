// OpenStreetMapのジオコーディングAPI(Nominatim)の利用ポリシーで、
// 1秒に1リクエストまでと定められているための間隔。
export const GEOCODE_INTERVAL_MS = 1100;

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// タイトルから「場所らしき部分」の候補を推測する。完璧ではないが、
// 「【地名】〜」「〇〇で「イベント名」開催」という言い回しが多いことを利用する。
// 【】の中身がイベント名で場所ではないケース(例:「【いたばし花火大会2026】
// 成増ドンキで〜」)もあるため、複数候補を返して呼び出し側で順に試す。
export function extractLocationHints(title) {
  const hints = [];

  const bracketMatch = title.match(/^【(.+?)】/);
  if (bracketMatch) {
    hints.push(bracketMatch[1]);
  }

  const rest = bracketMatch ? title.slice(bracketMatch[0].length) : title;
  const venueMatch = rest.match(/^(.{1,15}?)で[「『]/);
  if (venueMatch) {
    hints.push(venueMatch[1]);
  }

  return hints;
}

// 国土地理院の住所検索API。日本の住所(丁目・番地)であれば、
// Nominatimより高い精度でピンポイントに位置が取れる。無料・登録不要。
export async function geocodeAddress(address) {
  const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(
    address
  )}`;

  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const results = await response.json();
  if (!results || results.length === 0) {
    return null;
  }

  const [lon, lat] = results[0].geometry.coordinates;
  return { lat, lon };
}

export async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
    query
  )}`;

  const response = await fetch(url, {
    headers: {
      // Nominatimの利用ポリシーで、身元が分かるUser-Agentが必須。
      "User-Agent":
        "tokyo-events-app/0.1 (personal project; contact: capsuleperfume@gmail.com)",
    },
  });

  if (!response.ok) {
    return null;
  }

  const results = await response.json();
  if (!results || results.length === 0) {
    return null;
  }

  return { lat: Number(results[0].lat), lon: Number(results[0].lon) };
}
