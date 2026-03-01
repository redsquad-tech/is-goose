import { DesktopConfigStore } from "./config-store.js";
import type { AppConfig } from "./config.js";
import { normalizeAppConfig } from "./config.js";
import { mapSecretsToServerEnv } from "./secrets/env-map.js";
import type { SecretCrypto } from "./secrets/store.js";
import { DesktopSecretStore } from "./secrets/store.js";
import { type DesktopSettings, normalizeSettings } from "./settings.js";

export type SettingsStoreAppDirs = {
  root: string;
  config: string;
  logs: string;
  cache: string;
};

type SettingsStoreOptions = {
  configDir: string;
  crypto?: SecretCrypto;
};

const asBool = (value: boolean): string => (value ? "1" : "0");

const mapConfigToServerEnv = (config: AppConfig): Record<string, string> => ({
  AGENT_DESKTOP_SHOW_MENU_BAR_ICON: asBool(config.desktop.showMenuBarIcon),
  AGENT_DESKTOP_SHOW_DOCK_ICON: asBool(config.desktop.showDockIcon),
  AGENT_DESKTOP_SPELLCHECK_ENABLED: asBool(config.desktop.spellcheckEnabled),
  AGENT_DESKTOP_WAKELOCK_ENABLED: asBool(config.desktop.enableWakelock),
  AGENT_DESKTOP_SHORTCUT_OPEN_SETTINGS:
    config.desktop.keyboardShortcuts.openSettings,
  AGENT_DESKTOP_SHORTCUT_NEW_SESSION:
    config.desktop.keyboardShortcuts.newSession,
  AGENT_DESKTOP_RESPONSE_STYLE: config.rendererPrefs.responseStyle,
  AGENT_DESKTOP_SESSION_SHARING: asBool(
    config.rendererPrefs.sessionSharingConfig.enabled,
  ),
  AGENT_DESKTOP_SHOW_PRICING: asBool(config.rendererPrefs.showPricing),
});

export class SettingsStore {
  private readonly configStore: DesktopConfigStore;

  private readonly secretStore: DesktopSecretStore;

  constructor(options: SettingsStoreOptions) {
    this.configStore = new DesktopConfigStore({ configDir: options.configDir });
    this.secretStore = new DesktopSecretStore({
      configDir: options.configDir,
      ...(options.crypto ? { crypto: options.crypto } : {}),
    });
  }

  getConfig(): AppConfig {
    return this.configStore.getConfig();
  }

  saveConfig(next: AppConfig): AppConfig {
    const normalized = normalizeAppConfig(next);
    return this.configStore.saveConfig(normalized);
  }

  getDesktopSettings(): DesktopSettings {
    return this.getConfig().desktop;
  }

  saveDesktopSettings(next: DesktopSettings): DesktopSettings {
    const config = this.saveConfig({
      ...this.getConfig(),
      desktop: normalizeSettings(next),
    });
    return config.desktop;
  }

  upsertSecret(key: string, value: string): void {
    this.secretStore.upsert(key, value);
  }

  removeSecret(key: string): void {
    this.secretStore.remove(key);
  }

  buildServerEnv(
    baseEnv: NodeJS.ProcessEnv,
    dirs: SettingsStoreAppDirs,
    port: number,
  ): NodeJS.ProcessEnv {
    const configEnv = mapConfigToServerEnv(this.getConfig());
    const secretEnv = mapSecretsToServerEnv(this.secretStore.getAllSecrets());
    const serverSecret =
      secretEnv.SERVER_SECRET_KEY ?? baseEnv.SERVER_SECRET_KEY ?? "dev-secret";

    return {
      ...baseEnv,
      HOST: "127.0.0.1",
      PORT: String(port),
      SERVER_SECRET_KEY: serverSecret,
      AGENT_PATH_ROOT: dirs.root,
      AGENT_CONFIG_DIR: dirs.config,
      AGENT_LOGS_DIR: dirs.logs,
      AGENT_CACHE_DIR: dirs.cache,
      ...configEnv,
      ...secretEnv,
    };
  }
}
