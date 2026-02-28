import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { BrowserWindow, app, ipcMain } from "electron";
import { runWindowsPreflight } from "./windowsPreflight.js";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;

const isDev = !app.isPackaged;
const defaultDevServerUrl = "http://127.0.0.1:3001";

const createAppDirs = (): {
  root: string;
  config: string;
  logs: string;
  cache: string;
} => {
  const root = app.getPath("userData");
  const config = path.join(root, "config");
  const logs = path.join(root, "logs");
  const cache = path.join(root, "cache");

  fs.mkdirSync(config, { recursive: true });
  fs.mkdirSync(logs, { recursive: true });
  fs.mkdirSync(cache, { recursive: true });

  return { root, config, logs, cache };
};

const backendScriptPath = (): string => {
  return path.join(process.resourcesPath, "bin", "mock-backend.mjs");
};

const resolveDevBackendUrl = (): string =>
  process.env.AGENT_SERVER_URL ?? defaultDevServerUrl;

const waitForHealth = async (baseUrl: string): Promise<void> => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/status`);
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Backend health check timed out");
};

const startBackend = async (dirs: {
  root: string;
  config: string;
  logs: string;
  cache: string;
}): Promise<{ process: ChildProcessWithoutNullStreams; baseUrl: string }> => {
  const port = Number(process.env.AGENT_DESKTOP_BACKEND_PORT ?? "43111");
  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn(process.execPath, [backendScriptPath()], {
    env: {
      ...process.env,
      AGENT_BACKEND_PORT: String(port),
      AGENT_PATH_ROOT: dirs.root,
      AGENT_CONFIG_DIR: dirs.config,
      AGENT_LOGS_DIR: dirs.logs,
      AGENT_CACHE_DIR: dirs.cache,
    },
    stdio: "pipe",
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[desktop-backend] ${String(chunk)}`);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[desktop-backend] ${String(chunk)}`);
  });

  await waitForHealth(baseUrl);
  return { process: child, baseUrl };
};

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcessWithoutNullStreams | null = null;
let backendUrl = "";
let backendError = "";
let windowsPreflightMessages: string[] = [];
let appDirs: {
  root: string;
  config: string;
  logs: string;
  cache: string;
} | null = null;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, "../renderer/main_window/index.html"),
    );
  }
};

ipcMain.handle("desktop:get-state", () => {
  return {
    backendUrl,
    backendError,
    windowsPreflightMessages,
    appDirs,
    isDev,
  };
});

const shutdownBackend = (): void => {
  if (!backendProcess || backendProcess.killed) {
    return;
  }
  backendProcess.kill("SIGTERM");
};

void app.whenReady().then(async () => {
  const preflight = runWindowsPreflight();
  windowsPreflightMessages = preflight.messages;
  if (!preflight.ok) {
    backendError = `Windows preflight failed: ${preflight.messages.join(" ")}`;
  }

  appDirs = createAppDirs();
  if (!backendError) {
    try {
      if (isDev) {
        backendUrl = resolveDevBackendUrl();
        await waitForHealth(backendUrl);
      } else {
        const started = await startBackend(appDirs);
        backendProcess = started.process;
        backendUrl = started.baseUrl;
      }
    } catch (error: unknown) {
      backendError = error instanceof Error ? error.message : String(error);
    }
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  shutdownBackend();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  shutdownBackend();
});
