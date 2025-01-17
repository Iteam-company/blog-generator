import express from "express";

import AppError from "./utils/app.error";
import { errorHandler } from "./middlewares/error.middleware";

import blogsRouter from "./routes/blogs.route";

const app = express();

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

app.use("/api/blogs", blogsRouter);

app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(errorHandler);

export default app;
