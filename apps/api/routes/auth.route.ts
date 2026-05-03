// Bu route dosyasi genel alanindaki auth.route endpointlerini middleware ve controller zincirine baglar.
// URL duzeni ile yetkilendirme kurallari bu katmanda bir araya getirilir.
import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

export const authRoutes = Router();

authRoutes.post("/register", AuthController.register);
authRoutes.post("/login", AuthController.login);
authRoutes.post("/logout", AuthController.logout);
authRoutes.get("/me", authMiddleware, AuthController.me);
