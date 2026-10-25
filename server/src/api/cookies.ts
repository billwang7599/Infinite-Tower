/** The login cookie. httpOnly (page scripts can't read it) and SameSite=Lax (other sites can't send it with a POST). */
import type { CookieSerializeOptions } from "@fastify/cookie";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { LoginSession } from "../core/accounts/accounts.js";

const COOKIE_NAME = "it_session";

export const sessionToken = (req: FastifyRequest): string | null => req.cookies[COOKIE_NAME] || null;

/** `secure` (HTTPS only) in production; dev is plain http://localhost. */
export function setSessionCookie(reply: FastifyReply, session: LoginSession, secure: boolean): void {
  reply.setCookie(COOKIE_NAME, session.token, { ...options(secure), expires: session.expires });
}

export function clearSessionCookie(reply: FastifyReply, secure: boolean): void {
  reply.clearCookie(COOKIE_NAME, options(secure));
}

const options = (secure: boolean): CookieSerializeOptions => ({ path: "/", httpOnly: true, sameSite: "lax", secure });
