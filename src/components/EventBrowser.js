"use client";

import { useMemo, useState } from "react";
import MapSection from "./MapSection";
import { categorizeEvent } from "@/lib/categorize";

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "event", label: "イベント" },
  { key: "gourmet", label: "グルメ" },
];

export default function EventBrowser({ events }) {
  const [filter, setFilter] = useState("all");

  const filteredEvents = useMemo(() => {
    if (filter === "all") return events;
    return events.filter((event) => categorizeEvent(event.category) === filter);
  }, [events, filter]);

  const eventsWithLocation = filteredEvents.filter(
    (event) => event.latitude != null && event.longitude != null
  );

  return (
    <div>
      <div className="filterBar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={filter === f.key ? "filterButtonActive" : "filterButton"}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p>
        全{filteredEvents.length}件中、位置情報があるのは
        {eventsWithLocation.length}件です。
      </p>

      <MapSection events={filteredEvents} />

      <ul>
        {filteredEvents.map((event) => (
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
    </div>
  );
}
