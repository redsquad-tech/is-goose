import http from "node:http";

const port = Number(process.env.AGENT_BACKEND_PORT ?? "43111");

const server = http.createServer((req, res) => {
  if (req.url === "/status") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        runtime: "mock-backend",
        pathRoot: process.env.AGENT_PATH_ROOT ?? "",
      }),
    );
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`mock-backend listening on ${port}\n`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
