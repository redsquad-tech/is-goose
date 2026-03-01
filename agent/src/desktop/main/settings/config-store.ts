import fs from "node:fs";
import path from "node:path";
import Store from "electron-store";
import {
  type AppConfig,
  CONFIG_SCHEMA_VERSION,
  DEFAULT_APP_CONFIG,
  normalizeAppConfig,
  normalizeRendererPrefs,
} from "./config.js";
import { normalizeSettings } from "./settings.js";

type StoreShape = {
  config: AppConfig;
};

type ConfigStoreOptions = {
  configDir: string;
};

const atomicWriteJson = (file: string, value: unknown): void => {
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true });
  const tempFile = path.join(
    directory,
    `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`,
  );
  fs.writeFileSync(tempFile, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tempFile, file);
};

const readJson = (file: string): unknown | null => {
  if (!fs.existsSync(file)) {
    return null;
  }
  const raw = fs.readFileSync(file, "utf8");
  return JSON.parse(raw) as unknown;
};

const migrateLegacyConfig = (configDir: string): AppConfig => {
  const legacySettingsFile = path.join(configDir, "settings.json");
  const legacyRendererPrefsFile = path.join(configDir, "renderer-prefs.json");

  const legacySettingsRaw = readJson(legacySettingsFile);
  const legacyRendererPrefsRaw = readJson(legacyRendererPrefsFile);

  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    desktop:
      legacySettingsRaw === null
        ? DEFAULT_APP_CONFIG.desktop
        : normalizeSettings(legacySettingsRaw),
    rendererPrefs:
      legacyRendererPrefsRaw === null
        ? DEFAULT_APP_CONFIG.rendererPrefs
        : normalizeRendererPrefs(legacyRendererPrefsRaw),
  };
};

export class DesktopConfigStore {
  private readonly store: Store<StoreShape>;

  private readonly snapshotFile: string;

  constructor(options: ConfigStoreOptions) {
    this.store = new Store<StoreShape>({
      name: "desktop-config",
      cwd: options.configDir,
      defaults: { config: DEFAULT_APP_CONFIG },
    });
    this.snapshotFile = path.join(options.configDir, "config.json");

    const current = this.store.get("config");
    if (!current || Object.keys(current).length === 0) {
      const migrated = migrateLegacyConfig(options.configDir);
      this.store.set("config", migrated);
      atomicWriteJson(this.snapshotFile, migrated);
      return;
    }

    const normalized = normalizeAppConfig(current);
    this.store.set("config", normalized);
    atomicWriteJson(this.snapshotFile, normalized);
  }

  getConfig(): AppConfig {
    return normalizeAppConfig(this.store.get("config"));
  }

  saveConfig(next: AppConfig): AppConfig {
    const normalized = normalizeAppConfig(next);
    this.store.set("config", normalized);
    atomicWriteJson(this.snapshotFile, normalized);
    return normalized;
  }
}
