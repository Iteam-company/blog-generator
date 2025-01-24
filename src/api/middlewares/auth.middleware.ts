import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import AppError from "../utils/app.error";
import asyncHandler from "../utils/error.handler";

export class AuthMiddleware {
  public authenticateJWT = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const token = this.extractToken(req);

      if (!token) {
        return next(new AppError("Please log in to access this resource", 401));
      }

      const decoded = await this.verifyToken(token);

      next();
    }
  );

  private extractToken(req: Request): string | undefined {
    if (req.headers.authorization?.startsWith("Bearer")) {
      return req.headers.authorization.split(" ")[1];
    }
    return req.cookies?.jwt;
  }

  private async verifyToken(token: string): Promise<any> {
    return jwt.verify(token, process.env.STRAPI_JWT_SECRET!) as JwtPayload;
  }
}
