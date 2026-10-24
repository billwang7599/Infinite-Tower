/** The login cookie. httpOnly (page scripts can't read it) and SameSite=Lax (other sites can't send it with a POST). */
import type { IncomingMessage } from "node:http";
import type { LoginSession } from "../core/accounts/accounts.js";

const NAME = "it_session";

export function sessionToken(req: IncomingMessage): string | null {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq !== -1 && part.slice(0, eq).trim() === NAME) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

/** `secure` (HTTPS only) in production; dev is plain http://localhost. */
export function sessionCookie(session: LoginSession, secure: boolean): string {
  return cookie(session.token, `Expires=${session.expires.toUTCString()}`, secure);
}

export function clearedCookie(secure: boolean): string {
  return cookie("", "Max-Age=0", secure);
}

function cookie(value: string, lifetime: string, secure: boolean): string {
  return [`${NAME}=${encodeURIComponent(value)}`, lifetime, "Path=/", "HttpOnly", "SameSite=Lax", ...(secure ? ["Secure"] : [])].join("; ");
}
