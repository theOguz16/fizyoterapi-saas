import { NextRequest, NextResponse } from "next/server";
import { getApiBase } from "@/lib/api-base";

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

function buildCookieOptions() {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const response = await fetch(`${getApiBase()}/auth/login`, {
    method: "POST",
    headers: {
      "content-type": request.headers.get("content-type") || "application/json",
    },
    body,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const nextResponse = NextResponse.json(payload, { status: response.status });
  const accessToken = (payload as any)?.data?.accessToken;

  if (response.ok && typeof accessToken === "string" && accessToken) {
    nextResponse.cookies.set("accessToken", accessToken, buildCookieOptions());
  }

  return nextResponse;
}
