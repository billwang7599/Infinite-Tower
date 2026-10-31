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
} satisfies Record<string, LoreEntry>;

export type LoreId = keyof typeof LORE;
