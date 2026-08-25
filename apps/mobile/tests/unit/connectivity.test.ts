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
    expect(getConnectivitySnapshot()).toMatchObject({ status: "offline", isConnected: false, isInternetReachable: false, wasOffline: true, message: "offline" });

    resetConnectivityForE2E();
    expect(getConnectivitySnapshot()).toMatchObject({ status: "unknown", isConnected: true, isInternetReachable: null, wasOffline: false, reconnectedAt: null, message: null });

    markNetworkSuccess();
    expect(getConnectivitySnapshot()).toMatchObject({ status: "online", message: null });
  });

  it("records a reconnect edge so active screens can refresh exactly once", () => {
    resetConnectivityForE2E();
    markNetworkFailure();
    markNetworkSuccess();

    expect(getConnectivitySnapshot()).toMatchObject({ status: "online", wasOffline: true, isInternetReachable: true });
    expect(getConnectivitySnapshot().reconnectedAt).toEqual(expect.any(Number));
  });
});
