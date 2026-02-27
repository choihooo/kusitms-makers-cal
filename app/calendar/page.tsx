"use client";

import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import { useEffect, useState } from "react";

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  notionUrl: string;
  color: string;
};

type CalendarResponse = {
  events: CalendarEvent[];
  generatedAt?: string;
};

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadEvents() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/calendar/events", {
        method: "GET",
        cache: "no-store"
      });

      if (!response.ok) {
        const failedPayload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(failedPayload?.message ?? "Failed to fetch events.");
      }

      const payload = (await response.json()) as CalendarResponse;
      setEvents(payload.events);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch events.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  return (
    <main className="calendar-only-page">
      <section className="calendar-only-shell">
        {error ? <p className="calendar-message calendar-error">{error}</p> : null}
        {loading && !error ? <p className="calendar-message">일정 불러오는 중...</p> : null}
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          customButtons={{
            refresh: {
              text: loading ? "로딩..." : "새로고침",
              click: () => {
                void loadEvents();
              }
            }
          }}
          headerToolbar={{
            left: "title",
            center: "",
            right: "refresh today prev,next"
          }}
          buttonText={{
            today: "today"
          }}
          height="auto"
          events={events}
          eventDidMount={(info) => {
            info.el.title = info.event.title;
            info.el.setAttribute("aria-label", info.event.title);
          }}
          eventClick={(info) => {
            const notionUrl = (info.event.extendedProps as { notionUrl?: string }).notionUrl;
            if (notionUrl) {
              window.open(notionUrl, "_blank", "noopener,noreferrer");
            }
          }}
        />
      </section>
    </main>
  );
}
