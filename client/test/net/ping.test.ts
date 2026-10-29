import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";
import { parseClientMsg } from "@infinite-tower/shared/net/client-messages";
import { startPinging } from "../../src/net/ping.js";
import { FakeNet } from "../fixtures/fake-net.js";

function setup(t: TestContext) {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let nowMs = 5000;
  const net = new FakeNet();
  const reports: number[] = [];
  const pinging = startPinging(net, (ms) => reports.push(ms), () => nowMs);
  /** The next ping goes out: its id. */
  const ping = () => {
    t.mock.timers.tick(2000);
    const msg = net.sent.at(-1);
    return msg?.t === "ping" ? msg.id : NaN;
  };
  const wait = (ms: number) => { nowMs += ms; };
  return { net, reports, pinging, ping, wait };
}

describe("startPinging", () => {
  test("pings every 2 s, the first 2 s in, each with its own id the server accepts", (t) => {
    const { net } = setup(t);
    t.mock.timers.tick(1999);
    assert.equal(net.sent.length, 0);
    t.mock.timers.tick(1);
    assert.equal(net.sent.length, 1);
    t.mock.timers.tick(4000);
    assert.equal(net.sent.length, 3);
    assert.equal(new Set(net.sent.map((m) => m.t === "ping" && m.id)).size, 3);
    for (const msg of net.sent) assert.deepEqual(parseClientMsg(JSON.stringify(msg)), msg);
  });

  test("each pong reports the average of the last 4 round trips, in whole ms", (t) => {
    const { reports, pinging, ping, wait } = setup(t);
    for (const ms of [40, 41, 44, 45, 300]) {
      const id = ping();
      wait(ms);
      pinging.pong(id);
    }
    assert.deepEqual(reports, [40, 41, 42, 43, 108]);
  });

  test("a pong for a ping never sent, already answered, or older than one answered since reports nothing", (t) => {
    const { reports, pinging, ping, wait } = setup(t);
    const older = ping();
    wait(2000);
    const newer = ping();
    wait(60);
    pinging.pong(999);
    pinging.pong(newer);
    pinging.pong(newer);
    pinging.pong(older);
    assert.deepEqual(reports, [60]);
  });

  test("overlapping pings on a slow link each get their own round trip", (t) => {
    const { reports, pinging, ping, wait } = setup(t);
    const first = ping();
    wait(2000);
    const second = ping();
    wait(500);
    pinging.pong(first);
    wait(2000);
    pinging.pong(second);
    assert.deepEqual(reports, [2500, 2500]);
  });

  test("past 8 waiting, the oldest ping is given up on", (t) => {
    const { reports, pinging, ping } = setup(t);
    const ids = Array.from({ length: 9 }, ping);
    pinging.pong(ids[0]!);
    assert.deepEqual(reports, []);
    pinging.pong(ids[1]!);
    assert.equal(reports.length, 1);
  });

  test("stop() sends no more pings, and a pong after it reports nothing", (t) => {
    const { net, reports, pinging, ping } = setup(t);
    const id = ping();
    pinging.stop();
    t.mock.timers.tick(10_000);
    assert.equal(net.sent.length, 1);
    pinging.pong(id);
    assert.deepEqual(reports, []);
  });
});
