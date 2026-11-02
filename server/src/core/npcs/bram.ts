import type { Npc } from "./index.js";

const QUEST = "bram-yard";

export const BRAM: Npc = {
  stops: [
    {
      level: "kingdom",
      at: { x: -21.5, z: 10.5 },
      heading: "east",
      talk: [
        {
          when: { quest: QUEST, step: "bram" },
          lines: [
            "Aldric sent you? He sends them all. Come in, come in, mind the post.",
            "Empty-handed, like every one of you off that stone. Here: an old stick. It's no blade, but it swings "
              + "like one, and it's yours to keep.",
            "It's in your bag now. Open it, {general.inventory}, and drag the stick into one of your hands. No "
              + "stick in hand, no swing.",
            "Then show me on the dummy. A light swing, a heavy one and a stab, and it'll go down. Tell me when "
              + "you're ready.",
          ],
          offer: { train: "training-dummy" },
        },
        {
          when: { quest: QUEST, step: "dummy" },
          lines: [
            "The dummy's waiting. Stick in hand first: open your bag, {general.inventory}, and drag it into a "
              + "hand. It won't hit back, and it won't fall until it's had a light swing, a heavy one and a stab. "
              + "Ready?",
          ],
          offer: { train: "training-dummy" },
        },
        {
          when: { quest: QUEST, step: "spar" },
          lines: [
            "Not bad. Now me. Raise your guard, {battle.block}, when I come at you, and step clear, {battle.dodge}, "
              + "when you can't.",
            "Nobody gets hurt in my yard: whoever's nearly done yields, and that's the end of it. Ready?",
          ],
          offer: { train: "bram" },
        },
        {
          when: { done: QUEST },
          lines: [
            "You'll do. The market's down through the castle gate, and the wild's past the South Gate. Come back for a "
              + "spar whenever you like.",
          ],
          offer: { train: "bram" },
        },
        {
          lines: [
            "I'm Bram. I keep the yard, and I put something in the hands of avatars fresh off the stone. Want it?",
          ],
          offer: { start: QUEST },
        },
      ],
    },
  ],
};
