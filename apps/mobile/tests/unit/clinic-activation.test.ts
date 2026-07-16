import { describe, expect, it } from "vitest";
import { getClinicActivationNextRoute, isClinicActivationFlow } from "@/lib/clinic-activation";

describe("clinic owner activation flow", () => {
  it("keeps the activation context only for an explicit activation parameter", () => {
    expect(isClinicActivationFlow("1")).toBe(true);
    expect(isClinicActivationFlow(["1"])).toBe(true);
    expect(isClinicActivationFlow("0")).toBe(false);
    expect(isClinicActivationFlow(undefined)).toBe(false);
  });

  it("orders the four activation operations before the plan decision", () => {
    expect(getClinicActivationNextRoute("clinic").pathname).toBe("/(admin)/packages");
    expect(getClinicActivationNextRoute("package").pathname).toBe("/(admin)/working-hours");
    expect(getClinicActivationNextRoute("working_hours").pathname).toBe("/(admin)/clinic-qr");
    expect(getClinicActivationNextRoute("qr").pathname).toBe("/(admin)/subscription");
  });
});
