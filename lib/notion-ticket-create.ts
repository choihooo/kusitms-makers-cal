import { Client } from "@notionhq/client";

type TicketType = "Epic" | "Story" | "Issue";

type CreateTicketInput = {
  type: TicketType;
  title: string;
  globalId: string;
  status?: string;
  priority?: string;
  description?: string;
  assigneeIds?: string[];
  projectIds?: string[];
  sprintIds?: string[];
  parentIds?: string[];
  dueDateStart?: string;
  dueDateEnd?: string;
};

type DatabaseProperty = {
  type?: string;
  name?: string;
  select?: { options?: Array<{ name: string }> };
};

type DatabaseProperties = Record<string, DatabaseProperty>;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function getNotionClient(): Client {
  return new Client({ auth: required("NOTION_TOKEN") });
}

function resolveDatabaseId(type: TicketType): string {
  const typedMap: Record<TicketType, string | undefined> = {
    Epic: process.env.NOTION_EPICS_DB_ID,
    Story: process.env.NOTION_STORIES_DB_ID,
    Issue: process.env.NOTION_ISSUES_DB_ID
  };

  const typedDbId = typedMap[type];
  if (typedDbId) return typedDbId;

  return required("NOTION_ISSUES_DB_ID");
}

function findTitlePropertyName(properties: DatabaseProperties): string {
  for (const [name, property] of Object.entries(properties)) {
    if (property.type === "title") return name;
  }
  throw new Error("Target database does not have a title property.");
}

function firstExistingProperty(properties: DatabaseProperties, candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    if (properties[candidate]) return candidate;
  }
  return undefined;
}

function canUseSelectOption(
  properties: DatabaseProperties,
  propertyName: string,
  optionName: string
): boolean {
  const prop = properties[propertyName];
  if (!prop || prop.type !== "select") return false;
  const options = prop.select?.options ?? [];
  return options.some((option) => option.name === optionName);
}

export async function createNotionTicket(input: CreateTicketInput): Promise<{
  id: string;
  url: string;
  databaseId: string;
}> {
  const notion = getNotionClient();
  const databaseId = resolveDatabaseId(input.type);
  const database = (await notion.databases.retrieve({
    database_id: databaseId
  })) as { properties?: DatabaseProperties };

  const propertiesSchema = database.properties ?? {};
  const titleProperty = findTitlePropertyName(propertiesSchema);
  const properties: Record<string, unknown> = {
    [titleProperty]: {
      title: [{ type: "text", text: { content: `[${input.globalId}] ${input.title}` } }]
    }
  };

  const globalIdProperty = firstExistingProperty(propertiesSchema, ["Global ID", "글로벌 ID", "표시용 ID"]);
  if (globalIdProperty && propertiesSchema[globalIdProperty]?.type === "rich_text") {
    properties[globalIdProperty] = {
      rich_text: [{ type: "text", text: { content: input.globalId } }]
    };
  }

  if (input.description) {
    const descriptionProperty = firstExistingProperty(propertiesSchema, ["Description", "설명"]);
    if (descriptionProperty && propertiesSchema[descriptionProperty]?.type === "rich_text") {
      properties[descriptionProperty] = {
        rich_text: [{ type: "text", text: { content: input.description } }]
      };
    }
  }

  if (input.status && canUseSelectOption(propertiesSchema, "Status", input.status)) {
    properties.Status = { select: { name: input.status } };
  }
  if (input.priority && canUseSelectOption(propertiesSchema, "Priority", input.priority)) {
    properties.Priority = { select: { name: input.priority } };
  }
  if (canUseSelectOption(propertiesSchema, "Type", input.type)) {
    properties.Type = { select: { name: input.type } };
  }

  if (input.assigneeIds?.length && propertiesSchema.Assignee?.type === "people") {
    properties.Assignee = { people: input.assigneeIds.map((id) => ({ id })) };
  }
  if (input.projectIds?.length && propertiesSchema.Project?.type === "relation") {
    properties.Project = { relation: input.projectIds.map((id) => ({ id })) };
  }
  if (input.sprintIds?.length && propertiesSchema.Sprint?.type === "relation") {
    properties.Sprint = { relation: input.sprintIds.map((id) => ({ id })) };
  }

  if (input.parentIds?.length) {
    const parentCandidates = ["Parent Issue"];
    if (input.type === "Story") parentCandidates.unshift("Epic");
    if (input.type === "Issue") parentCandidates.unshift("Story");
    const parentProperty = firstExistingProperty(propertiesSchema, parentCandidates);

    if (parentProperty && propertiesSchema[parentProperty]?.type === "relation") {
      properties[parentProperty] = { relation: input.parentIds.map((id) => ({ id })) };
    }
  }

  const dueDateProperty = firstExistingProperty(propertiesSchema, ["Due Date", "기간"]);
  if (dueDateProperty && propertiesSchema[dueDateProperty]?.type === "date" && input.dueDateStart) {
    properties[dueDateProperty] = {
      date: {
        start: input.dueDateStart,
        end: input.dueDateEnd ?? null
      }
    };
  }

  const created = (await notion.pages.create({
    parent: { database_id: databaseId },
    properties: properties as never
  })) as { id: string; url: string };

  return {
    id: created.id,
    url: created.url,
    databaseId
  };
}
