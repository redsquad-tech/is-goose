import { describe, expect, it } from "vitest";

import { buildApp } from "../src/server/app.js";

describe("server contract", () => {
  it("requires secret key on protected endpoints", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/agent/start",
      payload: { working_dir: "/tmp" },
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("returns valid SSE framing on /reply", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/reply",
      headers: { "X-Secret-Key": "dev-secret" },
      payload: {
        session_id: "session-example",
        user_message: {
          role: "user",
          created: "2024-01-01T00:00:00.000Z",
          content: [{ type: "text", text: "hello" }],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.body.startsWith("data: ")).toBe(true);
    expect(response.body.endsWith("\n\n")).toBe(true);
    await app.close();
  });

  it("validates /mcp-ui-proxy by query secret", async () => {
    const app = buildApp();
    const ok = await app.inject({
      method: "GET",
      url: "/mcp-ui-proxy?secret=dev-secret",
    });
    const unauthorized = await app.inject({
      method: "GET",
      url: "/mcp-ui-proxy?secret=wrong",
    });

    expect(ok.statusCode).toBe(200);
    expect(unauthorized.statusCode).toBe(401);
    await app.close();
  });

  it("returns 204 with empty body for /recipes/save", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/recipes/save",
      headers: { "X-Secret-Key": "dev-secret" },
      payload: {},
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    await app.close();
  });
});
