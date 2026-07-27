import styles from "./page.module.css";
import { supabase } from "@/lib/supabaseClient";
import EventBrowser from "@/components/EventBrowser";

// データは1日1回のバッチ収集で更新されるだけなので、
// ページを毎回アクセス時に取得し直す(静的にキャッシュさせない)。
export const dynamic = "force-dynamic";

export default async function Home() {
  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .order("start_date", { ascending: true });

  if (error) {
    return <p>データの取得に失敗しました: {error.message}</p>;
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>東京イベント一覧(テスト表示)</h1>
        <EventBrowser events={events} />
      </main>
    </div>
  );
}
