import { Request, Response, NextFunction } from "express";
import AppError from "../utils/app.error";
import asyncHandler from "../utils/error.handler";
import { CronService } from "../../blog/cron.jobs";

export class CronController {
  private cronService: CronService;

  constructor() {
    this.cronService = new CronService("0 12 * * *");
  }

  start = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      this.cronService.cronStart();

      res.status(200).json({ status: "success" });
    }
  );

  stop = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      this.cronService.cronStop();

      res.status(200).json({ status: "success" });
    }
  );

  set = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const { pattern } = req.body;

      this.cronService.setNewPattern(pattern);

      res.status(200).json({ status: "success" });
    }
  );

  get = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const status = this.cronService.getCronStatus();

      res.status(200).json(status);
    }
  );
}
