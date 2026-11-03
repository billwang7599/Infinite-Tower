/** Frames for the 24x24 pixel sprites (sprites.ts): the player's from their look (gfx/look/), and the alert. */
import type { Hand, Look } from "@infinite-tower/shared";
import { VIEWS, type BattleFacing, type Picture } from "../gfx/look/art.js";
import { SWORD_POSES, type Pose, type SwordPose } from "../gfx/look/battle.js";
import { battleBody, CHIBI_FACINGS, drawBattle, drawChibi, type ChibiFacing } from "../gfx/look/look.js";
import type { Point } from "../gfx/look/pixels.js";
import { SPRITE_PX } from "../gfx/grid.js";
import type { Px, SpriteDraw } from "./sprites.js";

/** How many frames each of the arena's poses has. */
export const BATTLE_FRAMES: Record<Pose | SwordPose, number> = { stand: 1, slash: 1, down: 1, ...SWORD_POSES };

/** The side chibi faces right, like every side view. */
export interface PlayerSprites<Sprite> {
  chibi?: Record<ChibiFacing, Sprite>;
  battle: Record<BattleFacing, Record<Pose | SwordPose, Sprite[]>>;
}

/** About a frame between slices, so the screen keeps moving while the arena's frames are painted. */
export const PAINT_GAP_MS = 16;

/** Front frames are painted only when first shown: only other players ever see them. */
export class PlayerLook<Sprite> {
  private worn: string | null = null;
  private look: Look | null = null;
  private hand: Hand | null = "rightHand";
  private unpainted: (() => void)[] = [];
  private nextSlice: ReturnType<typeof setTimeout> | undefined;
  private paintedFront = new Set<Sprite>();

  constructor(
    private readonly sprites: PlayerSprites<Sprite>,
    private readonly redraw: (sprite: Sprite, draw: SpriteDraw) => void,
  ) {}

  wear(look: Look): void {
    const key = JSON.stringify(look);
    if (key === this.worn) return;
    this.worn = key;
    this.look = look;
    const chibi = this.sprites.chibi;
    if (chibi) for (const facing of CHIBI_FACINGS) this.redraw(chibi[facing], chibiDraw(look, facing));
    this.paintBattle(look);
  }

  hold(hand: Hand | null): void {
    if (hand === this.hand) return;
    this.hand = hand;
    if (this.look) this.paintBattle(this.look);
  }

  handAt(facing: BattleFacing, pose: Pose | SwordPose, frame: number): Point | null {
    return this.look && this.hand ? battleBody(this.look, pose, frame, facing, this.hand).sword[0] : null;
  }

  finish(): void {
    clearTimeout(this.nextSlice);
    for (const paintFrame of this.unpainted.splice(0)) paintFrame();
  }

  battleSprite(facing: BattleFacing, pose: Pose | SwordPose, frame: number): Sprite {
    const sprite = this.sprites.battle[facing][pose][frame]!;
    if (facing !== "back" && this.look && !this.paintedFront.has(sprite)) {
      this.paintedFront.add(sprite);
      this.paintFrame(this.look, this.hand, facing, pose, frame, sprite);
    }
    return sprite;
  }

  private paintBattle(look: Look): void {
    const hand = this.hand;
    this.paintedFront.clear();
    this.unpainted = (Object.keys(BATTLE_FRAMES) as (Pose | SwordPose)[]).flatMap((pose) =>
      this.sprites.battle.back[pose].map((sprite, frame) => () =>
        this.paintFrame(look, hand, "back", pose, frame, sprite)),
    );
    this.paintLater();
  }

  private paintFrame(
    look: Look, hand: Hand | null, facing: BattleFacing, pose: Pose | SwordPose, frame: number, sprite: Sprite,
  ): void {
    const pic = drawBattle(look, pose, frame, facing, undefined, hand, null);
    this.redraw(sprite, (px) => paint(px, pic, SPRITE_PX / VIEWS.battle.width));
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

export function chibiDraw(look: Look, facing: ChibiFacing): SpriteDraw {
  const pic = drawChibi(look, facing);
  return (px) => paint(px, pic, SPRITE_PX / VIEWS.chibi.width, facing === "side");
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

/** "!" speech bubble shown when an enemy notices you. */
export const drawAlert: SpriteDraw = (px) => {
  px(6, 2, 12, 16, "#1b1b2a");
  px(7, 3, 10, 14, "#ffffff");
  px(10, 5, 4, 7, "#d23a2c");
  px(10, 13, 4, 2, "#d23a2c");
  px(10, 18, 4, 2, "#1b1b2a");         // bubble tail
  px(11, 17, 2, 2, "#ffffff");
};

export const drawCrossedSwords: SpriteDraw = (px) => {
  const steel = "#e8e8f0", gold = "#d9a441", grip = "#6b4226";
  const dots: [number, number, number, string][] = [];
  for (let i = 0; i <= 10; i++) dots.push([3 + i, 2 + i, 2, steel], [19 - i, 2 + i, 2, steel]);
  for (let i = -2; i <= 2; i++) dots.push([14 - i, 13 + i, 2, gold], [9 + i, 13 + i, 2, gold]);
  dots.push([15, 15, 2, grip], [16, 16, 2, grip], [7, 15, 2, grip], [6, 16, 2, grip]);
  dots.push([17, 17, 3, gold], [4, 17, 3, gold]);
  for (const [x, y, size] of dots) px(x - 1, y - 1, size + 2, size + 2, "#1b1b2a");
  for (const [x, y, size, color] of dots) px(x, y, size, size, color);
};
