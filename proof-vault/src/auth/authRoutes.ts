import { Router } from "express";
import { login, logout, me, signup } from "./authController";
import { requireAuth } from "../middleware/requireAuth";

export const authRoutes = Router();

authRoutes.post("/signup", signup);
authRoutes.post("/login", login);
authRoutes.post("/logout", requireAuth, logout);
authRoutes.get("/me", requireAuth, me);
