type DesktopState = {
  backendUrl: string;
  backendError: string;
  windowsPreflightMessages: string[];
  appDirs: { root: string; config: string; logs: string; cache: string } | null;
  isDev: boolean;
};

declare global {
  interface Window {
    desktopApi: {
      getState: () => Promise<DesktopState>;
    };
  }
}

const status = document.querySelector("#status");
const details = document.querySelector("#details");

const render = async (): Promise<void> => {
  const state = await window.desktopApi.getState();
  if (!status || !details) {
    return;
  }

  if (state.backendError) {
    status.textContent = "Backend status: error";
  } else if (state.backendUrl) {
    status.textContent = `Backend status: ready (${state.backendUrl})`;
  } else {
    status.textContent = "Backend status: starting";
  }

  details.textContent = JSON.stringify(state, null, 2);
};

void render();
