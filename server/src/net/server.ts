/** HTTP (the built client, in production) plus the WebSocket endpoint at /ws. */
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { Connection } from "./connection.js";
import { serveStatic } from "./static.js";

export interface ServerOptions {
  port: number;
  /** client/dist; in dev Vite serves the client and proxies /ws here. */
  clientDist: string;
  onConnection(conn: Connection): void;
}

/** Messages are small JSON; anything bigger is refused by ws. */
const MAX_PAYLOAD = 16 * 1024;

export function startServer(opts: ServerOptions, onListening: () => void): void {
  const http = createServer(serveStatic(opts.clientDist));
  const wss = new WebSocketServer({ server: http, path: "/ws", maxPayload: MAX_PAYLOAD });
  wss.on("connection", (ws) => opts.onConnection(new Connection(ws)));
  http.listen(opts.port, onListening);
}
