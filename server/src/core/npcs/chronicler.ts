import type { Npc } from "./index.js";

export const CHRONICLER: Npc = {
  quests: {
    "chronicler-roads": {
      title: "Beyond the Walls",
      half: "side",
      when: { done: "bram-yard" },
      steps: [
        {
          id: "hollow",
          task: { kind: "reach", region: "waking-hollow" },
          text: "Go to the Waking Hollow.",
          hint: "Odo said the road from the South Gate runs straight down into it.",
        },
        {
          id: "mistwood",
          task: { kind: "reach", region: "mistwood" },
          text: "Go to the Mistwood.",
          hint: "Odo said it lies past the Grass Field, through the gap at its east edge.",
        },
        {
          id: "back",
          task: { kind: "talk", to: "chronicler" },
          text: "Tell Odo what you saw.",
          hint: "He keeps the roll in the archive off the Hall of Arrival's west end.",
          reward: { items: { "silver-coin": 1, "copper-coin": 50 }, lore: ["arrivals-roll"] },
        },
      ],
    },
  },
  stops: [
    {
      region: "kingdom",
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
          lines: ["The Waking Hollow first. The road from the South Gate runs straight down into it."],
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
