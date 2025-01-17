import { Request, Response, NextFunction } from "express";
import AppError from "../utils/app.error";
import asyncHandler from "../utils/error.handler";
import { PostGenerator } from "../../blog/post.generator";

export class BlogsController {
  private postGenerator;

  constructor() {
    this.postGenerator = new PostGenerator();
  }

  generate = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const prompt = req.query.p as string;

      const newPost = await this.postGenerator.generateNewPost(prompt);

      res.status(201).json(newPost);
    }
  );

  getOnePic = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const prompt = req.query.p as string;

      const pic = await this.postGenerator.searchUnsplash(prompt);

      res.status(201).json(pic);
    }
  );

  upload = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const url = req.body.url as string;
      const fileName = req.body.filename as string;
      const altText = req.body.alttext as string;

      const pic = await this.postGenerator.uploadImageToStrapi(
        url,
        altText,
        fileName
      );

      res.status(201).json(pic);
    }
  );
}
