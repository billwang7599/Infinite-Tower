import assert from "node:assert/strict";
import { test } from "node:test";
import { dispatch, rulesHint, USERNAME_RULES, type Handlers } from "@infinite-tower/shared";

type Msg = { t: "a"; n: number } | { t: "b"; s: string };

test("dispatch calls the handler for the message's tag, with the context", () => {
  const calls: string[] = [];
  const handlers: Handlers<Msg, string> = {
    a: (msg, ctx) => calls.push(`${ctx}:a${msg.n}`),
    b: (msg, ctx) => calls.push(`${ctx}:b${msg.s}`),
  };
  dispatch(handlers, { t: "b", s: "x" }, "me");
  dispatch(handlers, { t: "a", n: 1 }, "me");
  assert.deepEqual(calls, ["me:bx", "me:a1"]);
});

test("rulesHint says the rules in words", () => {
  assert.equal(rulesHint(USERNAME_RULES), "3-20 letters, digits, _ or -");
});
