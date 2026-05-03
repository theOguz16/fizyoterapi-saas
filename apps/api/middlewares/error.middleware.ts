// Bu middleware request zincirinde error.middleware ile ilgili ortak kontrolu uygular.
// Yetki, hata, tenant veya upload gibi cros-cutting davranislar controller oncesi burada ele alinir.
import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";
import { messageForCode } from "../errors/error-catalog";
import { attachAuditError } from "../services/audit-log.service";

export function errorMiddleware(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof AppError) {
    attachAuditError(res, err.code, messageForCode(err.code, err.message));
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: messageForCode(err.code, err.message),
      },
    });
  }

  console.error(err);
  attachAuditError(res, "INTERNAL_ERROR", "Sunucu hatası");

  return res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Sunucu hatası",
    },
  });
}
