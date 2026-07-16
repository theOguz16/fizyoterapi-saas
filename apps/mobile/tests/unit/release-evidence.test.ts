import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { REQUIRED_CRITICAL_FLOWS, validateReleaseEvidence } from "../../../../scripts/validate-release-evidence.mjs";

const temporaryDirectories: string[] = [];

function createFixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fizyoflow-release-evidence-"));
  temporaryDirectories.push(directory);
  const artifact = (name: string) => {
    fs.writeFileSync(path.join(directory, name), "verified evidence", "utf8");
    return name;
  };
  const builds = {
    ios: { id: "ios-build-id", status: "finished", profile: "production", easBuildUrl: "https://expo.dev/accounts/fizyoflow/projects/mobile/builds/ios-build-id", buildNumber: "45" },
    android: { id: "android-build-id", status: "finished", profile: "production", easBuildUrl: "https://expo.dev/accounts/fizyoflow/projects/mobile/builds/android-build-id", versionCode: "45" },
  };
  const platformEvidence = (prefix: string) => ({
    ios: { status: "passed", artifact: artifact(`${prefix}-ios.log`) },
    android: { status: "passed", artifact: artifact(`${prefix}-android.log`) },
  });
  return {
    directory,
    evidence: {
      schemaVersion: 1,
      release: { gitSha: "abcdef1234567", version: "1.2.3" },
      webSmoke: { status: "passed", url: "https://fizyoflow.com", artifact: artifact("web-smoke.log") },
      builds,
      maestro: Object.fromEntries(["ios", "android"].map((platform) => [
        platform,
        REQUIRED_CRITICAL_FLOWS.map((id) => ({ id, status: "passed", buildId: builds[platform as "ios" | "android"].id, artifact: artifact(`${platform}-${id}.log`) })),
      ])),
      deepLink: platformEvidence("deep-link"),
      qr: platformEvidence("qr"),
      revenueCat: {
        ios: { status: "passed", sandboxTransactionId: "ios-transaction", artifact: artifact("revenuecat-ios.log") },
        android: { status: "passed", sandboxTransactionId: "android-transaction", artifact: artifact("revenuecat-android.log") },
      },
      push: { status: "passed", buildId: builds.ios.id, evidenceFile: artifact("push-evidence.json") },
    },
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("unified release evidence gate", () => {
  it("accepts complete web, EAS, device and commerce evidence", () => {
    const fixture = createFixture();
    expect(validateReleaseEvidence(fixture.evidence, { evidencePath: path.join(fixture.directory, "release.json") })).toEqual([]);
  });

  it("keeps build, Maestro, push, deep-link, QR and RevenueCat failures distinct", () => {
    const fixture = createFixture();
    fixture.evidence.builds.android.status = "queued";
    fixture.evidence.maestro.android.pop();
    fixture.evidence.deepLink.ios.status = "pending";
    fixture.evidence.qr.android.artifact = "";
    fixture.evidence.revenueCat.ios.sandboxTransactionId = "";
    fixture.evidence.push.buildId = "another-build";

    const failures = validateReleaseEvidence(fixture.evidence, { evidencePath: path.join(fixture.directory, "release.json") });

    expect(failures).toEqual(expect.arrayContaining([
      expect.stringContaining("builds.android.status"),
      expect.stringContaining("maestro.android.member-bookings-smoke"),
      expect.stringContaining("deepLink.ios"),
      expect.stringContaining("qr.android.artifact"),
      expect.stringContaining("revenueCat.ios.sandboxTransactionId"),
      expect.stringContaining("push.buildId"),
    ]));
  });
});
