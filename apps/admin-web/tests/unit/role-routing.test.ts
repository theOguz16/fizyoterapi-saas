import { describe, expect, it } from "vitest";
import { resolveGuardRedirect, resolveRoleHome } from "@/lib/role-routing";

describe("role routing", () => {
  it("resolves the correct landing page for admin and trainer roles", () => {
    expect(resolveRoleHome("ADMIN")).toBe("/dashboard");
    expect(resolveRoleHome("TRAINER")).toBe("/trainer/today");
  });

  it("returns null for unsupported panel roles", () => {
    expect(resolveRoleHome("MEMBER")).toBeNull();
  });

  it("redirects anonymous users to login", () => {
    expect(resolveGuardRedirect(undefined, "ADMIN")).toBe("/login");
  });

  it("keeps authorized users on the requested surface", () => {
    expect(resolveGuardRedirect("TRAINER", "TRAINER")).toBeNull();
  });

  it("sends mismatched roles to their own home surface", () => {
    expect(resolveGuardRedirect("ADMIN", "TRAINER")).toBe("/dashboard");
    expect(resolveGuardRedirect("MEMBER", "TRAINER")).toBe("/login");
  });
});
