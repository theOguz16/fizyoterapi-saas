import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getApiBase } from "@/lib/api-base";

function clearCookie(response: NextResponse) {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set("accessToken", "", {
    httpOnly: true,
    secure,
    sameSite: secure ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge: 0,
  });
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
