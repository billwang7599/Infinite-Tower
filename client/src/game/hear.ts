import { say } from "../ui/notifications/say.js";
import type { UiState } from "../ui/state.js";
import { NPC_LOOKS } from "../visuals/visuals.js";
import type { Joined } from "../net/net.js";

export function hear({ net, welcome }: Joined, ui: UiState): void {
  if (!welcome.character) ui.creation.set({ open: true });
  ui.skills.set({ known: welcome.knownWords, book: welcome.skillbook });
  ui.chat.set({ open: false, focused: false, lines: welcome.chat });
  ui.questbook.set({ open: false, quests: welcome.questbook });
  net.on("questbook", ({ quests, news }) => {
    ui.questbook.set({ quests });
    for (const told of news) say(ui.notifications, { kind: "quest", news: told });
  });
  net.on("chat", ({ line }) => ui.hearChat([line]));
  net.on("chatRefused", ({ reason }) => say(ui.notifications, { kind: "chatRefused", reason }));
  net.on("challengeNews", ({ news }) => {
    if (news.kind === "received") ui.challenge.set({ from: news.from });
    else if (news.kind === "expired" || news.kind === "cancelled") ui.challenge.set({ from: null });
    say(ui.notifications, { kind: "challenge", news });
  });
  net.on("joinRefused", ({ reason }) => say(ui.notifications, { kind: "joinRefused", reason }));
  net.on("character", (msg) => {
    if (!msg.character) ui.creation.set({ open: true });
  });
  net.on("dialogue", ({ npc, trace, lines, offer }) => {
    const { name, look } = NPC_LOOKS[npc];
    if (trace) ui.openDialogue(`${name}'s bedroll`, null, lines);
    else ui.openDialogue(name, look, lines, offer);
  });
  net.on("shop", ({ shop }) => {
    ui.shop.set({ view: shop });
    if (shop && ui.panel.get().open !== "inventory") ui.togglePanel("inventory");
  });
  net.on("trade", (msg) => {
    ui.shop.set({ view: msg.shop });
    say(ui.notifications, { kind: "trade", news: msg.news });
  });
  net.on("rested", () => say(ui.notifications, { kind: "rested" }));
  net.on("padBound", ({ already }) => say(ui.notifications, { kind: "padBound", already }));
  net.on("itemUsed", ({ item }) => say(ui.notifications, { kind: "itemUsed", item }));
  net.on("core", ({ core, brokeThrough }) => {
    if (brokeThrough) say(ui.notifications, { kind: "breakthrough", core });
  });
  net.on("faith", ({ gained, blessed }) => say(ui.notifications, { kind: "faith", gained, blessed }));
  net.on("healed", () => say(ui.notifications, { kind: "healed" }));
  net.on("given", ({ item, count, left }) => say(ui.notifications, { kind: "given", item, count, left }));
  net.on("invulnerable", (msg) => ui.admin.set({ invulnerable: msg.on }));
  net.on("keepInventory", (msg) => ui.admin.set({ keepInventory: msg.on }));
  net.on("noQuest", () => say(ui.notifications, { kind: "noQuest" }));
  net.on("skillbook", (msg) => ui.skills.set({ book: msg.skillbook }));
}
