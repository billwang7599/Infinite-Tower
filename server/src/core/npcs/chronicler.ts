import type { Npc } from "./index.js";

export const CHRONICLER: Npc = {
  stops: [
    {
      level: "kingdom",
      at: { x: -4.5, z: 14.5 },
      heading: "east",
      talk: [
        {
          when: { done: "chronicler-roads" },
          lines: [
            "Ah, my correspondent. I've written your name twice now: once for arriving, once for the Hollow and the "
              + "Mistwood. Nobody else has two lines.",
            "Keep walking. The roll only knows this hall, and someone ought to know the rest.",
          ],
        },
        {
          when: { quest: "chronicler-roads", step: "back" },
          lines: [
            "You went? Both? Tell me everything. No, slower, I write slowly.",
            "A pad in the Hollow and a pad in the Mistwood, and people keeping each who never asked for it. Every "
              + "stone like this one.",
            "Let me show you something in return. The roll's first leaves, here, older than the castle. No names. "
              + "Only tallies, line after line.",
            "Someone counted arrivals on that platform before there was a Highmere to claim them. The crown doesn't "
              + "like that page. I do. Take this, from the archive's purse.",
          ],
        },
        {
          when: { quest: "chronicler-roads", step: "mistwood" },
          lines: ["The Hollow, then. Good. Now the Mistwood: past the Grass Field, through the gap at its east edge."],
        },
        {
          when: { quest: "chronicler-roads", step: "hollow" },
          lines: ["The Waking Hollow first. The road west off the Grass Field leads down into it."],
        },
        {
          lines: [
            "Name? No, don't tell me, I have it already. I wrote it the moment you woke. Odo, keeper of the roll.",
            "Every avatar who wakes on that platform goes into this book: a name, a day, a line on the look of them. "
              + "The crown counts it like it counts its soldiers.",
            "And I've never once been past the town gate. They say there are other pads out there: one in a hollow "
              + "to the west, one in a misty wood to the east.",
            "Go and look at them for me, both of them, and come back and tell me. The archive pays for good reports.",
          ],
          offer: { start: "chronicler-roads" },
        },
      ],
    },
  ],
};
