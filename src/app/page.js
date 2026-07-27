import styles from "./page.module.css";
import { supabase } from "@/lib/supabaseClient";

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
        <ul>
          {events.map((event) => (
            <li key={event.id}>
              <strong>{event.title}</strong>({event.start_date} 〜{" "}
              {event.end_date})
              <br />
              {event.venue_name} / {event.category}
              <br />
              出典:{" "}
              <a href={event.source_url} target="_blank" rel="noreferrer">
                {event.source_name}
              </a>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
