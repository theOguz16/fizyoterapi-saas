import { describe, expect, it } from "vitest";
import { buildRoleActionHref, getRoleAction, ROLE_ACTIONS } from "@/lib/role-actions";

describe("role actions", () => {
  it("keeps every action route and label usable", () => {
    for (const action of Object.values(ROLE_ACTIONS)) {
      expect(action.label.trim()).not.toBe("");
      expect(action.description.trim()).not.toBe("");
      expect(action.route.startsWith("/(")).toBe(true);
    }
  });

  it("adds an explicit return route when requested", () => {
    expect(buildRoleActionHref("ADMIN_SALON", "/(admin)/profile")).toEqual({
      pathname: "/(admin)/salon",
      params: { backTo: "/(admin)/profile" },
    });
    expect(getRoleAction("TRAINER_GROUP_CLASSES").route).toBe("/(trainer)/group-classes");
  });
});
