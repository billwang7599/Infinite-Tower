import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { itemDef } from "@infinite-tower/shared";
import { battleResultLines, type BattleOutcome } from "../../../src/ui/notifications/battleResult.js";
import { EVENT_MESSAGES, say } from "../../../src/ui/notifications/say.js";
import { Notifications } from "../../../src/ui/notifications/state.js";

const WIN: BattleOutcome = { won: true, loot: {}, leftBehind: {}, lost: {} };
const LOSS: BattleOutcome = { won: false, loot: {}, leftBehind: {}, lost: {} };

const notices = (to: Notifications) => to.notices.get().items.map((n) => n.text);
const banner = (to: Notifications) => to.announcement.get().current?.text ?? null;

describe("EVENT_MESSAGES", () => {
  test("only a fight starting goes to the centre banner; everything else is a corner notice", () => {
    const centre = Object.entries(EVENT_MESSAGES).filter(([, message]) => message.where === "centre");
    assert.deepEqual(centre.map(([kind]) => kind), ["encounter"]);
  });
});

describe("say", () => {
  const enemy = { name: "Test Boar" };

  test("a fight starting is the centre banner, not a notice", () => {
    const to = new Notifications();
    say(to, { kind: "encounter", source: null, enemy });
    assert.equal(banner(to), "A Test Boar leaps out of the grass!");
    assert.deepEqual(notices(to), []);
  });

  test("an enemy that touched you starts the fight with its own banner", () => {
    const to = new Notifications();
    say(to, { kind: "encounter", source: 7, enemy });
    assert.equal(banner(to), "The Test Boar attacks!");
  });

  test("a fight's result is notices in the corner, in order, with no banner", () => {
    const to = new Notifications();
    const outcome = { ...WIN, loot: { "boar-meat": 3, "boar-hide": 1 }, leftBehind: { "boar-hide": 1 } };
    say(to, { kind: "battleResult", outcome });
    assert.deepEqual(notices(to), battleResultLines(outcome));
    assert.equal(notices(to).length, 2);
    assert.equal(banner(to), null);
  });

  test("dying is a notice too", () => {
    const to = new Notifications();
    say(to, { kind: "battleResult", outcome: { ...LOSS, lost: { "boar-tusk": 1 } } });
    assert.deepEqual(notices(to), ["You died. Everything you carried is gone: boar tusk."]);
    assert.equal(banner(to), null);
  });

  test("a win that dropped nothing says nothing anywhere", () => {
    const to = new Notifications();
    say(to, { kind: "battleResult", outcome: WIN });
    assert.deepEqual(notices(to), []);
    assert.equal(banner(to), null);
  });

  test("closing the bag with things on the cloth is a notice of what's left behind", () => {
    const to = new Notifications();
    say(to, { kind: "leftOnCloth", items: { "boar-meat": 2, "boar-tusk": 1 } });
    assert.deepEqual(notices(to), ["You leave 2 boar meat, boar tusk behind on the cloth."]);
    assert.equal(banner(to), null);
  });

  test("resting is a notice", () => {
    const to = new Notifications();
    say(to, { kind: "rested" });
    assert.deepEqual(notices(to), ["You rest by the fire. HP and stamina are restored."]);
    assert.equal(banner(to), null);
  });

  test("using an item is a notice that names it", () => {
    const to = new Notifications();
    say(to, { kind: "itemUsed", item: "boar-meat" });
    assert.deepEqual(notices(to), [`You eat the ${itemDef("boar-meat").name.toLowerCase()}.`]);
    assert.equal(banner(to), null);
  });
});
