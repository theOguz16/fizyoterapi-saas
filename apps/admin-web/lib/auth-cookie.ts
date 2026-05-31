const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export function buildAuthCookieOptions(maxAge = COOKIE_MAX_AGE) {
  const secure = process.env.NODE_ENV === "production";
  const domain = process.env.AUTH_COOKIE_DOMAIN?.trim();

  return {
    httpOnly: true,
    secure,
    sameSite: secure ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge,
    ...(domain ? { domain } : {}),
  };
}
