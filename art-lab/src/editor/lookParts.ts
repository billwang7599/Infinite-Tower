import { LOOK_OPTIONS, type Look } from "@infinite-tower/shared";
import { renderParts, type AnySketch } from "@infinite-tower/client/src/gfx/look/art.js";
import { POSES, SWORD_POSES, type Pose, type SwordPose } from "@infinite-tower/client/src/gfx/look/battle.js";
import { LEATHER_JERKIN } from "@infinite-tower/client/src/gfx/look/jerkin.js";
import {
  BATTLE_FACINGS, CHIBI_FACINGS, battleSketch, chibiSketch, portraitSketch,
} from "@infinite-tower/client/src/gfx/look/look.js";
import { STARTER_CLOTHES, type Wear } from "@infinite-tower/client/src/gfx/look/outfit.js";
import { blank } from "./bitmap.js";
import { NO_UNDERLAY, START_FPS, type Project } from "./layers.js";

interface ShotSet { name: string; pages: { name: string; sketch: (look: Look, wear: Wear) => AnySketch }[] }

const POSE_FRAMES: Record<Pose | SwordPose, number> =
  { ...Object.fromEntries(POSES.map((p) => [p, 1])) as Record<Pose, number>, ...SWORD_POSES };

export const SHOT_SETS: readonly ShotSet[] = [
  { name: "portrait", pages: [{ name: "portrait", sketch: (look, wear) => portraitSketch(look, wear) }] },
  { name: "chibi", pages: CHIBI_FACINGS.map((f) => ({ name: f, sketch: (look, wear) => chibiSketch(look, f, wear) })) },
  ...BATTLE_FACINGS.flatMap((facing) => (Object.entries(POSE_FRAMES) as [Pose | SwordPose, number][])
    .map(([pose, count]) => ({
      name: `battle ${pose} ${facing}`,
      pages: Array.from({ length: count }, (_, frame) => ({
        name: `${pose} ${frame + 1}`, sketch: (look: Look, wear: Wear) => battleSketch(look, pose, frame, facing, wear),
      })),
    }))),
];

const ALL_WEAR: Wear = { ...STARTER_CLOTHES, jerkin: LEATHER_JERKIN };

interface PartChoice { name: string; part: string; look?: Partial<Look> }

export const PART_CHOICES: readonly PartChoice[] = [
  { name: "base", part: "base" },
  ...(["hair", "eyes", "mouth"] as const).flatMap((part) =>
    LOOK_OPTIONS[part].map((option) => ({ name: `${part}: ${option}`, part, look: { [part]: option } }))),
  ...[...Object.keys(ALL_WEAR), "weapon"].map((part) => ({ name: part, part })),
];

// A part drawn on several of the game's layers gets a layer for each, unless nothing is drawn between them.
export function partsProject(set: ShotSet, look: Look, wear: Wear, only?: { parts: string[]; name: string }): Project {
  const sketches = set.pages.map((p) => p.sketch(look, wear));
  const keyOf = ({ part, layer }: { part: string; layer: string }) => `${part} ${layer}`;
  const keys: string[] = [];
  for (const cuts of sketches.map((s) => renderParts(s))) {
    let after = -1;
    for (const cut of cuts) {
      const key = keyOf(cut);
      if (!keys.includes(key)) keys.splice(after + 1, 0, key);
      after = keys.indexOf(key);
    }
  }
  const partOf = (key: string) => key.split(" ")[0]!;
  const runs: string[][] = [];
  for (const key of keys) {
    const last = runs.at(-1);
    if (last && partOf(last[0]!) === partOf(key)) last.push(key);
    else runs.push([key]);
  }
  const kept = runs.filter((run) => !only || only.parts.includes(partOf(run[0]!)));
  const pages = sketches.map((s) => renderParts(s, only?.parts));
  const { width, height } = pages[0]![0]!.picture;
  const layers = kept.map((run) => {
    const [part, layer] = run[0]!.split(" ") as [string, string];
    const name = only?.name ?? part;
    return {
      name: kept.filter((r) => partOf(r[0]!) === part).length > 1 ? `${name} (${layer})` : name,
      pixels: pages.map((cuts) => {
        const out = blank(width, height);
        for (const { picture: { rgba } } of cuts.filter((c) => run.includes(keyOf(c)))) {
          for (let i = 0; i < rgba.length; i += 4) if (rgba[i + 3]) out.rgba.set(rgba.subarray(i, i + 4), i);
        }
        return out;
      }),
    };
  }).filter((layer) => layer.pixels.some((p) => p.rgba.some((v, i) => i % 4 === 3 && v > 0)));
  return {
    pages: set.pages.map((p, i) => ({
      name: set.pages.length > 1 ? p.name : "", width, height,
      layers: layers.map(({ name, pixels }) => ({ name, visible: true, opacity: 1, pixels: pixels[i]! })),
    })),
    page: 0, fps: START_FPS,
  };
}

export function partAloneProject(choice: PartChoice, set: ShotSet, look: Look): Project {
  const project = partsProject(set, { ...look, ...choice.look }, ALL_WEAR, { parts: [choice.part], name: choice.name });
  project.underlay = { ...NO_UNDERLAY, shots: set.name, body: look.body, face: look.face, skin: look.skin, shown: true };
  return project;
}
