import type { LoreEntry } from "@infinite-tower/shared";

export const LORE = {
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
} satisfies Record<string, LoreEntry>;

export type LoreId = keyof typeof LORE;
