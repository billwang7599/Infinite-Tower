/**
 * The account API under /api (the routes are listed in shared/src/net/accounts.ts).
 * Each body is checked against its shared Zod schema before the handler runs.
 */
import type { AccountInfo } from "@infinite-tower/shared";
import { LoginRequest, RegisterRequest } from "@infinite-tower/shared/net/account-requests";
import type { FastifyReply } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Accounts } from "../../core/accounts/accounts.js";
import type { Account } from "../../core/ports.js";
import { clearSessionCookie, sessionToken, setSessionCookie } from "../cookies.js";
import { HttpError } from "../errors.js";

export interface AccountRoutesOptions {
  accounts: Accounts;
  secureCookies: boolean;
}

/**
 * Tries at logging in and signing up, together, per IP address. Password hashing is slow on purpose, and this
 * keeps guessing slow too (and the server's CPU free).
 */
const LOGIN_LIMIT = { max: 20, timeWindow: "1 minute" };

export const accountRoutes: FastifyPluginAsyncZod<AccountRoutesOptions> = async (app, { accounts, secureCookies }) => {
  const limited = app.rateLimit(LOGIN_LIMIT);
  const loggedIn = async (reply: FastifyReply, account: Account, status: number) => {
    setSessionCookie(reply, await accounts.startSession(account.id), secureCookies);
    return reply.code(status).send(accountInfo(account));
  };

  app.post("/register", { schema: { body: RegisterRequest }, onRequest: limited }, async (req, reply) => {
    const account = await accounts.create(req.body.username, req.body.password);
    if (!account) throw new HttpError(409, "That username is taken.");
    return loggedIn(reply, account, 201);
  });

  app.post("/login", { schema: { body: LoginRequest }, onRequest: limited }, async (req, reply) => {
    const account = await accounts.verify(req.body.username, req.body.password);
    if (!account) throw new HttpError(401, "Wrong username or password.");
    return loggedIn(reply, account, 200);
  });

  app.post("/logout", async (req, reply) => {
    const token = sessionToken(req);
    if (token) await accounts.endSession(token);
    clearSessionCookie(reply, secureCookies);
    return reply.code(204).send();
  });

  app.get("/me", async (req) => {
    const token = sessionToken(req);
    const account = token ? await accounts.forToken(token) : null;
    if (!account) throw new HttpError(401, "Not logged in.");
    return accountInfo(account);
  });
};

const accountInfo = (account: Account): AccountInfo => ({ username: account.username });
