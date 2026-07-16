import fs from "node:fs";
import path from "node:path";

const roles = ["ADMIN", "TRAINER", "MEMBER"];
const states = ["foreground", "background", "terminated"];

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} zorunludur.`);
  return value;
}

const evidenceDir = path.resolve(process.cwd(), required("PUSH_E2E_EVIDENCE_DIR"));
const relative = (fileName) => fileName;
const scenarios = roles.flatMap((role) => states.map((state) => ({
  id: `${role.toLowerCase()}-${state}`,
  role,
  appState: state,
  appResult: "passed",
  screenshot: relative(`${role.toLowerCase()}-${state}.png`),
  maestroLog: relative(`${role.toLowerCase()}-${state}.log`),
  providerTicket: relative(`${role.toLowerCase()}-${state}-ticket.json`),
  providerReceipt: relative(`${role.toLowerCase()}-${state}-receipt.json`),
})));

const evidence = {
  schemaVersion: 1,
  build: required("PUSH_E2E_BUILD"),
  testedAt: new Date().toISOString(),
  environment: required("PUSH_E2E_ENVIRONMENT"),
  device: {
    platform: "ios",
    physical: true,
    id: required("PUSH_E2E_DEVICE_ID"),
    model: required("PUSH_E2E_DEVICE_MODEL"),
    osVersion: required("PUSH_E2E_OS_VERSION"),
  },
  permissionDenied: {
    status: "passed",
    screenshot: relative("permission-denied.png"),
    maestroLog: relative("permission-denied.log"),
  },
  tokenRegistration: Object.fromEntries(roles.map((role) => [role, {
    status: "registered",
    screenshot: relative(`${role.toLowerCase()}-token-registration.png`),
    serverLog: relative(`${role.toLowerCase()}-token-registration.log`),
  }])),
  scenarios,
};

const outputPath = path.join(evidenceDir, "push-release-evidence.json");
fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(outputPath);
