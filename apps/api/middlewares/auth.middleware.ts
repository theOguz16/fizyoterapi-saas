// Bu middleware request zincirinde auth.middleware ile ilgili ortak kontrolu uygular.
// Yetki, hata, tenant veya upload gibi cros-cutting davranislar controller oncesi burada ele alinir.
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { attachAuditError } from "../services/audit-log.service";

export type JwtPayload = {
  sub: string;
  tenantId?: string | null;
  role: string;
  accountId?: string;
  linkedUserId?: string | null;
  membershipId?: string | null;
  loginScope?: "ACCOUNT" | "LEGACY";
};

export interface AuthenticatedRequest extends Request {
  auth?: JwtPayload;
  tenantId?: string;
  file?: Express.Multer.File;
  requestId?: string;
}

// Hem mobile Bearer token hem de web cookie oturumu ayni middleware'den geciyor.
// Bu nedenle token'i birden fazla kaynaktan toplayip tek bir req.auth alanina indiriyoruz.
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const bearerToken = header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
  const headerToken =
    bearerToken &&
    bearerToken !== "undefined" &&
    bearerToken !== "null" &&
    bearerToken !== "__cookie_session__"
      ? bearerToken
      : undefined;
  const cookieToken = req.cookies?.accessToken as string | undefined;
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    attachAuditError(res, "CONFIG_ERROR", "Sunucu yapılandırması eksik");
    return res.status(500).json({
      error: { code: "CONFIG_ERROR", message: "Sunucu yapılandırması eksik" },
    });
  }

  try {
    const token = headerToken || cookieToken;
    if (!token) {
      attachAuditError(res, "NO_TOKEN", "Oturum bulunamadı. Lütfen tekrar giriş yapın.");
      return res.status(401).json({
        error: { code: "NO_TOKEN", message: "Oturum bulunamadı. Lütfen tekrar giriş yapın." },
      });
    }
    const payload = jwt.verify(token, jwtSecret) as JwtPayload;
    req.auth = payload;
    return next();
  } catch {
    // Bazi istemciler stale header ile gecerli cookie'yi ayni anda tasiyabiliyor.
    // Header dogrulanamazsa cookie fallback'i denememizin sebebi bu gecis sorunlari.
    if (headerToken && cookieToken) {
      try {
        const fallbackPayload = jwt.verify(cookieToken, jwtSecret) as JwtPayload;
        req.auth = fallbackPayload;
        return next();
      } catch {
        // no-op
      }
    }
    return res.status(401).json({
      error: { code: "INVALID_TOKEN", message: "Oturum doğrulanamadı. Lütfen tekrar giriş yapın." },
    });
  }
}
