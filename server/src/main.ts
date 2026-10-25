/**
 * Infinite Tower server. Authoritative for everything a player shouldn't be able to change: levels, encounters,
 * field actors, enemy stats, fight results and progress.
 *
 * It's built as ports and adapters (hexagonal). core/ is the game and knows nothing about sockets, HTTP or SQL; what
 * it needs from outside, it asks for through the interfaces in core/ports.ts. Each outlet plugs into core from one
 * side, and never into another outlet:
 *
 *   core/      the game: who's online, sessions, the field, fights, levels, content, accounts' rules
 *   ws/        outlet: the game socket (/ws). Messages in become session calls; the socket is the PlayerLink out
 *   api/       outlet: HTTP (Fastify). The account API (/api), the built client, and the login check on /ws
 *   db/        outlet: Postgres through Drizzle. The PlayerStore and AccountStore, migrations, the dev seed
 *   env.ts     settings from environment variables (.env locally)
 *
 * This file is the only one that sees them all: it builds each, plugs them together and runs the tick timer.
 * `npm run typecheck` enforces the rule (server/scripts/check-layers.ts).
 */
import { fileURLToPath } from "node:url";
import { startServer } from "./api/server.js";
import { Accounts } from "./core/accounts/accounts.js";
import { FixedClock } from "./core/game/clock.js";
import { OnlinePlayers } from "./core/game/online.js";
import { PgAccountStore } from "./db/account-store.js";
import { connectDb, errorText } from "./db/db.js";
import { PgPlayerStore } from "./db/player-store.js";
import { DEV, PORT } from "./env.js";
import { gameSockets } from "./ws/sockets.js";

const CLIENT_DIST = fileURLToPath(new URL("../../client/dist", import.meta.url));
/** How often the timer checks for due ticks. The ticks themselves are FIXED_DT apart (clock.ts). */
const TIMER_MS = 5;

/** Logs the error under `tag` and stops the server. */
const exitOn = (tag: string) => (err: unknown): never => {
  console.error(`[${tag}] ${errorText(err)}`);
  process.exit(1);
};

const db = await connectDb().catch(exitOn("db"));
const accounts = new Accounts(new PgAccountStore(db));
const online = new OnlinePlayers(new PgPlayerStore(db), DEV);

await startServer({
  port: PORT,
  clientDist: CLIENT_DIST,
  accounts,
  secureCookies: !DEV,
  socket: gameSockets(online),
}).catch(exitOn("server"));
console.log(`[server] ${DEV ? "dev" : "production"} on http://localhost:${PORT} (ws /ws, api /api)`);

const clock = new FixedClock((dt) => online.tick(dt));
let last = performance.now();
setInterval(() => {
  const now = performance.now();
  clock.advance((now - last) / 1000);
  last = now;
}, TIMER_MS);
