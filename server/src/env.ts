/** The server's settings, from environment variables; locally from the repo's .env, which they win over. */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const ENV_FILE = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

export const DEV = process.env.NODE_ENV !== "production";
export const PORT = Number(process.env.PORT ?? 8787);
/** Required: there's no built-in default, so .env is the one place the dev database's address is written. */
export const DATABASE_URL = process.env.DATABASE_URL;

/** A whole number, written plainly ("50", not "50ms" or "5e1"). */
const WholeNumber = z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().nonnegative());

export const DEFAULT_DEV_PING_MS = 50;

/** A page's `?ping=`, or null if it isn't a whole number of ms. */
export function parsePingMs(raw: string | undefined): number | null {
  const parsed = WholeNumber.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * The round trip a dev server simulates on every game socket, half each way. Anything but a whole number of ms
 * stops the server; production never delays.
 */
export function parseDevPing(raw: string | undefined, dev: boolean): number {
  if (!dev) return 0;
  if (raw === undefined || raw === "") return DEFAULT_DEV_PING_MS;
  const parsed = WholeNumber.safeParse(raw);
  if (!parsed.success) throw new Error(`DEV_PING_MS must be a whole number of milliseconds, 0 or more (got "${raw}")`);
  return parsed.data;
}

export const DEV_PING_MS = parseDevPing(process.env.DEV_PING_MS, DEV);

export const DEFAULT_SERVER_NAME = "Local";
export const DEFAULT_MAX_PLAYERS = 50;

export function parseServerName(raw: string | undefined): string {
  return raw?.trim() || DEFAULT_SERVER_NAME;
}

export function parseMaxPlayers(raw: string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_MAX_PLAYERS;
  const parsed = WholeNumber.safeParse(raw);
  if (!parsed.success || parsed.data < 1) throw new Error(`MAX_PLAYERS must be a whole number, 1 or more (got "${raw}")`);
  return parsed.data;
}

export const SERVER_NAME = parseServerName(process.env.SERVER_NAME);
export const MAX_PLAYERS = parseMaxPlayers(process.env.MAX_PLAYERS);
