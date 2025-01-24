import { Request, Response, NextFunction, CookieOptions } from "express";
import axios, { AxiosError } from "axios";
import jwt, { JwtPayload } from "jsonwebtoken";

import AppError from "../utils/app.error";
import asyncHandler from "../utils/error.handler";

import { Credentials, StrapiAuth } from "../interfaces/auth.interfaces";

export class AuthController {
  private STRAPI_AUTH_URL = "/api/auth/local";
  private strapiAxios = axios.create({
    baseURL: process.env.STRAPI_URL,
  });

  constructor() {
    this.strapiAxios.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          return Promise.resolve(error.response.data);
        }
      }
    );
  }

  private async getStrapiToken(credentials: Credentials): Promise<StrapiAuth> {
    const result = await this.strapiAxios.post(
      this.STRAPI_AUTH_URL,
      credentials
    );

    if (!result.data?.jwt) {
      throw new AppError("Invalid authentication response", 401);
    }

    return result.data;
  }

  private async attachCookies(
    token: string,
    statusCode: number,
    res: Response
  ): Promise<void> {
    const decoded = jwt.decode(token) as JwtPayload;

    if (!decoded?.exp) {
      throw new AppError("Invalid JWT token", 401);
    }

    const cookieOptions: CookieOptions = {
      expires: new Date(decoded.exp * 1000),
      httpOnly: true,
      // secure: process.env.NODE_ENV === "production",
      secure: true,
      sameSite: "none",
    };

    res.cookie("jwt", token, cookieOptions);
    res.status(statusCode).json({
      status: "success",
    });
  }

  login = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const { identifier, password } = req.body;

      if (!identifier || !password) {
        throw new AppError("Please provide email and password", 400);
      }

      const { jwt } = await this.getStrapiToken({ identifier, password });

      await this.attachCookies(jwt, 200, res);
    }
  );

  logout = (req: Request, res: Response): void => {
    res.cookie("jwt", "logged-out", {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });

    res.status(200).json({ status: "success" });
  };

  me = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      res.status(200).json({ status: "success" });
    }
  );
}
