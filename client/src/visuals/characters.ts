/** Frames for the 24x24 pixel sprites (sprites.ts): the player's from their look (gfx/look/), the rest drawn here. */
import type { Hand, Look } from "@infinite-tower/shared";
import { VIEWS, type Art, type Picture } from "../gfx/look/art.js";
import { SWORD_POSES, type Pose, type SwordPose } from "../gfx/look/battle.js";
import { CHIBI_FACINGS, drawBattle, drawChibi, type ChibiFacing } from "../gfx/look/look.js";
import { SWORD } from "../gfx/look/sword.js";
import { SPRITE_PX, type Px, type SpriteDraw } from "./sprites.js";

/** How many frames each of the arena's poses has. */
export const BATTLE_FRAMES: Record<Pose | SwordPose, number> = { stand: 1, slash: 1, down: 1, ...SWORD_POSES };

/** The side chibi faces right, like every side view. */
export interface PlayerSprites<Sprite> {
  chibi: Record<ChibiFacing, Sprite>;
  battle: Record<Pose | SwordPose, Sprite[]>;
}

export interface Held { hand: Hand; art: Art }

/** About a frame between slices, so the screen keeps moving while the arena's frames are painted. */
export const PAINT_GAP_MS = 16;

/** The chibi is painted at once; the arena's frames (~3 ms each) one per slice after, or the rest on `finish`. */
export class PlayerLook<Sprite> {
  private worn: string | null = null;
  private look: Look | null = null;
  private held: Held | null = { hand: "rightHand", art: SWORD };
  private unpainted: (() => void)[] = [];
  private nextSlice: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly sprites: PlayerSprites<Sprite>,
    private readonly redraw: (sprite: Sprite, draw: SpriteDraw) => void,
  ) {}

  wear(look: Look): void {
    const key = JSON.stringify(look);
    if (key === this.worn) return;
    this.worn = key;
    this.look = look;
    for (const facing of CHIBI_FACINGS) {
      const pic = drawChibi(look, facing);
      this.redraw(this.sprites.chibi[facing], (px) => paint(px, pic, SPRITE_PX / VIEWS.chibi.width, facing === "side"));
    }
    this.paintBattle(look);
  }

  hold(held: Held | null): void {
    if (held?.hand === this.held?.hand && held?.art === this.held?.art) return;
    this.held = held;
    if (this.look) this.paintBattle(this.look);
  }

  finish(): void {
    clearTimeout(this.nextSlice);
    for (const paintFrame of this.unpainted.splice(0)) paintFrame();
  }

  private paintBattle(look: Look): void {
    const held = this.held;
    this.unpainted = (Object.keys(BATTLE_FRAMES) as (Pose | SwordPose)[]).flatMap((pose) =>
      this.sprites.battle[pose].map((sprite, frame) => () => {
        const pic = drawBattle(look, pose, frame, undefined, held?.hand ?? null, held?.art);
        this.redraw(sprite, (px) => paint(px, pic, SPRITE_PX / VIEWS.battle.width));
      }),
    );
    this.paintLater();
  }

  private paintLater(): void {
    clearTimeout(this.nextSlice);
    if (this.unpainted.length === 0) return;
    this.nextSlice = setTimeout(() => {
      this.unpainted.shift()?.();
      this.paintLater();
    }, PAINT_GAP_MS);
  }
}

/** `pic`, each of its pixels `scale` sprite pixels square; `mirrored` flips it left to right. */
function paint(px: Px, pic: Picture, scale: number, mirrored = false): void {
  for (let y = 0; y < pic.height; y++) {
    for (let x = 0; x < pic.width; x++) {
      const i = (y * pic.width + x) * 4;
      if (!pic.rgba[i + 3]) continue;
      const color = `#${[0, 1, 2].map((c) => pic.rgba[i + c]!.toString(16).padStart(2, "0")).join("")}`;
      px((mirrored ? pic.width - 1 - x : x) * scale, y * scale, scale, scale, color);
    }
  }
}

/** Wild boar, side view (overworld). */
export const drawBoar: SpriteDraw = (px) => {
  const hide = "#6b4632", hideHi = "#835a40", dark = "#3a281d", snout = "#b77a6a", tusk = "#efe6cf";
  px(3, 10, 1, 3, dark);               // tail
  px(4, 9, 13, 9, hide);               // body
  px(5, 10, 11, 3, hideHi);
  px(5, 8, 11, 2, dark);               // bristly mane
  px(7, 7, 2, 1, dark); px(11, 7, 2, 1, dark);
  px(16, 10, 5, 7, hide);              // head
  px(16, 8, 2, 3, dark);               // ear
  px(19, 11, 1, 1, "#140c08");         // eye
  px(21, 13, 2, 3, snout);             // snout
  px(22, 14, 1, 1, "#5a2e26");         // nostril
  px(20, 16, 1, 1, tusk); px(21, 15, 1, 1, tusk);
  px(5, 18, 2, 3, dark); px(8, 18, 2, 3, dark);     // legs
  px(13, 18, 2, 3, dark); px(16, 17, 2, 4, dark);
};

/** Kobold swordsman, side view (overworld): a dog-headed little fighter, its sword held up in front. */
export const drawKobold: SpriteDraw = (px) => {
  const fur = "#8a6a4a", furHi = "#a5825e", dark = "#4a3626", cloth = "#6e2f2a", steel = "#d6dde3";
  px(19, 2, 1, 12, steel);             // blade, held up
  px(17, 13, 5, 1, "#b8913a");         // guard
  px(18, 14, 2, 2, dark);              // grip + fist
  px(9, 4, 2, 3, dark);                // ear
  px(8, 6, 7, 6, fur);                 // head
  px(9, 7, 4, 2, furHi);
  px(14, 8, 4, 3, fur);                // snout
  px(17, 8, 1, 1, "#140c08");          // nose
  px(12, 7, 1, 1, "#f2c84a");          // eye
  px(8, 12, 8, 7, cloth);              // tunic
  px(8, 17, 8, 1, dark);               // belt
  px(14, 13, 4, 2, fur);               // sword arm
  px(5, 15, 3, 1, fur); px(4, 14, 1, 1, fur);  // tail
  px(9, 19, 2, 4, dark); px(13, 19, 2, 4, dark); // legs
};

export const drawGoblin: SpriteDraw = (px) => {
  const skin = "#5f8a3a", skinHi = "#7aa64a", robe = "#3b2a52", robeHi = "#4d3a68", wood = "#5a3c22";
  px(18, 3, 3, 3, "#ff8a3a");          // orb
  px(19, 4, 1, 1, "#ffd08a");
  px(19, 6, 1, 15, wood);              // staff
  px(9, 4, 7, 4, robe);                // hood
  px(8, 7, 2, 1, robe);
  px(10, 8, 6, 5, skin);               // face
  px(11, 9, 3, 1, skinHi);
  px(16, 10, 2, 1, skin);              // nose
  px(6, 9, 4, 1, skin); px(5, 8, 1, 1, skin);  // ear
  px(14, 9, 1, 1, "#ffb03a");          // eye
  px(9, 13, 8, 8, robe);               // robe
  px(10, 14, 3, 6, robeHi);
  px(8, 20, 10, 1, "#8a6a2a");         // hem
  px(16, 14, 3, 2, robe);              // staff arm
  px(18, 14, 2, 2, skin);              // fist
  px(10, 21, 2, 2, skin); px(14, 21, 2, 2, skin); // feet
};

/** "!" speech bubble shown when a boar notices you. */
export const drawAlert: SpriteDraw = (px) => {
  px(6, 2, 12, 16, "#1b1b2a");
  px(7, 3, 10, 14, "#ffffff");
  px(10, 5, 4, 7, "#d23a2c");
  px(10, 13, 4, 2, "#d23a2c");
  px(10, 18, 4, 2, "#1b1b2a");         // bubble tail
  px(11, 17, 2, 2, "#ffffff");
};
