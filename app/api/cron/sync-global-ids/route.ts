import { NextRequest, NextResponse } from "next/server";
import { syncNotionGlobalIds } from "@/lib/notion-global-id-sync";

export const runtime = "nodejs";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

function parseLimit(request: NextRequest): number | undefined {
  const raw = request.nextUrl.searchParams.get("limit");
  if (!raw) return undefined;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.floor(parsed);
}

async function handler(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncNotionGlobalIds({
      limitPerDatabase: parseLimit(request)
    });

    return NextResponse.json({
      ok: true,
      ...result,
      syncedAt: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export const GET = handler;
export const POST = handler;
