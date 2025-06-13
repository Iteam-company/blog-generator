import express from 'express';
import { CaseController} from "../controllers/case.controller";

const router = express.Router();

const caseController = new CaseController();
router.post('/generate-case', (req, res) => caseController.generateCase(req, res));

export default router;