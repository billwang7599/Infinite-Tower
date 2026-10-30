import type { Npc } from "./index.js";

export const HOLLIS: Npc = {
  stops: [
    {
      level: "grass-field",
      at: { x: -6, z: -3.5 },
      heading: "west",
      talk: [
        {
          when: { flag: "hollis-to-mistwood" },
          lines: [
            "Meet me in the Mistwood, through the gap at the east edge. I'll be along once the fire's banked.",
            "Kobolds hold the old ruins east of the river. They swing in twos and threes. Watch the blade, not the "
              + "lizard.",
          ],
        },
        {
          when: { quest: "hollis-pads", step: "back" },
          lines: [
            "Three fewer. The fire thanks you, and so do I.",
            "The stone you woke on, at the edge of this field: we call it a summoning pad. Every place your kind comes "
              + "in has one.",
            "When your shell comes apart, that's where you wake again. Nobody of this world built them, and the gods "
              + "won't say who did.",
            "I've a mind to see where the pads lead. Take this for the road.",
            "Meet me in the Mistwood, avatar. It's through the gap at the east edge, past the kobold ruins. Go rested.",
          ],
        },
        {
          when: { quest: "hollis-pads", step: "boars" },
          lines: [
            "Three boars, avatar, then come back to me.",
            "Mind you don't fall. The shell comes apart like ash, and what you carried stays on the ground for "
              + "whoever's quick.",
          ],
        },
        {
          when: { canStart: "hollis-pads" },
          lines: [
            "Good hides. The fire will burn steadier behind them.",
            "The boars are getting bold, though. They come right up to the fire after dark.",
            "Thin them out for me. Three of them, then come back: there's something you should know about where you "
              + "woke.",
          ],
          offer: { start: "hollis-pads" },
        },
        {
          when: { quest: "hollis-hides", step: "bring" },
          lines: ["Back with those hides? Hand them over and I'll get the meat on."],
          offer: { deliver: "hollis-hides" },
        },
        {
          when: { quest: "hollis-hides", step: "gather" },
          lines: [
            "Two boar hides, avatar. The boars roam the field, and they like the tall grass. Not every one has a hide "
              + "worth keeping.",
            "They say an avatar carries a small sun inside. A flame at first, Yan, then Sol, Lux, Ling, and Tian at "
              + "the top.",
          ],
        },
        {
          lines: [
            "Another one from the other world. New shell, someone else's eyes behind it. Welcome, avatar.",
            "Sit by my fire whenever the beasts have had their share of you. It mends what it can.",
            "We say the world leaks soul, and the leak clumps into beasts. Your kind hunts them, and grows brighter "
              + "for it.",
            "The wind off the river cuts through this field at night. A wall of hides round the fire would keep it "
              + "in.",
            "Bring me two boar hides and I'll cook you something for your trouble.",
          ],
          offer: { start: "hollis-hides" },
        },
      ],
    },
  ],
};
