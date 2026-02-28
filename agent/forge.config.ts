import { VitePlugin } from "@electron-forge/plugin-vite";
import { MakerDEB } from "@electron-forge/maker-deb";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerRPM } from "@electron-forge/maker-rpm";
import { MakerWix } from "@electron-forge/maker-wix";

const config = {
  packagerConfig: {
    asar: true,
    extraResource: ["src/desktop/resources/bin"],
  },
  rebuildConfig: {},
  makers: [
    new MakerDMG({
      format: "ULFO",
    }),
    new MakerWix({
      language: 1033,
      manufacturer: "Goose Agent",
    }),
    new MakerDEB({}),
    new MakerRPM({}),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/desktop/main.ts",
          config: "vite.electron.main.config.ts",
        },
        {
          entry: "src/desktop/preload.ts",
          config: "vite.electron.preload.config.ts",
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
