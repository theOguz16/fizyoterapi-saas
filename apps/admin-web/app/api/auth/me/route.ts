import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getApiBase } from "@/lib/api-base";

export async function GET() {
  const accessToken = cookies().get("accessToken")?.value;

  if (!accessToken) {
    return NextResponse.json(
      {
        error: {
          code: "NO_TOKEN",
          message: "Oturum bulunamadı. Lütfen tekrar giriş yapın.",
        },
      },
      { status: 401 }
    );
  }

  const response = await fetch(`${getApiBase()}/auth/me`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: response.status });
}
