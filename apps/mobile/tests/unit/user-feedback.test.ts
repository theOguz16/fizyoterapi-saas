import { afterEach, describe, expect, it, vi } from "vitest";

async function loadUserFeedback() {
  vi.resetModules();
  const alert = vi.fn();
  vi.doMock("react-native", () => ({ Alert: { alert } }));
  const module = await import("@/lib/user-feedback");
  return { ...module, alert };
}

describe("committed mutation feedback", () => {
  afterEach(() => {
    vi.doUnmock("react-native");
  });

  it("keeps a committed operation successful when the session refresh fails", async () => {
    const { alert, refreshSessionAfterCommittedAction } = await loadUserFeedback();

    await expect(refreshSessionAfterCommittedAction(async () => Promise.reject(new Error("offline")), "Başvuru gönderme")).resolves.toBe(false);
    expect(alert).toHaveBeenCalledWith(
      "Başvuru gönderme tamamlandı",
      expect.stringContaining("sunucuda kaydedildi")
    );
  });

  it("does not show a warning after a successful session refresh", async () => {
    const { alert, refreshSessionAfterCommittedAction } = await loadUserFeedback();

    await expect(refreshSessionAfterCommittedAction(async () => undefined, "Klinik oluşturma")).resolves.toBe(true);
    expect(alert).not.toHaveBeenCalled();
  });
});
