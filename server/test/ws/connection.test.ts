import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";
import { emptyBag, emptyCloth, NO_PILE, packFor, type ClientMsg } from "@infinite-tower/shared";
import { Connection } from "../../src/ws/connection.js";
import { FakeSocket } from "./fake-socket.js";
import { armed } from "../fixtures/fight.js";

const REST: ClientMsg = { t: "rest" };

function connect() {
  const socket = new FakeSocket();
  const conn = new Connection(socket.ws);
  const received: ClientMsg[] = [];
  conn.onMessage((msg) => received.push(msg));
  return { socket, conn, received };
}

describe("Connection", () => {
  test("is open while the socket is", () => {
    const { socket, conn } = connect();
    assert.equal(conn.open, true);
    socket.close(1000, "bye");
    assert.equal(conn.open, false);
  });

  test("sends messages as JSON while open", () => {
    const { socket, conn } = connect();
    conn.send({ t: "rested", vitals: { hp: 100, stamina: 100 } });
    assert.deepEqual(socket.sent, ['{"t":"rested","vitals":{"hp":100,"stamina":100}}']);
  });

  test("drops messages once closed", () => {
    const { socket, conn } = connect();
    conn.close(1000, "done");
    conn.send({ t: "rested", vitals: { hp: 100, stamina: 100 } });
    assert.deepEqual(socket.sent, []);
  });

  test("close passes the code and reason to the socket", () => {
    const { socket, conn } = connect();
    conn.close(4000, "playing somewhere else");
    assert.deepEqual(socket.closed, { code: 4000, reason: "playing somewhere else" });
  });

  test("hands valid messages to the handler, parsed", () => {
    const { socket, received } = connect();
    socket.receive({ t: "input", seq: 3, moveX: 1, moveZ: -0.5 });
    socket.receive(REST);
    assert.deepEqual(received, [{ t: "input", seq: 3, moveX: 1, moveZ: -0.5 }, REST]);
  });

  test("accepts text frames as well as Buffers", () => {
    const { socket, received } = connect();
    socket.emit("message", JSON.stringify(REST));
    assert.deepEqual(received, [REST]);
  });

  test("ignores bad JSON, unknown types and wrong field types", () => {
    const { socket, received } = connect();
    socket.receive("{not json");
    socket.receive({ t: "teleport", x: 1 });
    socket.receive({ t: "input", seq: "1", moveX: 0, moveZ: 0 });
    socket.receive({ t: "input", seq: -1, moveX: 0, moveZ: 0 });
    socket.receive({ t: "battleEnd", won: true, vitals: { hp: 1, stamina: 1 } });
    socket.receive({ t: "battleInput", upTo: 1, inputs: [{ step: 1, moveX: 9, moveZ: 0, aimX: 0, aimZ: 1 }] });
    socket.receive({ t: "useItem", at: { in: "bag", x: -1, y: 0 } });
    socket.receive("null");
    assert.deepEqual(received, []);
  });

  test("a few invalid messages keep the connection open", () => {
    const { socket, conn, received } = connect();
    for (let i = 0; i < 5; i++) socket.receive("garbage");
    assert.equal(conn.open, true);
    assert.equal(socket.closed, null);
    socket.receive(REST);
    assert.deepEqual(received, [REST]);
  });

  test("a flood of invalid messages closes it with 1008", () => {
    const { socket, conn } = connect();
    for (let i = 0; i < 1000; i++) socket.receive("garbage");
    assert.equal(conn.open, false);
    assert.deepEqual(socket.closed, { code: 1008, reason: "invalid messages" });
  });

  test("valid messages in between don't reset the invalid count", () => {
    const { socket } = connect();
    for (let i = 0; i < 1000; i++) { socket.receive("garbage"); socket.receive(REST); }
    assert.equal(socket.closed?.code, 1008);
  });

  test("answers a ping with a pong of the same id, and doesn't hand it to the game", () => {
    const { socket, received } = connect();
    socket.receive({ t: "ping", id: 7 });
    socket.receive(REST);
    socket.receive({ t: "ping", id: 8 });
    assert.deepEqual(socket.messages, [{ t: "pong", id: 7 }, { t: "pong", id: 8 }]);
    assert.deepEqual(received, [REST]);
  });

  test("onClose runs when the socket closes", () => {
    const { socket, conn } = connect();
    let closes = 0;
    conn.onClose(() => closes++);
    socket.close(1000, "bye");
    assert.equal(closes, 1);
  });
});

describe("Connection with a simulated ping (dev)", () => {
  /** A connection whose round trip takes `pingMs`, on mocked timers. */
  function slow(t: TestContext, pingMs: number) {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const socket = new FakeSocket();
    const conn = new Connection(socket.ws, pingMs);
    const heard: string[] = [];
    conn.onMessage((msg) => heard.push(msg.t));
    conn.onClose(() => heard.push("closed"));
    return { socket, conn, heard };
  }
  const RESTED = { t: "rested", vitals: { hp: 1, stamina: 1 } } as const;

  test("what the client sends reaches the game half the ping later, in order", (t) => {
    const { socket, heard } = slow(t, 100);
    socket.receive(REST);
    t.mock.timers.tick(10);
    socket.receive({ t: "leaveBattle" });
    t.mock.timers.tick(39);
    assert.deepEqual(heard, []);
    t.mock.timers.tick(1);
    assert.deepEqual(heard, ["rest"]);
    t.mock.timers.tick(10);
    assert.deepEqual(heard, ["rest", "leaveBattle"]);
  });

  test("what the game sends leaves half the ping later, in order", (t) => {
    const { socket, conn } = slow(t, 37);
    conn.send(RESTED);
    const gear = {
      bag: emptyBag(), pack: packFor(null), quiver: packFor(null), cloth: emptyCloth(), pile: NO_PILE, equipment: armed(),
    };
    conn.send({ t: "gear", gear });
    t.mock.timers.tick(18);
    assert.deepEqual(socket.sent, []);
    t.mock.timers.tick(1);
    assert.deepEqual(socket.kinds(), ["rested", "gear"]);
  });

  test("the client hanging up is heard after what it sent before", (t) => {
    const { socket, heard } = slow(t, 1000);
    socket.receive(REST);
    socket.close(1001, "tab closed");
    t.mock.timers.tick(500);
    assert.deepEqual(heard, ["rest", "closed"]);
  });

  test("the game hanging up goes after what it sent before", (t) => {
    const { socket, conn } = slow(t, 200);
    conn.send(RESTED);
    conn.close(4000, "playing somewhere else");
    assert.equal(socket.closed, null);
    t.mock.timers.tick(100);
    assert.deepEqual(socket.kinds(), ["rested"]);
    assert.deepEqual(socket.closed, { code: 4000, reason: "playing somewhere else" });
  });

  test("a ping's pong comes back the whole simulated round trip later, after what was sent before it", (t) => {
    const { socket, conn } = slow(t, 200);
    socket.receive({ t: "ping", id: 1 });
    t.mock.timers.tick(50);
    conn.send(RESTED);
    // Ticked in steps: a mocked timer set inside another's callback counts from the end of that tick.
    t.mock.timers.tick(50);
    t.mock.timers.tick(50);
    assert.deepEqual(socket.kinds(), ["rested"]);
    t.mock.timers.tick(49);
    assert.deepEqual(socket.kinds(), ["rested"]);
    t.mock.timers.tick(1);
    assert.deepEqual(socket.messages, [RESTED, { t: "pong", id: 1 }]);
  });

  test("a ping of 0 delays nothing", (t) => {
    const { socket, conn, heard } = slow(t, 0);
    socket.receive(REST);
    conn.send(RESTED);
    assert.deepEqual(heard, ["rest"]);
    assert.deepEqual(socket.kinds(), ["rested"]);
  });
});
