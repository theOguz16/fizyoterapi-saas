import { describe, expect, it } from "vitest";
import { ScriptSafetyService } from "../services/script-safety.service";

describe("script safety service", () => {
  it("blocks scripts in production", () => {
    expect(() =>
      ScriptSafetyService.assertNonProductionScript("reset-demo", {
        NODE_ENV: "production",
        DATABASE_URL: "postgres://db",
      } as NodeJS.ProcessEnv)
    ).toThrow(/cannot run/);
  });

  it("blocks production-looking database urls unless explicitly allowed", () => {
    expect(() =>
      ScriptSafetyService.assertNonProductionScript("seed", {
        NODE_ENV: "development",
        DATABASE_URL: "postgres://fitnes-production-db",
      } as NodeJS.ProcessEnv)
    ).toThrow(/production database/);
  });

  it("allows non-production scripts for local databases", () => {
    expect(() =>
      ScriptSafetyService.assertNonProductionScript("seed", {
        NODE_ENV: "development",
        DATABASE_URL: "postgres://localhost/fitnes_dev",
      } as NodeJS.ProcessEnv)
    ).not.toThrow();
  });
});
