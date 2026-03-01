import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  base: "./",
  root: "src/desktop/renderer",
  build: {
    outDir: "../../../.vite/renderer/main_window",
    emptyOutDir: true,
  },
});
