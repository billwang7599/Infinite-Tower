/**
 * A fingerprint of a fight's state (state.ts), so the server and a client can check they agree without sending it.
 * Every number is rounded to 2 decimals first (1 cm, 0.01 s, 0.01 rad, like the states the server used to send),
 * so a last-bit difference between machines (Math.sin in another browser) doesn't count until it grows into
 * something that could be seen. Keys are sorted, so the order fields were made in doesn't matter.
 */
import { roundTo } from "../../core/math.js";
import type { Fight } from "./fight.js";
import { saveFight } from "./state.js";

const HASH_DECIMALS = 2;

export function hashFight(fight: Fight): number {
  return hashText(canonical(saveFight(fight)));
}

function canonical(value: unknown): string {
  if (typeof value === "number") return String(roundTo(value, HASH_DECIMALS) || 0);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${key}:${canonical(record[key])}`).join(",")}}`;
  }
  return String(value);
}

/** cyrb53: a quick 53-bit hash of a string (a fingerprint, not a lock: nothing secret depends on it). */
function hashText(text: string): number {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
