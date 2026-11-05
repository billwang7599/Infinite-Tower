import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DEFAULT_DEV_PING_MS, DEFAULT_MAX_PLAYERS, DEFAULT_SERVER_NAME, parseBehindCloudflare, parseCheats, parseDevPing,
  parseMaxPlayers,
  parsePingMs, parseServerName,
} from "../src/env.js";

describe("DEV_PING_MS", () => {
  test("left out (or empty), it's the default", () => {
    assert.equal(parseDevPing(undefined, true), DEFAULT_DEV_PING_MS);
    assert.equal(parseDevPing("", true), DEFAULT_DEV_PING_MS);
  });

  test("any whole number of milliseconds, 0 or more", () => {
    for (const ms of [0, 37, 150, 1000]) assert.equal(parseDevPing(String(ms), true), ms);
  });

  test("anything else stops the server, like any other bad setting", () => {
    for (const raw of ["-1", "1.5", "abc", "50ms", " 50"]) {
      assert.throws(() => parseDevPing(raw, true), /DEV_PING_MS/, raw);
    }
  });

  test("production never delays, whatever is set", () => {
    for (const raw of [undefined, "200", "nonsense"]) assert.equal(parseDevPing(raw, false), 0);
  });
});

describe("parsePingMs (a page's ?ping=)", () => {
  test("a whole number of milliseconds, 0 or more", () => {
    for (const ms of [0, 37, 1000]) assert.equal(parsePingMs(String(ms)), ms);
  });

  test("anything else is no answer (the caller falls back)", () => {
    for (const raw of [undefined, "", "-5", "1.5", "abc", "1e3"]) assert.equal(parsePingMs(raw), null, String(raw));
  });
});

describe("MAX_PLAYERS", () => {
  test("left out (or empty), it's the default", () => {
    assert.equal(parseMaxPlayers(undefined), DEFAULT_MAX_PLAYERS);
    assert.equal(parseMaxPlayers(""), DEFAULT_MAX_PLAYERS);
  });

  test("any whole number of players, 1 or more", () => {
    for (const n of [1, 4, 200]) assert.equal(parseMaxPlayers(String(n)), n);
  });

  test("anything else stops the server", () => {
    for (const raw of ["0", "-1", "2.5", "lots", " 5"]) assert.throws(() => parseMaxPlayers(raw), /MAX_PLAYERS/, raw);
  });
});

describe("BEHIND_CLOUDFLARE", () => {
  test("left out (or empty), it's off", () => {
    assert.equal(parseBehindCloudflare(undefined), false);
    assert.equal(parseBehindCloudflare(""), false);
  });

  test("true or false", () => {
    assert.equal(parseBehindCloudflare("true"), true);
    assert.equal(parseBehindCloudflare("false"), false);
  });

  test("anything else stops the server", () => {
    for (const raw of ["1", "yes", "TRUE", " true"]) {
      assert.throws(() => parseBehindCloudflare(raw), /BEHIND_CLOUDFLARE/, raw);
    }
  });
});

describe("SERVER_NAME", () => {
  test("left out or blank, it's the default", () => {
    for (const raw of [undefined, "", "   "]) assert.equal(parseServerName(raw), DEFAULT_SERVER_NAME);
  });

  test("otherwise the name, trimmed", () => {
    assert.equal(parseServerName("  Aincrad East "), "Aincrad East");
  });
});

describe("CHEATS", () => {
  test("only 1 turns cheats on", () => {
    assert.equal(parseCheats("1"), true);
  });

  test("left out, empty or 0, they're off", () => {
    for (const raw of [undefined, "", "0"]) assert.equal(parseCheats(raw), false);
  });

  test("anything else stops the server", () => {
    for (const raw of ["true", "yes", " 1", "2"]) assert.throws(() => parseCheats(raw), /CHEATS/, raw);
  });
});
