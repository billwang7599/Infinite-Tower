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
  private handlers: GameHandlers | null = null;
  private backlog: GameMsg[] = [];
  private lostHandler: ((reason: string) => void) | null = null;
  /** Set when the socket is lost, so a handler added later still hears about it. */
  private lostReason: string | null = null;
  private hungUp = false;

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
        if (welcomed) net.lose(closeReason(ev.code));
        else reject(ev.code === CLOSE_CODES.notLoggedIn ? new NotLoggedInError() : new Error(SERVER_UNREACHABLE));
      };
    });
  }

  /** Start handling messages (one handler per type), beginning with any that queued up. */
  listen(handlers: GameHandlers): void {
    this.handlers = handlers;
    for (const msg of this.backlog.splice(0)) this.receive(msg);
  }

  /**
   * `handler` runs once if the socket closes without `close()` being called; `reason` is a sentence for the title.
   * If it already closed (say, while the game was still loading), it runs right away.
   */
  onLost(handler: (reason: string) => void): void {
    this.lostHandler = handler;
    if (this.lostReason !== null) handler(this.lostReason);
  }

  /** Hang up on purpose: no `onLost`, and nothing more is delivered. */
  close(): void {
    this.hungUp = true;
    this.lostHandler = null;
    this.ws.onmessage = null;
    this.ws.close();
  }

  send(msg: ClientMsg): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private lose(reason: string): void {
    if (this.hungUp || this.lostReason !== null) return;
    this.lostReason = reason;
    this.lostHandler?.(reason);
  }

  private receive(msg: GameMsg): void {
    if (this.handlers) dispatch(this.handlers, msg, undefined);
    else this.backlog.push(msg);
  }
}

function closeReason(closeCode: number): string {
  if (closeCode === CLOSE_CODES.replaced) return "You started playing in another tab or browser.";
  return "Lost the connection to the game server.";
}
