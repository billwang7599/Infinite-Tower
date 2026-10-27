/** The HTTP server: the account API (/api), the door to the game socket (/ws), and the built client in production. */
import { join, sep } from "node:path";
import fastifyCookie from "@fastify/cookie";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import type { Accounts } from "../core/accounts/accounts.js";
import { HttpError, onError, onNotFound } from "./errors.js";
import { gameSocketRoute, type GameSocket } from "./routes/game-socket.js";
import { accountRoutes } from "./routes/accounts.js";

export interface ServerOptions {
  port: number;
  /** client/dist; in dev Vite serves the client and proxies /ws and /api here. */
  clientDist: string;
  accounts: Accounts;
  /** HTTPS only: on in production, off for dev's plain http://localhost. */
  secureCookies: boolean;
  socket: GameSocket;
}

const MAX_BODY_BYTES = 4 * 1024;
/** Vite puts a hash of each file's contents in its name under assets/, so a browser can keep those for good. */
const CACHE_FOREVER = "public, max-age=31536000, immutable";

/** The server, ready but not listening: `startServer` listens, and a test can `app.inject()` requests instead. */
export async function buildServer(opts: ServerOptions): Promise<FastifyInstance> {
  const app = Fastify({ bodyLimit: MAX_BODY_BYTES });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  // JSON is the only body there is. That also keeps other sites out: a cross-site form can send text/plain, but
  // not application/json without the browser asking this server first (CORS), and it says no.
  app.removeContentTypeParser("text/plain");
  app.setErrorHandler(onError);
  app.setNotFoundHandler(onNotFound);
  app.addHook("onRequest", async (req, reply) => {
    if (req.url.startsWith("/api/")) reply.header("cache-control", "no-store");
  });

  await app.register(fastifyCookie);
  await app.register(fastifyRateLimit, {
    global: false,
    errorResponseBuilder: (_req, limit) =>
      new HttpError(limit.statusCode, `Too many tries. Wait ${limit.after} and try again.`),
  });
  // At the top so its hooks see every route: an upgrade to anything but /ws is answered or closed, never left open.
  await app.register(fastifyWebsocket, { options: { maxPayload: opts.socket.maxMessageBytes } });

  await app.register(accountRoutes, { prefix: "/api", accounts: opts.accounts, secureCookies: opts.secureCookies });
  await app.register(gameSocketRoute, { accounts: opts.accounts, socket: opts.socket });
  const assets = join(opts.clientDist, "assets") + sep;
  await app.register(fastifyStatic, {
    root: opts.clientDist,
    cacheControl: false,
    // Everything else (index.html) is checked with the server on each load, and only downloaded when it changed.
    setHeaders: (reply, path) => reply.header("cache-control", path.startsWith(assets) ? CACHE_FOREVER : "no-cache"),
  });
  return app;
}

/** On every interface, so it's reachable from outside in production. */
export async function startServer(opts: ServerOptions): Promise<void> {
  const app = await buildServer(opts);
  await app.listen({ port: opts.port, host: "::" });
}
