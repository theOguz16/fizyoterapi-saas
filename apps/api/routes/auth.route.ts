// Bu route dosyasi genel alanindaki auth.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { authLoginRateLimit, authRegisterRateLimit } from "../middlewares/rate-limit.middleware";
import { passwordResetRateLimit } from "../middlewares/rate-limit.middleware";
import { PasswordResetController } from "../controllers/password-reset.controller";

export const authRoutes = Router();

authRoutes.post("/register", authRegisterRateLimit, AuthController.register);
authRoutes.post("/register-clinic-member", authRegisterRateLimit, AuthController.registerClinicMember);
authRoutes.post("/login", authLoginRateLimit, AuthController.login);
authRoutes.post("/password-reset/request", passwordResetRateLimit, PasswordResetController.request);
authRoutes.post("/password-reset/confirm", passwordResetRateLimit, PasswordResetController.confirm);
authRoutes.post("/logout", authMiddleware, AuthController.logout);
authRoutes.post("/switch-role", authMiddleware, AuthController.switchRole);
authRoutes.get("/me", authMiddleware, AuthController.me);
authRoutes.delete("/account", authMiddleware, AuthController.deleteAccount);
