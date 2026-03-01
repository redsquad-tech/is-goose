import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DesktopSecretStore,
  type SecretCrypto,
} from "../src/desktop/main/settings/secrets/store.js";

const tempDirs: string[] = [];

const makeDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-secrets-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("MUST satisfy secrets store requirements", () => {
  it("MUST persist per-key secret with primary crypto backend", () => {
    const crypto: SecretCrypto = {
      isAvailable: () => true,
      encrypt: (input) => Buffer.from(input, "utf8").toString("base64"),
      decrypt: (input) => Buffer.from(input, "base64").toString("utf8"),
    };
    const dir = makeDir();

    const first = new DesktopSecretStore({ configDir: dir, crypto });
    first.upsert("provider.openai.api_key", "secret-1");
    expect(first.getStatus().backend).toBe("keychain");

    const second = new DesktopSecretStore({ configDir: dir, crypto });
    expect(second.getAllSecrets()["provider.openai.api_key"]).toBe("secret-1");
  });

  it("MUST fallback to env export file when crypto backend is unavailable", () => {
    const crypto: SecretCrypto = {
      isAvailable: () => false,
      encrypt: (input) => input,
      decrypt: (input) => input,
    };
    const dir = makeDir();

    const store = new DesktopSecretStore({ configDir: dir, crypto });
    store.upsert("mcp.system.token", "token-1");

    expect(store.getStatus().backend).toBe("fallback_env_file");
    expect(fs.existsSync(path.join(dir, "secrets.env"))).toBe(true);
  });
});
