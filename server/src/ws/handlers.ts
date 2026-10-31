/** Each (already validated) client message, as a call on the player's session. */
import type { Handlers } from "@infinite-tower/shared";
import type { GameSession } from "../core/game/session.js";
import type { SessionMsg } from "./connection.js";

export const handlers: Handlers<SessionMsg, GameSession> = {
  input: (msg, s) => s.input(msg.seq, msg.moveX, msg.moveZ),
  battleInput: (msg, s) => s.battleInput(msg.upTo, msg.inputs),
  battleResync: (_msg, s) => s.battleResync(),
  leaveBattle: (_msg, s) => s.leaveBattle(),
  settings: (msg, s) => s.setSettings(msg.settings),
  character: (msg, s) => s.setCharacter(msg.character),
  rest: (_msg, s) => s.rest(),
  useItem: (msg, s) => s.useItem(msg.at),
  moveItem: (msg, s) => s.moveItem(msg.from, msg.to, msg.turned),
  closeBag: (_msg, s) => s.closeBag(),
  openPile: (_msg, s) => s.openPile(),
  talk: (_msg, s) => s.talk(),
  acceptQuest: (msg, s) => s.acceptQuest(msg.quest),
  deliver: (msg, s) => s.deliver(msg.quest),
  saveSkill: (msg, s) => s.saveSkill(msg.page, msg.skill),
  cheat: (msg, s) => s.cheat(msg.cheat),
  challenge: (_msg, s) => s.challenge(),
  answerChallenge: (msg, s) => s.answerChallenge(msg.accept),
  joinBattle: (_msg, s) => s.joinBattle(),
  chat: (msg, s) => s.chat(msg.text),
  statPoint: (msg, s) => s.statPoint(msg.stat, msg.add),
};
