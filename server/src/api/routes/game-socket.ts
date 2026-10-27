/** The door to the game socket (/ws): checks the upgrade's login cookie, then hands the socket on. */
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import type { Accounts } from "../../core/accounts/accounts.js";
import type { Account } from "../../core/ports.js";
import { sessionToken } from "../cookies.js";

/** What main.ts plugs in here (ws/sockets.ts). */
export interface GameSocket {
  /** Bigger messages are refused (by ws, close 1009) before anyone reads them. */
  maxMessageBytes: number;
  /** `account` null: not logged in. `askedPing`: the page's `?ping=`, as it came. */
  accept(socket: WebSocket, account: Account | null, askedPing: string | undefined): void;
}

export interface GameSocketOptions {
  accounts: Accounts;
  socket: GameSocket;
}

export const gameSocketRoute: FastifyPluginAsync<GameSocketOptions> = async (app, { accounts, socket }) => {
  const accountOf = new WeakMap<FastifyRequest, Account | null>();

  app.get("/ws", {
    websocket: true,
    // Before the upgrade, so a failed lookup is still an HTTP answer (503), not a socket that opens and dies.
    async preHandler(req, reply) {
      const token = sessionToken(req);
      try {
        accountOf.set(req, token ? await accounts.forToken(token) : null);
      } catch (err) {
        console.error("[ws] checking a login failed", err);
        return reply.code(503).send();
      }
    },
  }, (ws, req) => {
    const { ping } = req.query as { ping?: unknown };
    socket.accept(ws, accountOf.get(req) ?? null, typeof ping === "string" ? ping : undefined);
  });
};
