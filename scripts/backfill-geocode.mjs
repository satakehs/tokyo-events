import { createClient } from "@supabase/supabase-js";
import { resolveEventLocation } from "./lib/article.mjs";

// 過去に登録した分は精度の低い方法(タイトルからの推測)で位置情報を
// 付けていたため、記事本文から正確な住所を取り直して上書きする。
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
    .select("id, title, source_url");

  if (error) {
    throw new Error(`取得失敗: ${error.message}`);
  }

  let updated = 0;
  for (const row of rows) {
    try {
      const location = await resolveEventLocation({
        title: row.title,
        url: row.source_url,
        wardContext: WARD_CONTEXT,
      });

      if (!location) continue;

      const { error: updateError } = await supabase
        .from("events")
        .update({
          venue_name: location.venueName,
          address: location.address,
          latitude: location.latitude,
          longitude: location.longitude,
        })
        .eq("id", row.id);

      if (updateError) {
        console.error(`更新失敗 (${row.title}): ${updateError.message}`);
      } else {
        updated++;
      }
    } catch (itemError) {
      // 1件のエラーで全体を止めない。
      console.error(`処理中にエラー (${row.title}): ${itemError.message}`);
    }
  }

  console.log(`${rows.length}件中${updated}件の位置情報を更新しました`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
