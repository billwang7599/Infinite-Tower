import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { addItem, bagCounts, emptyBag, packFor, type Bag } from "@infinite-tower/shared";
import { LORE, type LoreId } from "../../../src/core/content/lore.js";
import type { QuestDef, Quests, QuestStep, Task } from "../../../src/core/content/quests.js";
import {
  holds, keptStory, newStory, questbookOf, unfold, type Effect, type Seen, type Story,
} from "../../../src/core/game/story.js";
import { bagWith } from "./helpers.js";

const step = (id: string, task: Task, extra: Partial<QuestStep> = {}): QuestStep =>
  ({ id, task, text: `${id} text`, hint: `${id} hint`, ...extra });
const quest = (steps: QuestStep[], extra: Partial<QuestDef> = {}): QuestDef =>
  ({ title: "A quest", half: "main", steps, ...extra });
const TALK: Task = { kind: "talk", to: "hollis" };
const LORE_ID = Object.keys(LORE)[0] as LoreId;

const SEEN: Seen = { region: "grass-field", at: { x: 0, z: 0 } };
const on = (id: string, stepId: string | null, kills = 0, story = newStory()): Story =>
  ({ ...story, quests: { ...story.quests, [id]: { step: stepId, kills } } });
function run(
  quests: Quests, story: Story, effects: Effect[] = [], seen: Partial<Seen> & { bag?: Bag; pack?: Bag } = {},
) {
  const { bag = emptyBag(), pack = packFor(null), ...rest } = seen;
  return unfold({ story, bag, pack }, effects, { ...SEEN, ...rest }, quests);
}

describe("conditions", () => {
  const QUESTS: Quests = {
    first: quest([step("a", TALK), step("b", TALK)]),
    second: quest([step("a", TALK)], { when: { done: "first" } }),
  };

  test("none always holds; a flag holds once it's set", () => {
    assert.ok(holds(undefined, newStory(), QUESTS));
    assert.ok(!holds({ flag: "met" }, newStory(), QUESTS));
    assert.ok(holds({ flag: "met" }, { ...newStory(), flags: ["met"] }, QUESTS));
  });

  test("a quest's step holds only while the quest is on it; done, once it's past its last", () => {
    assert.ok(!holds({ quest: "first", step: "a" }, newStory(), QUESTS));
    assert.ok(holds({ quest: "first", step: "a" }, on("first", "a"), QUESTS));
    assert.ok(!holds({ quest: "first", step: "b" }, on("first", "a"), QUESTS));
    assert.ok(!holds({ done: "first" }, on("first", "b"), QUESTS));
    assert.ok(holds({ done: "first" }, on("first", null), QUESTS));
  });

  test("a quest can start while it's not taken and its own condition holds", () => {
    assert.ok(holds({ canStart: "first" }, newStory(), QUESTS));
    assert.ok(!holds({ canStart: "first" }, on("first", "a"), QUESTS));
    assert.ok(!holds({ canStart: "second" }, on("first", "b"), QUESTS));
    assert.ok(holds({ canStart: "second" }, on("first", null), QUESTS));
    assert.ok(!holds({ canStart: "no-such-quest" }, newStory(), QUESTS));
  });
});

describe("effects", () => {
  const QUESTS: Quests = {
    q: quest([step("a", TALK), step("b", TALK)], { title: "Q" }),
    later: quest([step("a", TALK)], { when: { done: "q" } }),
  };

  test("start: the quest is on its first step with nothing counted, and told; not twice, nor before it can", () => {
    const { story, news } = run(QUESTS, newStory(), [{ start: "q" }]);
    assert.deepEqual(story.quests, { q: { step: "a", kills: 0 } });
    assert.deepEqual(news, [{ kind: "taken", quest: "Q", step: "a text" }]);
    assert.equal(run(QUESTS, story, [{ start: "q" }]).story, story);
    assert.equal(run(QUESTS, story, [{ start: "later" }]).story, story);
  });

  test("advance: on to the next step, told; past the last the quest is done; nothing for one not on a step", () => {
    const once = run(QUESTS, on("q", "a"), [{ advance: "q" }]);
    assert.deepEqual(once.story.quests.q, { step: "b", kills: 0 });
    assert.deepEqual(once.news, [{ kind: "advanced", quest: "Q", next: "b text", gained: {}, dropped: {}, lore: [] }]);
    const done = run(QUESTS, once.story, [{ advance: "q" }]);
    assert.deepEqual(done.story.quests.q, { step: null, kills: 0 });
    assert.equal(done.news[0]?.kind === "advanced" && done.news[0].next, null);
    assert.equal(run(QUESTS, done.story, [{ advance: "q" }]).story, done.story);
    assert.equal(run(QUESTS, newStory(), [{ advance: "q" }]).story.quests.q, undefined);
  });

  test("a step done gives its reward: items into the bag, each flag once, and its lore, told with it", () => {
    const QUESTS: Quests = { q: quest([
      step("a", TALK, { reward: { items: { "boar-meat": 2 }, flags: ["fed", "warm"], lore: [LORE_ID] } }),
    ], { title: "Q" }) };
    const { story, bag, news } = run(QUESTS, on("q", "a", 0, { ...newStory(), flags: ["fed"] }), [{ advance: "q" }]);
    assert.deepEqual(bagCounts(bag), { "boar-meat": 2 });
    assert.deepEqual(story.flags, ["fed", "warm"]);
    assert.deepEqual(news, [{
      kind: "advanced", quest: "Q", next: null, gained: { "boar-meat": 2 }, dropped: {}, lore: [LORE[LORE_ID].title],
    }]);
  });

  test("what doesn't fit in the bag is dropped, and told", () => {
    const QUESTS: Quests = { q: quest([step("a", TALK, { reward: { items: { "boar-meat": 1 } } })]) };
    const full = bagWith({ "boar-tusk": 12 });
    assert.equal(addItem(full, "boar-meat", 1).left, 1, "the bag is full");
    const { bag, dropped, news } = run(QUESTS, on("q", "a"), [{ advance: "q" }], { bag: full });
    assert.deepEqual(bag, full);
    assert.deepEqual(dropped, { "boar-meat": 1 });
    assert.ok(news[0]?.kind === "advanced");
    assert.deepEqual([news[0].gained, news[0].dropped], [{}, { "boar-meat": 1 }]);
  });

  test("the backpack counts as the bag does: gathered, handed over from, and a reward put in it", () => {
    const only = (task: Task): Quests => ({ q: quest([step("s0", task)]) });
    const pack = addItem(packFor("canvas-backpack"), "boar-hide", 2).bag;
    const gather = only({ kind: "gather", item: "boar-hide", count: 2 });
    assert.equal(run(gather, on("q", "s0"), [], { pack }).story.quests.q?.step, null);
    const QUESTS: Quests = { q: quest([
      step("give", { kind: "deliver", item: "boar-hide", count: 2, to: "hollis" }, { reward: { items: { bread: 1 } } }),
    ]) };
    const full = bagWith({ "boar-tusk": 12 });
    const after = run(QUESTS, on("q", "give"), [{ advance: "q" }], { bag: full, pack });
    assert.deepEqual(after.bag, full);
    assert.deepEqual(bagCounts(after.pack), { bread: 1 });
    assert.deepEqual(after.dropped, {});
  });

  test("advancing a deliver step hands its items over, across stacks, and nothing else; too few, nothing", () => {
    const QUESTS: Quests = { q: quest([step("give", { kind: "deliver", item: "boar-meat", count: 6, to: "hollis" })]) };
    const bag = bagWith({ "boar-meat": 7, "boar-hide": 1 });
    const after = run(QUESTS, on("q", "give"), [{ advance: "q" }], { bag });
    assert.deepEqual(bagCounts(after.bag), { "boar-meat": 1, "boar-hide": 1 });
    assert.equal(after.story.quests.q?.step, null);
    const short = bagWith({ "boar-meat": 5 }), story = on("q", "give");
    const refused = run(QUESTS, story, [{ advance: "q" }], { bag: short });
    assert.deepEqual([refused.story, refused.bag, refused.news], [story, short, []]);
  });
});

describe("steps the world meets", () => {
  const only = (...tasks: Task[]): Quests => ({ q: quest(tasks.map((t, i) => step(`s${i}`, t)), { title: "Q" }) });

  test("gather: done once the bag holds enough, which it keeps", () => {
    const QUESTS = only({ kind: "gather", item: "boar-hide", count: 2 });
    assert.equal(run(QUESTS, on("q", "s0"), [], { bag: bagWith({ "boar-hide": 1 }) }).story.quests.q?.step, "s0");
    const two = bagWith({ "boar-hide": 2 }), { story, bag } = run(QUESTS, on("q", "s0"), [], { bag: two });
    assert.equal(story.quests.q?.step, null);
    assert.equal(bag, two);
  });

  test("reach: done in that region, inside its area if it has one", () => {
    const QUESTS = only({ kind: "reach", region: "mistwood", area: { x: 2, z: 2, w: 2, h: 2 } });
    const stepAt = (seen: Partial<Seen>) => run(QUESTS, on("q", "s0"), [], seen).story.quests.q?.step;
    assert.equal(stepAt({ at: { x: 3, z: 3 } }), "s0", "another region");
    assert.equal(stepAt({ region: "mistwood" }), "s0", "outside the area");
    assert.equal(stepAt({ region: "mistwood", at: { x: 3, z: 3 } }), null);
    const anywhere = only({ kind: "reach", region: "mistwood" });
    assert.equal(run(anywhere, on("q", "s0"), [], { region: "mistwood" }).story.quests.q?.step, null);
  });

  test("kill: that kind counted across fights and told, others not, until there are enough", () => {
    const QUESTS = only({ kind: "kill", enemy: "wild-boar", count: 3 });
    let { story, news } = run(QUESTS, on("q", "s0"), [], { killed: ["wild-boar", "kobold-swordsman"] });
    assert.deepEqual(story.quests.q, { step: "s0", kills: 1 });
    assert.deepEqual(news, [{ kind: "tally", quest: "Q", have: 1, need: 3 }]);
    story = run(QUESTS, story, [], { killed: ["wild-boar"] }).story;
    assert.deepEqual(story.quests.q, { step: "s0", kills: 2 });
    ({ story, news } = run(QUESTS, story, [], { killed: ["wild-boar", "wild-boar"] }));
    assert.deepEqual(story.quests.q, { step: null, kills: 0 }, "done, and the extra kill isn't kept");
    assert.deepEqual(news.map((n) => n.kind), ["advanced"]);
  });

  test("kills before the step began don't count, and one fight does one step", () => {
    const QUESTS = only({ kind: "reach", region: SEEN.region }, { kind: "kill", enemy: "wild-boar", count: 1 });
    const late = run(QUESTS, on("q", "s0"), [], { killed: ["wild-boar"] });
    assert.deepEqual(late.story.quests.q, { step: "s1", kills: 0 });
    const twice = only({ kind: "kill", enemy: "wild-boar", count: 1 }, { kind: "kill", enemy: "wild-boar", count: 1 });
    assert.equal(run(twice, on("q", "s0"), [], { killed: ["wild-boar", "wild-boar"] }).story.quests.q?.step, "s1");
  });

  test("what's already true does the next step at once; talk and deliver steps wait for an NPC", () => {
    const QUESTS = only(
      { kind: "gather", item: "boar-meat", count: 1 }, { kind: "reach", region: "grass-field" },
      { kind: "deliver", item: "boar-meat", count: 1, to: "hollis" }, TALK,
    );
    const { story, news } = run(QUESTS, on("q", "s0"), [], { bag: bagWith({ "boar-meat": 1 }) });
    assert.equal(story.quests.q?.step, "s2");
    assert.deepEqual(news.map((n) => n.kind === "advanced" && n.next), ["s1 text", "s2 text"]);
    assert.equal(run(QUESTS, on("q", "s3")).story.quests.q?.step, "s3");
  });

  test("with nothing done or counted, the story and the bag are the same objects", () => {
    const QUESTS = only({ kind: "kill", enemy: "wild-boar", count: 1 }), story = on("q", "s0"), bag = emptyBag();
    const after = unfold({ story, bag, pack: packFor(null) }, [], { ...SEEN, killed: ["kobold-swordsman"] }, QUESTS);
    assert.equal(after.story, story);
    assert.equal(after.bag, bag);
    assert.deepEqual(after.news, []);
  });
});

describe("the questbook", () => {
  const QUESTS: Quests = {
    hunt: quest([
      step("boars", { kind: "kill", enemy: "wild-boar", count: 3 }, { text: "Slay 3 boars", hint: "In the grass" }),
      step("hides", { kind: "deliver", item: "boar-hide", count: 2, to: "hollis" }, { reward: { lore: [LORE_ID] } }),
    ], { title: "Hunt", half: "side" }),
    talk: quest([step("a", TALK, { reward: { lore: [LORE_ID] } })], { title: "Talk" }),
    untaken: quest([step("a", TALK)], { title: "Untaken" }),
  };

  test("only taken quests, open ones first: the step on with its hint and tally, and the lore it revealed", () => {
    let story = run(QUESTS, on("hunt", "boars", 0, on("talk", "a")), [{ advance: "talk" }], {
      killed: ["wild-boar"],
    }).story;
    assert.deepEqual(questbookOf(story, QUESTS), [
      {
        id: "hunt", title: "Hunt", half: "side", lore: [],
        step: { text: "Slay 3 boars", hint: "In the grass", tally: { kills: 1, need: 3 } },
      },
      { id: "talk", title: "Talk", half: "main", step: null, lore: [LORE[LORE_ID]] },
    ]);
    story = run(QUESTS, story, [], { killed: ["wild-boar", "wild-boar"] }).story;
    assert.deepEqual(questbookOf(story, QUESTS)[0]!.step!.tally, { item: "boar-hide", need: 2 });
  });
});

describe("a saved story", () => {
  const QUESTS: Quests = { q: quest([step("a", TALK), step("b", TALK)]) };

  test("keeps the quests still in the game on steps they still have, done ones, and every flag", () => {
    const saved: Story = { quests: { q: { step: "b", kills: 2 }, gone: { step: "a", kills: 0 } }, flags: ["met"] };
    assert.deepEqual(keptStory(saved, QUESTS), { quests: { q: { step: "b", kills: 2 } }, flags: ["met"] });
    assert.deepEqual(keptStory(on("q", null), QUESTS).quests, { q: { step: null, kills: 0 } });
  });

  test("forgets a quest on a step it no longer has, so it's offered again", () => {
    assert.deepEqual(keptStory(on("q", "renamed"), QUESTS).quests, {});
  });
});
