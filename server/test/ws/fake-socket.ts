/**
 * Just enough of a `ws` WebSocket for ws/: readyState, send, close and the "message" / "close" events.
 * Closing is immediate here (real ws goes through CLOSING and emits "close" later).
 */
import { EventEmitter } from "node:events";
import type { ServerMsg } from "@infinite-tower/shared";
import type { WebSocket } from "ws";

export class FakeSocket extends EventEmitter {
  readonly OPEN = 1;
  readonly CLOSED = 3;
  readyState = 1;
  readonly sent: string[] = [];
  closed: { code: number; reason: string } | null = null;

  send(text: string): void {
    this.sent.push(text);
  }

  close(code: number, reason: string): void {
    if (this.readyState === this.CLOSED) return;
    this.readyState = this.CLOSED;
    this.closed = { code, reason };
    this.emit("close", code, Buffer.from(reason));
  }

  /** What the client sends: ws hands "message" listeners a Buffer. */
  receive(msg: unknown): void {
    this.emit("message", Buffer.from(typeof msg === "string" ? msg : JSON.stringify(msg)));
  }

  /** The sent messages, parsed. */
  get messages(): ServerMsg[] {
    return this.sent.map((text) => JSON.parse(text) as ServerMsg);
  }

  kinds(): string[] {
    return this.messages.map((m) => m.t);
  }

  get ws(): WebSocket {
    return this as unknown as WebSocket;
  }
}
