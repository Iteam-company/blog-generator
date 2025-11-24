import express from "express";
import { ProjectController } from "../controllers/project.controller";

const router = express.Router();

const caseController = new ProjectController();
router.post("/generate-project", (req, res) =>
  caseController.generateProject(req, res)
);

export default router;
