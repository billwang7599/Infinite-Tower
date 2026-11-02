import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";
import { CLOSE_CODES, type ServerMsg, type ServerMsgOf } from "@infinite-tower/shared";
import { SERVER_UNREACHABLE } from "../../src/net/api.js";
import { CONNECT_TIMEOUT_MS, LOAD_FAILED, Net, NotLoggedInError, SAVE_RESET, SERVER_FULL } from "../../src/net/net.js";

class FakeSocket {
  static readonly OPEN = 1;
  static last: FakeSocket | null = null;
  readyState = FakeSocket.OPEN;
  readonly sent: unknown[] = [];
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.last = this;
  }

  send(text: string): void {
    this.sent.push(JSON.parse(text));
  }

  close(): void {
    this.readyState = 3;
  }

  receive(msg: ServerMsg): void {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }

  drop(code = 1006): void {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

const WELCOME = { t: "welcome" } as ServerMsgOf<"welcome">;
const GEAR = { t: "gear", gear: {} } as ServerMsgOf<"gear">;
const RESTED = { t: "rested", vitals: { hp: 1, stamina: 2 } } as ServerMsgOf<"rested">;
const settled = () => new Promise((resolve) => setImmediate(resolve));

async function connect(t: TestContext) {
  t.mock.property(globalThis, "WebSocket", FakeSocket as unknown as typeof WebSocket);
  const joining = Net.connect("ws://test/ws");
  const ws = FakeSocket.last!;
  ws.receive(WELCOME);
  const { net, welcome } = await joining;
  t.after(() => net.close());
  return { net, welcome, ws };
}

describe("Net", () => {
  test("connect resolves with the welcome, which no listener hears", async (t) => {
    const { net, welcome, ws } = await connect(t);
    assert.equal(ws.url, "ws://test/ws");
    assert.deepEqual(welcome, WELCOME);
    const heard: unknown[] = [];
    net.on("gear", (msg) => heard.push(msg));
    ws.receive(WELCOME);
    await settled();
    assert.deepEqual(heard, []);
  });

  test("connect fails with NotLoggedInError, or as unreachable, when the socket closes before the welcome", async (t) => {
    t.mock.property(globalThis, "WebSocket", FakeSocket as unknown as typeof WebSocket);
    const refused = Net.connect("ws://test/ws");
    FakeSocket.last!.drop(CLOSE_CODES.notLoggedIn);
    await assert.rejects(refused, NotLoggedInError);
    const unreachable = Net.connect("ws://test/ws");
    FakeSocket.last!.drop();
    await assert.rejects(unreachable, { message: SERVER_UNREACHABLE });
  });

  test("connect fails with the full message when the server is full", async (t) => {
    t.mock.property(globalThis, "WebSocket", FakeSocket as unknown as typeof WebSocket);
    const refused = Net.connect("ws://test/ws");
    FakeSocket.last!.drop(CLOSE_CODES.full);
    await assert.rejects(refused, { message: SERVER_FULL });
  });

  test("connect fails with its own message when the server couldn't load the save", async (t) => {
    t.mock.property(globalThis, "WebSocket", FakeSocket as unknown as typeof WebSocket);
    const refused = Net.connect("ws://test/ws");
    FakeSocket.last!.drop(CLOSE_CODES.loadFailed);
    await assert.rejects(refused, { message: LOAD_FAILED });
  });

  test("connect gives up as unreachable and hangs up when no welcome comes in time", async (t) => {
    t.mock.property(globalThis, "WebSocket", FakeSocket as unknown as typeof WebSocket);
    t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
    const joining = Net.connect("ws://test/ws");
    const ws = FakeSocket.last!;
    t.mock.timers.tick(CONNECT_TIMEOUT_MS - 1);
    assert.equal(ws.readyState, FakeSocket.OPEN);
    t.mock.timers.tick(1);
    await assert.rejects(joining, { message: SERVER_UNREACHABLE });
    assert.equal(ws.readyState, 3);
  });

  test("a welcome in time keeps the socket open past the connect timeout", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
    const { ws } = await connect(t);
    t.mock.timers.tick(CONNECT_TIMEOUT_MS);
    assert.equal(ws.readyState, FakeSocket.OPEN);
  });

  test("a server's socket path is opened on the page's host, passing on the page's ?ping=", async (t) => {
    t.mock.property(globalThis, "WebSocket", FakeSocket as unknown as typeof WebSocket);
    (globalThis as { location?: unknown }).location = { protocol: "https:", host: "tower.example", search: "?ping=80" };
    t.after(() => { delete (globalThis as { location?: unknown }).location; });
    void Net.connect("/ws").catch(() => {});
    assert.equal(FakeSocket.last!.url, "wss://tower.example/ws?ping=80");
    FakeSocket.last!.drop();
  });

  test("each message goes to every listener of its type, until it unsubscribes", async (t) => {
    const { net, ws } = await connect(t);
    const first: unknown[] = [], second: unknown[] = [], rested: unknown[] = [];
    const off = net.on("gear", (msg) => first.push(msg));
    net.on("gear", (msg) => second.push(msg));
    net.on("rested", (msg) => rested.push(msg));
    await settled();
    ws.receive(GEAR);
    off();
    ws.receive(GEAR);
    ws.receive(RESTED);
    assert.deepEqual(first, [GEAR]);
    assert.deepEqual(second, [GEAR, GEAR]);
    assert.deepEqual(rested, [RESTED]);
  });

  test("messages that came before any listener reach the ones added in the same task, in order", async (t) => {
    const { net, ws } = await connect(t);
    ws.receive(GEAR);
    ws.receive(RESTED);
    const heard: string[] = [];
    net.on("rested", (msg) => heard.push(msg.t));
    net.on("gear", (msg) => heard.push(msg.t));
    assert.deepEqual(heard, []);
    await settled();
    assert.deepEqual(heard, ["gear", "rested"]);
  });

  test("send goes out as JSON while the socket is open", async (t) => {
    const { net, ws } = await connect(t);
    net.send({ t: "rest" });
    ws.readyState = 3;
    net.send({ t: "closeBag" });
    assert.deepEqual(ws.sent, [{ t: "rest" }]);
  });

  test("onLost hears a dropped socket once, with a reason for the title, even when added after", async (t) => {
    const { net, ws } = await connect(t);
    const lost: string[] = [];
    net.onLost((reason) => lost.push(reason));
    ws.drop(CLOSE_CODES.replaced);
    ws.drop();
    net.onLost((reason) => lost.push(reason));
    assert.deepEqual(lost, ["You started playing in another tab or browser.", "You started playing in another tab or browser."]);
  });

  test("a reset save's close is told apart, so the game can join again", async (t) => {
    const { net, ws } = await connect(t);
    const lost: string[] = [];
    net.onLost((reason) => lost.push(reason));
    ws.drop(CLOSE_CODES.saveReset);
    assert.deepEqual(lost, [SAVE_RESET]);
  });

  test("close() hangs up quietly: no onLost, and nothing more is delivered", async (t) => {
    const { net, ws } = await connect(t);
    const heard: unknown[] = [];
    net.on("gear", (msg) => heard.push(msg));
    net.onLost((reason) => heard.push(reason));
    net.close();
    ws.receive(GEAR);
    ws.drop();
    await settled();
    assert.deepEqual(heard, []);
  });

  test("pings the server and reports the round trip from its pong", async (t) => {
    t.mock.timers.enable({ apis: ["setInterval"] });
    const { net, ws } = await connect(t);
    const reports: number[] = [];
    net.onPing((ms) => reports.push(ms));
    t.mock.timers.tick(2000);
    const ping = ws.sent.at(-1) as { t: string; id: number };
    assert.equal(ping.t, "ping");
    ws.receive({ t: "pong", id: ping.id });
    assert.equal(reports.length, 1);
    net.close();
    t.mock.timers.tick(10_000);
    assert.equal(ws.sent.length, 1);
  });
});
