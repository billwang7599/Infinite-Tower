/**
 * The HTTP API's types (/api/register, /api/login, /api/logout, /api/me): plain HTTP, since the login cookie has to
 * exist before /ws opens. The rules are here so the form can say them up front; the server checks api-requests.ts.
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

/** A sentence the title screen can show as is. */
export interface ApiError {
  error: string;
}
