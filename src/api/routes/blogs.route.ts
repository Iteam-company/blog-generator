import { Router } from "express";
import { BlogsController } from "../controllers/blogs.controller";

const router = Router();
const blogsController = new BlogsController();

router.post("/generate", blogsController.generate);
router.get("/pic", blogsController.getOnePic);
router.post("/upload", blogsController.upload);

export default router;
