/**
 * The door to the game socket (/ws). Its login cookie arrives with the upgrade request, so it's checked here; the
 * socket is then handed on with the account it belongs to, and what happens to it after that is ws/'s business.
 */
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import type { Accounts } from "../../core/accounts/accounts.js";
import type { Account } from "../../core/ports.js";
import { sessionToken } from "../cookies.js";

/** What main.ts plugs in here (ws/sockets.ts). */
export interface GameSocket {
  /** Bigger messages are refused (by ws, close 1009) before anyone reads them. */
  maxMessageBytes: number;
  /** A socket opened on /ws, and who its cookie says it is (null: not logged in). */
  accept(socket: WebSocket, account: Account | null): void;
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
  }, (ws, req) => socket.accept(ws, accountOf.get(req) ?? null));
};
