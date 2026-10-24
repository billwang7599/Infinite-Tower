/** HTTP (the account API, plus the built client in production) and the WebSocket endpoint at /ws. */
import { createServer, type IncomingMessage } from "node:http";
import { CLOSE_CODES } from "@infinite-tower/shared";
import { WebSocketServer } from "ws";
import type { Account } from "../auth/accounts.js";
import type { ApiHandler } from "../auth/routes.js";
import { Connection } from "./connection.js";
import { serveStatic } from "./static.js";

export interface ServerOptions {
  port: number;
  /** client/dist; in dev Vite serves the client and proxies /ws and /api here. */
  clientDist: string;
  api: ApiHandler;
  /** Who a socket's upgrade request is logged in as (from its cookie), or null. */
  authenticate(req: IncomingMessage): Promise<Account | null>;
  onConnection(conn: Connection, account: Account): void;
}

/** Messages are small JSON; anything bigger is refused by ws. */
const MAX_PAYLOAD = 16 * 1024;

export function startServer(opts: ServerOptions, onListening: () => void): void {
  const files = serveStatic(opts.clientDist);
  const http = createServer((req, res) => {
    opts.api(req, res).then((handled) => { if (!handled) void files(req, res); });
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });

  http.on("upgrade", (req, socket, head) => {
    if (new URL(req.url ?? "/", "http://x").pathname !== "/ws") { socket.destroy(); return; }
    opts.authenticate(req).then(
      (account) => wss.handleUpgrade(req, socket, head, (ws) => {
        const conn = new Connection(ws);
        // Accepted then closed, rather than refused, so the browser learns why (it can't see an HTTP status).
        if (!account) conn.close(CLOSE_CODES.notLoggedIn, "not logged in");
        else opts.onConnection(conn, account);
      }),
      (err: unknown) => {
        console.error("[ws] checking a login failed", err);
        socket.end("HTTP/1.1 503 Service Unavailable\r\n\r\n");
      },
    );
  });
  http.listen(opts.port, onListening);
}
