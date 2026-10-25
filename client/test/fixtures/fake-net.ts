import type { ClientMsg } from "@infinite-tower/shared";
import type { Connection } from "../../src/net/connection.js";

/** Records what the client would send, in place of the real WebSocket connection. */
export class FakeNet {
  readonly sent: ClientMsg[] = [];

  send(msg: ClientMsg): void {
    this.sent.push(msg);
  }

  asConnection(): Connection {
    return this as unknown as Connection;
  }
}
