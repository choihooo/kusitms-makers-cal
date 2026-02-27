import { Client } from "@notionhq/client";
import { getNextGlobalSequence } from "@/lib/global-counter";

type DatabaseProperty = {
  type?: string;
  title?: unknown;
  rich_text?: unknown;
};

type DatabaseProperties = Record<string, DatabaseProperty>;

type NotionPage = {
  id: string;
  properties: Record<string, unknown>;
};

const GLOBAL_ID_PROPERTY_CANDIDATES = ["Global ID", "글로벌 ID", "표시용 ID"];

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function getCounterName(): string {
  return process.env.GLOBAL_COUNTER_NAME ?? "km_ticket";
}

function getNotionClient(): Client {
  return new Client({ auth: required("NOTION_TOKEN") });
}

function resolveTargetDatabaseIds(): string[] {
  const raw = [
    process.env.NOTION_ISSUES_DB_ID,
    process.env.NOTION_STORIES_DB_ID,
    process.env.NOTION_EPICS_DB_ID
  ].filter((value): value is string => Boolean(value && value.trim()));

  if (raw.length === 0) {
    throw new Error("Missing required env: NOTION_ISSUES_DB_ID");
  }

  return [...new Set(raw)];
}

function findTitlePropertyName(properties: DatabaseProperties): string {
  for (const [name, property] of Object.entries(properties)) {
    if (property.type === "title") return name;
  }
  throw new Error("Target database does not have a title property.");
}

function findGlobalIdPropertyName(properties: DatabaseProperties): string | undefined {
  for (const candidate of GLOBAL_ID_PROPERTY_CANDIDATES) {
    if (properties[candidate]?.type === "rich_text") return candidate;
  }
  return undefined;
}

function extractTitleText(value: unknown): string {
  const prop = value as { type?: string; title?: Array<{ plain_text?: string }> } | undefined;
  if (!prop || prop.type !== "title") return "";
  return (prop.title ?? []).map((item) => item.plain_text ?? "").join("").trim();
}

function extractRichText(value: unknown): string {
  const prop = value as { type?: string; rich_text?: Array<{ plain_text?: string }> } | undefined;
  if (!prop || prop.type !== "rich_text") return "";
  return (prop.rich_text ?? []).map((item) => item.plain_text ?? "").join("").trim();
}

function readGlobalIdFromTitle(title: string): string | undefined {
  const match = title.match(/^\[(KM-\d+)\]\s*/);
  return match?.[1];
}

function readGlobalIdFromText(text: string): string | undefined {
  const match = text.match(/\b(KM-\d+)\b/);
  return match?.[1];
}

function prefixTitle(globalId: string, rawTitle: string): string {
  const title = rawTitle.trim() || "Untitled";
  return `[${globalId}] ${title}`;
}

function hasAnyPropertyValue(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length > 0;
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
      if ("id" in raw && "properties" in raw) {
        pages.push(raw as unknown as NotionPage);
      }
    }

    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return pages;
}

export type SyncNotionGlobalIdsResult = {
  scanned: number;
  assigned: number;
  backfilled: number;
  databaseCount: number;
  processedDatabaseIds: string[];
};

export async function syncNotionGlobalIds(options?: {
  limitPerDatabase?: number;
}): Promise<SyncNotionGlobalIdsResult> {
  const notion = getNotionClient();
  const databaseIds = resolveTargetDatabaseIds();

  let scanned = 0;
  let assigned = 0;
  let backfilled = 0;

  for (const databaseId of databaseIds) {
    const database = (await notion.databases.retrieve({
      database_id: databaseId
    })) as { properties?: DatabaseProperties };

    const schema = database.properties ?? {};
    const titleProperty = findTitlePropertyName(schema);
    const globalIdProperty = findGlobalIdPropertyName(schema);
    const allPages = await queryAllPages(notion, databaseId);
    const pages =
      options?.limitPerDatabase && options.limitPerDatabase > 0
        ? allPages.slice(0, options.limitPerDatabase)
        : allPages;

    scanned += pages.length;

    for (const page of pages) {
      const currentTitle = extractTitleText(page.properties[titleProperty]);
      const titleGlobalId = readGlobalIdFromTitle(currentTitle);
      const propertyGlobalId = globalIdProperty
        ? readGlobalIdFromText(extractRichText(page.properties[globalIdProperty]))
        : undefined;
      const existingGlobalId = propertyGlobalId ?? titleGlobalId;

      const updates: Record<string, unknown> = {};

      if (existingGlobalId) {
        if (titleGlobalId !== existingGlobalId) {
          updates[titleProperty] = {
            title: [{ type: "text", text: { content: prefixTitle(existingGlobalId, currentTitle) } }]
          };
        }
        if (globalIdProperty && propertyGlobalId !== existingGlobalId) {
          updates[globalIdProperty] = {
            rich_text: [{ type: "text", text: { content: existingGlobalId } }]
          };
        }

        if (hasAnyPropertyValue(updates)) {
          await notion.pages.update({
            page_id: page.id,
            properties: updates as never
          });
          backfilled += 1;
        }
        continue;
      }

      const nextNumber = await getNextGlobalSequence(getCounterName());
      const globalId = `KM-${nextNumber}`;

      updates[titleProperty] = {
        title: [{ type: "text", text: { content: prefixTitle(globalId, currentTitle) } }]
      };
      if (globalIdProperty) {
        updates[globalIdProperty] = {
          rich_text: [{ type: "text", text: { content: globalId } }]
        };
      }

      await notion.pages.update({
        page_id: page.id,
        properties: updates as never
      });
      assigned += 1;
    }
  }

  return {
    scanned,
    assigned,
    backfilled,
    databaseCount: databaseIds.length,
    processedDatabaseIds: databaseIds
  };
}
