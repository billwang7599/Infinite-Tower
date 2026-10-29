import type { ClientMsg } from "@infinite-tower/shared";

export class FakeNet {
  readonly sent: ClientMsg[] = [];

  send(msg: ClientMsg): void {
    this.sent.push(msg);
  }
}
