import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_PUSH_SCENARIOS = ["ADMIN", "TRAINER", "MEMBER"].flatMap((role) =>
  ["foreground", "background", "terminated"].map((appState) => ({ role, appState }))
);

function isNonEmptyFile(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile() && fs.statSync(filePath).size > 0;
}

function resolveArtifact(evidencePath, artifactPath) {
  return path.resolve(path.dirname(evidencePath), artifactPath);
}

function validateArtifact(evidencePath, value, label, failures) {
  if (typeof value !== "string" || !value.trim()) {
    failures.push(`${label}: dosya yolu eksik`);
    return null;
  }
  const direct = path.resolve(process.cwd(), value);
  const adjacent = resolveArtifact(evidencePath, value);
  const resolved = isNonEmptyFile(direct) ? direct : adjacent;
  if (!isNonEmptyFile(resolved)) failures.push(`${label}: kanıt dosyası bulunamadı veya boş (${value})`);
  return resolved;
}

function validateScreenshot(evidencePath, value, label, failures) {
  const filePath = validateArtifact(evidencePath, value, label, failures);
  if (!filePath || !isNonEmptyFile(filePath)) return filePath;
  const header = fs.readFileSync(filePath).subarray(0, 8);
  const isPng = header.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  if (!isPng && !isJpeg) failures.push(`${label}: PNG veya JPEG ekran görüntüsü değil`);
  return filePath;
}

function readJsonArtifact(filePath, label, failures) {
  if (!filePath || !isNonEmptyFile(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    failures.push(`${label}: geçerli JSON değil`);
    return null;
  }
}

export function validatePushEvidence(evidence, options) {
  const failures = [];
  const evidencePath = options.evidencePath;
  if (!evidence || typeof evidence !== "object") return ["Kanıt JSON nesnesi olmalıdır."];
  if (evidence.schemaVersion !== 1) failures.push("schemaVersion 1 olmalıdır.");
  if (!evidence.build) failures.push("build eksik");
  if (options.expectedBuild && evidence.build !== options.expectedBuild) {
    failures.push(`build uyuşmuyor (${evidence.build} != ${options.expectedBuild})`);
  }
  if (!["testflight", "production-like"].includes(String(evidence.environment || "").toLowerCase())) {
    failures.push("environment testflight veya production-like olmalıdır.");
  }
  const testedAt = new Date(evidence.testedAt);
  if (!Number.isFinite(testedAt.getTime())) failures.push("testedAt geçerli tarih olmalıdır.");
  else if (testedAt.getTime() - Date.now() > 15 * 60 * 1000) failures.push("testedAt gelecekte olamaz");
  else if (Date.now() - testedAt.getTime() > Number(options.maxAgeHours || 72) * 60 * 60 * 1000) {
    failures.push(`kanıt ${options.maxAgeHours || 72} saatten eski`);
  }
  if (evidence.device?.platform !== "ios" || evidence.device?.physical !== true) {
    failures.push("iOS fiziksel cihaz kanıtı zorunludur; simülatör kabul edilmez.");
  }
  for (const field of ["id", "model", "osVersion"]) {
    if (!String(evidence.device?.[field] || "").trim()) failures.push(`device.${field} eksik`);
  }
  if (/simulator/i.test(`${evidence.device?.id || ""} ${evidence.device?.model || ""}`)) {
    failures.push("cihaz bilgisi simülatör olarak işaretlenmiş");
  }

  if (evidence.permissionDenied?.status !== "passed") failures.push("izin reddi senaryosu geçmemiş");
  validateScreenshot(evidencePath, evidence.permissionDenied?.screenshot, "izin reddi screenshot", failures);
  validateArtifact(evidencePath, evidence.permissionDenied?.maestroLog, "izin reddi Maestro log", failures);

  const registrationProofByRole = new Map();
  for (const role of ["ADMIN", "TRAINER", "MEMBER"]) {
    const registration = evidence.tokenRegistration?.[role];
    if (registration?.status !== "registered") failures.push(`${role}: token kaydı doğrulanmamış`);
    validateScreenshot(evidencePath, registration?.screenshot, `${role}: token screenshot`, failures);
    const registrationLogPath = validateArtifact(evidencePath, registration?.serverLog, `${role}: token server log`, failures);
    const registrationProof = readJsonArtifact(registrationLogPath, `${role}: token server log`, failures);
    if (registrationProof && (
      registrationProof.role !== role ||
      registrationProof.status !== "registered" ||
      registrationProof.isActive !== true ||
      !String(registrationProof.tokenSuffix || "").trim() ||
      !Number.isFinite(new Date(registrationProof.checkedAt).getTime())
    )) {
      failures.push(`${role}: backend token kayıt kanıtı geçersiz`);
    } else if (registrationProof) {
      const checkedAt = new Date(registrationProof.checkedAt).getTime();
      const maxAgeMs = Number(options.maxAgeHours || 72) * 60 * 60 * 1000;
      if (checkedAt - Date.now() > 15 * 60 * 1000 || Date.now() - checkedAt > maxAgeMs) {
        failures.push(`${role}: backend token kayıt kanıtı güncel değil`);
      }
      registrationProofByRole.set(role, registrationProof);
    }
  }

  const scenarios = Array.isArray(evidence.scenarios) ? evidence.scenarios : [];
  for (const required of REQUIRED_PUSH_SCENARIOS) {
    const scenario = scenarios.find((row) => row?.role === required.role && row?.appState === required.appState);
    const label = `${required.role}/${required.appState}`;
    if (!scenario) {
      failures.push(`${label}: senaryo eksik`);
      continue;
    }
    if (scenario.appResult !== "passed") failures.push(`${label}: push tıklama/hedef ekran başarısız`);
    validateScreenshot(evidencePath, scenario.screenshot, `${label}: screenshot`, failures);
    validateArtifact(evidencePath, scenario.maestroLog, `${label}: Maestro log`, failures);
    const ticketPath = validateArtifact(evidencePath, scenario.providerTicket, `${label}: Expo ticket`, failures);
    const receiptPath = validateArtifact(evidencePath, scenario.providerReceipt, `${label}: Expo receipt`, failures);
    const ticket = readJsonArtifact(ticketPath, `${label}: Expo ticket`, failures);
    const receipt = readJsonArtifact(receiptPath, `${label}: Expo receipt`, failures);
    if (ticket && (ticket.provider !== "EXPO" || ticket.providerTicketStatus !== "ok" || !ticket.ticketId || !ticket.token)) {
      failures.push(`${label}: Expo ticket kabul edilmemiş`);
    }
    const tokenSuffix = String(registrationProofByRole.get(required.role)?.tokenSuffix || "").replace(/^\.+/, "");
    if (ticket?.token && tokenSuffix && !String(ticket.token).endsWith(tokenSuffix)) {
      failures.push(`${label}: teslim edilen token backend kayıt kanıtıyla eşleşmiyor`);
    }
    if (receipt && (receipt.provider !== "EXPO" || receipt.receipt?.status !== "ok" || receipt.ticketId !== ticket?.ticketId)) {
      failures.push(`${label}: Expo/APNs teslim receipt'i doğrulanmamış`);
    }
  }
  return failures;
}

export function validatePushEvidenceFile(evidenceFile, options = {}) {
  const evidencePath = path.resolve(process.cwd(), evidenceFile);
  if (!isNonEmptyFile(evidencePath)) throw new Error(`Push kanıtı bulunamadı: ${evidencePath}`);
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  const failures = validatePushEvidence(evidence, { ...options, evidencePath });
  if (failures.length) throw new Error(`Gerçek cihaz push kanıtı geçmedi:\n- ${failures.join("\n- ")}`);
  return evidence;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const evidenceFile = process.env.PUSH_RELEASE_EVIDENCE;
  if (!evidenceFile) throw new Error("PUSH_RELEASE_EVIDENCE ile push-release-evidence.json dosyasını belirtin.");
  const expectedBuild = process.env.PUSH_RELEASE_BUILD;
  if (!expectedBuild) throw new Error("PUSH_RELEASE_BUILD ile doğrulanacak TestFlight build numarasını belirtin.");
  const evidence = validatePushEvidenceFile(evidenceFile, {
    expectedBuild,
    maxAgeHours: Number(process.env.PUSH_RELEASE_MAX_AGE_HOURS || 72),
  });
  console.log(JSON.stringify({
    status: "passed",
    build: evidence.build,
    testedAt: evidence.testedAt,
    device: evidence.device,
    scenarios: evidence.scenarios.length,
  }, null, 2));
}
