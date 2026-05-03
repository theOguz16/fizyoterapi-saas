// Express uygulamasinin HTTP kabugu bu dosyada kurulur.
// Guvenlik, parse, CORS ve ana router baglantisi burada bir kez tanimlanir.
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import rateLimit from "express-rate-limit";
import { appRouter } from "./routes";
import { auditMiddleware } from "./middlewares/audit.middleware";
import { errorMiddleware } from "./middlewares/error.middleware";

// Express uygulamasinin HTTP kabugu.
// Guvenlik, parse, CORS ve route zinciri burada bir kez tanimlanir.
export function createApp() {
  const app = express();
  const allowedOrigins =
    process.env.CORS_ORIGIN?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:2929",
      "http://localhost:3929",
      "http://localhost:4949",
    ];

  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(auditMiddleware);

  // Web ve mobil istemciler farkli portlardan gelebilecegi icin
  // origin listesi env veya lokal default'larla yonetiliyor.
  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
  }));

  // Basit bir genel koruma: tek endpoint bazli ince ayar yok, tum API icin ortak limit.
  app.use(rateLimit({ windowMs: 60_000, limit: 300 }));

  app.get("/health", (_, res) => res.json({ ok: true }));

  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Tum uygulama modulleri /api altina baglanir.
  app.use("/api/", appRouter);

  // Error middleware en sonda olmali; aksi halde throw edilen hatalar normalize edilemez.
  app.use(errorMiddleware);

  return app;
}
