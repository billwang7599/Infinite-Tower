import { DEFAULT_LOOK, ITEMS, LOOK_OPTIONS, seededRandom, type ItemId } from "@infinite-tower/shared";
import { PX_PER_TILE, SPRITE_PX } from "@infinite-tower/client/src/gfx/grid.js";
import { drawItem } from "@infinite-tower/client/src/gfx/items/items.js";
import { POSES, SWORD_POSES, type Pose, type SwordPose } from "@infinite-tower/client/src/gfx/look/battle.js";
import {
  BATTLE_FACINGS, CHIBI_FACINGS, drawBattle, drawChibi, drawPortrait,
} from "@infinite-tower/client/src/gfx/look/look.js";
import { goblinSprite } from "@infinite-tower/client/src/visuals/enemies/goblin-warlock/sprite.js";
import { koboldGreatswordSprite } from "@infinite-tower/client/src/visuals/enemies/kobold-greatsword/sprite.js";
import { koboldSprite } from "@infinite-tower/client/src/visuals/enemies/kobold-swordsman/sprite.js";
import { boarSprite } from "@infinite-tower/client/src/visuals/enemies/wild-boar/sprite.js";
import { GRASS_FIELD_TILES } from "@infinite-tower/client/src/visuals/levels/grass-field/tiles.js";
import { MISTWOOD_TILES } from "@infinite-tower/client/src/visuals/levels/mistwood/tiles.js";
import type { TileLooks } from "@infinite-tower/client/src/visuals/levels/tiles.js";
import { NPC_LOOKS } from "@infinite-tower/client/src/visuals/npcs/index.js";
import { Pen, PROP_ART } from "@infinite-tower/client/src/visuals/overworld/props.js";
import type { SpriteDraw } from "@infinite-tower/client/src/visuals/sprites.js";
import { el } from "../dom.js";
import { blank, hexToRgba, type Bitmap } from "./bitmap.js";
import { paint, rectPoints } from "./draw.js";
import { projectOf, type Project } from "./layers.js";
import type { Mode } from "./modes.js";

export interface Template { group: string; name: string; mode: Mode; make: () => Project }

type Named = { name: string; pixels: Bitmap };

const one = (group: string, name: string, draw: () => Bitmap): Template =>
  ({ group, name, mode: "sprite", make: () => projectOf([{ name: "picture", pixels: draw() }], "layers") });

const pages = (group: string, name: string, mode: Mode, draw: () => Named[]): Template =>
  ({ group, name, mode, make: () => projectOf(draw(), "pages") });

function onCanvas(width: number, height: number, draw: (pen: Pen) => void): Bitmap {
  const c = el("canvas");
  [c.width, c.height] = [width, height];
  const g = c.getContext("2d", { willReadFrequently: true })!;
  draw(new Pen(g));
  return { width, height, rgba: g.getImageData(0, 0, width, height).data };
}

function sprite(draw: SpriteDraw): Bitmap {
  const b = blank(SPRITE_PX, SPRITE_PX);
  draw((x, y, w, h, color) => paint(b, rectPoints(x, y, x + w - 1, y + h - 1, true), hexToRgba(color)));
  return b;
}

const tileset = (looks: TileLooks): Named[] => Object.entries(looks).map(([kind, look], i) => ({
  name: kind,
  pixels: onCanvas(PX_PER_TILE, PX_PER_TILE, (pen) => look.ground(pen, 0, 0, seededRandom(i + 1), () => true)),
}));

const POSE_FRAMES: Record<string, number> = { ...Object.fromEntries(POSES.map((p) => [p, 1])), ...SWORD_POSES };

export const TEMPLATES: readonly Template[] = [
  ...LOOK_OPTIONS.body.flatMap((body) => LOOK_OPTIONS.face.map((face) =>
    one("Portraits", `portrait ${body} ${face}`, () => drawPortrait({ ...DEFAULT_LOOK, body, face })))),
  ...LOOK_OPTIONS.body.map((body) => pages("Chibi", `chibi ${body}`, "animation", () =>
    CHIBI_FACINGS.map((facing) => ({ name: facing, pixels: drawChibi({ ...DEFAULT_LOOK, body }, facing) })))),
  ...BATTLE_FACINGS.flatMap((facing) => Object.entries(POSE_FRAMES).map(([pose, count]) =>
    pages("Battle sprite", `battle ${pose} ${facing}`, "animation", () => Array.from({ length: count }, (_, frame) => ({
      name: `${pose} ${frame + 1}`, pixels: drawBattle(DEFAULT_LOOK, pose as Pose | SwordPose, frame, facing),
    }))))),
  ...Object.entries(NPC_LOOKS).map(([id, npc]) => one("NPCs", `${id} portrait`, () => drawPortrait(npc.look))),
  ...Object.entries({
    "wild boar": boarSprite, "kobold swordsman": koboldSprite, "kobold greatsword": koboldGreatswordSprite,
    "goblin warlock": goblinSprite,
  }).map(([name, s]) => one("Enemies (overworld)", name, () => sprite(s.draw))),
  pages("Tiles", "grass field tiles", "tiles", () => tileset(GRASS_FIELD_TILES)),
  pages("Tiles", "mistwood tiles", "tiles", () => tileset(MISTWOOD_TILES)),
  ...Object.entries(PROP_ART).map(([kind, art]) =>
    one("Props", kind, () => onCanvas(art.widthPx, art.heightPx, (pen) => art.draw(pen, seededRandom(31))))),
  ...(Object.keys(ITEMS) as ItemId[]).map((id) => one("Items", id, () => drawItem(id))),
];
