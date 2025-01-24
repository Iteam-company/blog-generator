import { Router } from "express";
import { BlogsController } from "../controllers/blogs.controller";
import { AuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();
const blogsController = new BlogsController();
const authMiddleware = new AuthMiddleware();

router.use(authMiddleware.authenticateJWT);

router.post("/markdown", blogsController.getMarkDown);
router.post("/default", blogsController.generateDefault);
router.post("/custom", blogsController.generateCustom);
router.post("/publish", blogsController.parseAndPublish);
router.post("/pic", blogsController.getOnePic);
router.post("/upload", blogsController.uploadImg);
router.post("/test", blogsController.testMD);

export default router;
