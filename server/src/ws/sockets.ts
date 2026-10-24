/**
 * The game socket. api/ has already checked the upgrade's login; this accepts it and plugs it into core: the
 * socket becomes the player's `PlayerLink`, and each message it brings is one call on their session.
 */
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { CLOSE_CODES, dispatch } from "@infinite-tower/shared";
import { WebSocketServer } from "ws";
import type { OnlinePlayers } from "../core/game/online.js";
import type { Account } from "../core/ports.js";
import { Connection } from "./connection.js";
import { handlers } from "./handlers.js";

/** Messages are small JSON; anything bigger is refused by ws. */
const MAX_PAYLOAD = 16 * 1024;

export function gameSockets(online: OnlinePlayers) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });

  return (req: IncomingMessage, socket: Duplex, head: Buffer, account: Account | null): void => {
    wss.handleUpgrade(req, socket, head, (ws) => {
      const conn = new Connection(ws);
      // Accepted then closed, rather than refused, so the browser learns why (it can't see an HTTP status).
      if (!account) { conn.close(CLOSE_CODES.notLoggedIn, "not logged in"); return; }
      void online.join(conn, account).then((session) => {
        if (!session) return;
        conn.onMessage((msg) => dispatch(handlers, msg, session));
        conn.onClose(() => online.leave(session));
      });
    });
  };
}
