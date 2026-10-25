/**
 * The WebSocket to the game server (/ws; Vite proxies it in dev). JSON messages typed by
 * shared/src/net. Messages that arrive before the game calls `listen` are queued, so nothing sent
 * right after `welcome` (like the first `level`) is lost while the game is still loading.
 */
import {
  CLOSE_CODES, dispatch, type ClientMsg, type Handlers, type ServerMsg, type ServerMsgOf,
} from "@infinite-tower/shared";

/** Everything after `welcome`. */
type GameMsg = Exclude<ServerMsg, ServerMsgOf<"welcome">>;
type GameHandlers = Handlers<GameMsg>;
export interface Joined { net: Connection; welcome: ServerMsgOf<"welcome"> }

export const SERVER_UNREACHABLE =
  "Can't reach the game server. Start everything with `npm run dev` (server + client).";

/** The socket opened but the server turned it away: the login cookie is missing or expired. */
export class NotLoggedInError extends Error {
  constructor() {
    super("You're not logged in anymore. Log in again.");
  }
}

export class Connection {
  /** After `welcome`: the socket closed without `close()` being called. `reason` is a sentence for the title. */
  onClose: (reason: string) => void = () => {};
  private handlers: GameHandlers | null = null;
  private backlog: GameMsg[] = [];

  private constructor(private readonly ws: WebSocket) {}

  /** Connect and wait for the server's `welcome`. */
  static open(): Promise<Joined> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
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
        if (welcomed) net.onClose(lostReason(ev.code));
        else reject(ev.code === CLOSE_CODES.notLoggedIn ? new NotLoggedInError() : new Error(SERVER_UNREACHABLE));
      };
    });
  }

  /** Start handling messages (one handler per type), beginning with any that queued up. */
  listen(handlers: GameHandlers): void {
    this.handlers = handlers;
    for (const msg of this.backlog.splice(0)) this.receive(msg);
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

function lostReason(closeCode: number): string {
  if (closeCode === CLOSE_CODES.replaced) return "You started playing in another tab or browser.";
  return "Lost the connection to the game server.";
}
