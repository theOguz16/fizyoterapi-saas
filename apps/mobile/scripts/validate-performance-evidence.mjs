import fs from "node:fs";
import path from "node:path";

const budgets = {
  coldStartMs: 3000,
  warmStartMs: 1500,
  listScrollFps: 55,
  droppedFramePercent: 5,
};

const evidencePath = process.env.MOBILE_PERFORMANCE_EVIDENCE;
const requestedPlatforms = (process.env.MOBILE_PERFORMANCE_PLATFORMS || "ios")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

if (!evidencePath) {
  throw new Error("MOBILE_PERFORMANCE_EVIDENCE ile gerçek cihaz ölçüm JSON dosyasını belirtin.");
}

const absoluteEvidencePath = path.resolve(process.cwd(), evidencePath);
if (!fs.existsSync(absoluteEvidencePath)) {
  throw new Error(`Mobil performans kanıtı bulunamadı: ${absoluteEvidencePath}`);
}

let evidence;
try {
  evidence = JSON.parse(fs.readFileSync(absoluteEvidencePath, "utf8"));
} catch {
  throw new Error("Mobil performans kanıtı geçerli JSON olmalıdır.");
}

if (!evidence || typeof evidence !== "object" || !evidence.build || !evidence.measuredAt || !evidence.platforms) {
  throw new Error("Kanıt build, measuredAt ve platforms alanlarını içermelidir.");
}

const failures = [];
for (const platform of requestedPlatforms) {
  const result = evidence.platforms[platform];
  if (!result || typeof result !== "object") {
    failures.push(`${platform}: ölçüm eksik`);
    continue;
  }

  for (const field of ["device", "osVersion", "recording", "profileArtifact"]) {
    if (typeof result[field] !== "string" || !result[field].trim()) {
      failures.push(`${platform}: ${field} eksik`);
    }
  }

  for (const [metric, limit] of Object.entries(budgets)) {
    const value = Number(result[metric]);
    const withinBudget = metric === "listScrollFps" ? value >= limit : value <= limit;
    if (!Number.isFinite(value) || !withinBudget) {
      const operator = metric === "listScrollFps" ? ">=" : "<=";
      failures.push(`${platform}: ${metric} ${value} (${operator} ${limit} olmalı)`);
    }
  }
}

if (failures.length > 0) {
  throw new Error(`Mobil performans bütçesi geçmedi:\n- ${failures.join("\n- ")}`);
}

console.log(JSON.stringify({ status: "passed", build: evidence.build, measuredAt: evidence.measuredAt, platforms: requestedPlatforms, budgets }, null, 2));
