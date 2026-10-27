/**
 * The arena fight on the wire: the numbers client and server agree on. The browser runs the whole fight itself, at
 * once, and sends only its inputs, each for a numbered step (battle/input.ts, StepInput); the server runs the same
 * fight on the same inputs at the same steps, and decides it. Four times a second it sends a hash of its fight's
 * state, and a client whose copy differs asks for the whole of it, takes it and replays its own inputs since.
 */
import { FIXED_DT } from "../core/time.js";

/** The server sends `battleHash` after every step that's a multiple of this: 4 times a second at 60 steps. */
export const HASH_EVERY_STEPS = 15;

/**
 * Seconds a player's input may be late (after the server's clock has reached its step) and still run on its own
 * step: the server holds its fight back for it that long. Later than that, it runs on the server's next step
 * instead, and the client is corrected. A cheat could hold inputs back this long on purpose: plan/server-fights.md.
 */
export const MAX_INPUT_DELAY = 0.2;
export const MAX_INPUT_DELAY_STEPS = Math.round(MAX_INPUT_DELAY / FIXED_DT);

/**
 * How many steps ahead of the server's clock an input may be. One for a later step is dropped: a client can't run
 * its fight ahead of real time. The slack covers a first message that took longer than the rest.
 */
export const MAX_INPUT_LEAD_STEPS = 6;
