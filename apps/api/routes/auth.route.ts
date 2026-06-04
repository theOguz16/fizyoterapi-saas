// Bu route dosyasi genel alanindaki auth.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { authLoginRateLimit, authRegisterRateLimit } from "../middlewares/rate-limit.middleware";

export const authRoutes = Router();

authRoutes.post("/register", authRegisterRateLimit, AuthController.register);
authRoutes.post("/login", authLoginRateLimit, AuthController.login);
authRoutes.post("/logout", AuthController.logout);
authRoutes.post("/switch-role", authMiddleware, AuthController.switchRole);
authRoutes.get("/me", authMiddleware, AuthController.me);
authRoutes.delete("/account", authMiddleware, AuthController.deleteAccount);
