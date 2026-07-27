import Parser from "rss-parser";
import { createClient } from "@supabase/supabase-js";
import { GEOCODE_INTERVAL_MS, sleep, extractLocationHints, geocode } from "./lib/geocode.mjs";

// 取り込み元のRSS一覧。今後ここに他のサイトを追加していく想定。
const SOURCES = [
  {
    name: "いたばしTIMES",
    feedUrl: "https://itabashi-times.com/feed/",
    wardContext: "東京都板橋区",
  },
];

function toDateOnly(pubDate) {
  const parsed = new Date(pubDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
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
