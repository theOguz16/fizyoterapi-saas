import { describe, expect, it } from "vitest";
import { StartupConfigService } from "../services/startup-config.service";

describe("startup config service", () => {
  it("rejects production boot when required secrets are missing", () => {
    expect(() =>
      StartupConfigService.validateProductionEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://example",
        JWT_SECRET: "secretsecretsecretsecretsecret1234",
      } as NodeJS.ProcessEnv)
    ).toThrow(/FIZYOFLOW_ADMIN_SECRET/);
  });

  it("rejects unsafe production cors and db sync", () => {
    expect(() =>
      StartupConfigService.validateProductionEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://example",
        JWT_SECRET: "secretsecretsecretsecretsecret1234",
        FIZYOFLOW_ADMIN_SECRET: "internal",
        REVENUECAT_WEBHOOK_AUTH: "Bearer webhook",
        REVENUECAT_ENTITLEMENT_ID: "clinic_pro",
        MOBILE_DEEP_LINK_BASE: "fizyoflow://",
        TRUST_PROXY: "true",
        CORS_ORIGIN: "http://localhost:3000",
        DB_SYNC: "true",
      } as NodeJS.ProcessEnv)
    ).toThrow(/Unsafe production CORS_ORIGIN/);
  });

  it("accepts strict production config", () => {
    expect(() =>
      StartupConfigService.validateProductionEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://example",
        JWT_SECRET: "secretsecretsecretsecretsecret1234",
        FIZYOFLOW_ADMIN_SECRET: "internal",
        REVENUECAT_WEBHOOK_AUTH: "Bearer webhook",
        REVENUECAT_ENTITLEMENT_ID: "clinic_pro",
        MOBILE_DEEP_LINK_BASE: "fizyoflow://",
        TRUST_PROXY: "true",
        CORS_ORIGIN: "https://app.example.com,https://admin.example.com",
      } as NodeJS.ProcessEnv)
    ).not.toThrow();
  });

  it("rejects weak or shared production secrets", () => {
    expect(() =>
      StartupConfigService.validateProductionEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://example",
        JWT_SECRET: "short",
        FIZYOFLOW_ADMIN_SECRET: "short",
        REVENUECAT_WEBHOOK_AUTH: "Bearer webhook",
        REVENUECAT_ENTITLEMENT_ID: "clinic_pro",
        MOBILE_DEEP_LINK_BASE: "fizyoflow://",
        TRUST_PROXY: "true",
        CORS_ORIGIN: "https://app.example.com",
      } as NodeJS.ProcessEnv)
    ).toThrow(/JWT_SECRET/);
  });
});
