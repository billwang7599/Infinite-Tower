/**
 * Infinite Tower server. Authoritative for everything a player shouldn't be able to change:
 * levels, encounters, field actors, enemy stats, fight results and progress.
 *
 *   net/       sockets: HTTP + /ws, message validation (Zod), static files
 *   game/      sessions (one per player), message handlers, encounters, snapshots, the tick loop
 *   levels/    level data: layout, spawns, encounter tables
 *   field/     the 2D field's simulation: actor components, behaviors, prefabs, spawner, the player's walking
 *   content/   enemy stats
 *   store/     what's kept about a player between connections (a stub for now)
 */
import { fileURLToPath } from "node:url";
import { dispatch } from "@infinite-tower/shared";
import { handlers } from "./game/handlers.js";
import { startLoop } from "./game/loop.js";
import { Session } from "./game/session.js";
import { START_LEVEL } from "./levels/index.js";
import type { Connection } from "./net/connection.js";
import { startServer } from "./net/server.js";
import { GUEST, type PlayerId, type PlayerStore } from "./store/player-store.js";
import { StubPlayerStore } from "./store/stub-store.js";

const PORT = Number(process.env.PORT ?? 8787);
const DEV = process.env.NODE_ENV !== "production";
const CLIENT_DIST = fileURLToPath(new URL("../../client/dist", import.meta.url));

const store: PlayerStore = new StubPlayerStore();
const sessions = new Set<Session>();

startServer({
  port: PORT,
  clientDist: CLIENT_DIST,
  onConnection(conn) {
    join(conn, GUEST).catch((err: unknown) => {
      console.error(`[store] loading ${GUEST} failed`, err);
      conn.close(1011, "couldn't load your save");
    });
  },
}, () => console.log(`[server] ${DEV ? "dev" : "production"} on http://localhost:${PORT} (ws /ws)`));

/** Messages that arrive while the save loads are dropped; the client sends nothing before `welcome` anyway. */
async function join(conn: Connection, id: PlayerId): Promise<void> {
  const saved = await store.load(id);
  if (!conn.open) return;
  const session = new Session(conn, DEV, saved, (data) => {
    store.save(id, data).catch((err: unknown) => console.error(`[store] saving ${id} failed`, err));
  });
  sessions.add(session);
  conn.onMessage((msg) => dispatch(handlers, msg, session));
  conn.onClose(() => {
    sessions.delete(session);
    session.save();
  });
  session.enterLevel(START_LEVEL);
}

startLoop(sessions);
