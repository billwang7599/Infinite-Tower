import { CLOSE_CODES, type ClientMsg, type ServerMsg, type ServerMsgOf } from "@infinite-tower/shared";
import { SERVER_UNREACHABLE } from "./api.js";
import { startPinging } from "./ping.js";

export const SERVER_FULL = "That server is full. Try again later, or pick another one.";
export const LOAD_FAILED = "The server couldn't load your character. Try again in a moment.";
export const SAVE_RESET = "Your save was reset.";
export const CONNECT_TIMEOUT_MS = 10_000;

type GameMsgType = Exclude<ServerMsg["t"], "welcome" | "pong">;
type Listener = (msg: ServerMsg) => void;

export interface Joined { net: Net; welcome: ServerMsgOf<"welcome"> }

/** The socket opened but the server turned it away: the login cookie is missing or expired. */
export class NotLoggedInError extends Error {
  constructor() {
    super("You're not logged in anymore. Log in again.");
  }
}

export class Net {
  private readonly listeners = new Map<GameMsgType, Set<Listener>>();
  /** Until the first listener: the server sends the world right after `welcome`, while the game may still load. */
  private held: ServerMsg[] | null = [];
  private flushQueued = false;
  private readonly lostListeners = new Set<(reason: string) => void>();
  private lostReason: string | null = null;
  private hungUp = false;
  private readonly pingListeners = new Set<(ms: number) => void>();
  private readonly pinging = startPinging(this, (ms) => { for (const fn of this.pingListeners) fn(ms); });

  private constructor(private readonly ws: WebSocket) {}

  static connect(socket: string): Promise<Joined> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(socketUrl(socket));
      const net = new Net(ws);
      let welcomed = false;
      const giveUp = setTimeout(() => {
        net.close();
        reject(new Error(SERVER_UNREACHABLE));
      }, CONNECT_TIMEOUT_MS);
      ws.onmessage = (ev) => {
        const msg = JSON.parse(String(ev.data)) as ServerMsg;
        if (msg.t !== "welcome") net.receive(msg);
        else if (!welcomed) {
          welcomed = true;
          clearTimeout(giveUp);
          resolve({ net, welcome: msg });
        }
      };
      ws.onclose = (ev) => {
        if (welcomed) net.lose(closeReason(ev.code));
        else {
          clearTimeout(giveUp);
          net.pinging.stop();
          if (ev.code === CLOSE_CODES.notLoggedIn) reject(new NotLoggedInError());
          else reject(new Error(refusedReason(ev.code)));
        }
      };
    });
  }

  send(msg: ClientMsg): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  /** Messages held for the first listener go out once the current task ends, to every listener added by then. */
  on<T extends GameMsgType>(type: T, fn: (msg: ServerMsgOf<T>) => void): () => void {
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, set = new Set());
    set.add(fn as Listener);
    if (this.held && !this.flushQueued) {
      this.flushQueued = true;
      queueMicrotask(() => {
        const held = this.held ?? [];
        this.held = null;
        for (const msg of held) this.deliver(msg);
      });
    }
    return () => set.delete(fn as Listener);
  }

  /** Once, if the socket closes without `close()`; at once if it already has. `reason` is for the title. */
  onLost(fn: (reason: string) => void): () => void {
    this.lostListeners.add(fn);
    if (this.lostReason !== null) fn(this.lostReason);
    return () => this.lostListeners.delete(fn);
  }

  onPing(fn: (ms: number) => void): () => void {
    this.pingListeners.add(fn);
    return () => this.pingListeners.delete(fn);
  }

  /** On purpose: no `onLost`, and nothing more is delivered. */
  close(): void {
    this.hungUp = true;
    this.stop();
    this.ws.onmessage = null;
    this.ws.close();
  }

  private receive(msg: ServerMsg): void {
    if (msg.t === "pong") this.pinging.pong(msg.id);
    else if (this.held) this.held.push(msg);
    else this.deliver(msg);
  }

  private deliver(msg: ServerMsg): void {
    if (this.hungUp || msg.t === "welcome" || msg.t === "pong") return;
    for (const fn of this.listeners.get(msg.t) ?? []) fn(msg);
  }

  private lose(reason: string): void {
    if (this.hungUp || this.lostReason !== null) return;
    this.lostReason = reason;
    const lostListeners = [...this.lostListeners];
    this.stop();
    for (const fn of lostListeners) fn(reason);
  }

  private stop(): void {
    this.pinging.stop();
    this.listeners.clear();
    this.lostListeners.clear();
    this.pingListeners.clear();
  }
}

/** The page's `?ping=` is passed on as it is: a dev server simulates that round trip, production ignores it. */
function socketUrl(socket: string): string {
  if (typeof location === "undefined") return socket;
  const url = new URL(socket, `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`);
  const ping = new URLSearchParams(location.search).get("ping");
  if (ping !== null) url.searchParams.set("ping", ping);
  return url.href;
}

function refusedReason(closeCode: number): string {
  if (closeCode === CLOSE_CODES.full) return SERVER_FULL;
  if (closeCode === CLOSE_CODES.loadFailed) return LOAD_FAILED;
  return SERVER_UNREACHABLE;
}

function closeReason(closeCode: number): string {
  if (closeCode === CLOSE_CODES.replaced) return "You started playing in another tab or browser.";
  if (closeCode === CLOSE_CODES.saveReset) return SAVE_RESET;
  if (closeCode === CLOSE_CODES.idle) return "You were idle too long, so the game let you go.";
  return "Lost the connection to the game server.";
}
