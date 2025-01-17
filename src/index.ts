import axios from "axios";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

// axios.defaults.baseURL = process.env.STRAPI_BASE_URL;
// axios.defaults.headers.common[
//   "Authorization"
// ] = `Bearer ${process.env.STRAPI_TOKEN}`;

import app from "./api/app";

const port = process.env.APP_PORT || 3000;
const server = app.listen(port, () => {
  console.log(`✅App running on port ${port}...`);
});

// import { job } from "./blog/cron.jobs";
// job.start();
