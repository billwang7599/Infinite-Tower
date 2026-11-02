import { DEFAULT_LOOK, LOOK_OPTIONS, type Look } from "@infinite-tower/shared";
import { render, VIEWS } from "@infinite-tower/client/src/gfx/look/art.js";
import { STARTER_CLOTHES } from "@infinite-tower/client/src/gfx/look/outfit.js";
import { checkbox, el, select } from "../dom.js";
import { blank, type Bitmap } from "./bitmap.js";
import { NO_UNDERLAY, type Underlay } from "./layers.js";
import { SHOT_SETS } from "./lookParts.js";
import type { Editor } from "./state.js";

const BODY_TINTS: Record<Look["body"], readonly [number, number, number]> = {
  skinny: [90, 170, 255], medium: [255, 210, 80], wide: [255, 100, 110],
};

const oneOf = <T>(list: readonly T[], value: unknown): value is T => list.includes(value as T);

export function underlayFrom(raw: unknown): Underlay | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const u = { ...NO_UNDERLAY, ...raw } as Underlay;
  const valid = SHOT_SETS.some((s) => s.name === u.shots) && oneOf([...LOOK_OPTIONS.body, "all"], u.body) &&
    oneOf(LOOK_OPTIONS.face, u.face) && oneOf(LOOK_OPTIONS.skin, u.skin) && (u.hair === null || oneOf(LOOK_OPTIONS.hair, u.hair));
  if (!valid) return undefined;
  const opacity = typeof u.opacity === "number" ? Math.max(0, Math.min(1, u.opacity)) : NO_UNDERLAY.opacity;
  return {
    shots: u.shots, body: u.body, face: u.face, skin: u.skin, hair: u.hair, dressed: u.dressed === true, opacity,
    shown: u.shown !== false,
  };
}

export function underlayPicture(u: Underlay, page: number, width: number, height: number): Bitmap | null {
  const set = SHOT_SETS.find((s) => s.name === u.shots);
  if (!set) return null;
  const shot = set.pages[Math.min(page, set.pages.length - 1)]!;
  const parts = ["base", ...(u.hair ? ["hair"] : []), ...(u.dressed ? [...Object.keys(STARTER_CLOTHES), "weapon"] : [])];
  const draw = (body: Look["body"]) => {
    const sketch = shot.sketch({ ...DEFAULT_LOOK, body, face: u.face, skin: u.skin, hair: u.hair ?? DEFAULT_LOOK.hair },
      STARTER_CLOTHES);
    return render(sketch, parts);
  };
  if (u.body !== "all") {
    const pic = draw(u.body);
    return pic.width === width && pic.height === height ? pic : null;
  }
  const pics = LOOK_OPTIONS.body.map((body) => [draw(body), BODY_TINTS[body]] as const);
  if (pics[0]![0].width !== width || pics[0]![0].height !== height) return null;
  const out = blank(width, height);
  for (let i = 0; i < out.rgba.length; i += 4) {
    const on = pics.filter(([pic]) => pic.rgba[i + 3]);
    if (on.length === 0) continue;
    for (let c = 0; c < 3; c++) {
      out.rgba[i + c] = on.reduce((sum, [pic, tint]) => {
        const light = (0.3 * pic.rgba[i]! + 0.59 * pic.rgba[i + 1]! + 0.11 * pic.rgba[i + 2]!) / 255;
        return sum + tint[c]! * (0.35 + 0.65 * light);
      }, 0) / on.length;
    }
    out.rgba[i + 3] = 255;
  }
  return out;
}

export function underlayPanel(ed: Editor): HTMLElement {
  const box = el("div", "flex flex-col gap-1.5");
  const row = () => el("div", "flex flex-wrap items-center gap-1.5 text-fg-muted");
  const u = ed.project.underlay ?? NO_UNDERLAY;
  const set = (change: Partial<Underlay>) => {
    ed.project.underlay = { ...u, ...change };
    ed.changed();
  };
  const fits = SHOT_SETS.filter((s) => {
    const { width, height } = VIEWS[s.pages[0]!.sketch(DEFAULT_LOOK, STARTER_CLOTHES).view];
    return width === ed.doc.width && height === ed.doc.height;
  });
  const pick = row();
  pick.append(select([["", "none"], ...fits.map((s) => [s.name, s.name] as const)], u.shots, (shots) => set({ shots })));
  box.append(pick);
  if (!u.shots) return box;
  const opacity = el("input", "range w-24 flex-none");
  opacity.type = "range";
  opacity.min = "0";
  opacity.max = "100";
  opacity.value = String(Math.round(u.opacity * 100));
  opacity.title = "Opacity";
  opacity.oninput = () => {
    ed.project.underlay = { ...u, opacity: Number(opacity.value) / 100 };
    ed.changed(false);
  };
  pick.append(checkbox("show (H)", u.shown, (shown) => set({ shown })), opacity);
  const look = row();
  look.append(
    select([...LOOK_OPTIONS.body.map((b) => [b, b] as const), ["all", "every body, tinted"]], u.body, (body) => set({ body })),
    select(LOOK_OPTIONS.face.map((f) => [f, `${f} face`] as const), u.face, (face) => set({ face })),
    select(LOOK_OPTIONS.skin.map((s) => [s, `${s} skin`] as const), u.skin, (skin) => set({ skin })),
    select([["", "no hair"], ...LOOK_OPTIONS.hair.map((h) => [h, `${h} hair`] as const)], u.hair ?? "",
      (hair) => set({ hair: hair || null })),
    checkbox("dressed", u.dressed, (dressed) => set({ dressed })),
  );
  box.append(look, el("span", "text-label text-fg-faint",
    "Under the canvas to draw on: not a layer, never exported. Saved with the drawing."));
  return box;
}
