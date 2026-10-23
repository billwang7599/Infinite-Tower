/** The WebSocket to the game server (/ws; Vite proxies it in dev). JSON messages, see shared/src/net. */
import type { ClientMsg, ServerMsg } from "@infinite-tower/shared";

type Welcome = Extract<ServerMsg, { t: "welcome" }>;

export class Connection {
  /** Set by the game; messages before it is set are dropped (only `welcome` comes first). */
  onMessage: (msg: ServerMsg) => void = () => {};
  onClose: () => void = () => {};

  private constructor(private readonly ws: WebSocket) {}

  /** Connect and wait for the server's `welcome`. */
  static open(url = defaultUrl()): Promise<{ net: Connection; welcome: Welcome }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const net = new Connection(ws);
      let welcomed = false;
      ws.onmessage = (ev) => {
        const msg = JSON.parse(String(ev.data)) as ServerMsg;
        if (!welcomed && msg.t === "welcome") { welcomed = true; resolve({ net, welcome: msg }); return; }
        net.onMessage(msg);
      };
      ws.onclose = () => {
        if (!welcomed) reject(new Error("Can't reach the game server. Start everything with `npm run dev` (server + client)."));
        else net.onClose();
      };
    });
  }

  send(msg: ClientMsg): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}

function defaultUrl(): string {
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
}
