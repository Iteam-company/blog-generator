import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { AuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();
const authController = new AuthController();
const authMiddleware = new AuthMiddleware();

router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.post("/me", authMiddleware.authenticateJWT, authController.me);

export default router;
