import { defineConfig } from "vite";

export default defineConfig({
  // Havok ships a .wasm file that Vite's dep pre-bundler would break.
  optimizeDeps: { exclude: ["@babylonjs/havok"] },
  server: { port: 5173 },
});
