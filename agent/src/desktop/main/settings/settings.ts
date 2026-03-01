export type KeyboardShortcuts = {
  openSettings: string;
  newSession: string;
};

export type DesktopSettings = {
  showMenuBarIcon: boolean;
  showDockIcon: boolean;
  spellcheckEnabled: boolean;
  enableWakelock: boolean;
  keyboardShortcuts: KeyboardShortcuts;
};

export const DEFAULT_SETTINGS: DesktopSettings = {
  showMenuBarIcon: true,
  showDockIcon: true,
  spellcheckEnabled: true,
  enableWakelock: false,
  keyboardShortcuts: {
    openSettings: "Ctrl+,",
    newSession: "Ctrl+N",
  },
};

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const asString = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.length > 0 ? value : fallback;

export const normalizeSettings = (value: unknown): DesktopSettings => {
  if (!value || typeof value !== "object") {
    return DEFAULT_SETTINGS;
  }

  const obj = value as Record<string, unknown>;
  const shortcuts =
    obj.keyboardShortcuts && typeof obj.keyboardShortcuts === "object"
      ? (obj.keyboardShortcuts as Record<string, unknown>)
      : {};

  return {
    showMenuBarIcon: asBoolean(
      obj.showMenuBarIcon,
      DEFAULT_SETTINGS.showMenuBarIcon,
    ),
    showDockIcon: asBoolean(obj.showDockIcon, DEFAULT_SETTINGS.showDockIcon),
    spellcheckEnabled: asBoolean(
      obj.spellcheckEnabled,
      DEFAULT_SETTINGS.spellcheckEnabled,
    ),
    enableWakelock: asBoolean(
      obj.enableWakelock,
      DEFAULT_SETTINGS.enableWakelock,
    ),
    keyboardShortcuts: {
      openSettings: asString(
        shortcuts.openSettings,
        DEFAULT_SETTINGS.keyboardShortcuts.openSettings,
      ),
      newSession: asString(
        shortcuts.newSession,
        DEFAULT_SETTINGS.keyboardShortcuts.newSession,
      ),
    },
  };
};
