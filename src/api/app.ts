import express from "express";

import AppError from "./utils/app.error";
import { errorHandler } from "./middlewares/error.middleware";

import cors from "cors";
import cookieParser from "cookie-parser";

import blogsRouter from "./routes/blogs.route";
import authRouter from "./routes/auth.router";
import cronRouter from "./routes/cron.router";

const app = express();

const corsWhitelist = process.env
  .CORS_WHITELIST!.split(",")
  .map((elem) => elem.trim());

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || corsWhitelist.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
  })
);

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/blog", blogsRouter);
app.use("/api/cron", cronRouter);

app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// ERROR HANDLING: ALWAYS THE LAST IN MIDDLEWARE
app.use(errorHandler);

export default app;
