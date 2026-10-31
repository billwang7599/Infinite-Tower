import type { Npc } from "./index.js";

export const CORWIN: Npc = {
  stops: [
    {
      level: "grass-field",
      at: { x: 22.5, z: -4.5 },
      heading: "west",
      talk: [
        {
          when: { done: "corwin-count" },
          lines: [
            "The road's quieter. It won't stay so, but it's quieter.",
            "When your door takes you home for good, go with your word kept. That's all the Oath asks of anyone.",
          ],
        },
        {
          when: { quest: "corwin-count", step: "back" },
          lines: [
            "Two. And there'll be two more by the next moon; there always are.",
            "I used to think they bred in the ruins. They don't. The land holds loose soul, and where it pools long "
              + "enough it clumps into a beast. Put one down and the pool starts filling again.",
            "Part of what it held goes into whoever killed it. That's you, these days. The rest sinks back into the "
              + "ground, and the ground makes another.",
            "You kept your word. The watch eats better than it fights; take this.",
          ],
        },
        {
          when: { quest: "corwin-count", step: "kobolds" },
          lines: [
            "Two of their swordsmen. They come up out of the field's south-east corner, south-west of where I stand.",
          ],
        },
        {
          when: { canStart: "corwin-count" },
          lines: [
            "The blind's up. I can sit the night out of the wind now, and they can't see me counting.",
            "And I count too many. The Kobolds come up out of the field's south-east corner, twos and threes, closer "
              + "to the road each week.",
            "Put two of their swordsmen down and come back to me. I'd know what the count does when someone thins it.",
          ],
          offer: { start: "corwin-count" },
        },
        {
          when: { quest: "corwin-blind", step: "bring" },
          lines: ["Got those hides? Hand them here and I'll have the blind up by dark."],
          offer: { deliver: "corwin-blind" },
        },
        {
          when: { quest: "corwin-blind", step: "gather" },
          lines: [
            "Two boar hides. The boars root about in the field's tall grass, and not every one gives a hide worth "
              + "the name.",
          ],
        },
        {
          lines: [
            "Hold there, avatar. I'm Corwin. I keep the east road for Valdris, from the river to the Mistwood's edge.",
            "I'll not ask where you come from. Another world, they say, and one day you'll go back to it. Until then "
              + "you keep the peace here, and you keep your word.",
            "The Kobolds hold the east of this field. I watch them from the road, wind or no wind.",
            "Bring me two boar hides for a blind and I'll see you fed. Have I your word?",
          ],
          offer: { start: "corwin-blind" },
        },
      ],
    },
  ],
};
