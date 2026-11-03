import type { Npc } from "./index.js";

export const APOTHECARY: Npc = {
  stops: [
    {
      region: "market-ward",
      at: { x: 10.5, z: 9.5 },
      heading: "south",
      talk: [
        {
          lines: [
            "Tinctures and tonics: red for wounds, green for tired legs. They do what the label says. Mostly.",
          ],
          offer: { shop: "apothecary" },
        },
      ],
    },
  ],
};
