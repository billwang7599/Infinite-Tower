import type { Npc } from "./index.js";

export const SMITH: Npc = {
  stops: [
    {
      level: "market-ward",
      at: { x: 13.5, z: -0.5 },
      heading: "west",
      talk: [
        {
          lines: [
            "Another one off the pad. The door sends you lot in soft as dough, and somebody has to arm you.",
            "I'll take hides and tusks for the bellows and the grips, and blades you've no more use for.",
          ],
          offer: { shop: "smith" },
        },
      ],
    },
  ],
};
