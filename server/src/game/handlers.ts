/** What the server does with each (already validated) client message. One handler per message type. */
import type { ClientMsg, Handlers } from "@infinite-tower/shared";
import { FieldPlayer } from "../field/components.js";
import { endEncounter, startEncounter } from "./encounter.js";
import type { Session } from "./session.js";

/** Inputs waiting to be simulated; more than this and new ones are dropped. */
const MAX_QUEUED_INPUTS = 30;

export const handlers: Handlers<ClientMsg, Session> = {
  input(msg, s) {
    if (!s.inField || msg.seq <= s.lastSeq) return;
    s.lastSeq = msg.seq;
    const fp = s.world.require(s.player, FieldPlayer);
    if (fp.queue.length < MAX_QUEUED_INPUTS) fp.queue.push({ seq: msg.seq, moveX: msg.moveX, moveZ: msg.moveZ });
  },
  battleEnd(msg, s) {
    endEncounter(s, msg.won);
  },
  debug(msg, s) {
    if (s.dev && msg.cmd === "encounter" && s.inField) startEncounter(s, null, "wild-boar");
  },
};
