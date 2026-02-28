import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: ".vite/build",
    sourcemap: true,
    lib: {
      entry: "src/desktop/main.ts",
      formats: ["es"],
      fileName: () => "main.js",
    },
    rollupOptions: {
      external: ["electron"],
    },
  },
});
