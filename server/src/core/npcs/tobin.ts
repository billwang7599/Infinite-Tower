import type { Npc } from "./index.js";

export const TOBIN: Npc = {
  stops: [
    {
      region: "waking-hollow",
      at: { x: 4.5, z: 2.5 },
      heading: "west",
      talk: [
        {
          when: { done: "tobin-kobold" },
          lines: [
            "Kill what you need and no more, avatar.",
            "The Hollow eats because hunters waste nothing. Remember that out there.",
          ],
        },
        {
          when: { quest: "tobin-kobold", step: "back" },
          lines: [
            "Still in one piece? Then it fought like they all do: twos and threes, never a wasted swing.",
            "They fight like they were taught. Kaelith's priests say the god of the blade teaches whoever asks him, "
              + "beast or man.",
            "Take this. You earned it.",
          ],
        },
        {
          when: { quest: "tobin-kobold", step: "kobold" },
          lines: [
            "Kobolds, east of the Grass Field's river. They swing in twos and threes, and they don't waste a swing. "
              + "Neither should you.",
          ],
        },
        {
          when: { canStart: "tobin-kobold" },
          lines: [
            "That meat will feed the next one off the stone. You did right.",
            "Maren will have more for you. But if you want real work: Kobolds hold the old ruins east of the Grass "
              + "Field's river, and they've been coming west.",
            "Put one of their swordsmen down and come and tell me how it fought.",
          ],
          offer: { start: "tobin-kobold" },
        },
        {
          when: { quest: "tobin-smoke", step: "bring" },
          lines: ["That for the rack? Hand it over."],
          offer: { deliver: "tobin-smoke" },
        },
        {
          when: { quest: "tobin-smoke", step: "gather" },
          lines: ["Two boar meat. A beaten boar leaves some more often than not, and the tall grass is full of them."],
        },
        {
          when: { canStart: "tobin-smoke" },
          lines: [
            "Maren sent you? Then you've killed something. Good.",
            "Your kind kills and leaves the meat to rot. Out here we don't waste what a beast gives.",
            "Bring me two boar meat for the rack. I'll smoke it for whoever wakes on that stone next.",
          ],
          offer: { start: "tobin-smoke" },
        },
        {
          lines: ["Another one off the stone.", "Maren will want you first. She always does."],
        },
      ],
    },
  ],
};
