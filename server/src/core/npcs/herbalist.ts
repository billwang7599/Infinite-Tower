import type { Npc } from "./index.js";

export const HERBALIST: Npc = {
  stops: [
    {
      level: "mistwood",
      at: { x: -11.5, z: -8.5 },
      heading: "west",
      talk: [
        {
          when: { done: "herbalist-mist" },
          lines: [
            "The mist's thinner tonight. Or I'm counting too hard. I always count too hard.",
            "The Harvest's priests say your kind were sent to fill the world back up. Looking at you, I'd like to "
              + "believe it.",
          ],
        },
        {
          when: { quest: "herbalist-mist", step: "back" },
          lines: [
            "You stood in it. How did it feel? Like breathing someone else's breath? Yes. That's the word for it.",
            "It isn't mist. It's soul, the loose kind, rising off the still water where it's pooled under the mire. "
              + "Where it hangs thick enough, it clumps: a boar, a wolf, a Kobold.",
            "The goblins breathe it before they chant. Whatever their words are for, they need it.",
            "And there's less of it every year, like everything else. Here. Calyx pays better than I do, but this "
              + "is mine.",
          ],
        },
        {
          when: { quest: "herbalist-mist", step: "warlock" },
          lines: [
            "The goblin in the broken walls south-east of the lake. Put it down before it comes to the water again.",
          ],
        },
        {
          when: { quest: "herbalist-mist", step: "island" },
          lines: [
            "The little island in the lake. Walk out along the bridge, and where it forks, go north.",
          ],
        },
        {
          when: { canStart: "herbalist-mist" },
          lines: [
            "The poultice is setting. Now something I can't do with my knees.",
            "The mist. It comes off the water thickest over the little island north of the bridge, and it's thinner "
              + "every year too.",
            "Go and stand on that island, and tell me what it feels like. And the goblin in the broken walls south-"
              + "east of the lake comes down to breathe it before it chants. Put it down while you're about it.",
          ],
          offer: { start: "herbalist-mist" },
        },
        {
          when: { quest: "herbalist-fangs", step: "bring" },
          lines: [
            "Fangs! Good ones. Let me see. Yes, these will grind.",
            "You'll want to know why I count everything. I've gathered in this wood forty years, and I keep a tally "
              + "of all I take.",
            "Every year it's a little less. The roots come up smaller, the mushrooms thinner. Never enough to see. "
              + "Always enough to count.",
            "Everyone says the world leaks. Calyx's own say it's starving, and has been longer than anyone's kept "
              + "count. Here, for the fangs.",
          ],
          offer: { deliver: "herbalist-fangs" },
        },
        {
          when: { quest: "herbalist-fangs", step: "gather" },
          lines: [
            "Three wolf fangs. A grey wolf lies up in the woods just west of here, and another prowls the Grass "
              + "Field's far north-east corner. Not every one gives a fang.",
          ],
        },
        {
          lines: [
            "Mind the reeds, they bite back. Oh. One of the new ones. You've the hall's look about you.",
            "Sorrel. I gather for Calyx, who keeps everything that grows. This mire grows more than most. Or it did.",
            "A grey wolf lies up in the woods just west of here. Its fangs, ground fine, go into a poultice for rot, "
              + "and I'm out. Bring me three and I'll pay in copper.",
          ],
          offer: { start: "herbalist-fangs" },
        },
      ],
    },
  ],
};
