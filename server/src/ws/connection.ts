/**
 * One client socket, and the player's `PlayerLink` (core/ports.ts). Incoming text is checked against the shared
 * Zod schemas before anything else sees it; outgoing messages are typed. A client that keeps sending garbage is
 * disconnected. On a dev server it can simulate a ping: everything in, the close included, and everything out waits
 * half of it, in order (delay.ts).
 */
import type { ClientMsg, ServerMsg } from "@infinite-tower/shared";
import { parseClientMsg } from "@infinite-tower/shared/net/client-messages";
import type { WebSocket } from "ws";
import type { PlayerLink } from "../core/ports.js";
import { DelayLine } from "./delay.js";

/** More invalid messages than this over a connection's life, and it's closed (1008). */
const MAX_INVALID_MESSAGES = 20;

export class Connection implements PlayerLink {
  private invalid = 0;
  private readonly incoming: DelayLine;
  private readonly outgoing: DelayLine;

  /** `pingMs`: the round trip to simulate (dev only; 0 is none). */
  constructor(private readonly ws: WebSocket, pingMs = 0) {
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

  onMessage(handler: (msg: ClientMsg) => void): void {
    this.ws.on("message", (data) => this.incoming.push(() => {
      const msg = parseClientMsg(String(data));
      if (msg) { handler(msg); return; }
      if (++this.invalid > MAX_INVALID_MESSAGES) this.close(1008, "invalid messages");
    }));
  }

  onClose(handler: () => void): void {
    this.ws.on("close", () => this.incoming.push(handler));
  }
}
