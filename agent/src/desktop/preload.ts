import { contextBridge, ipcRenderer } from "electron";

type DesktopState = {
  backendUrl: string;
  backendError: string;
  windowsPreflightMessages: string[];
  appDirs: { root: string; config: string; logs: string; cache: string } | null;
  isDev: boolean;
};

contextBridge.exposeInMainWorld("desktopApi", {
  getState: (): Promise<DesktopState> =>
    ipcRenderer.invoke("desktop:get-state"),
});
