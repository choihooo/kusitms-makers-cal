import { Client } from "@notionhq/client";

export type CalendarEventSource = "project" | "issue" | "sprint" | "release";

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  source: CalendarEventSource;
  notionUrl: string;
  color: string;
};

const SOURCE_COLORS: Record<CalendarEventSource, string> = {
  project: "#7c3aed",
  issue: "#ea580c",
  sprint: "#2563eb",
  release: "#059669"
};

type DateValue = {
  start?: string | null;
  end?: string | null;
};

type NotionPage = {
  id: string;
  url: string;
  properties: Record<string, unknown>;
};

function isDateOnly(value: string): boolean {
  return value.length === 10;
}

function toExclusiveEnd(dateValue: string): string {
  if (!isDateOnly(dateValue)) return dateValue;
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function getDateProperty(page: NotionPage, propName: string): DateValue {
  const prop = page.properties[propName] as { type?: string; date?: DateValue } | undefined;
  if (!prop || prop.type !== "date" || !prop.date) return {};
  return prop.date;
}

function resolveRangeDate(
  page: NotionPage,
  opts: {
    rangePropName: string;
    legacyStartPropName?: string;
    legacyEndPropName?: string;
  }
): { start?: string; end?: string } {
  const range = getDateProperty(page, opts.rangePropName);
  if (range.start) {
    return {
      start: range.start ?? undefined,
      end: range.end ?? undefined
    };
  }

  const legacyStart = opts.legacyStartPropName
    ? getDateProperty(page, opts.legacyStartPropName)
    : {};
  const legacyEnd = opts.legacyEndPropName ? getDateProperty(page, opts.legacyEndPropName) : {};

  const start = legacyStart.start ?? legacyEnd.start ?? undefined;
  const end = legacyEnd.end ?? legacyEnd.start ?? undefined;

  return { start, end };
}

function getRichText(prop: unknown): string | undefined {
  const casted = prop as
    | {
        type?: string;
        rich_text?: Array<{ plain_text?: string }>;
      }
    | undefined;
  if (!casted || casted.type !== "rich_text") return undefined;
  return casted.rich_text?.map((r) => r.plain_text ?? "").join("").trim() || undefined;
}

function getTitle(page: NotionPage, preferredKey: string): string {
  const preferred = page.properties[preferredKey] as
    | {
        type?: string;
        title?: Array<{ plain_text?: string }>;
      }
    | undefined;
  if (preferred?.type === "title") {
    const value = preferred.title?.map((v) => v.plain_text ?? "").join("").trim();
    if (value) return value;
  }

  for (const property of Object.values(page.properties)) {
    const titleProp = property as { type?: string; title?: Array<{ plain_text?: string }> };
    if (titleProp?.type === "title") {
      const value = titleProp.title?.map((v) => v.plain_text ?? "").join("").trim();
      if (value) return value;
    }
  }

  return "Untitled";
}

async function queryAllPages(notion: Client, databaseId: string): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;

  do {
    const response = (await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100
    })) as {
      results: Array<Record<string, unknown>>;
      has_more: boolean;
      next_cursor: string | null;
    };

    for (const raw of response.results) {
      if ("properties" in raw && "id" in raw && "url" in raw) {
        pages.push(raw as unknown as NotionPage);
      }
    }

    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return pages;
}

function buildIssueEvents(pages: NotionPage[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const page of pages) {
    const due = getDateProperty(page, "Due Date");
    if (!due.start) continue;

    const issueKey = getRichText(page.properties["Issue Key"]);
    const baseTitle = getTitle(page, "Title");
    const title = issueKey ? `[Issue] ${issueKey} ${baseTitle}` : `[Issue] ${baseTitle}`;
    const allDay = isDateOnly(due.start);

    events.push({
      id: `issue-${page.id}`,
      title,
      start: due.start,
      end: due.end ? (allDay ? toExclusiveEnd(due.end) : due.end) : undefined,
      allDay,
      source: "issue",
      notionUrl: page.url,
      color: SOURCE_COLORS.issue
    });
  }
  return events;
}

function buildSprintEvents(pages: NotionPage[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const page of pages) {
    const { start, end } = resolveRangeDate(page, {
      rangePropName: "기간",
      legacyStartPropName: "Start Date",
      legacyEndPropName: "End Date"
    });
    if (!start && !end) continue;

    const normalizedStart = start ?? end;
    if (!normalizedStart) continue;
    const allDay = isDateOnly(normalizedStart);
    const normalizedEnd = end ? (allDay ? toExclusiveEnd(end) : end) : undefined;

    events.push({
      id: `sprint-${page.id}`,
      title: `[Sprint] ${getTitle(page, "Name")}`,
      start: normalizedStart,
      end: normalizedEnd,
      allDay,
      source: "sprint",
      notionUrl: page.url,
      color: SOURCE_COLORS.sprint
    });
  }
  return events;
}

function buildReleaseEvents(pages: NotionPage[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const page of pages) {
    const releaseDate = getDateProperty(page, "Release Date").start;
    if (!releaseDate) continue;

    events.push({
      id: `release-${page.id}`,
      title: `[Release] ${getTitle(page, "Version")}`,
      start: releaseDate,
      allDay: isDateOnly(releaseDate),
      source: "release",
      notionUrl: page.url,
      color: SOURCE_COLORS.release
    });
  }
  return events;
}

function buildProjectEvents(pages: NotionPage[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const page of pages) {
    const { start, end: target } = resolveRangeDate(page, {
      rangePropName: "기간",
      legacyStartPropName: "Start Date",
      legacyEndPropName: "Target Date"
    });
    if (!start && !target) continue;

    const normalizedStart = start ?? target;
    if (!normalizedStart) continue;
    const allDay = isDateOnly(normalizedStart);
    const end = target ? (allDay ? toExclusiveEnd(target) : target) : undefined;

    events.push({
      id: `project-${page.id}`,
      title: `[Project] ${getTitle(page, "Name")}`,
      start: normalizedStart,
      end,
      allDay,
      source: "project",
      notionUrl: page.url,
      color: SOURCE_COLORS.project
    });
  }
  return events;
}

export async function fetchCalendarEvents(params: {
  accessToken: string;
  projectsDbId: string;
  issuesDbId: string;
  sprintsDbId: string;
  releasesDbId: string;
}): Promise<CalendarEvent[]> {
  const notion = new Client({ auth: params.accessToken });

  const [projectPages, issuePages, sprintPages, releasePages] = await Promise.all([
    queryAllPages(notion, params.projectsDbId),
    queryAllPages(notion, params.issuesDbId),
    queryAllPages(notion, params.sprintsDbId),
    queryAllPages(notion, params.releasesDbId)
  ]);

  return [
    ...buildProjectEvents(projectPages),
    ...buildIssueEvents(issuePages),
    ...buildSprintEvents(sprintPages),
    ...buildReleaseEvents(releasePages)
  ].sort((a, b) => a.start.localeCompare(b.start));
}
