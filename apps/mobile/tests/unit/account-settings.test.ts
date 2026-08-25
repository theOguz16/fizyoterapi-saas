import { describe, expect, it } from "vitest";
import { getAccountActionsForRole, getProfileRouteForRole } from "@/lib/account-settings";
import { buildRoleActionHref } from "@/lib/role-actions";

describe("account settings", () => {
  it("shows leave-salon only to members", () => {
    expect(getAccountActionsForRole("MEMBER").map((item) => item.id)).toContain("LEAVE_SALON");
    expect(getAccountActionsForRole("ADMIN").map((item) => item.id)).not.toContain("LEAVE_SALON");
    expect(getAccountActionsForRole("TRAINER").map((item) => item.id)).not.toContain("LEAVE_SALON");
  });

  it("does not classify logout as destructive", () => {
    const logout = getAccountActionsForRole("MEMBER").find((item) => item.id === "LOGOUT");
    expect(logout?.destructive).toBe(false);
  });

  it("builds role profile and shared return routes", () => {
    expect(getProfileRouteForRole("ADMIN")).toBe("/(admin)/profile");
    expect(getProfileRouteForRole("TRAINER")).toBe("/(trainer)/profile");
    expect(getProfileRouteForRole("MEMBER")).toBe("/(member)/profile");
    expect(buildRoleActionHref("SHARED_ACCOUNT_SETTINGS", "/(member)/profile")).toEqual({
      pathname: "/(shared)/account-settings",
      params: { backTo: "/(member)/profile" },
    });
  });
});
