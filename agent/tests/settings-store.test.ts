import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { SecretCrypto } from "../src/desktop/main/settings/secrets/store.js";
import { SettingsStore } from "../src/desktop/main/settings/store.js";

const tempDirs: string[] = [];

const makeDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-settings-store-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("MUST satisfy settings store requirements", () => {
  it("MUST persist desktop settings in local store", () => {
    const dir = makeDir();
    const store = new SettingsStore({ configDir: dir });
    store.saveDesktopSettings({
      ...store.getDesktopSettings(),
      showMenuBarIcon: false,
    });

    const restored = new SettingsStore({ configDir: dir });
    expect(restored.getDesktopSettings().showMenuBarIcon).toBe(false);
  });

  it("MUST include settings and secrets in server env snapshot", () => {
    const dir = makeDir();
    const crypto: SecretCrypto = {
      isAvailable: () => true,
      encrypt: (input) => Buffer.from(input, "utf8").toString("base64"),
      decrypt: (input) => Buffer.from(input, "base64").toString("utf8"),
    };
    const store = new SettingsStore({ configDir: dir, crypto });
    store.upsertSecret("provider.openai.api_key", "secret-1");
    store.saveDesktopSettings({
      ...store.getDesktopSettings(),
      spellcheckEnabled: false,
    });

    const env = store.buildServerEnv(
      { PATH: process.env.PATH },
      {
        root: "/tmp/agent",
        config: "/tmp/agent/config",
        logs: "/tmp/agent/logs",
        cache: "/tmp/agent/cache",
      },
      43111,
    );

    expect(env.HOST).toBe("127.0.0.1");
    expect(env.PORT).toBe("43111");
    expect(env.PROVIDER_OPENAI_API_KEY).toBe("secret-1");
    expect(env.AGENT_DESKTOP_SPELLCHECK_ENABLED).toBe("0");
    expect(env.AGENT_CONFIG_DIR).toBe("/tmp/agent/config");
  });
});
