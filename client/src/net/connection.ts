/**
 * The WebSocket to the game server (/ws; Vite proxies it in dev). JSON messages typed by
 * shared/src/net. Messages that arrive before the game calls `listen` are queued, so nothing sent
 * right after `welcome` (like the first `level`) is lost while the game is still loading.
 */
import { dispatch, type ClientMsg, type Handlers, type MsgOf, type ServerMsg } from "@infinite-tower/shared";

export type Welcome = MsgOf<ServerMsg, "welcome">;
/** Everything after `welcome`. */
export type GameMsg = Exclude<ServerMsg, Welcome>;
export type GameHandlers = Handlers<GameMsg>;

export class Connection {
  onClose: () => void = () => {};
  private handlers: GameHandlers | null = null;
  private backlog: GameMsg[] = [];

  private constructor(private readonly ws: WebSocket) {}

  /** Connect and wait for the server's `welcome`. */
  static open(url = defaultUrl()): Promise<{ net: Connection; welcome: Welcome }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const net = new Connection(ws);
      let welcomed = false;
      ws.onmessage = (ev) => {
        const msg = JSON.parse(String(ev.data)) as ServerMsg;
        if (msg.t === "welcome") {
          if (!welcomed) { welcomed = true; resolve({ net, welcome: msg }); }
          return;
        }
        net.receive(msg);
      };
      ws.onclose = () => {
        if (!welcomed) reject(new Error("Can't reach the game server. (Developing? npm run dev starts the server and the client.)"));
        else net.onClose();
      };
    });
  }

  /** Start handling messages (one handler per type), beginning with any that queued up. */
  listen(handlers: GameHandlers): void {
    this.handlers = handlers;
    for (const msg of this.backlog.splice(0)) dispatch(handlers, msg, undefined);
  }

  send(msg: ClientMsg): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private receive(msg: GameMsg): void {
    if (this.handlers) dispatch(this.handlers, msg, undefined);
    else this.backlog.push(msg);
  }
}

function defaultUrl(): string {
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
}
