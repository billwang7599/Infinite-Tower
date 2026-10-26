import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_LOOK, GENDERS, LOOK_PARTS } from "@infinite-tower/shared";
import { ROWS, shuffled, stepped, valueOf, type Choices } from "../../../../src/ui/screens/creation/options.js";

const START: Choices = { gender: "girl", look: DEFAULT_LOOK };
const row = (key: string) => ROWS.find((r) => r.key === key)!;

test("there's a row for boy or girl and for every part of a look", () => {
  assert.deepEqual(ROWS.map((r) => r.key).sort(), ["gender", ...LOOK_PARTS].sort());
  assert.deepEqual(row("gender").options, GENDERS);
});

test("stepping wraps around both ways", () => {
  const body = row("body");
  const last = body.options.at(-1)!;
  assert.equal(valueOf(stepped({ ...START, look: { ...DEFAULT_LOOK, body: last as "wide" } }, body, 1), "body"),
    body.options[0]);
  assert.equal(valueOf(stepped({ ...START, look: { ...DEFAULT_LOOK, body: body.options[0] as "skinny" } }, body, -1),
    "body"), last);
  assert.equal(valueOf(stepped(START, row("gender"), 1), "gender"), "boy");
});

test("shuffle changes only the look, to real options", () => {
  let n = 0;
  const shuffledChoices = shuffled(START, () => (n++ % 7) / 7);
  assert.equal(shuffledChoices.gender, "girl");
  for (const r of ROWS) assert.ok(r.options.includes(valueOf(shuffledChoices, r.key)), r.key);
});
