/**
 * Infinite Tower server. Authoritative for everything a player shouldn't be able to change:
 * levels, encounters, field actors, enemy stats, fight results and progress.
 *
 *   net/       sockets: HTTP + /ws, message validation (Zod), static files
 *   game/      sessions (one per player), message handlers, encounters, snapshots, the tick loop
 *   levels/    level data: layout, spawns, encounter tables
 *   field/     the 2D field's simulation: actor components, behaviors, prefabs, spawner, the player's walking
 *   content/   enemy stats
 *   store/     what's kept about a player between connections
 *   db/        the database: Drizzle tables, connection, migrations
 *   env.ts     settings from environment variables (.env locally)
 */
import { fileURLToPath } from "node:url";
import { dispatch } from "@infinite-tower/shared";
import { connectDb } from "./db/db.js";
import { DEV, PORT } from "./env.js";
import { handlers } from "./game/handlers.js";
import { startLoop } from "./game/loop.js";
import { Session } from "./game/session.js";
import { START_LEVEL } from "./levels/index.js";
import type { Connection } from "./net/connection.js";
import { startServer } from "./net/server.js";
import { GUEST, type PlayerId, type PlayerStore } from "./store/player-store.js";
import { PgPlayerStore } from "./store/pg-player-store.js";

const CLIENT_DIST = fileURLToPath(new URL("../../client/dist", import.meta.url));

const db = await connectDb(DEV).catch((err: unknown) => {
  console.error(`[db] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
const store: PlayerStore = new PgPlayerStore(db);
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
