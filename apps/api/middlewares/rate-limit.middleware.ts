import rateLimit from "express-rate-limit";

function createLimit(windowMs: number, limit: number, code: string, message: string) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: { code, message },
    },
  });
}

export const globalApiRateLimit = createLimit(60_000, 300, "RATE_LIMITED", "Çok fazla istek gönderildi.");

export const authLoginRateLimit = createLimit(15 * 60_000, 10, "LOGIN_RATE_LIMITED", "Çok fazla giriş denemesi yapıldı.");

export const authRegisterRateLimit = createLimit(60 * 60_000, 5, "REGISTER_RATE_LIMITED", "Çok fazla kayıt denemesi yapıldı.");

export const inviteAcceptRateLimit = createLimit(15 * 60_000, 20, "INVITE_RATE_LIMITED", "Çok fazla davet denemesi yapıldı.");

export const paymentRequestRateLimit = createLimit(10 * 60_000, 20, "PAYMENT_REQUEST_RATE_LIMITED", "Çok fazla ödeme talebi gönderildi.");

export const checkinRateLimit = createLimit(60_000, 60, "CHECKIN_RATE_LIMITED", "Çok fazla check-in isteği gönderildi.");

export const qrRateLimit = createLimit(60_000, 120, "QR_RATE_LIMITED", "Çok fazla QR isteği gönderildi.");

export const webhookRateLimit = createLimit(60_000, 120, "WEBHOOK_RATE_LIMITED", "Çok fazla webhook isteği gönderildi.");

export const publicFormRateLimit = createLimit(15 * 60_000, 30, "PUBLIC_FORM_RATE_LIMITED", "Çok fazla form isteği gönderildi.");

export const publicRecommendationRateLimit = createLimit(
  15 * 60_000,
  60,
  "PUBLIC_RECOMMENDATION_RATE_LIMITED",
  "Çok fazla öneri isteği gönderildi."
);

export const productEventRateLimit = createLimit(
  15 * 60_000,
  180,
  "PRODUCT_EVENT_RATE_LIMITED",
  "Çok fazla ölçüm olayı gönderildi."
);
