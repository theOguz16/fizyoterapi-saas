import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validatePushEvidence } from "../../scripts/validate-push-release-evidence.mjs";

const temporaryDirectories: string[] = [];

function writeArtifact(directory: string, name: string, content = "evidence") {
  if (name.endsWith(".png")) {
    fs.writeFileSync(path.join(directory, name), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB", "base64"));
  } else {
    fs.writeFileSync(path.join(directory, name), content, "utf8");
  }
  return name;
}

function createFixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fizyoflow-push-evidence-"));
  temporaryDirectories.push(directory);
  writeArtifact(directory, "permission-denied.png");
  writeArtifact(directory, "permission-denied.log");

  const tokenRegistration: Record<string, unknown> = {};
  const scenarios: Array<Record<string, unknown>> = [];
  for (const role of ["ADMIN", "TRAINER", "MEMBER"]) {
    const lowerRole = role.toLowerCase();
    tokenRegistration[role] = {
      status: "registered",
      screenshot: writeArtifact(directory, `${lowerRole}-token.png`),
      serverLog: writeArtifact(directory, `${lowerRole}-token.log`, JSON.stringify({
        role,
        status: "registered",
        isActive: true,
        tokenSuffix: `...${lowerRole}`,
        checkedAt: new Date().toISOString(),
      })),
    };
    for (const appState of ["foreground", "background", "terminated"]) {
      const id = `${lowerRole}-${appState}`;
      const ticketId = `ticket-${id}`;
      scenarios.push({
        id,
        role,
        appState,
        appResult: "passed",
        screenshot: writeArtifact(directory, `${id}.png`),
        maestroLog: writeArtifact(directory, `${id}.log`),
        providerTicket: writeArtifact(directory, `${id}-ticket.json`, JSON.stringify({
          provider: "EXPO",
          providerTicketStatus: "ok",
          ticketId,
          token: `Exponent...${lowerRole}`,
        })),
        providerReceipt: writeArtifact(directory, `${id}-receipt.json`, JSON.stringify({
          provider: "EXPO",
          ticketId,
          receipt: { status: "ok" },
        })),
      });
    }
  }

  return {
    directory,
    evidence: {
      schemaVersion: 1,
      build: "ios-1.2.3(45)",
      testedAt: new Date().toISOString(),
      environment: "testflight",
      device: { platform: "ios", physical: true, id: "physical-id", model: "iPhone 15", osVersion: "iOS 18.6" },
      permissionDenied: { status: "passed", screenshot: "permission-denied.png", maestroLog: "permission-denied.log" },
      tokenRegistration,
      scenarios,
    },
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("push release evidence", () => {
  it("accepts fresh physical-device proof for all nine role and app-state scenarios", () => {
    const fixture = createFixture();
    expect(validatePushEvidence(fixture.evidence, {
      evidencePath: path.join(fixture.directory, "evidence.json"),
      expectedBuild: "ios-1.2.3(45)",
      maxAgeHours: 72,
    })).toEqual([]);
  });

  it("rejects simulator, missing scenario and failed provider receipt evidence", () => {
    const fixture = createFixture();
    fixture.evidence.device.physical = false;
    fixture.evidence.scenarios.pop();
    fs.writeFileSync(path.join(fixture.directory, "admin-token.log"), JSON.stringify({
      role: "ADMIN",
      status: "registered",
      isActive: false,
      tokenSuffix: "...admin",
      checkedAt: new Date().toISOString(),
    }));
    const firstReceipt = path.join(fixture.directory, String(fixture.evidence.scenarios[0].providerReceipt));
    fs.writeFileSync(firstReceipt, JSON.stringify({ provider: "EXPO", ticketId: "wrong", receipt: { status: "error" } }));

    const failures = validatePushEvidence(fixture.evidence, {
      evidencePath: path.join(fixture.directory, "evidence.json"),
      expectedBuild: "ios-1.2.3(45)",
      maxAgeHours: 72,
    });

    expect(failures).toEqual(expect.arrayContaining([
      expect.stringContaining("simülatör kabul edilmez"),
      expect.stringContaining("ADMIN: backend token kayıt kanıtı geçersiz"),
      expect.stringContaining("MEMBER/terminated: senaryo eksik"),
      expect.stringContaining("Expo/APNs teslim receipt'i doğrulanmamış"),
    ]));
  });
});
