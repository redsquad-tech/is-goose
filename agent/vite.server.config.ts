import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: ".vite/build",
    sourcemap: true,
    lib: {
      entry: "src/server/index.ts",
      formats: ["es"],
      fileName: () => "server.js",
    },
    rollupOptions: {
      external: [/^node:/, "fastify", "@fastify/swagger", "openapi-sampler"],
    },
  },
});
