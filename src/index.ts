import dotenv from "dotenv";

dotenv.config({ path: ".env" });

import app from "./api/app";

const port = process.env.APP_PORT || 3000;
const server = app.listen(port, () => {
  console.log(`✅App running on port ${port}...`);
});
