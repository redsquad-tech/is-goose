import { describe, expect, it } from "vitest";
import { mapSecretsToServerEnv } from "../src/desktop/main/settings/secrets/env-map.js";

describe("MUST satisfy secrets env mapping requirements", () => {
  it("MUST map supported per-key scopes into deterministic server env names", () => {
    const env = mapSecretsToServerEnv({
      "provider.openai.api_key": "p1",
      "sftp.private_key": "p2",
      "mcp.system.token": "p3",
      "mcp.ext.github.token": "p4",
      "server.secret_key": "p5",
    });

    expect(env.PROVIDER_OPENAI_API_KEY).toBe("p1");
    expect(env.SFTP_PRIVATE_KEY).toBe("p2");
    expect(env.MCP_SYSTEM_TOKEN).toBe("p3");
    expect(env.MCP_EXT_GITHUB_TOKEN).toBe("p4");
    expect(env.SERVER_SECRET_KEY).toBe("p5");
  });
});
