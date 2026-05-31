export const RESERVED_PUBLIC_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "assets",
  "cdn",
  "mail",
  "status",
  "support",
  "www",
]);

export function isReservedPublicSlug(value: string) {
  return RESERVED_PUBLIC_SLUGS.has(value.trim().toLowerCase());
}
