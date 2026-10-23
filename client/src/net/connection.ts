/**
 * The WebSocket to the game server (/ws; Vite proxies it in dev). JSON messages typed by
 * shared/src/net. Messages that arrive before the game calls `listen` are queued, so nothing sent
 * right after `welcome` (like the first `level`) is lost while the game is still loading.
 */
import { CLOSE_CODES, dispatch, type ClientMsg, type Handlers, type MsgOf, type ServerMsg } from "@infinite-tower/shared";

export type Welcome = MsgOf<ServerMsg, "welcome">;
/** Everything after `welcome`. */
export type GameMsg = Exclude<ServerMsg, Welcome>;
export type GameHandlers = Handlers<GameMsg>;
export interface Joined { net: Connection; welcome: Welcome }

export const SERVER_UNREACHABLE = "Can't reach the game server. Start everything with `npm run dev` (server + client).";

/** The socket opened but the server turned it away: the login cookie is missing or expired. */
export class NotLoggedInError extends Error {
  constructor() {
    super("You're not logged in anymore. Log in again.");
  }
}

export class Connection {
  /** After `welcome`: the socket closed without `close()` being called. `code` is the WebSocket close code. */
  onClose: (code: number) => void = () => {};
  private handlers: GameHandlers | null = null;
  private backlog: GameMsg[] = [];

  private constructor(private readonly ws: WebSocket) {}

  /** Connect and wait for the server's `welcome`. */
  static open(url = defaultUrl()): Promise<Joined> {
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
      ws.onclose = (ev) => {
        if (welcomed) net.onClose(ev.code);
        else reject(ev.code === CLOSE_CODES.notLoggedIn ? new NotLoggedInError() : new Error(SERVER_UNREACHABLE));
      };
    });
  }

  /** Start handling messages (one handler per type), beginning with any that queued up. */
  listen(handlers: GameHandlers): void {
    this.handlers = handlers;
    for (const msg of this.backlog.splice(0)) dispatch(handlers, msg, undefined);
  }

  /** Hang up on purpose: no `onClose`, and nothing more is delivered. */
  close(): void {
    this.onClose = () => {};
    this.ws.onmessage = null;
    this.ws.close();
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
