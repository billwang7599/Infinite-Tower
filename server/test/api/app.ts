/** Builds the HTTP server for a test, on in-memory accounts and a throwaway client/dist, without listening. */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import type { GameServer } from "@infinite-tower/shared";
import type { WebSocket } from "ws";
import { Accounts } from "../../src/core/accounts/accounts.js";
import type { Account } from "../../src/core/ports.js";
import { buildServer } from "../../src/api/server.js";
import { MemoryAccountStore } from "../fixtures/fakes.js";

export interface TestApp {
  app: FastifyInstance;
  store: MemoryAccountStore;
  accounts: Accounts;
  /** Every socket handed to the game, with the account its cookie said and the ping its page asked for. */
  accepted: { ws: WebSocket; account: Account | null; ping: string | undefined }[];
}

export const INDEX_HTML = "<!doctype html><title>test</title>";
export const APP_JS = "console.log('app');";

export const TEST_SERVER: GameServer = { name: "Test", socket: "/ws", players: 3, maxPlayers: 10 };

export async function testApp(
  t: TestContext,
  opts: { secureCookies?: boolean; behindCloudflare?: boolean } = {},
): Promise<TestApp> {
  const clientDist = await mkdtemp(join(tmpdir(), "it-client-dist-"));
  await mkdir(join(clientDist, "assets"));
  await writeFile(join(clientDist, "index.html"), INDEX_HTML);
  await writeFile(join(clientDist, "assets", "app.js"), APP_JS);

  const store = new MemoryAccountStore();
  const accounts = new Accounts(store);
  const accepted: TestApp["accepted"] = [];
  const app = await buildServer({
    port: 0,
    clientDist,
    accounts,
    secureCookies: opts.secureCookies ?? false,
    behindCloudflare: opts.behindCloudflare ?? false,
    servers: () => [TEST_SERVER],
    socket: { maxMessageBytes: 1024, accept: (ws, account, ping) => accepted.push({ ws, account, ping }) },
  });
  t.after(async () => {
    for (const { ws } of accepted) ws.terminate();
    await app.close();
    await rm(clientDist, { recursive: true, force: true });
  });
  return { app, store, accounts, accepted };
}

export const post = (app: FastifyInstance, url: string, body: unknown, cookie?: string) =>
  app.inject({ method: "POST", url, payload: body as object, headers: cookie ? { cookie } : {} });

/** The `it_session` Set-Cookie header of a response; throws if there isn't one. */
export function sessionSetCookie(res: LightMyRequestResponse): string {
  const raw = res.headers["set-cookie"];
  const found = [raw].flat().find((c): c is string => typeof c === "string" && c.startsWith("it_session="));
  if (!found) throw new Error(`no it_session cookie in ${JSON.stringify(raw)}`);
  return found;
}

/** The `it_session=<token>` pair to send back as a Cookie header. */
export const sessionCookie = (res: LightMyRequestResponse): string => sessionSetCookie(res).split(";")[0]!;

/** Registers `username` and returns its Cookie header. */
export async function register(app: FastifyInstance, username = "asuna", password = "password1"): Promise<string> {
  const res = await post(app, "/api/register", { username, password });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.statusCode} ${res.body}`);
  return sessionCookie(res);
}
