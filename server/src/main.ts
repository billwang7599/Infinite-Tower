/**
 * The server, hexagonal: core/ is the game, and the outlets (ws/, api/, db/) plug into it, never into each other.
 * This is the only file that sees them all: it builds each, plugs them together and runs the tick timer.
 */
import { fileURLToPath } from "node:url";
import { initPhysics } from "@infinite-tower/shared/fight";
import { GAME_SOCKET_PATH } from "./api/routes/game-socket.js";
import { startServer } from "./api/server.js";
import { Accounts } from "./core/accounts/accounts.js";
import { FixedClock } from "./core/game/clock.js";
import { OnlinePlayers } from "./core/game/online.js";
import { PgAccountStore } from "./db/account-store.js";
import { connectDb, errorText } from "./db/db.js";
import { PgPlayerStore } from "./db/player-store.js";
import { BEHIND_CLOUDFLARE, CHEATS, DEV, DEV_PING_MS, MAX_PLAYERS, PORT, SERVER_NAME } from "./env.js";
import { gameSockets } from "./ws/sockets.js";

const CLIENT_DIST = fileURLToPath(new URL("../../client/dist", import.meta.url));
/** How often the timer checks for due ticks. The ticks themselves are FIXED_DT apart (clock.ts). */
const TIMER_MS = 5;

const exitOn = (tag: string) => (err: unknown): never => {
  console.error(`[${tag}] ${errorText(err)}`);
  process.exit(1);
};

await initPhysics();
const db = await connectDb().catch(exitOn("db"));
const accounts = new Accounts(new PgAccountStore(db));
const online = new OnlinePlayers(new PgPlayerStore(db), CHEATS, MAX_PLAYERS);

await startServer({
  port: PORT,
  clientDist: CLIENT_DIST,
  accounts,
  secureCookies: !DEV,
  behindCloudflare: BEHIND_CLOUDFLARE,
  socket: gameSockets(online, { dev: DEV, pingMs: DEV_PING_MS }),
  servers: () => [
    { name: SERVER_NAME, socket: GAME_SOCKET_PATH, players: online.count, maxPlayers: online.maxPlayers },
  ],
}).catch(exitOn("server"));
console.log(`[server] ${DEV ? "dev" : "production"} on http://localhost:${PORT} (ws /ws, api /api)`);
if (CHEATS) console.log("[server] cheats on (CHEATS=1)");
if (DEV_PING_MS > 0) console.log(`[server] simulating a ${DEV_PING_MS} ms ping (DEV_PING_MS; ?ping=N per page)`);

const clock = new FixedClock((dt) => online.tick(dt));
let last = performance.now();
setInterval(() => {
  const now = performance.now();
  clock.advance((now - last) / 1000);
  last = now;
}, TIMER_MS);
