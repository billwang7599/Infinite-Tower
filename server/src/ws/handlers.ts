/** Each (already validated) client message, as a call on the player's session. One handler per message type. */
import type { ClientMsg, Handlers } from "@infinite-tower/shared";
import type { GameSession } from "../core/game/session.js";

export const handlers: Handlers<ClientMsg, GameSession> = {
  input: (msg, s) => s.input(msg.seq, msg.moveX, msg.moveZ),
  battleInput: (msg, s) => s.battleInput(msg.inputs),
  leaveBattle: (_msg, s) => s.leaveBattle(),
  settings: (msg, s) => s.setSettings(msg.settings),
  character: (msg, s) => s.setCharacter(msg.character),
  rest: (_msg, s) => s.rest(),
  useItem: (msg, s) => s.useItem(msg.at),
  moveItem: (msg, s) => s.moveItem(msg.from, msg.to, msg.turned),
  debug: (msg, s) => { if (msg.cmd === "encounter") s.debugEncounter(); },
};
