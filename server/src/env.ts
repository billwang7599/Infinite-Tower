/**
 * The server's settings, from environment variables. Locally they come from the repo's .env (a copy of
 * .env.example); a variable already set in the environment wins over the file, and production can set them
 * any way it likes, with or without a .env.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ENV_FILE = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

export const DEV = process.env.NODE_ENV !== "production";
export const PORT = Number(process.env.PORT ?? 8787);
/** Required: there's no built-in default, so .env is the one place the dev database's address is written. */
export const DATABASE_URL = process.env.DATABASE_URL;
