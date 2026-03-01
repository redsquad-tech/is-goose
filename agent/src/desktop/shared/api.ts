export type DesktopState = {
  backendUrl: string;
  backendError: string;
  windowsPreflightMessages: string[];
  appDirs: { root: string; config: string; logs: string; cache: string } | null;
  isDev: boolean;
};

export type DesktopApi = {
  getState: () => Promise<DesktopState>;
};
