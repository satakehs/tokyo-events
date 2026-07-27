import Parser from "rss-parser";
import { createClient } from "@supabase/supabase-js";

// 取り込み元のRSS一覧。今後ここに他のサイトを追加していく想定。
const SOURCES = [
  {
    name: "いたばしTIMES",
    feedUrl: "https://itabashi-times.com/feed/",
    wardContext: "東京都板橋区",
  },
];

// OpenStreetMapのジオコーディングAPI(Nominatim)の利用ポリシーで、
// 1秒に1リクエストまでと定められているための間隔。
const GEOCODE_INTERVAL_MS = 1100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toDateOnly(pubDate) {
  const parsed = new Date(pubDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

// タイトルから「場所らしき部分」の候補を推測する。完璧ではないが、
// 「【地名】〜」「〇〇で「イベント名」開催」という言い回しが多いことを利用する。
// 【】の中身がイベント名で場所ではないケース(例:「【いたばし花火大会2026】
// 成増ドンキで〜」)もあるため、複数候補を返して呼び出し側で順に試す。
function extractLocationHints(title) {
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

async function geocode(query) {
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

async function findExistingUrls(supabase, urls) {
  if (urls.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase
    .from("events")
    .select("source_url")
    .in("source_url", urls);

  if (error) {
    throw new Error(`既存データの確認に失敗: ${error.message}`);
  }

  return new Set((data || []).map((row) => row.source_url));
}

async function ingestSource(supabase, parser, source) {
  const feed = await parser.parseURL(source.feedUrl);

  const urls = feed.items.map((item) => item.link).filter(Boolean);
  const existingUrls = await findExistingUrls(supabase, urls);
  const newItems = feed.items.filter(
    (item) => item.link && !existingUrls.has(item.link)
  );

  if (newItems.length === 0) {
    console.log(`[${source.name}] 新規記事はありませんでした`);
    return;
  }

  const rows = [];
  for (const item of newItems) {
    const startDate = toDateOnly(item.pubDate);
    if (!startDate) continue;

    let latitude = null;
    let longitude = null;
    let venueName = null;

    for (const hint of extractLocationHints(item.title)) {
      const geocoded = await geocode(`${source.wardContext}${hint}`);
      await sleep(GEOCODE_INTERVAL_MS);
      if (geocoded) {
        latitude = geocoded.lat;
        longitude = geocoded.lon;
        venueName = hint;
        break;
      }
    }

    rows.push({
      title: item.title,
      description: (item.contentSnippet || "").slice(0, 300),
      // 注意: RSSには「イベント開催日」までは含まれていないため、
      // 暫定的に記事の公開日をstart_dateとして使っている。
      start_date: startDate,
      end_date: null,
      venue_name: venueName,
      address: null,
      latitude,
      longitude,
      category: item.categories?.[0] ?? "未分類",
      source_name: source.name,
      source_url: item.link,
    });
  }

  const { error } = await supabase.from("events").upsert(rows, {
    onConflict: "source_url",
  });

  if (error) {
    throw new Error(`[${source.name}] insert error: ${error.message}`);
  }

  const geocodedCount = rows.filter((row) => row.latitude != null).length;
  console.log(
    `[${source.name}] 新規${rows.length}件を登録(うち位置情報あり${geocodedCount}件)`
  );
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      "環境変数 SUPABASE_URL / SUPABASE_SECRET_KEY が設定されていません"
    );
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey);
  const parser = new Parser();

  for (const source of SOURCES) {
    await ingestSource(supabase, parser, source);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
