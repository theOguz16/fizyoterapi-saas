// Express uygulamasinin HTTP kabugu bu dosyada kurulur.
// Guvenlik, parse, CORS ve ana router baglantisi burada bir kez tanimlanir.
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import { appRouter } from "./routes";
import { AppDataSource } from "./data-source";
import { auditMiddleware } from "./middlewares/audit.middleware";
import { errorMiddleware } from "./middlewares/error.middleware";
import { globalApiRateLimit } from "./middlewares/rate-limit.middleware";

// Express uygulamasinin HTTP kabugu.
// Guvenlik, parse, CORS ve route zinciri burada bir kez tanimlanir.
export function createApp() {
  const app = express();
  if (process.env.TRUST_PROXY) {
    const trustProxyValue = process.env.TRUST_PROXY === "true" ? 1 : process.env.TRUST_PROXY;
    app.set("trust proxy", trustProxyValue);
  }
  const allowedOrigins =
    process.env.CORS_ORIGIN?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:2929",
      "http://localhost:3939",
      "http://localhost:4949",
      "https://fizyoflow.com",
      "https://www.fizyoflow.com",
      "https://app.fizyoflow.com",
    ];

  const isAllowedOrigin = (origin: string) => {
    if (allowedOrigins.includes(origin)) return true;
    try {
      const url = new URL(origin);
      return url.protocol === "https:" && (url.hostname === "fizyoflow.com" || url.hostname.endsWith(".fizyoflow.com"));
    } catch {
      return false;
    }
  };

  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(auditMiddleware);

  // Web ve mobil istemciler farkli portlardan gelebilecegi icin
  // origin listesi env veya lokal default'larla yonetiliyor.
  app.use(cors({
    origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
  }));

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
