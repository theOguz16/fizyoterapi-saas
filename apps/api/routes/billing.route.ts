// Bu route dosyasi genel alanindaki billing.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { BillingController } from "../controllers/billing.controller";
import { webhookRateLimit } from "../middlewares/rate-limit.middleware";

export const billingRoutes = Router();

billingRoutes.post("/subscription-intent", BillingController.createSubscriptionIntent);
billingRoutes.post("/revenuecat/webhook", webhookRateLimit, BillingController.revenueCatWebhook);
