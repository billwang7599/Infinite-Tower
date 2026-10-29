import { MAX_CHAT_CHARS, type ChatLine, type ServerMsgOf } from "@infinite-tower/shared";
import type { GameSession } from "./session.js";

export const CHAT_HISTORY_LINES = 1000;
export const CHAT_LINES_ON_JOIN = 50;
export const MAX_CHAT_LINES_PER_WINDOW = 10;
export const CHAT_WINDOW_MS = 5000;

export class Chat {
  readonly history: ChatLine[] = [];
  private readonly sentAtMs = new WeakMap<GameSession, number[]>();

  constructor(private readonly online: () => Iterable<GameSession>) {}

  recent(): ChatLine[] {
    return this.history.slice(-CHAT_LINES_ON_JOIN);
  }

  say(from: GameSession, text: string): void {
    if (!from.character) return;
    if (text.length > MAX_CHAT_CHARS) return refuse(from, "tooLong");
    const nowMs = Date.now();
    const sent = (this.sentAtMs.get(from) ?? []).filter((atMs) => nowMs - atMs < CHAT_WINDOW_MS);
    this.sentAtMs.set(from, sent);
    if (sent.length >= MAX_CHAT_LINES_PER_WINDOW) return refuse(from, "tooFast");
    sent.push(nowMs);
    const line = { from: from.character.name, text };
    this.history.push(line);
    if (this.history.length > CHAT_HISTORY_LINES) this.history.shift();
    for (const to of this.online()) to.link.send({ t: "chat", line, speaker: speakerFor(to, from) });
  }
}

const refuse = (to: GameSession, reason: ServerMsgOf<"chatRefused">["reason"]) =>
  to.link.send({ t: "chatRefused", reason });

function speakerFor(to: GameSession, from: GameSession): ServerMsgOf<"chat">["speaker"] {
  if (to === from) return "you";
  return to.inLevel && from.inLevel && to.overworld === from.overworld ? from.me : null;
}
