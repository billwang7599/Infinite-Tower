import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

/** The repo root, where .env is. Only this config reads it; none of it reaches the browser bundle. */
const ROOT = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => {
  // The game server (server/) listens on PORT; the browser always talks to /ws on the page's own host.
  const port = loadEnv(mode, ROOT, "").PORT || "8787";
  const proxy = { "/ws": { target: `ws://localhost:${port}`, ws: true } };
  return {
    plugins: [react(), tailwindcss()],
    // Havok ships a .wasm file that Vite's dep pre-bundler would break.
    optimizeDeps: { exclude: ["@babylonjs/havok"] },
    server: { port: 5173, proxy },
    preview: { proxy },
  };
});
