import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getApiBase } from "@/lib/api-base";
import { buildAuthCookieOptions } from "@/lib/auth-cookie";

function clearCookie(response: NextResponse) {
  response.cookies.set("accessToken", "", buildAuthCookieOptions(0));
}

export async function POST() {
  const accessToken = cookies().get("accessToken")?.value;

  if (accessToken) {
    try {
      await fetch(`${getApiBase()}/auth/logout`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });
    } catch {
      // local cookie cleanup is the source of truth for web auth
    }
  }

  const response = NextResponse.json({ data: true });
  clearCookie(response);
  return response;
}
