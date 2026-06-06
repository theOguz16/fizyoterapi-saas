import type { MobileReleasePlatform } from "../src/lib/release-env";

const { validateMobileReleaseEnv } = require("../src/lib/release-env") as typeof import("../src/lib/release-env");
const fs = require("node:fs") as typeof import("node:fs");
const path = require("node:path") as typeof import("node:path");

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");
    process.env[key] ||= value;
  }
}

try {
  for (const fileName of [".env.production", ".env"]) {
    loadEnvFile(path.join(process.cwd(), fileName));
  }

  const easBuildPlatform = String(process.env.EAS_BUILD_PLATFORM || "").trim().toLowerCase();
  const inferredPlatform = easBuildPlatform === "ios" || easBuildPlatform === "android" ? easBuildPlatform : "all";
  const platform = (process.env.MOBILE_RELEASE_PLATFORM || inferredPlatform) as MobileReleasePlatform;
  const result = validateMobileReleaseEnv(process.env, { platform });
  console.log(JSON.stringify({ event: "mobile_release_env_passed", ...result }));
} catch (error) {
  console.error(
    JSON.stringify({
      event: "mobile_release_env_failed",
      error: error instanceof Error ? error.message : String(error),
    })
  );
  process.exitCode = 1;
}
