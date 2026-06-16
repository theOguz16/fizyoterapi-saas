import { describe, expect, it } from "vitest";
import { adminClinicRoutes } from "../routes/admin/clinic.route";
import { adminRevenueRoutes } from "../routes/admin/revenue.route";
import { memberGroupClassesRoutes } from "../routes/member/group-classes.route";
import { mobileNotificationPreferencesRoutes } from "../routes/mobile/notification-preferences.route";
import { trainerBookingsRoutes } from "../routes/trainer/booking.route";

function routeSignatures(router: any) {
  return router.stack
    .filter((layer: any) => layer.route)
    .flatMap((layer: any) => Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${layer.route.path}`));
}

describe("phase four API contracts", () => {
  it("keeps critical mobile roadmap endpoints registered", () => {
    expect(routeSignatures(adminClinicRoutes)).toContain("GET /subscription/history");
    expect(routeSignatures(adminClinicRoutes)).toContain("POST /subscription/sync");
    expect(routeSignatures(adminRevenueRoutes)).toEqual(expect.arrayContaining(["GET /report", "GET /export.csv"]));
    expect(routeSignatures(mobileNotificationPreferencesRoutes)).toEqual(expect.arrayContaining(["GET /", "PUT /"]));
    expect(routeSignatures(memberGroupClassesRoutes)).toEqual(expect.arrayContaining(["GET /:id/waitlist", "POST /:id/waitlist", "DELETE /:id/waitlist"]));
    expect(routeSignatures(trainerBookingsRoutes)).toEqual(expect.arrayContaining(["GET /schedule-change-requests", "POST /bulk-notifications", "POST /:id/schedule-change-request"]));
  });
});
