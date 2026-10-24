/**
 * The HTTP server: the account API (/api), the built client in production, and the door to the game socket.
 * A /ws upgrade is checked here, since its cookie arrives with the HTTP request, then handed on with the account
 * it's logged in as; what happens to the socket after that is ws/'s business.
 */
import { createServer, type IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { Accounts } from "../core/accounts/accounts.js";
import type { Account } from "../core/ports.js";
import { sessionToken } from "./cookies.js";
import { accountRoutes } from "./routes.js";
import { serveStatic } from "./static.js";

export interface ServerOptions {
  port: number;
  /** client/dist; in dev Vite serves the client and proxies /ws and /api here. */
  clientDist: string;
  accounts: Accounts;
  /** Only sent over HTTPS: on in production, off for dev's plain http://localhost. */
  secureCookies: boolean;
  /** An upgrade request to /ws, and who its cookie says it is (null: not logged in). */
  onSocket(req: IncomingMessage, socket: Duplex, head: Buffer, account: Account | null): void;
}

export function startServer(opts: ServerOptions, onListening: () => void): void {
  const api = accountRoutes(opts.accounts, opts.secureCookies);
  const files = serveStatic(opts.clientDist);
  const http = createServer((req, res) => {
    api(req, res).then((handled) => { if (!handled) void files(req, res); });
  });

  http.on("upgrade", (req, socket, head) => {
    if (new URL(req.url ?? "/", "http://x").pathname !== "/ws") { socket.destroy(); return; }
    const token = sessionToken(req);
    (token ? opts.accounts.forToken(token) : Promise.resolve(null)).then(
      (account) => opts.onSocket(req, socket, head, account),
      (err: unknown) => {
        console.error("[ws] checking a login failed", err);
        socket.end("HTTP/1.1 503 Service Unavailable\r\n\r\n");
      },
    );
  });
  http.listen(opts.port, onListening);
}
