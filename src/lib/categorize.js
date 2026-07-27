// 収集元(RSSなど)のカテゴリータグを、アプリの絞り込みボタン用に
// 「イベント / グルメ / その他」の3つに大まかに分類する。
export function categorizeEvent(category) {
  if (category === "イベント情報") return "event";
  if (category === "店舗情報") return "gourmet";
  return "other";
}
