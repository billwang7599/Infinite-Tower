import { Color3, MeshBuilder, StandardMaterial, Texture, Vector4, type DynamicTexture, type Mesh, type Scene } from "@babylonjs/core";
import { seededRandom } from "@infinite-tower/shared";
import { pixelCanvas, type Pen } from "./props.js";
import type { Awning, Ledge } from "./scenery.js";

const POST_TILES = 0.08;
const OVERHANG_TILES = 0.1;
const AWNING_THICK_TILES = 0.12;
const PLANK = { gap: "#2e1f15", tones: ["#6a4a30", "#5e4129", "#74533a"], light: "#8c6842" };

type Lit = (name: string, tex: DynamicTexture) => StandardMaterial;

export interface StallLooks {
  counter: readonly [StandardMaterial, StandardMaterial, null];
  hearth: readonly [StandardMaterial, StandardMaterial, null];
  awning(ledge: Ledge & { awning: Awning }, i: number): Mesh[];
}

export function stallLooks(scene: Scene, lit: Lit, stone: StandardMaterial): StallLooks {
  const canvas = (name: string, size: number, draw: (pen: Pen) => void) => {
    const tex = pixelCanvas(scene, name, size, size, draw, false);
    tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
    return tex;
  };
  const counterSide = lit("stall-counter-side", canvas("counter-side", 32, (pen) => planks(pen, true)));
  const counterTop = lit("stall-counter-top", canvas("counter-top", 32, (pen) => planks(pen, false)));
  const coalsTex = canvas("coals", 32, drawCoals);
  const coals = lit("stall-coals", coalsTex);
  coals.emissiveTexture = coalsTex;
  coals.disableLighting = true;
  const post = new StandardMaterial("stall-post", scene);
  post.diffuseColor = Color3.FromHexString("#3e2a1c");
  post.specularColor = Color3.Black();
  const awnings = new Map<string, StandardMaterial>();
  const awningMaterial = ([a, b]: readonly [string, string]) => {
    const key = `${a}${b}`;
    let m = awnings.get(key);
    if (!m) awnings.set(key, m = lit(`stall-awning-${key}`, canvas(`awning-${key}`, 16, (pen) => stripes(pen, a, b))));
    return m;
  };

  return {
    counter: [counterTop, counterSide, null],
    hearth: [coals, stone, null],
    awning({ rect, topY, awning }, i) {
      const along = rect.w >= rect.h, long = Math.max(rect.w, rect.h), short = Math.min(rect.w, rect.h);
      const width = long + OVERHANG_TILES * 2, depth = short + OVERHANG_TILES * 2;
      const cloth = MeshBuilder.CreateBox(`stall-awning-${i}`, {
        width, depth, height: AWNING_THICK_TILES, wrap: true,
        faceUV: [
          new Vector4(0, 0, width, 1), new Vector4(0, 0, width, 1), new Vector4(0, 0, depth, 1),
          new Vector4(0, 0, depth, 1), new Vector4(0, 0, width, depth), new Vector4(0, 0, width, depth),
        ],
      }, scene);
      const cx = rect.x + rect.w / 2, cz = rect.z + rect.h / 2;
      cloth.position.set(cx, awning.topY - AWNING_THICK_TILES / 2, cz);
      if (!along) cloth.rotation.y = Math.PI / 2;
      cloth.material = awningMaterial(awning.colors);
      const height = awning.topY - AWNING_THICK_TILES - topY, inset = POST_TILES;
      const posts = [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz], k) => {
        const p = MeshBuilder.CreateBox(`stall-post-${i}-${k}`, { width: POST_TILES, depth: POST_TILES, height }, scene);
        p.position.set(cx + sx! * (rect.w / 2 - inset), topY + height / 2, cz + sz! * (rect.h / 2 - inset));
        p.material = post;
        return p;
      });
      return [cloth, ...posts];
    },
  };
}

function planks(pen: Pen, upright: boolean): void {
  const rand = seededRandom(upright ? 11 : 12);
  for (let k = 0; k < 8; k++) {
    const tone = PLANK.tones[Math.floor(rand() * PLANK.tones.length)]!;
    if (upright) {
      pen.rect(k * 4, 0, 4, 32, tone);
      pen.rect(k * 4, 0, 1, 32, PLANK.gap);
      pen.rect(k * 4 + 2, 3 + rand() * 24, 1, 2, PLANK.light);
    } else {
      pen.rect(0, k * 4, 32, 4, tone);
      pen.rect(0, k * 4, 32, 1, PLANK.gap);
      pen.rect(3 + rand() * 24, k * 4 + 2, 3, 1, PLANK.light);
    }
  }
}

function stripes(pen: Pen, a: string, b: string): void {
  for (let x = 0; x < 16; x += 8) {
    pen.rect(x, 0, 4, 16, a);
    pen.rect(x + 4, 0, 4, 16, b);
  }
}

function drawCoals(pen: Pen): void {
  const rand = seededRandom(13);
  pen.rect(0, 0, 32, 32, "#2a1a14");
  for (let i = 0; i < 70; i++) {
    pen.rect(rand() * 30, rand() * 30, 2, 2, ["#5a2a1c", "#a8321f", "#e0482a", "#f7b23b"][Math.floor(rand() * 4)]!);
  }
  for (let i = 0; i < 12; i++) pen.rect(rand() * 31, rand() * 31, 1, 1, "#ffe08a");
}
