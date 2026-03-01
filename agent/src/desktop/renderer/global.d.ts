import type { DesktopApi } from "../shared/api.js";

declare global {
  interface Window {
    desktopApi: DesktopApi;
  }
}
