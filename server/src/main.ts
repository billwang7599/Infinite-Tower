/**
 * Infinite Tower server. Authoritative for everything a player shouldn't be able to change:
 * field layout, encounters, map enemies, enemy stats, fight results and progress.
 *
 *   content/   game data (field, arena, enemy stats)     field/    field simulation (ECS systems)
 *   battle/    fight-result checks                       session   one connected player
 *
 * WebSocket at /ws; in production it also serves client/dist over HTTP.
 */
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { FIXED_DT } from "@infinite-tower/shared";
import { WebSocketServer } from "ws";
import { Session } from "./session.js";
import { serveStatic } from "./static.js";

const PORT = Number(process.env.PORT ?? 8787);
const DEV = process.env.NODE_ENV !== "production";
const CLIENT_DIST = fileURLToPath(new URL("../../client/dist", import.meta.url));

const sessions = new Set<Session>();
const http = createServer(serveStatic(CLIENT_DIST));
const wss = new WebSocketServer({ server: http, path: "/ws" });

wss.on("connection", (ws) => {
  const session = new Session((msg) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); }, DEV);
  sessions.add(session);
  ws.on("message", (data) => session.onMessage(String(data)));
  ws.on("close", () => sessions.delete(session));
});

// Fixed 60 Hz simulation for every session.
let last = performance.now(), acc = 0;
setInterval(() => {
  const now = performance.now();
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  while (acc >= FIXED_DT) {
    for (const s of sessions) s.tick(FIXED_DT);
    acc -= FIXED_DT;
  }
}, 5);

http.listen(PORT, () => console.log(`[server] ${DEV ? "dev" : "production"} on http://localhost:${PORT} (ws /ws)`));
