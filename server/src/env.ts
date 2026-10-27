/**
 * The server's settings, from environment variables. Locally they come from the repo's .env (a copy of
 * .env.example); a variable already set in the environment wins over the file, and production can set them
 * any way it likes, with or without a .env.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const ENV_FILE = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

export const DEV = process.env.NODE_ENV !== "production";
export const PORT = Number(process.env.PORT ?? 8787);
/** Required: there's no built-in default, so .env is the one place the dev database's address is written. */
export const DATABASE_URL = process.env.DATABASE_URL;

/** A ping in milliseconds: a whole number, 0 or more, written plainly ("50", not "50ms" or "5e1"). */
const PingMs = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().nonnegative());

/** The simulated ping when DEV_PING_MS is left out. */
export const DEFAULT_DEV_PING_MS = 50;

/** A page's `?ping=` as milliseconds, or null if it isn't one (missing, negative, not whole, not a number). */
export function parsePingMs(raw: string | undefined): number | null {
  const parsed = PingMs.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * DEV_PING_MS: the round trip a dev server simulates on every game socket, half each way (ws/delay.ts), so client
 * prediction can be felt on localhost. Left out (or empty): DEFAULT_DEV_PING_MS. Anything but a whole number of
 * milliseconds stops the server. Production never delays (0), whatever is set.
 */
export function parseDevPing(raw: string | undefined, dev: boolean): number {
  if (!dev) return 0;
  if (raw === undefined || raw === "") return DEFAULT_DEV_PING_MS;
  const parsed = PingMs.safeParse(raw);
  if (!parsed.success) throw new Error(`DEV_PING_MS must be a whole number of milliseconds, 0 or more (got "${raw}")`);
  return parsed.data;
}

export const DEV_PING_MS = parseDevPing(process.env.DEV_PING_MS, DEV);
