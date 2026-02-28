import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? "3001");
const host = process.env.HOST ?? "127.0.0.1";

const app = buildApp();

app
  .listen({ port, host })
  .then(() => {
    console.log(`server started on http://${host}:${port}`);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
