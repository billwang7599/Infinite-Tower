/**
 * Infinite Tower server. Authoritative for everything a player shouldn't be able to change:
 * levels, encounters, field actors, enemy stats, fight results and progress.
 *
 *   net/       sockets and HTTP: /ws, message validation (Zod), JSON helpers, static files
 *   auth/      accounts, passwords, login cookies, the /api routes
 *   game/      who's online, sessions (one per player), message handlers, encounters, snapshots, the tick loop
 *   levels/    level data: layout, spawns, encounter tables
 *   field/     the 2D field's simulation: actor components, behaviors, prefabs, spawner, the player's walking
 *   content/   enemy stats
 *   store/     what's kept about a player between connections
 *   db/        the database: Drizzle tables, connection, migrations, the dev seed
 *   env.ts     settings from environment variables (.env locally)
 */
import { fileURLToPath } from "node:url";
import { Accounts } from "./auth/accounts.js";
import { sessionToken } from "./auth/cookies.js";
import { accountRoutes } from "./auth/routes.js";
import { connectDb } from "./db/db.js";
import { DEV, PORT } from "./env.js";
import { startLoop } from "./game/loop.js";
import { OnlinePlayers } from "./game/online.js";
import { startServer } from "./net/server.js";
import type { PlayerStore } from "./store/player-store.js";
import { PgPlayerStore } from "./store/pg-player-store.js";

const CLIENT_DIST = fileURLToPath(new URL("../../client/dist", import.meta.url));

const db = await connectDb(DEV).catch((err: unknown) => {
  console.error(`[db] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
const accounts = new Accounts(db);
const store: PlayerStore = new PgPlayerStore(db);
const online = new OnlinePlayers(store, DEV);

startServer({
  port: PORT,
  clientDist: CLIENT_DIST,
  api: accountRoutes(accounts, !DEV),
  authenticate(req) {
    const token = sessionToken(req);
    return token ? accounts.forToken(token) : Promise.resolve(null);
  },
  onConnection: (conn, account) => online.join(conn, account),
}, () => console.log(`[server] ${DEV ? "dev" : "production"} on http://localhost:${PORT} (ws /ws, api /api)`));

startLoop(online.sessions);
