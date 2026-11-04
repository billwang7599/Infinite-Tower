import type { Npc } from "./index.js";

export const INNKEEPER: Npc = {
  stops: [
    {
      region: "market-ward",
      at: { x: 27.5, z: 18.5 },
      heading: "south",
      talk: [
        {
          lines: [
            "Welcome to the Gilded Door. Named for the one up in the castle's hall, though ours is only gilt paint, "
              + "and the paint's flaking.",
            "Hesper Wainwright. No, I've never built a wagon; my great-grandmother's people did. I keep the place: "
              + "soldiers off watch, carters off the south road, and now and then one of you, fresh off the stone.",
            "You hear things in here. The castle's had riders from Seraphel three times this season. Nobody tells "
              + "me why, so everybody tells me why.",
            "The East Gate's shut while the priests up on Temple Hill argue over something, and the gate to the "
              + "Lower Town's shut because it's the Lower Town. They'll open again. They always do.",
          ],
        },
      ],
    },
  ],
};
