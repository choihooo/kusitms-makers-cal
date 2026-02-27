import { NextRequest, NextResponse } from "next/server";
import { getNextGlobalSequence } from "@/lib/global-counter";
import { createNotionTicket } from "@/lib/notion-ticket-create";

export const runtime = "nodejs";

type TicketType = "Epic" | "Story" | "Issue";

type CreateTicketRequest = {
  type: TicketType;
  title: string;
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

function getCounterName(): string {
  return process.env.GLOBAL_COUNTER_NAME ?? "km_ticket";
}

function validate(body: unknown): { ok: true; value: CreateTicketRequest } | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Request body must be a JSON object." };
  }

  const payload = body as Partial<CreateTicketRequest>;
  if (!payload.title || typeof payload.title !== "string") {
    return { ok: false, message: "title is required." };
  }
  if (!payload.type || !["Epic", "Story", "Issue"].includes(payload.type)) {
    return { ok: false, message: "type must be one of: Epic, Story, Issue." };
  }

  return {
    ok: true,
    value: {
      type: payload.type as TicketType,
      title: payload.title.trim(),
      status: payload.status,
      priority: payload.priority,
      description: payload.description,
      assigneeIds: payload.assigneeIds,
      projectIds: payload.projectIds,
      sprintIds: payload.sprintIds,
      parentIds: payload.parentIds,
      dueDateStart: payload.dueDateStart,
      dueDateEnd: payload.dueDateEnd
    }
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    const validation = validate(body);
    if (!validation.ok) {
      return NextResponse.json({ message: validation.message }, { status: 400 });
    }

    const nextNumber = await getNextGlobalSequence(getCounterName());
    const globalId = `KM-${nextNumber}`;

    const created = await createNotionTicket({
      ...validation.value,
      globalId
    });

    return NextResponse.json({
      globalId,
      pageId: created.id,
      pageUrl: created.url,
      databaseId: created.databaseId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 500 });
  }
}

