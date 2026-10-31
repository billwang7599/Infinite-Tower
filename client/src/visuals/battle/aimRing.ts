import { Color3, Mesh, MeshBuilder, StandardMaterial, TransformNode, type Scene } from "@babylonjs/core";
import {
  Body, isSwing, LocalPlayer, mirrorWay, Player, SCREEN_DIR, Wielder, type Entity, type SwingData, type SwingDir,
  type World,
} from "@infinite-tower/shared";

const WEDGES = 8;
const MINE_RADIUS_M = 0.8;
const FOE_RADIUS_M = 1.02;
const WEDGE_LENGTH_M = 0.32;
const WEDGE_THICK_M = 0.08;
const STAB_DOT_M = 0.1;
const HEIGHT_M = 1.05;

/** Where a swing comes from as whoever named it sees it: 0 the right, then anticlockwise. */
export function wedgeOf(way: SwingDir): number {
  const going = SCREEN_DIR[way];
  return (Math.round(Math.atan2(-going.y, -going.x) / (2 * Math.PI / WEDGES)) + WEDGES) % WEDGES;
}

export interface RingLights { mine: number | null; foe: number | null; stab: boolean }

export function ringLights(mine: SwingDir | null, foe: SwingData | null): RingLights {
  const coming = foe?.way && foe.step < foe.liveUntil ? mirrorWay(foe.way) : null;
  return {
    mine: mine && wedgeOf(mine), foe: coming && isSwing(coming) ? wedgeOf(coming) : null, stab: coming === "stab",
  };
}

function glow(scene: Scene, name: string, color: Color3, alpha: number): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.disableLighting = true;
  m.emissiveColor = color;
  m.alpha = alpha;
  m.backFaceCulling = false;
  return m;
}

export function aimRing(scene: Scene): { frame(world: World, lock: Entity | null, shown: boolean): void } {
  const root = new TransformNode("aim-ring", scene);
  root.billboardMode = TransformNode.BILLBOARDMODE_ALL;
  const dim = glow(scene, "aim-dim", new Color3(1, 1, 1), 0.16);
  const gold = glow(scene, "aim-gold", new Color3(1.3, 0.95, 0.35), 0.95);
  const red = glow(scene, "aim-red", new Color3(1.4, 0.2, 0.15), 0.95);
  const ring = (radius: number) => Array.from({ length: WEDGES }, (_, i) => {
    const mesh = MeshBuilder.CreatePlane(`aim-${radius}-${i}`, { width: WEDGE_LENGTH_M, height: WEDGE_THICK_M }, scene);
    const a = (i * 2 * Math.PI) / WEDGES;
    mesh.parent = root;
    mesh.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
    mesh.rotation.z = a + Math.PI / 2;
    mesh.material = dim;
    mesh.isPickable = false;
    mesh.renderingGroupId = 1;
    return mesh;
  });
  const mine = ring(MINE_RADIUS_M), foe = ring(FOE_RADIUS_M);
  const dot = MeshBuilder.CreateDisc("aim-stab", { radius: STAB_DOT_M, sideOrientation: Mesh.DOUBLESIDE }, scene);
  dot.parent = root;
  dot.material = red;
  dot.isPickable = false;
  dot.renderingGroupId = 1;
  root.setEnabled(false);

  return {
    frame(world, lock, shown) {
      const body = lock === null ? undefined : world.get(lock, Body);
      root.setEnabled(shown && body !== undefined);
      if (!shown || !body || lock === null) return;
      root.position.set(body.pos.x, body.pos.y - body.centerHeight + HEIGHT_M, body.pos.z);
      const me = world.first(LocalPlayer, Player);
      const lights = ringLights(me?.[2].way ?? null, world.get(lock, Wielder)?.swing ?? null);
      mine.forEach((mesh, i) => { mesh.material = i === lights.mine ? gold : dim; });
      foe.forEach((mesh, i) => { mesh.material = i === lights.foe ? red : dim; });
      dot.setEnabled(lights.stab);
    },
  };
}
