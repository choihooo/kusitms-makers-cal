import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { getNotionOAuthEnv } from "@/lib/notion-env";

type TokenResponse = {
  access_token?: string;
};

function redirectWithError(request: NextRequest, code: string) {
  const url = new URL("/calendar", request.url);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const env = getNotionOAuthEnv();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const savedState = request.cookies.get("notion_oauth_state")?.value;

  if (!code || !state || !savedState || state !== savedState) {
    return redirectWithError(request, "invalid_state");
  }

  const basicAuth = Buffer.from(`${env.clientId}:${env.clientSecret}`).toString("base64");
  const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: env.redirectUri
    })
  });

  if (!tokenResponse.ok) {
    return redirectWithError(request, "oauth_failed");
  }

  const tokenPayload = (await tokenResponse.json()) as TokenResponse;
  if (!tokenPayload.access_token) {
    return redirectWithError(request, "missing_token");
  }

  const redirectUrl = new URL("/calendar", request.url);
  redirectUrl.searchParams.set("connected", "1");

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set("notion_access_token", tokenPayload.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
  response.cookies.delete("notion_oauth_state");

  return response;
}
