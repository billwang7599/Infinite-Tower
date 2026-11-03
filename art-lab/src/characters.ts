import { DEFAULT_LOOK, LOOK_OPTIONS as OPTIONS } from "@infinite-tower/shared";
import type { Picture } from "@infinite-tower/client/src/gfx/look/art.js";
import { TRACED_COLORS, TRACED_PICTURES } from "@infinite-tower/client/src/gfx/look/base.js";
import { POSES, SWORD_POSES, type Pose, type SwordPose } from "@infinite-tower/client/src/gfx/look/battle.js";
import { LEATHER_JERKIN } from "@infinite-tower/client/src/gfx/look/jerkin.js";
import {
  BATTLE_FACINGS, CHIBI_FACINGS, colorsOf, drawBattle, drawChibi, drawPortrait, drawTraced, type BattleFacing,
  type ChibiFacing, type Look,
} from "@infinite-tower/client/src/gfx/look/look.js";
import { STARTER_CLOTHES } from "@infinite-tower/client/src/gfx/look/outfit.js";
import { Shuffle } from "lucide";
import { caption, checkbox, el, withIcon } from "./dom.js";

const LABELS: Record<keyof Look, string> = {
  body: "Body", face: "Face shape", skin: "Skin", hair: "Hair", hairColor: "Hair color", eyes: "Eyes",
  eyeColor: "Eye color", mouth: "Mouth", outfit: "Outfit color", accent: "Accent",
};

let look: Look = { ...DEFAULT_LOOK };
let jerkin = false;
let leftHanded = false;

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;
const randomLook = (): Look =>
  Object.fromEntries(Object.entries(OPTIONS).map(([k, list]) => [k, pick(list)])) as unknown as Look;

function canvas(pic: Picture, scale: number, className = ""): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = pic.width;
  c.height = pic.height;
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(pic.rgba), pic.width, pic.height), 0, 0);
  c.className = `pixelated ${className}`;
  c.style.width = `${pic.width * scale}px`;
  c.style.height = `${pic.height * scale}px`;
  return c;
}

const wear = () => (jerkin ? { ...STARTER_CLOTHES, jerkin: LEATHER_JERKIN } : STARTER_CLOTHES);
const portrait = (l: Look) => drawPortrait(l, wear());
const chibi = (l: Look, facing: ChibiFacing) => drawChibi(l, facing, wear());
const battle = (pose: Pose | SwordPose, frame: number, facing: BattleFacing) =>
  drawBattle(look, pose, frame, facing, wear(), leftHanded ? "leftHand" : "rightHand");

export const currentLook = () => look;

const CARD = "flex flex-wrap items-end gap-8 overflow-x-auto rounded-lg border border-line bg-ink-850 p-5";

let root: HTMLElement;

export function renderCharacters(into: HTMLElement): void {
  root = into;
  render();
}

function render(): void {
  root.replaceChildren();
  const heading = el("div", "flex flex-col gap-1");
  heading.append(el("h1", "m-0 text-lg font-semibold", "Character art"),
    el("p", "m-0 text-body text-fg-muted", "Every look drawn by the game's own code, in each view and pose."));
  root.append(heading);

  const controls = el("div", "flex flex-wrap items-end gap-3 rounded-lg border border-line bg-ink-850 p-4");
  for (const key of Object.keys(OPTIONS) as (keyof Look)[]) {
    const label = el("label", "flex flex-col gap-1 text-label text-fg-muted", LABELS[key]);
    const select = el("select", "field");
    for (const option of OPTIONS[key]) select.append(new Option(option, option, false, look[key] === option));
    select.onchange = () => { look = { ...look, [key]: select.value }; render(); };
    label.append(select);
    controls.append(label);
  }
  const random = withIcon(el("button", "btn", "Random"), Shuffle);
  random.onclick = () => { look = randomLook(); render(); };
  const toggles = el("div", "flex h-7 items-center gap-4");
  toggles.append(
    checkbox("Try on: leather jerkin", jerkin, (on) => { jerkin = on; render(); }),
    checkbox("Sword in the left hand", leftHanded, (on) => { leftHanded = on; render(); }),
  );
  controls.append(random, toggles);
  root.append(controls);

  // The portrait and the chibi facing front, at a few sizes
  const views = el("div", CARD);
  views.append(
    caption(canvas(portrait(look), 6), "portrait 64x64 at 6x"),
    caption(canvas(chibi(look, "front"), 6), "chibi 32x32 at 6x"),
    caption(canvas(chibi(look, "front"), 3), "chibi at 3x (about world size)"),
  );
  root.append(views, tracedSection());

  // The chibi facing each way: front, back, side (walking right mirrors the side).
  const facings = el("div", CARD);
  for (const facing of CHIBI_FACINGS) facings.append(caption(canvas(chibi(look, facing), 6), `chibi facing ${facing}`));
  facings.append(
    caption(canvas(chibi(look, "side"), 6, "-scale-x-100"), "chibi facing side, walking right"),
  );
  for (const facing of CHIBI_FACINGS) facings.append(caption(canvas(chibi(look, facing), 3), "3x"));
  root.append(facings);

  // The battle sprite in each pose, from behind and from the front, and at about arena size.
  const poses = el("div", CARD);
  for (const pose of POSES) {
    const sides = el("div", "flex gap-1");
    for (const facing of BATTLE_FACINGS) sides.append(canvas(battle(pose, 0, facing), 4));
    poses.append(caption(sides, `battle: ${pose}, back and front, at 4x`));
  }
  for (const facing of BATTLE_FACINGS) poses.append(caption(canvas(battle("stand", 0, facing), 2), "at 2x"));
  root.append(poses);

  // The sword fight's poses: every frame in order, from behind over from the front, at 3x.
  const moves = el("div", "flex flex-wrap gap-x-7 gap-y-5");
  for (const [pose, count] of Object.entries(SWORD_POSES) as [SwordPose, number][]) {
    const sides = el("div", "flex flex-col gap-0.5");
    for (const facing of BATTLE_FACINGS) {
      const frames = el("div", "flex gap-0.5");
      for (let frame = 0; frame < count; frame++) frames.append(canvas(battle(pose, frame, facing), 3));
      sides.append(frames);
    }
    moves.append(caption(sides, `${pose}: ${count} frames, back over front`));
  }
  const movesCard = el("div", CARD);
  movesCard.append(caption(moves, "battle: the sword fight's poses, frame by frame"));
  root.append(movesCard);

  // Mock dialogue, FGO style: speaker lit, the other dimmed, no portrait backgrounds. Portraits face our left, so
  // the one on the left is flipped to face the other.
  const scene = el("div", "relative h-[420px] w-[1050px] overflow-hidden rounded-md " +
    "bg-[radial-gradient(ellipse_at_50%_35%,#2a2433,#0a090d_70%)]");
  const other = randomLookStable();
  scene.append(
    canvas(portrait(other), 4, "absolute right-[140px] bottom-[60px] brightness-45"),
    canvas(portrait(look), 4, "absolute bottom-[60px] left-[140px] -scale-x-100"),
  );
  const box2 = el("div", "absolute right-6 bottom-4 left-6 h-[110px] rounded px-5 pt-7 " +
    "border border-[#c9a24a88] bg-linear-to-b from-[#0d0c11e6] to-[#050507f2]");
  box2.append(
    el("div", "absolute -top-4 left-3 border border-[#c9a24a88] bg-[#14121a] px-[18px] py-1",
      "You"),
    el("div", "text-[17px] leading-normal", "So this is the tower... It just keeps going up."),
  );
  scene.append(box2);
  const sceneCard = el("div", CARD);
  sceneCard.append(caption(scene, "mock dialogue: speaker lit, listener dimmed, portraits have no background"));
  root.append(sceneCard);

  // A crowd of random looks
  const crowd = el("div", "flex flex-wrap gap-3");
  for (const l of crowdLooks) crowd.append(canvas(portrait(l), 2), canvas(chibi(l, "front"), 3));
  const crowdCard = el("div", CARD);
  crowdCard.append(caption(crowd, "random looks"));
  root.append(crowdCard);
}

const SD_PICTURES = import.meta.glob<string>("../../client/art/sd/*.png",
  { eager: true, query: "?url", import: "default" });

function sdPicture(name: string, scale: number): HTMLImageElement {
  const img = el("img", "pixelated");
  img.src = SD_PICTURES[`../../client/art/sd/${name}.png`] ?? "";
  img.style.width = img.style.height = `${64 * scale}px`;
  return img;
}

function tracedSection(): HTMLElement {
  const sources = el("div", CARD);
  for (const [part, pictures] of Object.entries(TRACED_PICTURES) as [keyof typeof TRACED_PICTURES, object][]) {
    for (const [option, name] of Object.entries(pictures) as [string, string][]) {
      const pair = el("div", "flex gap-1");
      pair.append(sdPicture(name, 3), canvas(drawTraced(part, option, TRACED_COLORS), 3),
        canvas(drawTraced(part, option, colorsOf(look)), 3));
      sources.append(caption(pair, `${part} ${option}: Stable Diffusion, traced, in your colors`));
    }
  }
  const parts = el("div", "flex flex-col gap-2 overflow-x-auto rounded-lg border border-line bg-ink-850 p-5");
  for (const body of OPTIONS.body) {
    const row = el("div", "flex flex-wrap gap-1");
    const on = (change: Partial<Look>) => canvas(portrait({ ...look, body, ...change }), 2);
    for (const hair of OPTIONS.hair) row.append(on({ hair }));
    for (const eyes of OPTIONS.eyes) row.append(on({ eyes }));
    for (const mouth of OPTIONS.mouth) row.append(on({ mouth }));
    for (const face of OPTIONS.face) row.append(on({ face }));
    parts.append(caption(row, `${body}: every hair style, eye type, mouth and face shape`));
  }
  const section = el("div", "flex flex-col gap-3");
  section.append(el("h2", "m-0 text-body font-semibold", "Stable Diffusion against the traced parts"), sources, parts);
  return section;
}

let stableOther: Look | null = null;
function randomLookStable(): Look {
  stableOther ??= randomLook();
  return stableOther;
}
const crowdLooks = Array.from({ length: 8 }, randomLook);

