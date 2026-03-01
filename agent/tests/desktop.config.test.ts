import { describe, expect, it } from "vitest";
import {
  CONFIG_SCHEMA_VERSION,
  DEFAULT_APP_CONFIG,
  DEFAULT_RENDERER_PREFS,
  normalizeAppConfig,
  normalizeRendererPrefs,
} from "../src/desktop/main/settings/config.js";

describe("MUST satisfy desktop config normalization requirements", () => {
  it("MUST fallback to defaults for malformed renderer prefs", () => {
    const prefs = normalizeRendererPrefs({
      sessionSharingConfig: { enabled: "no" },
      responseStyle: "experimental",
      showPricing: "yes",
    });

    expect(prefs).toEqual(DEFAULT_RENDERER_PREFS);
  });

  it("MUST normalize app config with schema version and defaults", () => {
    const config = normalizeAppConfig({
      schemaVersion: "v1",
      desktop: {
        showMenuBarIcon: false,
      },
      rendererPrefs: {
        responseStyle: "concise",
      },
    });

    expect(config.schemaVersion).toBe(CONFIG_SCHEMA_VERSION);
    expect(config.desktop.showMenuBarIcon).toBe(false);
    expect(config.desktop.showDockIcon).toBe(
      DEFAULT_APP_CONFIG.desktop.showDockIcon,
    );
    expect(config.rendererPrefs.responseStyle).toBe("concise");
    expect(config.rendererPrefs.showPricing).toBe(true);
  });
});
