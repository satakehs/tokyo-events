"use client";

import dynamic from "next/dynamic";

// LeafletはブラウザのDOM(window)が必要なため、サーバー側では描画せず
// ブラウザ側だけで読み込む(ssr: false)。
const EventMap = dynamic(() => import("./EventMap"), {
  ssr: false,
  loading: () => <p>地図を読み込み中...</p>,
});

export default function MapSection({ events }) {
  return <EventMap events={events} />;
}
