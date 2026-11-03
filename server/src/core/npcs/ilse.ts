import { regionRect } from "../world/index.js";
import type { Npc } from "./index.js";

export const ILSE: Npc = {
  quests: {
    "ilse-weights": {
      title: "Weights for the Loom",
      half: "side",
      steps: [
        {
          id: "gather",
          task: { kind: "gather", item: "boar-tusk", count: 2 },
          text: "Gather 2 boar tusks.",
          hint: "Ilse said the boars carry them, the Mistwood's and the Grass Field's alike, though few give one up.",
        },
        {
          id: "bring",
          task: { kind: "deliver", item: "boar-tusk", count: 2, to: "ilse" },
          text: "Bring the 2 boar tusks to Ilse.",
          hint: "She sits by the Mistwood's path where it comes off the lake's bridge, on the east shore.",
          reward: { items: { "boar-meat": 2 }, lore: ["nyras-loom", "the-realms"] },
        },
      ],
    },
    "ilse-snapped": {
      title: "The Snapped Thread",
      half: "side",
      when: { done: "ilse-weights" },
      steps: [
        {
          id: "ruins",
          task: { kind: "reach", region: "mistwood", area: regionRect("mistwood", { x: 11, z: 12, w: 9, h: 5 }) },
          text: "Go to the broken walls north of the lake.",
          hint: "Ilse said they stand in the Mistwood's north-east, up the path from where she sits.",
        },
        {
          id: "kobold",
          task: { kind: "kill", enemy: "kobold-swordsman", count: 1 },
          text: "Slay a Kobold Swordsman.",
          hint: "Ilse said one keeps the broken walls, and fights like nothing else in the wood.",
        },
        {
          id: "back",
          task: { kind: "talk", to: "ilse" },
          text: "Tell Ilse how it fought.",
          hint: "She sits by the Mistwood's path on the lake's east shore, where the bridge comes in.",
          reward: { items: { "boar-meat": 3 }, lore: ["snapped-tether"] },
        },
      ],
    },
  },
  stops: [
    {
      region: "mistwood",
      at: { x: 11.5, z: 1.5 },
      heading: "west",
      talk: [
        {
          when: { quest: "hollis-loom", step: "ilse" },
          lines: [
            "Hollis sent you about the pad. He's asked me twice a day since he came.",
            "I've stood on it and looked, the way I look at you. Nothing. No thread runs to it, and none runs out.",
            "Whoever laid that stone isn't on the loom. Tell him that, and tell him it's the same nothing I see in "
              + "you.",
          ],
        },
        {
          when: { quest: "tamsin-son", step: "ilse" },
          lines: [
            "Rook? Tamsin's boy, from Highmere. Hold still, I'll find him. Natives are easy; it's you I can't read.",
            "There. His thread runs on. Thin, and a long way off, past anywhere the loom will show me, but it runs.",
            "Tell his mother he's alive. Where he is, and why he hasn't come home, the thread won't say.",
          ],
        },
        {
          when: { done: "ilse-snapped" },
          lines: [
            "Still no thread. I've stopped expecting one.",
            "Go on, avatar. I'd like to see how far a light with no thread can climb.",
          ],
        },
        {
          when: { quest: "ilse-snapped", step: "back" },
          lines: [
            "And? Did it fight like a beast, or like one of you?",
            "The hunters tell a story: that some beasts were avatars once, and their tether snapped. Cut loose from "
              + "the one behind their eyes, they went wild, and they've been eating ever since.",
            "I hoped that swordsman would have no thread, like you. It had one. Thin, and knotted, but a thread.",
            "Which proves nothing either way. A knot can hide anything. Take this for your trouble.",
          ],
        },
        {
          when: { quest: "ilse-snapped", step: "kobold" },
          lines: ["The swordsman that keeps the broken walls. Put it down, then come and tell me how it fought."],
        },
        {
          when: { quest: "ilse-snapped", step: "ruins" },
          lines: ["The broken walls are north of the lake. Follow the path up from here."],
        },
        {
          when: { canStart: "ilse-snapped" },
          lines: [
            "The weights hang true. Thank you.",
            "There's something else I've wanted to know. A Kobold Swordsman keeps the broken walls north of the lake, "
              + "and it fights like nothing else in this wood.",
            "Go up to the walls, put it down, and come and tell me how it fought. Then I'll tell you why I ask.",
          ],
          offer: { start: "ilse-snapped" },
        },
        {
          when: { quest: "ilse-weights", step: "bring" },
          lines: [
            "Are those the tusks? Let me feel the weight.",
            "While you're close: I can't see your thread, but I can see your light. A flame still. Yan, the priests "
              + "call that.",
            "After it come Sol, Lux, Ling and Tian, each further from fire. Some say a soul past Tian takes a seat "
              + "beside a god. Nobody living has seen one.",
          ],
          offer: { deliver: "ilse-weights" },
        },
        {
          when: { quest: "ilse-weights", step: "gather" },
          lines: [
            "Two boar tusks, the heavier the better. The boars here carry them, and so do the Grass Field's, though "
              + "few give one up.",
          ],
        },
        {
          lines: [
            "Stand still a moment. No. Nothing, again.",
            "I'm Ilse. I weave for Nyra, who keeps the loom every life in this world is a thread on. Mine's there. "
              + "Every boar in this wood is there.",
            "Yours isn't. None of your kind's are. Whatever sends you here isn't on her loom.",
            "My loom's weights cracked in the frost, and boar tusk hangs truer than stone. Bring me two, and I'll tell "
              + "you what I can see of you.",
          ],
          offer: { start: "ilse-weights" },
        },
      ],
    },
  ],
};
