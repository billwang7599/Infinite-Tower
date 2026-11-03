import { Color3, Mesh, MeshBuilder, StandardMaterial, TransformNode, type Scene } from "@babylonjs/core";
import {
  Body, Health, Player, SCREEN_DIR, Wielder, type SwingData, type SwingDir, type World,
} from "@infinite-tower/shared";
import { LocalPlayer } from "../../modes/components.js";
import type { ArenaScene } from "./scene.js";

const WEDGES = 8;
// Wedge 6 would be a swing from below: there is no upward swing.
const SHOWN_WEDGES = [0, 1, 2, 3, 4, 5, 7];
const RADIUS_M = 0.8;
const WEDGE_LENGTH_M = 0.32;
const WEDGE_THICK_M = 0.08;
const STAB_SIZE_M = 0.08;
const HEIGHT_M = 1.05;

export function wedgeOf(way: SwingDir): number {
  const going = SCREEN_DIR[way];
  return (Math.round(Math.atan2(-going.y, -going.x) / (2 * Math.PI / WEDGES)) + WEDGES) % WEDGES;
}

export interface RingLights { lit: number; stab: boolean }

export function ringLights(way: SwingDir, swing: SwingData | null): RingLights {
  return { lit: wedgeOf(way), stab: swing !== null && swing.way === "stab" && swing.step < swing.liveAt };
}

function glow(scene: Scene, name: string, color: Color3, alpha: number): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.disableLighting = true;
  m.emissiveColor = color;
  m.alpha = alpha;
  m.backFaceCulling = false;
  return m;
}

export function aimRing(ctx: ArenaScene): { frame(world: World): void } {
  const { scene } = ctx;
  const root = new TransformNode("aim-ring", scene);
  root.billboardMode = TransformNode.BILLBOARDMODE_ALL;
  const dim = glow(scene, "aim-dim", new Color3(1, 1, 1), 0.18);
  const gold = glow(scene, "aim-gold", new Color3(1.3, 0.95, 0.35), 0.95);
  const wedges = new Map(SHOWN_WEDGES.map((i) => {
    const mesh = MeshBuilder.CreatePlane(`aim-wedge-${i}`, { width: WEDGE_LENGTH_M, height: WEDGE_THICK_M }, scene);
    const a = (i * 2 * Math.PI) / WEDGES;
    mesh.parent = root;
    mesh.position.set(Math.cos(a) * RADIUS_M, Math.sin(a) * RADIUS_M, 0);
    mesh.rotation.z = a + Math.PI / 2;
    mesh.material = dim;
    mesh.isPickable = false;
    mesh.renderingGroupId = 1;
    return [i, mesh] as const;
  }));
  const stab = MeshBuilder.CreateDisc(
    "aim-stab", { radius: STAB_SIZE_M, tessellation: 4, sideOrientation: Mesh.DOUBLESIDE }, scene,
  );
  stab.parent = root;
  stab.material = gold;
  stab.isPickable = false;
  stab.renderingGroupId = 1;
  root.setEnabled(false);

  return {
    frame(world) {
      const me = world.first(LocalPlayer, Player, Wielder, Body, Health), node = me && ctx.nodes.get(me[0]);
      const shown = me && node && me[2].way !== null && me[5].hp > 0 && ctx.battle.outcome.state === "fighting";
      root.setEnabled(Boolean(shown));
      if (!me || !node || !shown) return;
      root.position.set(node.position.x, node.position.y - me[4].centerHeight + HEIGHT_M, node.position.z);
      const lights = ringLights(ctx.battle.way, me[3].swing);
      for (const [i, mesh] of wedges) mesh.material = i === lights.lit ? gold : dim;
      stab.setEnabled(lights.stab);
    },
  };
}
