import type { Npc } from "./index.js";

export const MAREN: Npc = {
  quests: {
    "maren-waking": {
      title: "Woken",
      half: "main",
      steps: [
        {
          id: "boar",
          task: { kind: "kill", enemy: "wild-boar", count: 1 },
          text: "Slay a wild boar.",
          hint: "Maren said the boars root about in the tall grass across the brook, south of the camp.",
        },
        {
          id: "back",
          task: { kind: "talk", to: "maren" },
          text: "Go back to Maren.",
          hint: "She said she'd tell you what you are. She keeps the pad in the Hollow, by the fire.",
          reward: { lore: ["the-seed"] },
        },
      ],
    },
    "maren-road": {
      title: "The Road East",
      half: "main",
      when: { done: "tobin-smoke" },
      steps: [
        {
          id: "hollis",
          task: { kind: "talk", to: "hollis" },
          text: "Find Hollis in the Grass Field.",
          hint: "Maren said the road east out of the Hollow runs into the Grass Field, and Hollis keeps a fire a good "
            + "walk along it.",
          reward: { items: { "boar-meat": 2 }, lore: ["natives"] },
        },
      ],
    },
    "maren-tongue": {
      title: "The Old Tongue",
      half: "side",
      when: { done: "maren-road" },
      steps: [
        {
          id: "mistwood",
          task: { kind: "reach", region: "mistwood" },
          text: "Go to the Mistwood.",
          hint: "Maren said it lies past the Grass Field, through the gap at its east edge.",
        },
        {
          id: "warlock",
          task: { kind: "kill", enemy: "goblin-warlock", count: 1 },
          text: "Hear a Goblin Warlock chant, then slay it.",
          hint: "Maren said the Mistwood's goblins chant among the broken walls in its south-east, past the water.",
        },
        {
          id: "back",
          task: { kind: "talk", to: "maren" },
          text: "Tell Maren what you heard.",
          hint: "She keeps the pad in the Hollow, by the fire.",
          reward: { items: { "boar-meat": 3 }, lore: ["old-tongue"] },
        },
      ],
    },
  },
  stops: [
    {
      region: "waking-hollow",
      at: { x: -2.5, z: 6 },
      heading: "west",
      talk: [
        {
          when: { done: "maren-tongue" },
          lines: [
            "The pad's been quiet. Sit by the fire if you need it; it's yours as much as anyone's.",
            "Ithra's priests would pay well to hear what you heard in the Mistwood. I'd not tell them.",
          ],
        },
        {
          when: { quest: "maren-tongue", step: "back" },
          lines: [
            "The same words as yours? I thought as much.",
            "Nobody taught them to the goblins that I know of. Nobody taught them to you either, and you pick them up "
              + "as if you'd always had them.",
            "The priests call it Ithra's tongue. Some say it was spoken before the gods were. Don't repeat that to a "
              + "priest.",
            "Here, for the walk back.",
          ],
        },
        {
          when: { quest: "maren-tongue", step: "warlock" },
          lines: ["Find a goblin that chants. Listen before you put it down, then come and tell me."],
        },
        {
          when: { quest: "maren-tongue", step: "mistwood" },
          lines: ["The Mistwood lies past the Grass Field, through the gap at its east edge."],
        },
        {
          when: { canStart: "maren-tongue" },
          lines: [
            "Hollis still keeping that fire? Good.",
            "Here's a thing I've never made sense of. Your kind casts with words, old ones: Ithra's tongue, the "
              + "priests call it.",
            "The goblins in the Mistwood chant the same words. Go and hear one, then put it down, and come and tell me "
              + "if it sounded like yours.",
          ],
          offer: { start: "maren-tongue" },
        },
        {
          when: { quest: "maren-road", step: "hollis" },
          lines: [
            "Hollis is east along the road, in the Grass Field. His fire's a good walk past where the road comes in.",
          ],
        },
        {
          when: { canStart: "maren-road" },
          lines: [
            "Tobin gave you a hide? Then he likes you better than he'll ever say.",
            "You've found your feet. The Hollow's small, and the world isn't.",
            "Follow the road east out of the Hollow and you'll come to the Grass Field. A man called Hollis keeps a "
              + "fire there for your kind. Go and see him.",
          ],
          offer: { start: "maren-road" },
        },
        {
          when: { quest: "maren-waking", step: "back" },
          lines: [
            "You came back. Good. Most do, the first time.",
            "What woke on that pad is a seed: a piece of a soul, given at the door by someone in your own world. The "
              + "one behind your eyes.",
            "The shell around it is empty. It fills with what the beasts held, a little with each one you put down.",
            "And the seed stays tied to the one it came from. We call that the tether. When the shell comes apart, "
              + "the tether pulls you back to a pad.",
            "Tobin keeps watch by the footbridge. He's short with your kind, but he could use a hand. Go and see him.",
          ],
        },
        {
          when: { quest: "maren-waking", step: "boar" },
          lines: [
            "Across the brook, where the grass grows tall. Tobin's footbridge takes you over.",
            "If it goes badly, come back and sit by the fire. It mends what it can.",
          ],
        },
        {
          when: { done: "maren-waking" },
          lines: ["Tobin's down by the footbridge. Mind his temper; it isn't about you."],
        },
        {
          lines: [
            "Easy. Breathe. You're through.",
            "I'm Maren. I keep the pad behind you, and I meet whoever it brings. The door from your world opens on it.",
            "You're an avatar now, in a shell that isn't yours yet. It learns quick, but it learns by doing.",
            "A boar's been at our stores, out in the tall grass across the brook. Put one down, then come back and "
              + "I'll tell you what you are.",
          ],
          offer: { start: "maren-waking" },
        },
      ],
    },
  ],
};
