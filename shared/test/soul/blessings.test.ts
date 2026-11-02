import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { addFaith, BLESSING_FAITH, BLESSINGS, blessingsOf, GODS, keptFaith } from "@infinite-tower/shared";

const blessable = Object.keys(BLESSINGS) as (keyof typeof BLESSINGS)[];
const unblessing = GODS.find((god) => !Object.hasOwn(BLESSINGS, god))!;

describe("faith and blessings", () => {
  test("no faith, no blessing", () => {
    assert.deepEqual(blessingsOf({}), []);
  });

  test("a god with a blessing blesses you once your faith in them reaches the threshold", () => {
    const god = blessable[0]!;
    assert.deepEqual(blessingsOf({ [god]: BLESSING_FAITH - 1 }), []);
    assert.deepEqual(blessingsOf(addFaith({ [god]: BLESSING_FAITH - 1 }, god, 1)), [god]);
  });

  test("blessings have no cap: every god past it blesses", () => {
    const all = Object.fromEntries(GODS.map((god) => [god, BLESSING_FAITH]));
    assert.deepEqual([...blessingsOf(all)].sort(), [...blessable].sort());
    assert.deepEqual(blessingsOf({ [unblessing]: BLESSING_FAITH * 10 }), [], "no blessing of their own yet");
  });

  test("faith adds up and never goes below nothing", () => {
    assert.deepEqual(addFaith(addFaith({}, "kaelith", 20), "kaelith", 5), { kaelith: 25 });
    assert.deepEqual(addFaith({ kaelith: 5 }, "kaelith", -20), { kaelith: 0 });
  });

  test("saved faith keeps only known gods, in whole positive numbers", () => {
    assert.deepEqual(keptFaith({ kaelith: 20.7, brannoc: -3, zeus: 50, haldis: "lots" }), { kaelith: 20 });
    assert.deepEqual(keptFaith(null), {});
  });
});
