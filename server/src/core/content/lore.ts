import type { LoreEntry } from "@infinite-tower/shared";

export const LORE = {
  "the-seed": {
    title: "The seed",
    text: "What wakes on the pad is a seed: a piece of a soul, given at the door by someone in your own world, the one "
      + "behind your eyes. The shell around it is empty, and it fills with what the beasts held as you put them down. "
      + "Maren says the seed stays tied to the one it came from, and calls that the tether: when the shell comes "
      + "apart, the tether pulls you back to a pad.",
  },
  "the-hollow": {
    title: "The Hollow's keepers",
    text: "The people of the Waking Hollow keep its pad. They didn't build it and can't close it; they meet whoever "
      + "wakes on it with a fire, a meal and a warning. Maren thinks your kind was sent for a reason. Tobin thinks a "
      + "thing that can't stay dead has no business hunting. They share a fire anyway.",
  },
  natives: {
    title: "Natives",
    text: "The people born in this world never needed a name for themselves; your kind gave them one. They don't "
      + "agree about you. Some say you were sent to feed a world that leaks, some that the strongest of you should "
      + "climb as high as you can go, some that you should be bound by oath and sent home, and some that a soul "
      + "which won't stay dead is a wound in the wheel.",
  },
  avatars: {
    title: "Avatars",
    text: "The people of this world call you an avatar: a soul from another world, summoned into an empty shell, with "
      + "someone else's eyes behind it. Hollis says your kind hunts the beasts and grows brighter for it.",
  },
  "summoning-pads": {
    title: "The summoning pads",
    text: "You first woke on a summoning pad, a wide stone pedestal where the door from your world opens. Every place "
      + "your kind comes into this world has one, and when your shell comes apart, you wake on one again. Hollis says "
      + "nobody of his world built them, and the gods won't say who did.",
  },
  kobolds: {
    title: "Kobolds",
    text: "Kobolds hold the old ruins east of the Grass Field's river as if they remembered building them. They fight "
      + "in twos and threes and never waste a swing. Tobin says they fight like Kaelith's own, and that the god of the "
      + "blade teaches whoever asks him, beast or man.",
  },
  "old-tongue": {
    title: "The old tongue",
    text: "The words skills are spoken in are older than the Hollow and older than the pads. The priests call them "
      + "Ithra's tongue, after the god of words. Your kind picks them up as if it had always known them, and the "
      + "goblins of the Mistwood chant them too. Nobody Maren knows can say who taught them.",
  },
  "the-oath": {
    title: "The Oath",
    text: "Corwin keeps the Grass Field's east road for Valdris, king of the gods' court, and holds to the Oath: "
      + "every soul belongs to its own world, and the old laws hold for all of them. Bind your kind by its word, keep "
      + "it in its place, and in time send it home. He doesn't hate avatars. He thinks a guest should keep the peace, "
      + "keep his word and go home when he's called. Maren would say the world needs you too badly to send you "
      + "anywhere.",
  },
  "pooled-soul": {
    title: "Where beasts come from",
    text: "Corwin has counted the Kobolds for years, and they never run out. The land holds loose soul, he says, and "
      + "where it pools long enough it clumps into a beast; put one down and the pool starts filling again. Part of "
      + "what the beast held goes into whoever killed it, and the rest sinks back into the land. It's what everyone "
      + "believes: the world leaks soul, and the leak clumps into beasts. Where the leak goes, nobody can tell him.",
  },
  "nyras-loom": {
    title: "Nyra's loom",
    text: "Nyra, the god of fate, keeps a loom, and every life in this world is a thread on it: every native, every "
      + "boar. Her weavers read them. Avatars have none. Ilse, who weaves for her in the Mistwood, says whatever sends "
      + "your kind here isn't on the loom at all, and that Nyra has studied the summoning longer than any other god.",
  },
  "the-realms": {
    title: "The five realms",
    text: "Natives say an avatar carries a small sun inside, and that it grows as the avatar does: Yan, a flame, at "
      + "first, then Sol, Lux, Ling and Tian, each further from fire, each climbed in three steps, early, middle and "
      + "peak. A native's light doesn't grow that way. Some say a soul that breaks past Tian takes a seat beside a "
      + "god; nobody living has seen one.",
  },
  "threadless-pads": {
    title: "The threadless pads",
    text: "Ilse looked at the Mistwood's summoning pad the way she looks at an avatar, for a thread on Nyra's loom, "
      + "and found none: none runs to it and none runs out. Whoever laid the pads isn't on the loom, any more than "
      + "whatever sends your kind. Hollis wagers they're the same hands.",
  },
  "snapped-tether": {
    title: "The snapped tether",
    text: "A story the hunters tell: some beasts were avatars once, and their tether snapped. Cut loose from the one "
      + "behind their eyes, they went wild, and they've been eating ever since. Ilse went looking for a beast with no "
      + "thread on Nyra's loom. The Mistwood's Kobold had one, thin and knotted, which proves nothing either way.",
  },
} satisfies Record<string, LoreEntry>;

export type LoreId = keyof typeof LORE;
