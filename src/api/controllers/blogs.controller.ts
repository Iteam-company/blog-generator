import { Request, Response, NextFunction } from "express";
import AppError from "../utils/app.error";
import asyncHandler from "../utils/error.handler";
import { PostGenerator } from "../../blog/post.generator";
import { readFileContent, saveJsonToFile } from "../../utils/utils";
import { MarkdownToStrapiConverter } from "../../markdown-parser/markdowntostrapi.parser";

export class BlogsController {
  getMarkDown = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const postGenerator = new PostGenerator(req.cookies?.jwt);

      const { prompt } = req.body;

      const markdown = await postGenerator.generateMarkDown(prompt);

      const converter = new MarkdownToStrapiConverter(markdown);

      const { metadata, content } = converter.getData();

      res.status(201).json({ metadata, content });
    }
  );

  generateDefault = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const postGenerator = new PostGenerator(req.cookies?.jwt);

      const newPost = await postGenerator.generateNewPost();

      res.status(201).json(newPost);
    }
  );

  generateCustom = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const postGenerator = new PostGenerator(req.cookies?.jwt);

      const { prompt } = req.body;
      if (!prompt) {
        next(new AppError("Please, provide a prompt for generation", 400));
      }

      const newPost = await postGenerator.generateNewPost(prompt);

      res.status(201).json(newPost);
    }
  );

  parseAndPublish = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const postGenerator = new PostGenerator(req.cookies?.jwt);

      const { metadata, content } = req.body;
      if (!metadata || !content) {
        next(new AppError("Please, provide a markdown", 400));
      }

      await saveJsonToFile("formated.md", content);

      const newPost = await postGenerator.parseAndPublish(content, metadata);

      res.status(201).json({ id: newPost.data.id });
    }
  );

  testMD = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const postGenerator = new PostGenerator(req.cookies?.jwt);

      const test = await readFileContent("airesponse.md");

      const newPost = await postGenerator.parseAndPublish(test);

      res.status(201).json(newPost);
    }
  );

  getOnePic = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const postGenerator = new PostGenerator(req.cookies?.jwt);

      const { prompt } = req.body;
      if (!prompt) {
        next(new AppError("Please, provide a prompt to get a pic", 400));
      }

      const pic = await postGenerator.searchUnsplash(prompt);

      res.status(201).json(pic);
    }
  );

  uploadImg = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const postGenerator = new PostGenerator(req.cookies?.jwt);

      const { url, fileName, altText } = req.body;

      const pic = await postGenerator.uploadImageToStrapi(
        url,
        fileName,
        altText
      );

      res.status(201).json(pic);
    }
  );
}
