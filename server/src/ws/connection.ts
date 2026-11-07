/**
 * One client socket: the player's `PlayerLink`. Incoming text is checked with the shared Zod schemas first. A dev
 * server can simulate a ping: everything each way, the close included, waits half of it, in order. Pings are
 * answered here, through send(), so a simulated ping delays the pong too.
 */
import type { ClientMsg, MsgOf, ServerMsg } from "@infinite-tower/shared";
import { parseClientMsg } from "@infinite-tower/shared/net/client-messages";
import type { WebSocket } from "ws";
import type { PlayerLink } from "../core/ports.js";
import { DelayLine } from "./delay.js";

/** More invalid messages than this over a connection's life, and it's closed (1008). */
const MAX_INVALID_MESSAGES = 20;
// A token bucket on all a client sends, dry closing it (1008): a client sends about one message a step (60 a
// second), and after a network stall its backlog arrives at once.
export const MAX_MESSAGES_PER_SEC = 120;
export const MAX_MESSAGE_BURST = 600;

export type SessionMsg = Exclude<ClientMsg, MsgOf<ClientMsg, "ping">>;

export class Connection implements PlayerLink {
  private invalid = 0;
  private tokens = MAX_MESSAGE_BURST;
  private refilledAtMs: number;
  private readonly incoming: DelayLine;
  private readonly outgoing: DelayLine;

  /** `pingMs`: the round trip to simulate (0 is none). */
  constructor(
    private readonly ws: WebSocket, pingMs = 0, private readonly nowMs: () => number = () => performance.now(),
  ) {
    this.refilledAtMs = nowMs();
    this.incoming = new DelayLine(pingMs / 2);
    this.outgoing = new DelayLine(pingMs / 2);
  }

  get open(): boolean {
    return this.ws.readyState === this.ws.OPEN;
  }

  send(msg: ServerMsg): void {
    if (!this.open) return;
    const text = JSON.stringify(msg);
    this.outgoing.push(() => { if (this.open) this.ws.send(text); });
  }

  close(code: number, reason: string): void {
    this.outgoing.push(() => this.ws.close(code, reason));
  }

  onMessage(handler: (msg: SessionMsg) => void): void {
    this.ws.on("message", (data) => {
      if (!this.takeToken()) { this.ws.close(1008, "too many messages"); return; }
      this.incoming.push(() => {
        const msg = parseClientMsg(String(data));
        if (msg?.t === "ping") this.send({ t: "pong", id: msg.id });
        else if (msg) handler(msg);
        else if (++this.invalid > MAX_INVALID_MESSAGES) this.close(1008, "invalid messages");
      });
    });
  }

  private takeToken(): boolean {
    const now = this.nowMs();
    this.tokens = Math.min(MAX_MESSAGE_BURST, this.tokens + (now - this.refilledAtMs) / 1000 * MAX_MESSAGES_PER_SEC);
    this.refilledAtMs = now;
    if (this.tokens < 1) return false;
    this.tokens--;
    return true;
  }

  onClose(handler: () => void): void {
    this.ws.on("close", () => this.incoming.push(handler));
  }
}
