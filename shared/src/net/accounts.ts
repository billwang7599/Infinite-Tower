/**
 * The account API: plain HTTP next to the socket, since the login cookie has to exist before /ws opens.
 *
 *   POST /api/register  {username, password}  -> 201 AccountInfo, sets the cookie (409 if the name is taken)
 *   POST /api/login     {username, password}  -> 200 AccountInfo, sets the cookie (401 if wrong)
 *   POST /api/logout                          -> 204, clears the cookie
 *   GET  /api/me                              -> 200 AccountInfo, or 401 when not logged in
 *
 * Errors are `ApiError`, with a sentence the title screen can show as is. The server checks bodies with the
 * Zod schemas in account-requests.ts; these rules are here too so the form can say them up front.
 */
import type { TextRules } from "./text-rules.js";

export const USERNAME_RULES = {
  min: 3, max: 20, pattern: "^[A-Za-z0-9_\\-]+$", allowed: "letters, digits, _ or -",
} as const satisfies TextRules;
export const PASSWORD_RULES = { min: 8, max: 128 } as const;

export interface Credentials {
  username: string;
  password: string;
}

export interface AccountInfo {
  username: string;
}

export interface ApiError {
  error: string;
}

/** Why the server closed the socket (besides the standard codes). The client shows each as a sentence. */
export const CLOSE_CODES = {
  /** The same account joined from another tab or browser; the newer one plays. */
  replaced: 4000,
  /** No (or an expired) login cookie. */
  notLoggedIn: 4001,
} as const;
