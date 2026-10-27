/** scrypt. A hash carries its own parameters and salt, `scrypt$N$r$p$salt$key`, so the cost can be raised later. */
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const COST = { N: 16384, r: 8, p: 1 };
const KEY_BYTES = 32;
const SALT_BYTES = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, KEY_BYTES, COST);
  return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64"), key.toString("base64")].join("$");
}

/** A damaged stored hash (only possible by editing the database) matches no password and never throws. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const hash = parseHash(stored);
  if (!hash) return false;
  try {
    return timingSafeEqual(await derive(password, hash.salt, KEY_BYTES, hash.cost), hash.key);
  } catch {
    return false; // a cost scrypt refuses: N not a power of two, or more memory than it allows
  }
}

function parseHash(stored: string): { cost: ScryptOptions; salt: Buffer; key: Buffer } | null {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const [N, r, p] = parts.slice(1, 4).map(wholeNumber);
  const salt = Buffer.from(parts[4]!, "base64");
  const key = Buffer.from(parts[5]!, "base64");
  if (!N || !r || !p || salt.length === 0 || key.length !== KEY_BYTES) return null;
  return { cost: { N, r, p }, salt, key };
}

/** "16384" → 16384; anything but a plain positive whole number → 0. */
const wholeNumber = (s: string): number => (/^[1-9]\d*$/.test(s) ? Number(s) : 0);

function derive(password: string, salt: Buffer, bytes: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, bytes, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}
