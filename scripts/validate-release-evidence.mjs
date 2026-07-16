import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_CRITICAL_FLOWS = [
  "release-admin-login",
  "admin-package-create-smoke",
  "admin-calendar-smoke",
  "release-trainer-login",
  "trainer-manual-checkin-smoke",
  "trainer-calendar-smoke",
  "login-role-routing",
  "member-salon-qr-deeplink-smoke",
  "member-bookings-smoke",
];

const PLATFORMS = ["ios", "android"];

function isNonEmptyFile(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile() && fs.statSync(filePath).size > 0;
}

function validateArtifact(evidencePath, value, label, failures) {
  if (typeof value !== "string" || !value.trim()) {
    failures.push(`${label}: kanit dosyasi eksik`);
    return;
  }
  const direct = path.resolve(process.cwd(), value);
  const adjacent = path.resolve(path.dirname(evidencePath), value);
  if (!isNonEmptyFile(direct) && !isNonEmptyFile(adjacent)) {
    failures.push(`${label}: kanit dosyasi bulunamadi veya bos (${value})`);
  }
}

function validatePassedPlatformEvidence(evidencePath, section, label, failures, requiredFields = []) {
  for (const platform of PLATFORMS) {
    const row = section?.[platform];
    if (row?.status !== "passed") failures.push(`${label}.${platform}: status passed olmali`);
    for (const field of requiredFields) {
      if (!String(row?.[field] || "").trim()) failures.push(`${label}.${platform}.${field}: eksik`);
    }
    validateArtifact(evidencePath, row?.artifact, `${label}.${platform}.artifact`, failures);
  }
}

export function validateReleaseEvidence(evidence, options) {
  const failures = [];
  const evidencePath = options.evidencePath;
  if (!evidence || typeof evidence !== "object") return ["Release evidence JSON nesnesi olmalidir."];
  if (evidence.schemaVersion !== 1) failures.push("schemaVersion 1 olmalidir");
  if (!/^[0-9a-f]{7,40}$/i.test(String(evidence.release?.gitSha || ""))) failures.push("release.gitSha gecersiz");
  if (!String(evidence.release?.version || "").trim()) failures.push("release.version eksik");

  if (evidence.webSmoke?.status !== "passed") failures.push("webSmoke.status passed olmali");
  try {
    const webUrl = new URL(evidence.webSmoke?.url);
    if (webUrl.protocol !== "https:") failures.push("webSmoke.url https olmali");
  } catch {
    failures.push("webSmoke.url gecersiz");
  }
  validateArtifact(evidencePath, evidence.webSmoke?.artifact, "webSmoke.artifact", failures);

  for (const platform of PLATFORMS) {
    const build = evidence.builds?.[platform];
    if (build?.status !== "finished") failures.push(`builds.${platform}.status finished olmali`);
    if (build?.profile !== "production") failures.push(`builds.${platform}.profile production olmali`);
    if (!String(build?.id || "").trim()) failures.push(`builds.${platform}.id eksik`);
    const nativeVersionField = platform === "ios" ? "buildNumber" : "versionCode";
    if (!String(build?.[nativeVersionField] || "").trim()) failures.push(`builds.${platform}.${nativeVersionField} eksik`);
    try {
      const buildUrl = new URL(build?.easBuildUrl);
      if (buildUrl.protocol !== "https:" || buildUrl.hostname !== "expo.dev" || !buildUrl.pathname.includes("/builds/")) {
        failures.push(`builds.${platform}.easBuildUrl gecerli Expo build URL'si olmali`);
      }
    } catch {
      failures.push(`builds.${platform}.easBuildUrl gecersiz`);
    }

    const flows = Array.isArray(evidence.maestro?.[platform]) ? evidence.maestro[platform] : [];
    for (const flowId of REQUIRED_CRITICAL_FLOWS) {
      const flow = flows.find((candidate) => candidate?.id === flowId);
      if (!flow) {
        failures.push(`maestro.${platform}.${flowId}: eksik`);
        continue;
      }
      if (flow.status !== "passed") failures.push(`maestro.${platform}.${flowId}: status passed olmali`);
      if (flow.buildId !== build?.id) failures.push(`maestro.${platform}.${flowId}: EAS build id ile eslesmiyor`);
      validateArtifact(evidencePath, flow.artifact, `maestro.${platform}.${flowId}.artifact`, failures);
    }
  }

  validatePassedPlatformEvidence(evidencePath, evidence.deepLink, "deepLink", failures);
  validatePassedPlatformEvidence(evidencePath, evidence.qr, "qr", failures);
  validatePassedPlatformEvidence(
    evidencePath,
    evidence.revenueCat,
    "revenueCat",
    failures,
    ["sandboxTransactionId"],
  );

  if (evidence.push?.status !== "passed") failures.push("push.status passed olmali");
  if (evidence.push?.buildId !== evidence.builds?.ios?.id) failures.push("push.buildId iOS EAS build id ile eslesmiyor");
  validateArtifact(evidencePath, evidence.push?.evidenceFile, "push.evidenceFile", failures);
  return failures;
}

export function validateReleaseEvidenceFile(evidenceFile) {
  const evidencePath = path.resolve(process.cwd(), evidenceFile);
  if (!isNonEmptyFile(evidencePath)) throw new Error(`Release evidence bulunamadi: ${evidencePath}`);
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  const failures = validateReleaseEvidence(evidence, { evidencePath });
  if (failures.length) throw new Error(`Release evidence kapisi gecmedi:\n- ${failures.join("\n- ")}`);
  return evidence;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (!process.env.RELEASE_EVIDENCE) {
    throw new Error("RELEASE_EVIDENCE ile release evidence JSON dosyasini belirtin.");
  }
  const evidence = validateReleaseEvidenceFile(process.env.RELEASE_EVIDENCE);
  console.log(JSON.stringify({
    event: "release_evidence_passed",
    version: evidence.release.version,
    gitSha: evidence.release.gitSha,
    platforms: PLATFORMS,
  }));
}
