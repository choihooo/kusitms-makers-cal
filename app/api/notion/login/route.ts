import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getNotionOAuthEnv } from "@/lib/notion-env";

export async function GET() {
  const env = getNotionOAuthEnv();
  const state = randomUUID();

  const url = new URL("https://api.notion.com/v1/oauth/authorize");
  url.searchParams.set("owner", "user");
  url.searchParams.set("client_id", env.clientId);
  url.searchParams.set("redirect_uri", env.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url);
  response.cookies.set("notion_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10
  });

  return response;
}
