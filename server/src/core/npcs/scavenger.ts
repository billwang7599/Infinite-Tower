import type { Npc } from "./index.js";

export const SCAVENGER: Npc = {
  quests: {
    "scavenger-pelts": {
      title: "A Roof of Pelts",
      half: "side",
      steps: [
        {
          id: "gather",
          task: { kind: "gather", item: "wolf-pelt", count: 2 },
          text: "Gather 2 wolf pelts.",
          hint: "Nim said a grey wolf prowls the Grass Field's far north-east corner and another the Mistwood's "
            + "south-west woods, and they don't give up the pelt every time.",
        },
        {
          id: "bring",
          task: { kind: "deliver", item: "wolf-pelt", count: 2, to: "scavenger" },
          text: "Bring the 2 wolf pelts to Nim.",
          hint: "She lives in the ruined overseer's hut, in the Old Quarry's south-west.",
          reward: { items: { "silver-coin": 1 }, lore: ["overseer-ledger"] },
        },
      ],
    },
    "scavenger-chanters": {
      title: "The Chanters at the Rim",
      half: "side",
      when: { done: "scavenger-pelts" },
      steps: [
        {
          id: "warlocks",
          task: { kind: "kill", enemy: "goblin-warlock", count: 2 },
          text: "Slay 2 Goblin Warlocks.",
          hint: "Nim said they keep to the Old Quarry's north rim, up by the cranes.",
        },
        {
          id: "back",
          task: { kind: "talk", to: "scavenger" },
          text: "Go back to Nim.",
          hint: "She lives in the ruined overseer's hut, in the Old Quarry's south-west.",
          reward: { items: { "silver-coin": 1, "copper-coin": 50 }, lore: ["rim-chanters"] },
        },
      ],
    },
  },
  stops: [
    {
      region: "old-quarry",
      at: { x: -12.5, z: -9.5 },
      heading: "east",
      talk: [
        {
          when: { done: "scavenger-chanters" },
          lines: [
            "The chanting's started up again. It always does. But I sleep under pelts now, and that's something.",
            "Mind yourself at the rim, avatar.",
          ],
        },
        {
          when: { quest: "scavenger-chanters", step: "back" },
          lines: [
            "Two of them? Then the rim's quiet for a night or two. I'll take it.",
            "Here's what I've seen from this roof. They don't come for us. They come for the pit. They sit at the "
              + "rim and chant down at the pool, in the old tongue, all night.",
            "And every time they do, the water sinks a finger's width. By morning it's full again. Either they're "
              + "drinking from it or they're feeding it, and I don't like either.",
            "Silver, and a bit over. Don't tell Harl where I keep it.",
          ],
        },
        {
          when: { quest: "scavenger-chanters", step: "warlocks" },
          lines: [
            "Two of the goblin chanters. They keep to the north rim, up by the cranes. Get close quick, before "
              + "they've room for a long chant.",
          ],
        },
        {
          when: { canStart: "scavenger-chanters" },
          lines: [
            "The roof's patched. I owe you better than coin, so here's a job that pays in coin anyway.",
            "The goblins up on the north rim, by the cranes. They chant all night and I can't sleep for it. Put two "
              + "of them down.",
          ],
          offer: { start: "scavenger-chanters" },
        },
        {
          when: { quest: "scavenger-pelts", step: "bring" },
          lines: [
            "Wolf pelts! Real ones. Give them here, before the rain finds the hole again.",
            "I found something while you were gone: the overseer's ledger, under the floor. Every block that left "
              + "this quarry, tallied by terrace and seam. The walls, the keep, the hall.",
            "Every block but one. The platform in the hall isn't in it. The first page says it was lying there "
              + "before the first block was cut, and nobody knew whose it was.",
            "The last page is in another hand: \"Pit broken. Cutters off. Stone enough.\" That's all the crown had "
              + "to say about it.",
            "Here, for the pelts. Fairer than Garrick would pay.",
          ],
          offer: { deliver: "scavenger-pelts" },
        },
        {
          when: { quest: "scavenger-pelts", step: "gather" },
          lines: [
            "Two wolf pelts. There's a grey wolf in the Grass Field's far north-east corner and another in the "
              + "Mistwood's south-west woods. They don't give up the pelt every time.",
          ],
        },
        {
          lines: [
            "Oh! I took you for a Kobold. You walk like one. No offence.",
            "Nim. I pick over what the cutters left: iron off the carts, rope off the cranes. The overseer won't "
              + "mind. He went back to Highmere years ago.",
            "This hut's a good roof, mostly. The mostly lets the rain in. Bring me two wolf pelts and I'll pay you "
              + "better than the forge would.",
          ],
          offer: { start: "scavenger-pelts" },
        },
      ],
    },
  ],
};
