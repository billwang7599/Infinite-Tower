import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { coreName, itemDef, MAX_CHAT_CHARS, newCore, type QuestNews } from "@infinite-tower/shared";
import { battleResultLines, type BattleOutcome } from "../../../src/ui/notifications/battleResult.js";
import { EVENT_MESSAGES, say } from "../../../src/ui/notifications/say.js";
import { Notifications } from "../../../src/ui/notifications/state.js";

const WIN: BattleOutcome = { won: true, lost: {}, core: newCore(), coreLost: null };
const LOSS: BattleOutcome = { won: false, lost: {}, core: newCore(), coreLost: null };

const notices = (to: Notifications) => to.notices.get().items.map((n) => n.text);
const banner = (to: Notifications) => to.announcement.get().current?.text ?? null;

describe("EVENT_MESSAGES", () => {
  test("only a fight starting for you (yours, a duel, one joined) is the centre banner; the rest are notices", () => {
    const centre = Object.entries(EVENT_MESSAGES).filter(([, message]) => message.where === "centre");
    assert.deepEqual(centre.map(([kind]) => kind), ["encounter", "duel", "joinedFight"]);
  });
});

describe("say", () => {
  const enemy = { name: "Test Boar" };

  test("every event told is heard by whoever listens, each time it is told", () => {
    const to = new Notifications(), heard: string[] = [];
    to.said.subscribe(() => heard.push(to.said.get().event!.kind));
    say(to, { kind: "rested" });
    say(to, { kind: "rested" });
    say(to, { kind: "challenge", news: { kind: "nobodyNear" } });
    assert.deepEqual(heard, ["rested", "rested", "challenge"]);
  });

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

  test("a fight's result is notices in the corner, with no banner", () => {
    const to = new Notifications();
    const outcome = { ...LOSS, lost: { "boar-meat": 3, "boar-hide": 1 } };
    say(to, { kind: "battleResult", outcome });
    assert.deepEqual(notices(to), battleResultLines(outcome));
    assert.equal(notices(to).length, 1);
    assert.equal(banner(to), null);
  });

  test("a chat line the server turned down is a notice saying why", () => {
    const to = new Notifications();
    say(to, { kind: "chatRefused", reason: "tooFast" });
    say(to, { kind: "chatRefused", reason: "tooLong" });
    assert.equal(notices(to).length, 2);
    assert.match(notices(to)[0]!, /too fast/);
    assert.match(notices(to)[1]!, new RegExp(`${MAX_CHAT_CHARS} characters`));
    assert.equal(banner(to), null);
  });

  test("dying is a notice too", () => {
    const to = new Notifications();
    say(to, { kind: "battleResult", outcome: { ...LOSS, lost: { "boar-tusk": 1 } } });
    assert.deepEqual(notices(to), ["You died and dropped boar tusk; what's left of it lands where the fight began."]);
    assert.equal(banner(to), null);
  });

  test("a win says nothing anywhere", () => {
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

  test("a breakthrough is a notice naming the step the core reached", () => {
    const to = new Notifications(), core = { ...newCore(), steps: 1 };
    say(to, { kind: "breakthrough", core });
    assert.deepEqual(notices(to), [`Your core breaks through: ${coreName(core)}.`]);
    assert.equal(banner(to), null);
  });

  test("a dev cheat's gift is a notice, and a full bag says what didn't fit", () => {
    const to = new Notifications();
    say(to, { kind: "given", item: "boar-meat", count: 3, left: 0 });
    assert.deepEqual(notices(to), ["You get 3 boar meat."]);
    const full = new Notifications();
    say(full, { kind: "given", item: "boar-hide", count: 1, left: 2 });
    assert.deepEqual(notices(full), ["You get boar hide.", "The bag is full: 2 boar hide didn't fit."]);
    const none = new Notifications();
    say(none, { kind: "given", item: "boar-hide", count: 0, left: 2 });
    assert.deepEqual(notices(none), ["The bag is full: 2 boar hide didn't fit."]);
  });

  test("a dev cheat's heal is a notice", () => {
    const to = new Notifications();
    say(to, { kind: "healed" });
    assert.deepEqual(notices(to), ["HP and stamina are restored."]);
    assert.equal(banner(to), null);
  });

  test("a duel starting is the centre banner, naming the other player", () => {
    const to = new Notifications();
    say(to, { kind: "duel", with: "Bee" });
    assert.equal(banner(to), "A duel with Bee!");
  });

  test("what became of a challenge is a corner notice; one to you is shown by its own notice instead", () => {
    const said = (news: Parameters<typeof say>[1] & { kind: "challenge" }) => {
      const to = new Notifications();
      say(to, news);
      assert.equal(banner(to), null);
      return notices(to);
    };
    assert.deepEqual(said({ kind: "challenge", news: { kind: "sent", to: "Bee" } }), ["You challenge Bee to a duel."]);
    assert.deepEqual(said({ kind: "challenge", news: { kind: "received", from: "Bee" } }), []);
    assert.deepEqual(said({ kind: "challenge", news: { kind: "declined", by: "Bee" } }),
      ["Bee declines your challenge."]);
    assert.deepEqual(said({ kind: "challenge", news: { kind: "expired", with: "Bee" } }),
      ["The challenge with Bee has expired."]);
    assert.deepEqual(said({ kind: "challenge", news: { kind: "cancelled", with: "Bee" } }),
      ["The challenge with Bee is called off."]);
    assert.deepEqual(said({ kind: "challenge", news: { kind: "nobodyNear" } }),
      ["Nobody is close enough to challenge."]);
    assert.deepEqual(said({ kind: "challenge", news: { kind: "busy", who: "Bee" } }),
      ["Bee is already in a challenge."]);
    assert.deepEqual(said({ kind: "challenge", news: { kind: "busy", who: null } }),
      ["You already have a challenge open."]);
  });

  test("quest news is corner notices: a quest taken, a count, a step done or the quest, what came of it", () => {
    const said = (news: QuestNews) => {
      const to = new Notifications();
      say(to, { kind: "quest", news });
      assert.equal(banner(to), null);
      return notices(to);
    };
    assert.deepEqual(said({ kind: "taken", quest: "Hides", step: "Gather 2 boar hides." }),
      ["New quest: Hides. Gather 2 boar hides."]);
    assert.deepEqual(said({ kind: "tally", quest: "Hunt", have: 1, need: 3 }), ["Hunt: 1 / 3."]);
    const step = { kind: "advanced" as const, quest: "Hides", gained: {}, dropped: {}, lore: [] };
    assert.deepEqual(said({ ...step, next: "Bring them to Hollis." }), ["Hides: Bring them to Hollis."]);
    assert.deepEqual(said({
      ...step, next: null, gained: { "boar-meat": 2 }, dropped: { "boar-tusk": 1 }, lore: ["Avatars", "Pads"],
    }), [
      "Quest complete: Hides.", "You get 2 boar meat.", "The bag is full: boar tusk is left at your feet.",
      "New in your questbook: Avatars.", "New in your questbook: Pads.",
    ]);
  });
});
