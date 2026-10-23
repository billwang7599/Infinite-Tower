/**
 * Infinite Tower server. Authoritative for everything a player shouldn't be able to change:
 * levels, encounters, field actors, enemy stats, fight results and progress.
 *
 *   net/       sockets: HTTP + /ws, message validation (Zod), static files
 *   game/      sessions (one per player), message handlers, encounters, snapshots, the tick loop
 *   levels/    level data: layout, spawns, encounter tables
 *   field/     the 2D field's simulation: actor components, behaviors, prefabs, spawner, the player's walking
 *   content/   enemy stats
 */
import { fileURLToPath } from "node:url";
import { dispatch } from "@infinite-tower/shared";
import { handlers } from "./game/handlers.js";
import { startLoop } from "./game/loop.js";
import { Session } from "./game/session.js";
import { START_LEVEL } from "./levels/index.js";
import { startServer } from "./net/server.js";

const PORT = Number(process.env.PORT ?? 8787);
const DEV = process.env.NODE_ENV !== "production";
const CLIENT_DIST = fileURLToPath(new URL("../../client/dist", import.meta.url));

const sessions = new Set<Session>();

startServer({
  port: PORT,
  clientDist: CLIENT_DIST,
  onConnection(conn) {
    const session = new Session(conn, DEV);
    sessions.add(session);
    conn.onMessage((msg) => dispatch(handlers, msg, session));
    conn.onClose(() => sessions.delete(session));
    session.enterLevel(START_LEVEL);
  },
}, () => console.log(`[server] ${DEV ? "dev" : "production"} on http://localhost:${PORT} (ws /ws)`));

startLoop(sessions);
