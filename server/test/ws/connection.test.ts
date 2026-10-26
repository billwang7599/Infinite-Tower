import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ClientMsg } from "@infinite-tower/shared";
import { Connection } from "../../src/ws/connection.js";
import { FakeSocket } from "./fake-socket.js";

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
    socket.receive({ t: "battleEnd", won: "yes", vitals: { hp: 1, stamina: 1 } });
    socket.receive({ t: "useItem", at: { x: -1, y: 0 } });
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

  test("onClose runs when the socket closes", () => {
    const { socket, conn } = connect();
    let closes = 0;
    conn.onClose(() => closes++);
    socket.close(1000, "bye");
    assert.equal(closes, 1);
  });
});
