"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// バンドラー経由だとLeafletのデフォルトのピン画像が正しく読み込めないため、
// CDN上の画像を直接指定する。
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// 板橋区役所付近を初期表示の中心にする
const ITABASHI_CENTER = [35.7511, 139.7093];

export default function EventMap({ events }) {
  const eventsWithLocation = events.filter(
    (event) => event.latitude != null && event.longitude != null
  );

  return (
    <MapContainer
      center={ITABASHI_CENTER}
      zoom={13}
      style={{ height: "500px", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {eventsWithLocation.map((event) => (
        <Marker key={event.id} position={[event.latitude, event.longitude]}>
          <Popup>
            <strong>{event.title}</strong>
            <br />
            {event.start_date}
            {event.venue_name ? <><br />{event.venue_name}</> : null}
            <br />
            <a href={event.source_url} target="_blank" rel="noreferrer">
              {event.source_name}
            </a>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
