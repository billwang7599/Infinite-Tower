import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

/** The repo root, where .env is. Only this config reads it; none of it reaches the browser bundle. */
const ROOT = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => {
  // The game server (server/) listens on PORT; the browser always talks to /ws and /api on the page's own host
  // (so the login cookie is the page's own, too).
  const port = loadEnv(mode, ROOT, "").PORT || "8787";
  const gameServer = {
    "/ws": { target: `ws://localhost:${port}`, ws: true },
    "/api": { target: `http://localhost:${port}` },
  };
  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173, proxy: gameServer },
    preview: { proxy: gameServer },
  };
});
