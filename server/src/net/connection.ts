/**
 * One client socket. Incoming text is checked against the shared Zod schemas before anything else
 * sees it; outgoing messages are typed. A client that keeps sending garbage is disconnected.
 */
import type { ClientMsg, ServerMsg } from "@infinite-tower/shared";
import { parseClientMsg } from "@infinite-tower/shared/net/client-messages";
import type { WebSocket } from "ws";

const MAX_INVALID = 20;

export class Connection {
  private invalid = 0;

  constructor(private readonly ws: WebSocket) {}

  send(msg: ServerMsg): void {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(msg));
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
