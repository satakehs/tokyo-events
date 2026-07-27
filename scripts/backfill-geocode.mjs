import { createClient } from "@supabase/supabase-js";
import { GEOCODE_INTERVAL_MS, sleep, extractLocationHints, geocode } from "./lib/geocode.mjs";

// すでに登録済みだが位置情報がまだ無いイベントに、後から
// 位置情報を補完するための一回限りのバックフィル用スクリプト。
const WARD_CONTEXT = "東京都板橋区";

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      "環境変数 SUPABASE_URL / SUPABASE_SECRET_KEY が設定されていません"
    );
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey);

  const { data: rows, error } = await supabase
    .from("events")
    .select("id, title")
    .is("latitude", null);

  if (error) {
    throw new Error(`取得失敗: ${error.message}`);
  }

  let updated = 0;
  for (const row of rows) {
    for (const hint of extractLocationHints(row.title)) {
      const geocoded = await geocode(`${WARD_CONTEXT}${hint}`);
      await sleep(GEOCODE_INTERVAL_MS);
      if (geocoded) {
        const { error: updateError } = await supabase
          .from("events")
          .update({
            latitude: geocoded.lat,
            longitude: geocoded.lon,
            venue_name: hint,
          })
          .eq("id", row.id);

        if (updateError) {
          console.error(`更新失敗 (${row.title}): ${updateError.message}`);
        } else {
          updated++;
        }
        break;
      }
    }
  }

  console.log(`${rows.length}件中${updated}件に位置情報を補完しました`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
