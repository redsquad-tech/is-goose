import { createLogger } from "../logging/index.js";
import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? "3001");
const host = process.env.HOST ?? "127.0.0.1";

const app = buildApp();
const logger = createLogger("server");

app
  .listen({ port, host })
  .then(() => {
    logger.info("startup_succeeded", { host, port });
  })
  .catch((error: unknown) => {
    logger.error("startup_failed", {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { message: String(error) },
    });
    process.exit(1);
  });
