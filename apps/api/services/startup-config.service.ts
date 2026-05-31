export class StartupConfigService {
  static validateProductionEnv(env: NodeJS.ProcessEnv = process.env) {
    if (env.NODE_ENV !== "production") return;

    const missing = [
      "DATABASE_URL",
      "JWT_SECRET",
      "FIZYOFLOW_ADMIN_SECRET",
      "REVENUECAT_WEBHOOK_AUTH",
      "REVENUECAT_ENTITLEMENT_ID",
      "CORS_ORIGIN",
      "MOBILE_DEEP_LINK_BASE",
      "TRUST_PROXY",
    ].filter((key) => !String(env[key] || "").trim());
    if (missing.length > 0) {
      throw new Error(`Missing required production env: ${missing.join(", ")}`);
    }

    const jwtSecret = String(env.JWT_SECRET || "");
    if (jwtSecret.length < 32) {
      throw new Error("JWT_SECRET must be at least 32 characters in production");
    }

    if (env.FIZYOFLOW_ADMIN_SECRET === env.JWT_SECRET) {
      throw new Error("FIZYOFLOW_ADMIN_SECRET must be different from JWT_SECRET in production");
    }

    const databaseUrl = String(env.DATABASE_URL || "");
    if (!databaseUrl.startsWith("postgres://") && !databaseUrl.startsWith("postgresql://")) {
      throw new Error("DATABASE_URL must be a postgres connection URL in production");
    }

    const corsOrigins = String(env.CORS_ORIGIN || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    const unsafeOrigins = corsOrigins.filter(
      (origin) =>
        origin === "*" ||
        origin.startsWith("http://localhost") ||
        origin.startsWith("http://127.0.0.1") ||
        !origin.startsWith("https://")
    );
    if (unsafeOrigins.length > 0) {
      throw new Error(`Unsafe production CORS_ORIGIN entries: ${unsafeOrigins.join(", ")}`);
    }

    const mobileDeepLinkBase = String(env.MOBILE_DEEP_LINK_BASE || "");
    if (!mobileDeepLinkBase.startsWith("https://") && !mobileDeepLinkBase.includes("://")) {
      throw new Error("MOBILE_DEEP_LINK_BASE must be a valid URL scheme or https URL in production");
    }

    if (env.DB_SYNC === "true") {
      throw new Error("DB_SYNC=true is not allowed in production");
    }
  }
}
