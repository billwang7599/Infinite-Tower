/** The arena fight's netcode numbers, which the client and the server agree on. */
import { FIXED_DT } from "../core/time.js";

/** The server sends `battleHash` after every step that's a multiple of this: 4 times a second at 60 steps. */
export const HASH_EVERY_STEPS = 15;

/**
 * Seconds an input may be late and still run on its own step: the server holds its fight back for it that long.
 * A later one runs on the server's next step. A cheat could abuse this window: plan/server-fights.md.
 */
const MAX_INPUT_DELAY = 0.2;
export const MAX_INPUT_DELAY_STEPS = Math.round(MAX_INPUT_DELAY / FIXED_DT);

/** An input further ahead of the server's clock is dropped, so a client can't run ahead of real time. */
export const MAX_INPUT_LEAD_STEPS = 6;
