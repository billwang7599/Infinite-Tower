/**
 * The game socket. api/ has already checked the upgrade's login and opened it; this plugs it into core: the socket
 * becomes the player's `PlayerLink`, and each message it brings is one call on their session.
 */
import { CLOSE_CODES, dispatch } from "@infinite-tower/shared";
import type { WebSocket } from "ws";
import type { OnlinePlayers } from "../core/game/online.js";
import type { Account } from "../core/ports.js";
import { Connection } from "./connection.js";
import { handlers } from "./handlers.js";

export function gameSockets(online: OnlinePlayers) {
  return {
    /** Messages are small JSON; anything bigger is refused by ws. */
    maxMessageBytes: 16 * 1024,

    accept(ws: WebSocket, account: Account | null): void {
      const conn = new Connection(ws);
      // Opened then closed, rather than refused, so the browser learns why (it can't see an HTTP status).
      if (!account) { conn.close(CLOSE_CODES.notLoggedIn, "not logged in"); return; }
      void online.join(conn, account).then((session) => {
        if (!session) return;
        conn.onMessage((msg) => dispatch(handlers, msg, session));
        conn.onClose(() => online.leave(session));
      });
    },
  };
}
