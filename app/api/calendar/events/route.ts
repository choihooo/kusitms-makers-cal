import { NextRequest, NextResponse } from "next/server";
import { getNotionEnv } from "@/lib/notion-env";
import { fetchCalendarEvents } from "@/lib/notion-events";

export async function GET(request: NextRequest) {
  const accessToken = process.env.NOTION_TOKEN ?? request.cookies.get("notion_access_token")?.value;
  if (!accessToken) {
    return NextResponse.json(
      { message: "Missing NOTION_TOKEN. Set it in .env.local." },
      { status: 401 }
    );
  }

  try {
    const env = getNotionEnv();
    const events = await fetchCalendarEvents({
      accessToken,
      projectsDbId: env.projectsDbId,
      issuesDbId: env.issuesDbId,
      sprintsDbId: env.sprintsDbId,
      releasesDbId: env.releasesDbId
    });

    return NextResponse.json({
      events,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
