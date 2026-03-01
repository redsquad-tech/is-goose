import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: ".vite/build",
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: "src/desktop/main/index.ts",
      formats: ["es"],
      fileName: () => "main.js",
    },
    rollupOptions: {
      external: [/^node:/, "electron", "electron-store"],
    },
  },
});
