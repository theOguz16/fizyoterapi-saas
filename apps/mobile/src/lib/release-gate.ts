export const MOBILE_PERFORMANCE_BUDGETS = {
  coldStartMs: 3000,
  warmStartMs: 1500,
  listScrollFps: 55,
  droppedFramePercent: 5,
} as const;

export const PUSH_RELEASE_SCENARIOS = (["ADMIN", "TRAINER", "MEMBER"] as const).flatMap((role) =>
  (["foreground", "background", "terminated"] as const).map((appState) => ({ role, appState }))
);

export const RELEASE_CRITICAL_MOBILE_FLOWS = [
  { id: "admin-login", role: "ADMIN", kind: "login", mode: "automated", flow: "release-admin-login.yaml" },
  { id: "admin-package", role: "ADMIN", kind: "package", mode: "automated", flow: "admin-package-create-smoke.yaml" },
  { id: "admin-calendar", role: "ADMIN", kind: "booking", mode: "automated", flow: "admin-calendar-smoke.yaml" },
  { id: "trainer-login", role: "TRAINER", kind: "login", mode: "automated", flow: "release-trainer-login.yaml" },
  { id: "trainer-checkin", role: "TRAINER", kind: "checkin", mode: "automated", flow: "trainer-manual-checkin-smoke.yaml" },
  { id: "trainer-calendar", role: "TRAINER", kind: "booking", mode: "automated", flow: "trainer-calendar-smoke.yaml" },
  { id: "member-login", role: "MEMBER", kind: "login", mode: "automated", flow: "login-role-routing.yaml" },
  { id: "member-join", role: "MEMBER", kind: "join", mode: "automated", flow: "member-salon-qr-deeplink-smoke.yaml" },
  { id: "member-bookings", role: "MEMBER", kind: "booking", mode: "automated", flow: "member-bookings-smoke.yaml" },
  { id: "role-switch", role: "ADMIN", kind: "role-switch", mode: "device", flow: null },
  { id: "push-routing", role: "ALL", kind: "push", mode: "device", flow: null },
] as const;
