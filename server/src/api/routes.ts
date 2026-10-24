/** The account API under /api (the routes are listed in shared/src/net/accounts.ts). */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AccountInfo } from "@infinite-tower/shared";
import { LoginRequest, RegisterRequest } from "@infinite-tower/shared/net/account-requests";
import type { z } from "zod";
import type { Accounts } from "../core/accounts/accounts.js";
import type { Account } from "../core/ports.js";
import { clearedCookie, sessionCookie, sessionToken } from "./cookies.js";
import { HttpError, readJson, sendError, sendJson } from "./http.js";

/** Handles /api/* and returns true, or returns false for anything else. */
export type ApiHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;

export function accountRoutes(accounts: Accounts, secureCookies: boolean): ApiHandler {
  const loggedIn = async (res: ServerResponse, account: Account, status: number) => {
    const session = await accounts.startSession(account.id);
    sendJson(res, status, info(account), { "set-cookie": sessionCookie(session, secureCookies) });
  };

  const routes: Record<string, (req: IncomingMessage, res: ServerResponse) => Promise<void>> = {
    async "POST /api/register"(req, res) {
      const { username, password } = await body(req, RegisterRequest);
      const account = await accounts.create(username, password);
      if (!account) throw new HttpError(409, "That username is taken.");
      await loggedIn(res, account, 201);
    },
    async "POST /api/login"(req, res) {
      const { username, password } = await body(req, LoginRequest);
      const account = await accounts.verify(username, password);
      if (!account) throw new HttpError(401, "Wrong username or password.");
      await loggedIn(res, account, 200);
    },
    async "POST /api/logout"(req, res) {
      const token = sessionToken(req);
      if (token) await accounts.endSession(token);
      res.writeHead(204, { "set-cookie": clearedCookie(secureCookies) }).end();
    },
    async "GET /api/me"(req, res) {
      const token = sessionToken(req);
      const account = token ? await accounts.forToken(token) : null;
      if (!account) throw new HttpError(401, "Not logged in.");
      sendJson(res, 200, info(account));
    },
  };

  return async (req, res) => {
    const path = new URL(req.url ?? "/", "http://x").pathname;
    if (!path.startsWith("/api/")) return false;
    const route = routes[`${req.method} ${path}`];
    try {
      if (!route) throw new HttpError(404, "No such API route.");
      await route(req, res);
    } catch (err) {
      if (err instanceof HttpError) sendError(res, err.status, err.message);
      else {
        console.error(`[api] ${req.method} ${path} failed`, err);
        sendError(res, 500, "Something went wrong on the server. Try again.");
      }
    }
    return true;
  };
}

const info = (account: Account): AccountInfo => ({ username: account.username });

/** The first rule a body breaks becomes the error message. */
async function body<T>(req: IncomingMessage, schema: z.ZodType<T>): Promise<T> {
  const result = schema.safeParse(await readJson(req));
  if (!result.success) throw new HttpError(400, result.error.issues[0]?.message ?? "That request isn't valid.");
  return result.data;
}
