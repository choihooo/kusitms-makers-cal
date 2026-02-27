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
  source?: "project" | "issue" | "sprint" | "meeting";
  sortOrder?: number;
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
      setEvents(
        payload.events.map((event) => ({
          ...event,
          sortOrder: event.source ? sourcePriority[event.source] : Number.MAX_SAFE_INTEGER
        }))
      );
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch events.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  const sourcePriority: Record<NonNullable<CalendarEvent["source"]>, number> = {
    sprint: 0,
    project: 1,
    issue: 2,
    meeting: 3
  };

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
          dayMaxEvents={false}
          dayMaxEventRows={false}
          height="auto"
          events={events}
          eventOrderStrict={true}
          eventOrder="sortOrder,title"
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
