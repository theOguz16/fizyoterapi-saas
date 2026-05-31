import { NextRequest, NextResponse } from "next/server";
import { getApiBase } from "@/lib/api-base";
import { buildAuthCookieOptions } from "@/lib/auth-cookie";

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
    nextResponse.cookies.set("accessToken", accessToken, buildAuthCookieOptions());
  }

  return nextResponse;
}
