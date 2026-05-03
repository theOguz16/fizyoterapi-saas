import { describe, expect, it } from "vitest";
import { inviteStatusLabel, resolveInviteFormError } from "@/app/admin/invites/invite-utils";

describe("invite utils", () => {
  it("maps invite status labels", () => {
    expect(inviteStatusLabel("PENDING")).toBe("Bekliyor");
    expect(inviteStatusLabel("ACCEPTED")).toBe("Kabul Edildi");
    expect(inviteStatusLabel("CANCELED")).toBe("İptal");
    expect(inviteStatusLabel("EXPIRED")).toBe("Süresi Doldu");
  });

  it("validates invite form inputs", () => {
    expect(resolveInviteFormError("", 72)).toMatch(/zorunludur/i);
    expect(resolveInviteFormError("test@demo.local", 0)).toMatch(/büyük/i);
    expect(resolveInviteFormError("test@demo.local", 24)).toBe("");
  });
});
