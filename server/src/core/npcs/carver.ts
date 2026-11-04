import type { Npc } from "./index.js";

export const CARVER: Npc = {
  stops: [
    {
      region: "market-ward",
      at: { x: 45.5, z: -4.5 },
      heading: "west",
      talk: [
        {
          lines: [
            "Ysolde Thatcher, of the Collegium of Thresholds. We cut the pads you lot wake on. To Ithra's tongue a "
              + "core's no different from stone: carve the right words and they hold.",
            "Bring me a sigil and I'll cut it into your core, a ring round your light, yours through every death. "
              + "Each step of your core holds one more ring, and the first step of a new realm two.",
            "Unmaking a ring costs three times the coin and twice the essence, and the word is gone for good. Think "
              + "before you carve.",
          ],
          offer: { shop: "collegium" },
        },
      ],
    },
  ],
};
