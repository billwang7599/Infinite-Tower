import { DEFAULT_LOOK, LOOK_OPTIONS as OPTIONS } from "@infinite-tower/shared";
import type { Picture } from "@infinite-tower/client/src/gfx/look/art.js";
import { POSES, SWORD_POSES, type Pose, type SwordPose } from "@infinite-tower/client/src/gfx/look/battle.js";
import { LEATHER_JERKIN } from "@infinite-tower/client/src/gfx/look/jerkin.js";
import {
  BATTLE_FACINGS, CHIBI_FACINGS, drawBattle, drawChibi, drawPortrait, type BattleFacing, type ChibiFacing, type Look,
} from "@infinite-tower/client/src/gfx/look/look.js";
import { STARTER_CLOTHES } from "@infinite-tower/client/src/gfx/look/outfit.js";
import { caption, el } from "./dom.js";

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

function canvas(pic: Picture, scale: number, style = ""): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = pic.width;
  c.height = pic.height;
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(pic.rgba), pic.width, pic.height), 0, 0);
  c.style.cssText = `width:${pic.width * scale}px;height:${pic.height * scale}px;image-rendering:pixelated;${style}`;
  return c;
}

const wear = () => (jerkin ? [...STARTER_CLOTHES, LEATHER_JERKIN] : STARTER_CLOTHES);
const portrait = (l: Look) => drawPortrait(l, wear());
const chibi = (l: Look, facing: ChibiFacing) => drawChibi(l, facing, wear());
const battle = (pose: Pose | SwordPose, frame: number, facing: BattleFacing) =>
  drawBattle(look, pose, frame, facing, wear(), leftHanded ? "leftHand" : "rightHand");

export const currentLook = () => look;

let root: HTMLElement;

export function renderCharacters(into: HTMLElement): void {
  root = into;
  render();
}

function render(): void {
  root.replaceChildren();
  root.append(el("h1", "margin:0;font-size:20px", "Character art sample"));

  // Controls
  const controls = el("div", "display:flex;flex-wrap:wrap;gap:12px;align-items:end");
  for (const key of Object.keys(OPTIONS) as (keyof Look)[]) {
    const label = el("label", "display:flex;flex-direction:column;gap:4px;font-size:12px;color:#9a9cb0", LABELS[key]);
    const select = el("select", "background:#2a2c3a;color:#e6e6f0;border:1px solid #444;padding:4px 6px");
    for (const option of OPTIONS[key]) select.append(new Option(option, option, false, look[key] === option));
    select.onchange = () => { look = { ...look, [key]: select.value }; render(); };
    label.append(select);
    controls.append(label);
  }
  const random = el("button", "padding:6px 12px;background:#3a3d52;color:#fff;border:0;cursor:pointer", "Random");
  random.onclick = () => { look = randomLook(); render(); };
  const gear = el("label", "display:flex;gap:6px;align-items:center");
  const box = el("input");
  box.type = "checkbox";
  box.checked = jerkin;
  box.onchange = () => { jerkin = box.checked; render(); };
  gear.append(box, "Try on: leather jerkin");
  const hand = el("label", "display:flex;gap:6px;align-items:center");
  const handBox = el("input");
  handBox.type = "checkbox";
  handBox.checked = leftHanded;
  handBox.onchange = () => { leftHanded = handBox.checked; render(); };
  hand.append(handBox, "Sword in the left hand");
  controls.append(random, gear, hand);
  root.append(controls);

  // The portrait and the chibi facing front, at a few sizes
  const views = el("div", "display:flex;gap:32px;align-items:end;flex-wrap:wrap");
  views.append(
    caption(canvas(portrait(look), 6), "portrait 64x64 at 6x"),
    caption(canvas(chibi(look, "front"), 6), "chibi 32x32 at 6x"),
    caption(canvas(chibi(look, "front"), 3), "chibi at 3x (about world size)"),
  );
  root.append(views);

  // The chibi facing each way: front, back, side (walking right mirrors the side).
  const facings = el("div", "display:flex;gap:32px;align-items:end;flex-wrap:wrap");
  for (const facing of CHIBI_FACINGS) facings.append(caption(canvas(chibi(look, facing), 6), `chibi facing ${facing}`));
  facings.append(
    caption(canvas(chibi(look, "side"), 6, "transform:scaleX(-1)"), "chibi facing side, walking right"),
  );
  for (const facing of CHIBI_FACINGS) facings.append(caption(canvas(chibi(look, facing), 3), "3x"));
  root.append(facings);

  // The battle sprite in each pose, from behind and from the front, and at about arena size.
  const poses = el("div", "display:flex;gap:32px;align-items:end;flex-wrap:wrap");
  for (const pose of POSES) {
    const sides = el("div", "display:flex;gap:4px");
    for (const facing of BATTLE_FACINGS) sides.append(canvas(battle(pose, 0, facing), 4));
    poses.append(caption(sides, `battle: ${pose}, back and front, at 4x`));
  }
  for (const facing of BATTLE_FACINGS) poses.append(caption(canvas(battle("stand", 0, facing), 2), "at 2x"));
  root.append(poses);

  // The sword fight's poses: every frame in order, from behind over from the front, at 3x.
  const moves = el("div", "display:flex;gap:20px 28px;flex-wrap:wrap");
  for (const [pose, count] of Object.entries(SWORD_POSES) as [SwordPose, number][]) {
    const sides = el("div", "display:flex;flex-direction:column;gap:2px");
    for (const facing of BATTLE_FACINGS) {
      const frames = el("div", "display:flex;gap:2px");
      for (let frame = 0; frame < count; frame++) frames.append(canvas(battle(pose, frame, facing), 3));
      sides.append(frames);
    }
    moves.append(caption(sides, `${pose}: ${count} frames, back over front`));
  }
  root.append(caption(moves, "battle: the sword fight's poses, frame by frame"));

  // Mock dialogue, FGO style: speaker lit, the other dimmed, no portrait backgrounds. Portraits face our left, so
  // the one on the left is flipped to face the other.
  const scene = el("div", "position:relative;width:1050px;height:420px;overflow:hidden;border-radius:6px;" +
    "background:radial-gradient(ellipse at 50% 35%, #2a2433, #0a090d 70%)");
  const other = randomLookStable();
  scene.append(
    canvas(portrait(other), 4, "position:absolute;bottom:60px;right:140px;filter:brightness(0.45)"),
    canvas(portrait(look), 4, "position:absolute;bottom:60px;left:140px;transform:scaleX(-1)"),
  );
  const box2 = el("div", "position:absolute;left:24px;right:24px;bottom:16px;height:110px;" +
    "background:linear-gradient(#0d0c11e6,#050507f2);border:1px solid #c9a24a88;border-radius:4px;padding:28px 20px 0");
  box2.append(
    el("div", "position:absolute;top:-16px;left:12px;padding:4px 18px;background:#14121a;border:1px solid #c9a24a88",
      "You"),
    el("div", "font-size:17px;line-height:1.5", "So this is the tower... It just keeps going up."),
  );
  scene.append(box2);
  root.append(caption(scene, "mock dialogue: speaker lit, listener dimmed, portraits have no background"));

  // A crowd of random looks
  const crowd = el("div", "display:flex;flex-wrap:wrap;gap:12px");
  for (const l of crowdLooks) crowd.append(canvas(portrait(l), 2), canvas(chibi(l, "front"), 3));
  root.append(caption(crowd, "random looks"));
}

let stableOther: Look | null = null;
function randomLookStable(): Look {
  stableOther ??= randomLook();
  return stableOther;
}
const crowdLooks = Array.from({ length: 8 }, randomLook);

