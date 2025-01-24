import express from "express";

import AppError from "./utils/app.error";
import { errorHandler } from "./middlewares/error.middleware";

import blogsRouter from "./routes/blogs.route";
import authRouter from "./routes/auth.router";

import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

const whitelist = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://192.168.1.42:3000",
  "https://3cf2-195-234-70-138.ngrok-free.app",
  "https://c026-91-202-131-31.ngrok-free.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || whitelist.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
  })
);

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/blog", blogsRouter);

app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// ERROR HANDLING: ALWAYS THE LAST IN MIDDLEWARE
app.use(errorHandler);

export default app;
