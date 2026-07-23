import { describe, expect, it } from "vitest";
import {
  getConnectivitySnapshot,
  markNetworkFailure,
  markNetworkSuccess,
  resetConnectivityForE2E,
} from "@/lib/connectivity";

describe("connectivity state", () => {
  it("resets the test-only connection signal after an isolated E2E flow", () => {
    markNetworkFailure("offline");
    expect(getConnectivitySnapshot()).toMatchObject({ status: "offline", message: "offline" });

    resetConnectivityForE2E();
    expect(getConnectivitySnapshot()).toMatchObject({ status: "unknown", message: null });

    markNetworkSuccess();
    expect(getConnectivitySnapshot()).toMatchObject({ status: "online", message: null });
  });
});
