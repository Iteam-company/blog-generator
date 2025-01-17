import { Request, Response, NextFunction } from "express";
import AppError from "../utils/app.error";

export class ErrorHandler {
  private sendErrorDev(err: AppError, req: Request, res: Response): void {
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
    return;
  }

  private sendErrorProd(err: AppError, req: Request, res: Response): void {
    if (err.isOperational) {
      res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
      return;
    }

    console.error("ERROR 💥", err);
    res.status(500).json({
      status: "error",
      message: "Something went very wrong!",
    });
    return;
  }

  public handleError(
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || "error";

    if (process.env.NODE_ENV === "development") {
      this.sendErrorDev(err, req, res);
    } else if (process.env.NODE_ENV === "production") {
      let error = JSON.parse(JSON.stringify(err));
      error.message = err.message;

      this.sendErrorProd(error, req, res);
    }
  }
}

export const errorHandler = new ErrorHandler().handleError.bind(
  new ErrorHandler()
);
