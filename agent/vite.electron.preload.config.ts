import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: ".vite/build",
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: "src/desktop/preload/index.ts",
      formats: ["cjs"],
      fileName: () => "preload.cjs",
    },
    rollupOptions: {
      external: [/^node:/, "electron"],
    },
  },
});
