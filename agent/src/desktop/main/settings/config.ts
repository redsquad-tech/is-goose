import {
  DEFAULT_SETTINGS,
  type DesktopSettings,
  normalizeSettings,
} from "./settings.js";

export const CONFIG_SCHEMA_VERSION = 1;

type SessionSharingConfig = {
  enabled: boolean;
};

type ResponseStyle = "concise" | "balanced" | "detailed";

export type RendererPrefs = {
  sessionSharingConfig: SessionSharingConfig;
  responseStyle: ResponseStyle;
  showPricing: boolean;
};

export type AppConfig = {
  schemaVersion: number;
  desktop: DesktopSettings;
  rendererPrefs: RendererPrefs;
};

export const DEFAULT_RENDERER_PREFS: RendererPrefs = {
  sessionSharingConfig: { enabled: false },
  responseStyle: "balanced",
  showPricing: true,
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  schemaVersion: CONFIG_SCHEMA_VERSION,
  desktop: DEFAULT_SETTINGS,
  rendererPrefs: DEFAULT_RENDERER_PREFS,
};

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const asResponseStyle = (
  value: unknown,
  fallback: ResponseStyle,
): ResponseStyle => {
  if (value === "concise" || value === "balanced" || value === "detailed") {
    return value;
  }
  return fallback;
};

export const normalizeRendererPrefs = (value: unknown): RendererPrefs => {
  if (!value || typeof value !== "object") {
    return DEFAULT_RENDERER_PREFS;
  }

  const obj = value as Record<string, unknown>;
  const sharing =
    obj.sessionSharingConfig && typeof obj.sessionSharingConfig === "object"
      ? (obj.sessionSharingConfig as Record<string, unknown>)
      : {};

  return {
    sessionSharingConfig: {
      enabled: asBoolean(
        sharing.enabled,
        DEFAULT_RENDERER_PREFS.sessionSharingConfig.enabled,
      ),
    },
    responseStyle: asResponseStyle(
      obj.responseStyle,
      DEFAULT_RENDERER_PREFS.responseStyle,
    ),
    showPricing: asBoolean(obj.showPricing, DEFAULT_RENDERER_PREFS.showPricing),
  };
};

export const normalizeAppConfig = (value: unknown): AppConfig => {
  if (!value || typeof value !== "object") {
    return DEFAULT_APP_CONFIG;
  }

  const obj = value as Record<string, unknown>;
  const schemaVersion =
    typeof obj.schemaVersion === "number" && Number.isInteger(obj.schemaVersion)
      ? obj.schemaVersion
      : CONFIG_SCHEMA_VERSION;

  return {
    schemaVersion,
    desktop: normalizeSettings(obj.desktop),
    rendererPrefs: normalizeRendererPrefs(obj.rendererPrefs),
  };
};
