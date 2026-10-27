/**
 * The game socket. api/ has already checked the upgrade's login and opened it; this plugs it into core: the socket
 * becomes the player's `PlayerLink`, and each message it brings is one call on their session.
 */
import { CLOSE_CODES, dispatch } from "@infinite-tower/shared";
import type { WebSocket } from "ws";
import type { OnlinePlayers } from "../core/game/online.js";
import type { Account } from "../core/ports.js";
import { parsePingMs } from "../env.js";
import { Connection } from "./connection.js";
import { handlers } from "./handlers.js";

/** Messages are small JSON; anything bigger is refused by ws (close 1009). */
const MAX_MESSAGE_BYTES = 16 * 1024;

/** The simulated ping (a dev tool): on a dev server, `pingMs` (DEV_PING_MS) unless the page asks for another. */
export interface PingOptions { dev: boolean; pingMs: number }

/** The round trip one connection simulates: none in production; in dev the page's `?ping=` if it's valid. */
export function connectionPingMs({ dev, pingMs }: PingOptions, asked: string | undefined): number {
  return dev ? parsePingMs(asked) ?? pingMs : 0;
}

export function gameSockets(online: OnlinePlayers, ping: PingOptions) {
  return {
    maxMessageBytes: MAX_MESSAGE_BYTES,

    /** `askedPing`: the page's `?ping=` on /ws, as it came. */
    accept(ws: WebSocket, account: Account | null, askedPing: string | undefined): void {
      const conn = new Connection(ws, connectionPingMs(ping, askedPing));
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
