import { Router } from "express";
import { CronController } from "../controllers/cron.controller";
import { AuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();
const cronController = new CronController();
const authMiddleware = new AuthMiddleware();

router.use(authMiddleware.authenticateJWT);

router.patch("/start", cronController.start);
router.patch("/stop", cronController.stop);
router.patch("/setpattern", cronController.set);
router.get("/status", cronController.get);

export default router;
