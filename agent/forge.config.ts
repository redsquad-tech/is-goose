import { VitePlugin } from "@electron-forge/plugin-vite";
import { MakerDEB } from "@electron-forge/maker-deb";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerRPM } from "@electron-forge/maker-rpm";
import { MakerWix } from "@electron-forge/maker-wix";
import path from "node:path";

const appIconBase = path.resolve(
  "src",
  "desktop",
  "renderer",
  "assets",
  "app-icons",
  "generated",
  "icon",
);
const appIconPng = path.resolve(
  "src",
  "desktop",
  "renderer",
  "assets",
  "app-icons",
  "generated",
  "icon.png",
);

const config = {
  packagerConfig: {
    asar: true,
    icon: appIconBase,
  },
  rebuildConfig: {},
  makers: [
    new MakerDMG({
      format: "ULFO",
    }),
    new MakerWix({
      language: 1033,
      manufacturer: "Goose Agent",
      icon: `${appIconBase}.ico`,
    }),
    new MakerDEB({
      options: {
        icon: appIconPng,
      },
    }),
    new MakerRPM({
      options: {
        icon: appIconPng,
      },
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/desktop/main/index.ts",
          config: "vite.electron.main.config.ts",
        },
        {
          entry: "src/desktop/preload/index.ts",
          config: "vite.electron.preload.config.ts",
        },
        {
          entry: "src/server/index.ts",
          config: "vite.server.config.ts",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.electron.renderer.config.ts",
        },
      ],
    }),
  ],
};

export default config;
