import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Havok ships a .wasm file that Vite's dep pre-bundler would break.
  optimizeDeps: { exclude: ["@babylonjs/havok"] },
  // The game server (server/) listens on 8787; the browser always talks to /ws on the page's own host.
  server: { port: 5173, proxy: { "/ws": { target: "ws://localhost:8787", ws: true } } },
  preview: { proxy: { "/ws": { target: "ws://localhost:8787", ws: true } } },
});
