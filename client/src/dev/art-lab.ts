/**
 * Dev-only page (/art.html on the Vite dev server, never built): every look option, both views, a piece of
 * gear tried on, and a mock dialogue scene. For judging the character art, not part of the game.
 */
import type { Picture, View } from "../gfx/look/art.js";
import { BODY_TYPES } from "../gfx/look/body.js";
import { EYE_TYPES, MOUTH_TYPES } from "../gfx/look/face.js";
import { FACE_SHAPES } from "../gfx/look/head.js";
import { HAIR_STYLES } from "../gfx/look/hair/index.js";
import { LEATHER_JERKIN } from "../gfx/look/jerkin.js";
import { drawLook, type Look } from "../gfx/look/look.js";
import { STARTER_CLOTHES } from "../gfx/look/outfit.js";
import { ACCENTS, DYES, EYES, HAIR, SKIN } from "../gfx/look/palette.js";

const OPTIONS: { [K in keyof Look]: readonly Look[K][] } = {
  body: Object.keys(BODY_TYPES) as Look["body"][],
  face: Object.keys(FACE_SHAPES) as Look["face"][],
  skin: Object.keys(SKIN) as Look["skin"][],
  hair: Object.keys(HAIR_STYLES) as Look["hair"][],
  hairColor: Object.keys(HAIR) as Look["hairColor"][],
  eyes: Object.keys(EYE_TYPES) as Look["eyes"][],
  eyeColor: Object.keys(EYES) as Look["eyeColor"][],
  mouth: Object.keys(MOUTH_TYPES) as Look["mouth"][],
  outfit: Object.keys(DYES) as Look["outfit"][],
  accent: Object.keys(ACCENTS) as Look["accent"][],
};
const LABELS: Record<keyof Look, string> = {
  body: "Body", face: "Face shape", skin: "Skin", hair: "Hair", hairColor: "Hair color", eyes: "Eyes",
  eyeColor: "Eye color", mouth: "Mouth", outfit: "Outfit color", accent: "Accent",
};

let look: Look = {
  body: "medium", face: "soft", skin: "light", hair: "short", hairColor: "black", eyes: "round", eyeColor: "blue",
  mouth: "smile", outfit: "soot", accent: "orange",
};
let jerkin = false;

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

const draw = (l: Look, view: View) =>
  drawLook(l, view, jerkin ? [...STARTER_CLOTHES, LEATHER_JERKIN] : STARTER_CLOTHES);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, style = "", text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.style.cssText = style;
  e.textContent = text;
  return e;
}

const root = el("div", "max-width:1100px;margin:0 auto;padding:24px;display:flex;flex-direction:column;gap:28px");
document.body.append(root);

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
  controls.append(random, gear);
  root.append(controls);

  // Both views, at a few sizes
  const views = el("div", "display:flex;gap:32px;align-items:end;flex-wrap:wrap");
  const caption = (node: HTMLElement, text: string) => {
    const box = el("div", "display:flex;flex-direction:column;align-items:center;gap:6px");
    box.append(node, el("span", "font-size:12px;color:#9a9cb0", text));
    return box;
  };
  views.append(
    caption(canvas(draw(look, "portrait"), 6), "portrait 64x64 at 6x"),
    caption(canvas(draw(look, "chibi"), 6), "chibi 32x32 at 6x"),
    caption(canvas(draw(look, "chibi"), 3), "chibi at 3x (about world size)"),
  );
  root.append(views);

  // Mock dialogue, FGO style: speaker lit, the other dimmed, no portrait backgrounds. Portraits face our left, so
  // the one on the left is flipped to face the other.
  const scene = el("div", "position:relative;width:1050px;height:420px;overflow:hidden;border-radius:6px;" +
    "background:radial-gradient(ellipse at 50% 35%, #2a2433, #0a090d 70%)");
  const other = randomLookStable();
  scene.append(
    canvas(draw(other, "portrait"), 4, "position:absolute;bottom:60px;right:140px;filter:brightness(0.45)"),
    canvas(draw(look, "portrait"), 4, "position:absolute;bottom:60px;left:140px;transform:scaleX(-1)"),
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
  for (const l of crowdLooks) crowd.append(canvas(draw(l, "portrait"), 2), canvas(draw(l, "chibi"), 3));
  root.append(caption(crowd, "random looks"));
}

let stableOther: Look | null = null;
function randomLookStable(): Look {
  stableOther ??= randomLook();
  return stableOther;
}
const crowdLooks = Array.from({ length: 8 }, randomLook);

render();
