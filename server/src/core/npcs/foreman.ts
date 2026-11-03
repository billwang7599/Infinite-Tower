import type { Npc } from "./index.js";

export const FOREMAN: Npc = {
  stops: [
    {
      region: "old-quarry",
      at: { x: -6.5, z: -12.5 },
      heading: "east",
      talk: [
        {
          when: { done: "foreman-pit" },
          lines: [
            "The big one's down, and another will climb out of that pool before the month's out. That's the quarry "
              + "now.",
            "If Highmere ever sends for stone again, tell them old Harl's still here, and still says no.",
          ],
        },
        {
          when: { quest: "foreman-pit", step: "back" },
          lines: [
            "You went down. You saw it. That water doesn't move, and nothing drinks from it.",
            "Forty years I cut stone here for Highmere: the walls, the keep, the hall. Then we went down for the deep "
              + "seam and broke into a hollow under the pit.",
            "It wasn't water that welled up. It was soul, the loose kind, pooled down there since before there was a "
              + "crown to want it. Still and clear as glass.",
            "Inside a season the first Kobold climbed out of the dark. Then the next. The crown called the stone "
              + "finished and took its cutters home.",
            "I swore to Brannoc I'd keep this place, so I stayed. The crown still pays me a foreman's wage for a "
              + "quarry nobody works. It might as well pay you.",
          ],
        },
        {
          when: { quest: "foreman-pit", step: "greatsword" },
          lines: [
            "The one with the greatsword stands over the pool like it's guarding it. Put it down, then come back up "
              + "to me.",
          ],
        },
        {
          when: { quest: "foreman-pit", step: "pool" },
          lines: [
            "Down into the pit, to the pool at the bottom. There are three ways in through the low stone; the south "
              + "one's straight up the rails from here.",
          ],
        },
        {
          lines: [
            "Another of the crown's cutters? No. You've the look of the hall about you. An avatar.",
            "Harl. I was foreman here, when there was a quarry to be foreman of. Every block in Highmere's walls came "
              + "off these terraces.",
            "Nobody cuts here now, and you'll want to know why. Go down into the pit and look at the pool at its "
              + "bottom, and put down the Kobold with the greatsword that stands over it.",
            "Then come back up and I'll tell you. There's crown silver in it.",
          ],
          offer: { start: "foreman-pit" },
        },
      ],
    },
  ],
};
