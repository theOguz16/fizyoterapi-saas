const OFFLINE_QUERY_PREFIXES = new Set([
  "admin-dashboard",
  "admin-members-v3",
  "admin-revenue-report",
  "admin-subscription-history",
  "trainer-clients",
  "trainer-today",
  "trainer-members",
  "trainer-schedule-change-requests",
  "member-home",
  "member-attendance",
  "member-measurements",
  "member-packages",
  "member-group-classes",
]);

export function shouldPersistQueryKey(queryKey: readonly unknown[]) {
  return OFFLINE_QUERY_PREFIXES.has(String(queryKey[0] || ""));
}
