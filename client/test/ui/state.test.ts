import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_LOOK } from "@infinite-tower/shared";
import type { Mode } from "../../src/game/transition.js";
import { CHAT_LOG_LINES, inWorld, UiState, whoHasTheKeys, type TitleState } from "../../src/ui/state.js";

describe("UiState screens", () => {
  test("settings open and close", () => {
    const ui = new UiState();
    ui.openSettings();
    assert.equal(ui.settingsScreen.get().open, true);
    ui.closeSettings();
    assert.equal(ui.settingsScreen.get().open, false);
  });

  test("the creation screen closes itself when it's done", () => {
    const ui = new UiState();
    ui.creation.set({ open: true });
    ui.closeCreation();
    assert.equal(ui.creation.get().open, false);
  });
});

describe("UiState overworld panels", () => {
  test("one at a time: a panel key opens its panel, again closes it, another switches", () => {
    const ui = new UiState();
    assert.equal(ui.overworldPanel.get().open, null);
    ui.toggleOverworldPanel("inventory");
    assert.equal(ui.overworldPanel.get().open, "inventory");
    ui.toggleOverworldPanel("character");
    assert.equal(ui.overworldPanel.get().open, "character");
    ui.toggleOverworldPanel("character");
    assert.equal(ui.overworldPanel.get().open, null);
  });

  test("closing closes whichever is open", () => {
    const ui = new UiState();
    ui.toggleOverworldPanel("inventory");
    ui.closeOverworldPanel();
    assert.equal(ui.overworldPanel.get().open, null);
  });
});

describe("UiState questbook", () => {
  test("its key opens it and closes it again; closing closes it, and keeps what's in it", () => {
    const ui = new UiState();
    ui.questbook.set({ quests: [{ id: "q", title: "Q", half: "main", step: null, lore: [] }] });
    ui.toggleQuestbook();
    assert.equal(ui.questbook.get().open, true);
    ui.toggleQuestbook();
    assert.equal(ui.questbook.get().open, false);
    ui.toggleQuestbook();
    ui.closeQuestbook();
    assert.equal(ui.questbook.get().open, false);
    assert.equal(ui.questbook.get().quests.length, 1);
  });
});

describe("UiState chat", () => {
  const line = (i: number) => ({ from: "Tester", text: `line ${i}` });

  test("lines heard go to the end of the log, which keeps the last CHAT_LOG_LINES", () => {
    const ui = new UiState();
    ui.hearChat([line(0), line(1)]);
    ui.hearChat([line(2)]);
    assert.deepEqual(ui.chat.get().lines, [line(0), line(1), line(2)]);
    ui.hearChat(Array.from({ length: CHAT_LOG_LINES }, (_, i) => line(i + 3)));
    assert.equal(ui.chat.get().lines.length, CHAT_LOG_LINES);
    assert.deepEqual(ui.chat.get().lines[0], line(3));
  });
});

describe("UiState dialogue", () => {
  const LINES = ["one", "two", "three"];

  test("opens on its first line, goes on a line at a time, and closes after the last", () => {
    const ui = new UiState();
    ui.openDialogue("Hollis", DEFAULT_LOOK, LINES);
    assert.deepEqual(ui.dialogue.get(), {
      open: true, name: "Hollis", look: DEFAULT_LOOK, lines: LINES, line: 0, offer: null,
    });
    ui.nextLine();
    ui.nextLine();
    assert.equal(ui.dialogue.get().line, 2);
    assert.equal(ui.nextLine(), null, "no offer to take");
    assert.equal(ui.dialogue.get().open, false);
  });

  test("an offer comes with the last line: going on past it closes the box and takes it; closing doesn't", () => {
    const offer = { kind: "quest", quest: "q", title: "Q", step: "Do it" } as const;
    const ui = new UiState();
    ui.openDialogue("Hollis", DEFAULT_LOOK, LINES, offer);
    assert.deepEqual([ui.nextLine(), ui.nextLine()], [null, null]);
    assert.equal(ui.nextLine(), offer);
    assert.equal(ui.dialogue.get().open, false);
    ui.openDialogue("Hollis", DEFAULT_LOOK, LINES, offer);
    ui.closeDialogue();
    assert.equal(ui.dialogue.get().open, false);
  });

  test("closes at any line, and opens again from the first", () => {
    const ui = new UiState();
    ui.openDialogue("Hollis", DEFAULT_LOOK, LINES);
    ui.nextLine();
    ui.closeDialogue();
    assert.equal(ui.dialogue.get().open, false);
    ui.openDialogue("Hollis", DEFAULT_LOOK, LINES);
    assert.equal(ui.dialogue.get().line, 0);
  });
});

describe("whoHasTheKeys", () => {
  const playing = (mode: Mode = "overworld") => {
    const ui = new UiState();
    ui.title.set({ phase: "playing" });
    return { ui, mode };
  };

  test("the title has them until it has cleared off a game, and again as it comes back", () => {
    const ui = new UiState();
    assert.deepEqual(whoHasTheKeys(ui, null), ["title"]);
    for (const phase of ["menu", "loading", "entering", "returning"] as const) {
      ui.title.set({ phase });
      assert.deepEqual(whoHasTheKeys(ui, "overworld"), ["title"], phase);
    }
    ui.creation.set({ open: true });
    assert.deepEqual(whoHasTheKeys(ui, "overworld"), ["title"], "the white still under the title");
  });

  test("with nothing over it, the world has them: the overworld or the arena", () => {
    assert.deepEqual(whoHasTheKeys(playing().ui, "overworld"), ["overworld"]);
    assert.deepEqual(whoHasTheKeys(playing().ui, "battle"), ["battle"]);
  });

  test("the open bag is over the overworld: you stand still while it's open", () => {
    const { ui, mode } = playing();
    ui.toggleOverworldPanel("inventory");
    assert.deepEqual(whoHasTheKeys(ui, mode), ["overworld", "bag"]);
  });

  test("the character panel only shows things: the world keeps the keys", () => {
    const { ui, mode } = playing();
    ui.toggleOverworldPanel("character");
    assert.deepEqual(whoHasTheKeys(ui, mode), ["overworld"]);
  });

  test("Settings is over the bag and the world, in either mode", () => {
    const { ui } = playing("overworld");
    ui.toggleOverworldPanel("inventory");
    ui.openSettings();
    assert.deepEqual(whoHasTheKeys(ui, "overworld"), ["overworld", "bag", "settings"]);
    const battle = playing("battle").ui;
    battle.toggleOverworldPanel("inventory");
    battle.openSettings();
    assert.deepEqual(whoHasTheKeys(battle, "battle"), ["battle", "settings"]);
  });

  test("the admin panel is over the world and its screens, in either mode; Settings goes over it", () => {
    const { ui } = playing("overworld");
    ui.toggleOverworldPanel("inventory");
    ui.admin.set({ open: true });
    assert.deepEqual(whoHasTheKeys(ui, "overworld"), ["overworld", "bag", "admin"]);
    ui.openSettings();
    assert.deepEqual(whoHasTheKeys(ui, "overworld"), ["overworld", "bag", "admin", "settings"]);
    const battle = playing("battle").ui;
    battle.admin.set({ open: true });
    assert.deepEqual(whoHasTheKeys(battle, "battle"), ["battle", "admin"]);
  });

  test("the chant popup is over the arena: you stand still while it's open; Settings goes over it", () => {
    const { ui } = playing("battle");
    ui.chant.set({ open: true });
    assert.deepEqual(whoHasTheKeys(ui, "battle"), ["battle", "chant"]);
    ui.openSettings();
    assert.deepEqual(whoHasTheKeys(ui, "battle"), ["battle", "chant", "settings"]);
  });

  test("in the arena the bag opens over the fight, the skillbook over it, and both go when the bag does", () => {
    const { ui } = playing("battle");
    ui.toggleBattleBag();
    assert.deepEqual(whoHasTheKeys(ui, "battle"), ["battle", "battleBag"]);
    ui.skillbookScreen.set({ open: true });
    assert.deepEqual(whoHasTheKeys(ui, "battle"), ["battle", "battleBag", "skillbook"]);
    ui.toggleBattleBag();
    assert.deepEqual(whoHasTheKeys(ui, "battle"), ["battle"]);
    assert.equal(ui.skillbookScreen.get().open, false);
  });

  test("the skillbook opens over the bag, and goes when the bag does", () => {
    const { ui, mode } = playing();
    ui.toggleOverworldPanel("inventory");
    ui.skillbookScreen.set({ open: true });
    assert.deepEqual(whoHasTheKeys(ui, mode), ["overworld", "bag", "skillbook"]);
    ui.toggleOverworldPanel("inventory");
    assert.equal(ui.skillbookScreen.get().open, false);
    assert.deepEqual(whoHasTheKeys(ui, mode), ["overworld"]);
  });

  test("the chat goes over the overworld or the arena while its box has focus; Settings goes over it", () => {
    for (const mode of ["overworld", "battle"] as const) {
      const { ui } = playing(mode);
      ui.chat.set({ open: true, focused: true });
      assert.deepEqual(whoHasTheKeys(ui, mode), [mode, "chat"]);
      ui.openSettings();
      assert.deepEqual(whoHasTheKeys(ui, mode), [mode, "chat", "settings"]);
    }
  });

  test("the chat open with its box unfocused (a click on the game) leaves the keys to the world", () => {
    for (const mode of ["overworld", "battle"] as const) {
      const { ui } = playing(mode);
      ui.chat.set({ open: true, focused: true });
      ui.chat.set({ focused: false });
      assert.deepEqual(whoHasTheKeys(ui, mode), [mode]);
      assert.equal(ui.chat.get().open, true, "the log stays");
    }
  });

  test("talking is over the world, in either mode: you stand still while it's open; Settings goes over it", () => {
    for (const mode of ["overworld", "battle"] as const) {
      const { ui } = playing(mode);
      ui.openDialogue("Hollis", DEFAULT_LOOK, ["hello"]);
      assert.deepEqual(whoHasTheKeys(ui, mode), [mode, "dialogue"]);
      ui.openSettings();
      assert.deepEqual(whoHasTheKeys(ui, mode), [mode, "dialogue", "settings"]);
    }
  });

  test("the questbook is over the world, in either mode: you stand still while it's open; Settings over it", () => {
    for (const mode of ["overworld", "battle"] as const) {
      const { ui } = playing(mode);
      ui.toggleQuestbook();
      assert.deepEqual(whoHasTheKeys(ui, mode), [mode, "questbook"]);
      ui.openSettings();
      assert.deepEqual(whoHasTheKeys(ui, mode), [mode, "questbook", "settings"]);
    }
  });

  test("character creation is over everything once the title has cleared onto it", () => {
    const { ui, mode } = playing();
    ui.creation.set({ open: true });
    ui.openSettings();
    assert.equal(whoHasTheKeys(ui, mode).at(-1), "creation");
  });
});

describe("inWorld", () => {
  const PHASES: readonly TitleState["phase"][] = [
    "checking", "menu", "signingIn", "connecting", "loading", "failed", "entering", "playing", "returning",
  ];

  test("HUDs and key-taking screens wait for the title to clear, and go as it comes back", () => {
    for (const phase of PHASES.filter((p) => p !== "playing")) {
      assert.equal(inWorld("overworld", phase), false, phase);
      assert.equal(inWorld("battle", phase), false, phase);
    }
  });

  test("once the title is gone, the overworld and the arena are both in the world", () => {
    assert.equal(inWorld("overworld", "playing"), true);
    assert.equal(inWorld("battle", "playing"), true);
  });

  test("no game running is never in the world", () => {
    for (const phase of PHASES) assert.equal(inWorld(null, phase), false, phase);
  });
});
