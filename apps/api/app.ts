// Express uygulamasinin HTTP kabugu bu dosyada kurulur.
// Guvenlik, parse, CORS ve ana router baglantisi burada bir kez tanimlanir.
import express, { type Request } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import { appRouter } from "./routes";
import { AppDataSource } from "./data-source";
import { auditMiddleware } from "./middlewares/audit.middleware";
import { errorMiddleware } from "./middlewares/error.middleware";
import { globalApiRateLimit } from "./middlewares/rate-limit.middleware";
import { AppError } from "./errors/AppError";

const PUBLIC_API_PREFIX = "/api/public";
const PUBLIC_CLINIC_ROOT_DOMAIN = "fizyoflow.com";
const RESERVED_PUBLIC_SUBDOMAINS = new Set(["api", "app", "www"]);
type CorsPolicyOptions = { origin: boolean; credentials: boolean };
type CorsPolicyInput = {
  origin?: string;
  pathname: string;
  nodeEnv?: string;
  corsOrigin?: string;
};
export type CorsPolicyDecision = {
  allowed: boolean;
  credentials: boolean;
  source: "no-origin" | "explicit" | "public-clinic" | "denied";
};

const DEVELOPMENT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:2929",
  "http://localhost:3939",
  "http://localhost:4949",
];

function isPublicApiPath(pathname: string) {
  return pathname === PUBLIC_API_PREFIX || pathname.startsWith(`${PUBLIC_API_PREFIX}/`);
}

function isPublicClinicOrigin(origin: string) {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" || url.port || url.username || url.password) return false;
    if (url.origin !== origin) return false;

    const suffix = `.${PUBLIC_CLINIC_ROOT_DOMAIN}`;
    if (!url.hostname.endsWith(suffix)) return false;
    const subdomain = url.hostname.slice(0, -suffix.length);
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(subdomain) && !RESERVED_PUBLIC_SUBDOMAINS.has(subdomain);
  } catch {
    return false;
  }
}

export function resolveCorsPolicyDecision({
  origin,
  pathname,
  nodeEnv,
  corsOrigin,
}: CorsPolicyInput): CorsPolicyDecision {
  if (!origin) return { allowed: true, credentials: true, source: "no-origin" };

  const configuredOrigins = corsOrigin
    ?.split(",")
    .map((configuredOrigin) => configuredOrigin.trim())
    .filter(Boolean);
  const allowedOrigins = configuredOrigins ?? (nodeEnv === "production" ? [] : DEVELOPMENT_ORIGINS);

  if (allowedOrigins.includes(origin)) {
    return { allowed: true, credentials: true, source: "explicit" };
  }

  const productionAllowlistReady = nodeEnv !== "production" || allowedOrigins.length > 0;
  if (productionAllowlistReady && isPublicApiPath(pathname) && isPublicClinicOrigin(origin)) {
    return { allowed: true, credentials: false, source: "public-clinic" };
  }

  return { allowed: false, credentials: false, source: "denied" };
}

// Express uygulamasinin HTTP kabugu.
// Guvenlik, parse, CORS ve route zinciri burada bir kez tanimlanir.
export function createApp() {
  const app = express();
  if (process.env.TRUST_PROXY) {
    const trustProxyValue = process.env.TRUST_PROXY === "true" ? 1 : process.env.TRUST_PROXY;
    app.set("trust proxy", trustProxyValue);
  }
  const corsEnvironment = {
    nodeEnv: process.env.NODE_ENV,
    corsOrigin: process.env.CORS_ORIGIN,
  };
  const corsPolicy = (
    req: Request,
    callback: (error: Error | null, options?: CorsPolicyOptions) => void,
  ) => {
    const decision = resolveCorsPolicyDecision({
      origin: req.headers.origin,
      pathname: req.path,
      ...corsEnvironment,
    });
    if (!decision.allowed) {
      callback(new AppError("FORBIDDEN", 403, "CORS origin not allowed"));
      return;
    }
    callback(null, { origin: true, credentials: decision.credentials });
  };

  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(auditMiddleware);

  // CORS yalniz tarayici politikasidir; kimlik dogrulama veya yetkilendirme siniri degildir.
  // Explicit origin'ler credentialed, klinik subdomain'leri ise yalniz public API'de credentials olmadan calisir.
  app.use(cors(corsPolicy));

  app.use(globalApiRateLimit);

  app.get("/health", (_, res) => res.json({ ok: true }));
  app.get("/live", (_, res) =>
    res.json({
      ok: true,
      uptime_seconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    })
  );
  app.get("/ready", async (_, res) => {
    if (!AppDataSource.isInitialized) {
      return res.status(503).json({ ok: false, database: "not_initialized" });
    }
    try {
      await AppDataSource.query("SELECT 1");
      return res.json({ ok: true, database: "ready" });
    } catch {
      return res.status(503).json({ ok: false, database: "unavailable" });
    }
  });

  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Tum uygulama modulleri /api altina baglanir.
  app.use("/api/", appRouter);

  // Error middleware en sonda olmali; aksi halde throw edilen hatalar normalize edilemez.
  app.use(errorMiddleware);

  return app;
}
