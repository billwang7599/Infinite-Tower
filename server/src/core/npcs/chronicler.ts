import type { Npc } from "./index.js";

export const CHRONICLER: Npc = {
  stops: [
    {
      level: "kingdom",
      at: { x: -15.5, z: 17.5 },
      heading: "east",
      talk: [
        {
          when: { done: "chronicler-roads" },
          lines: [
            "Ah, my correspondent. I've written your name twice now: once for arriving, once for the Hollow and the "
              + "Mistwood. Nobody else has two lines.",
            "Keep walking. The roll only knows that hall, and someone ought to know the rest.",
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
          when: { canStart: "bram-yard" },
          lines: [
            "Name? No, don't tell me, I have it already. I wrote it the moment you woke. Odo, keeper of the roll.",
            "And you've wandered in here with empty hands. Aldric will have told you: old Bram's yard first, by the "
              + "barracks, through the gap in the courtyard's north-west wall. Come back when he's done with you.",
          ],
        },
        {
          when: { canStart: "chronicler-roads" },
          lines: [
            "Name? No, don't tell me, I have it already. I wrote it the moment you woke. Odo, keeper of the roll.",
            "Every avatar who wakes on that platform goes into this book: a name, a day, a line on the look of them. "
              + "The crown counts it like it counts its soldiers.",
            "And I've never once been past the South Gate. They say there are other pads out there: one in a hollow "
              + "to the west, one in a misty wood to the east.",
            "Go and look at them for me, both of them, and come back and tell me. The archive pays for good reports.",
          ],
          offer: { start: "chronicler-roads" },
        },
        {
          lines: ["Still with Bram? Finish there first. The roll has waited this long; it can wait for you."],
        },
      ],
    },
  ],
};
