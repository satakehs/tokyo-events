import Parser from "rss-parser";
import { createClient } from "@supabase/supabase-js";

// 取り込み元のRSS一覧。今後ここに他のサイトを追加していく想定。
const SOURCES = [
  {
    name: "いたばしTIMES",
    feedUrl: "https://itabashi-times.com/feed/",
    // このタグが付いた記事だけをイベントとして取り込む。
    // (このRSSには店舗の開店・閉店情報やグルメレポなど、
    //  イベント以外の記事も混ざっているため)
    eventCategoryTag: "イベント情報",
  },
];

function toDateOnly(pubDate) {
  const parsed = new Date(pubDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

async function ingestSource(supabase, parser, source) {
  const feed = await parser.parseURL(source.feedUrl);

  const rows = feed.items
    .filter((item) => (item.categories || []).includes(source.eventCategoryTag))
    .map((item) => ({
      title: item.title,
      description: (item.contentSnippet || "").slice(0, 300),
      // 注意: RSSには「イベント開催日」までは含まれていないため、
      // 暫定的に記事の公開日をstart_dateとして使っている。
      start_date: toDateOnly(item.pubDate),
      end_date: null,
      venue_name: null,
      address: null,
      latitude: null,
      longitude: null,
      category: source.eventCategoryTag,
      source_name: source.name,
      source_url: item.link,
    }))
    .filter((row) => row.start_date && row.source_url);

  const { error } = await supabase
    .from("events")
    .upsert(rows, { onConflict: "source_url", ignoreDuplicates: true });

  if (error) {
    throw new Error(`[${source.name}] insert error: ${error.message}`);
  }

  console.log(`[${source.name}] ${rows.length}件を処理しました`);
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
