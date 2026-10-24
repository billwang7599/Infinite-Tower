/**
 * One client socket, and the player's `PlayerLink` (core/ports.ts). Incoming text is checked against the shared
 * Zod schemas before anything else sees it; outgoing messages are typed. A client that keeps sending garbage is
 * disconnected.
 */
import type { ClientMsg, ServerMsg } from "@infinite-tower/shared";
import { parseClientMsg } from "@infinite-tower/shared/net/client-messages";
import type { WebSocket } from "ws";
import type { PlayerLink } from "../core/ports.js";

const MAX_INVALID = 20;

export class Connection implements PlayerLink {
  private invalid = 0;

  constructor(private readonly ws: WebSocket) {}

  get open(): boolean {
    return this.ws.readyState === this.ws.OPEN;
  }

  send(msg: ServerMsg): void {
    if (this.open) this.ws.send(JSON.stringify(msg));
  }

  close(code: number, reason: string): void {
    this.ws.close(code, reason);
  }

  onMessage(handler: (msg: ClientMsg) => void): void {
    this.ws.on("message", (data) => {
      const msg = parseClientMsg(String(data));
      if (msg) { handler(msg); return; }
      if (++this.invalid > MAX_INVALID) this.ws.close(1008, "invalid messages");
    });
  }

  onClose(handler: () => void): void {
    this.ws.on("close", handler);
  }
}
