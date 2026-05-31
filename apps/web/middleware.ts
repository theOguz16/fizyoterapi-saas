import { NextRequest, NextResponse } from "next/server";
import { resolveMiddlewareRoute } from "./lib/middleware-routing";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.fizyoflow.com";

function getHostname(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host") || "";
  return host.split(":")[0].toLowerCase();
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = getHostname(request);
  const decision = resolveMiddlewareRoute({ hostname, pathname });
  if (decision.type === "redirect") {
    const target = new URL(APP_URL);
    target.pathname = decision.pathname;
    target.search = request.nextUrl.search;
    return NextResponse.redirect(target);
  }

  if (decision.type === "next") {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = decision.pathname;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
