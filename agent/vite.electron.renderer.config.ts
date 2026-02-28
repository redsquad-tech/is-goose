import { defineConfig } from "vite";

export default defineConfig({
  root: "src/desktop/renderer",
  build: {
    outDir: "../../../.vite/renderer/main_window",
    emptyOutDir: true,
  },
});
