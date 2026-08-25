import { describe, expect, it, vi } from "vitest";
import { publishInAppNotice, subscribeToInAppNotices } from "../../src/lib/in-app-notice";

describe("in-app notices", () => {
  it("publishes non-blocking success notices with a stable payload", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToInAppNotices(listener);

    publishInAppNotice("Paket oluşturuldu", "Paket listeye eklendi.");

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      title: "Paket oluşturuldu",
      message: "Paket listeye eklendi.",
      tone: "success",
      durationMs: 3600,
    }));

    unsubscribe();
  });

  it("stops publishing after the listener unsubscribes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToInAppNotices(listener);
    unsubscribe();

    publishInAppNotice("Bildirim gönderildi", "Bir üyeye teslim edildi.");

    expect(listener).not.toHaveBeenCalled();
  });
});
