import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: ".vite/build",
    sourcemap: true,
    lib: {
      entry: "src/desktop/preload.ts",
      formats: ["es"],
      fileName: () => "preload.js",
    },
    rollupOptions: {
      external: ["electron"],
    },
  },
});
