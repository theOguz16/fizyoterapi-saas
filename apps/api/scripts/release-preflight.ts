import "dotenv/config";
import { execFileSync } from "child_process";
import { StartupConfigService } from "../services/startup-config.service";
import { LoggerService } from "../services/logger.service";

type CheckResult = {
  name: string;
  ok: boolean;
  detail?: string;
};

function pass(name: string, detail?: string): CheckResult {
  return { name, ok: true, detail };
}

function fail(name: string, error: unknown): CheckResult {
  return {
    name,
    ok: false,
    detail: error instanceof Error ? error.message : String(error),
  };
}

async function checkHttp(name: string, url: string) {
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return pass(name, `${url} ok`);
}

function checkGitClean() {
  const output = execFileSync("git", ["status", "--porcelain", "--", "apps/api", "apps/mobile", "package.json", "pnpm-lock.yaml"], {
    cwd: process.cwd().includes("/apps/api") ? "../.." : process.cwd(),
    encoding: "utf8",
  });
  const dirty = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.endsWith(".tsbuildinfo"));

  if (dirty.length > 0) {
    throw new Error(`Backend/mobile release has uncommitted files:\n${dirty.join("\n")}`);
  }

  return pass("git_clean_backend_mobile");
}

async function main() {
  const checks: CheckResult[] = [];

  try {
    StartupConfigService.validateProductionEnv({ ...process.env, NODE_ENV: "production" });
    checks.push(pass("backend_production_env"));
  } catch (error) {
    checks.push(fail("backend_production_env", error));
  }

  const apiBase = String(process.env.RELEASE_API_BASE_URL || "").replace(/\/$/, "");
  if (apiBase) {
    try {
      checks.push(await checkHttp("api_live_endpoint", `${apiBase}/live`));
    } catch (error) {
      checks.push(fail("api_live_endpoint", error));
    }
    try {
      checks.push(await checkHttp("api_ready_endpoint", `${apiBase}/ready`));
    } catch (error) {
      checks.push(fail("api_ready_endpoint", error));
    }
  } else {
    checks.push(pass("api_http_smoke_skipped", "Set RELEASE_API_BASE_URL to check /live and /ready"));
  }

  if (process.env.RELEASE_CHECK_GIT === "true") {
    try {
      checks.push(checkGitClean());
    } catch (error) {
      checks.push(fail("git_clean_backend_mobile", error));
    }
  } else {
    checks.push(pass("git_clean_backend_mobile_skipped", "Set RELEASE_CHECK_GIT=true before the final release cut"));
  }

  for (const check of checks) {
    LoggerService.info(check.ok ? "release_preflight_check_passed" : "release_preflight_check_failed", check);
  }

  const failed = checks.filter((check) => !check.ok);
  if (failed.length > 0) {
    throw new Error(`Release preflight failed: ${failed.map((check) => check.name).join(", ")}`);
  }

  LoggerService.info("release_preflight_passed", { checks: checks.length });
}

main().catch((error) => {
  LoggerService.error("release_preflight_failed", error);
  process.exitCode = 1;
});
