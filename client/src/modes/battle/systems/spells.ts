import { Color3, MeshBuilder, StandardMaterial, type Mesh, type Scene } from "@babylonjs/core";
import { MAGIC, SpellShot, type Entity, type SpellElement, type System } from "@infinite-tower/shared";
import type { FightEvent } from "@infinite-tower/shared/fight";
import type { BattleContext } from "../context.js";

const ELEMENT_COLORS: Record<SpellElement | "none", string> = {
  fire: "#ff6a1a", water: "#3a8cff", earth: "#9a7a44", air: "#d8f4ff", lightning: "#f4ea4a", light: "#fffbe0",
  darkness: "#6a2a9a", none: "#c8c8d8",
};
const FLASH_TIME = 0.35;
const SELF_RADIUS = 1;

interface Flash { mesh: Mesh; left: number }

export interface SpellEffects {
  addEvents(events: readonly FightEvent[]): void;
  system: System;
  clear(): void;
}

export function createSpellEffects(ctx: BattleContext): SpellEffects {
  const materials = new Map<string, StandardMaterial>();
  const materialFor = (scene: Scene, elements: readonly SpellElement[]) => {
    const element = elements[0] ?? "none";
    let m = materials.get(element);
    if (!m) {
      m = new StandardMaterial(`spell-${element}`, scene);
      m.emissiveColor = Color3.FromHexString(ELEMENT_COLORS[element]);
      m.disableLighting = true;
      materials.set(element, m);
    }
    return m;
  };
  const bolts = new Map<Entity, Mesh>();
  const flashes: Flash[] = [];

  return {
    clear() {
      for (const mesh of bolts.values()) mesh.dispose();
      for (const { mesh } of flashes) mesh.dispose();
      bolts.clear();
      flashes.length = 0;
    },
    addEvents(events) {
      for (const event of events) {
        if (event.type !== "spell") continue;
        const radius = event.form === "nova" ? MAGIC.nova.radius : SELF_RADIUS;
        const mesh = MeshBuilder.CreateSphere("spell-flash", { diameter: radius * 2, segments: 12 }, ctx.scene);
        mesh.material = materialFor(ctx.scene, event.elements);
        mesh.position.set(event.at.x, event.at.y, event.at.z);
        mesh.isPickable = false;
        flashes.push({ mesh, left: FLASH_TIME });
      }
    },
    system(world, dt) {
      const live = new Set<Entity>();
      for (const [e, shot] of world.query(SpellShot)) {
        live.add(e);
        let mesh = bolts.get(e);
        if (!mesh) {
          mesh = MeshBuilder.CreateSphere(`bolt-${e}`, { diameter: MAGIC.bolt.radiusM * 2, segments: 8 }, ctx.scene);
          mesh.material = materialFor(ctx.scene, shot.spell.segments[shot.segment]!.elements);
          mesh.isPickable = false;
          bolts.set(e, mesh);
        }
        mesh.position.set(shot.pos.x, shot.pos.y, shot.pos.z);
      }
      for (const [e, mesh] of bolts) {
        if (live.has(e)) continue;
        mesh.dispose();
        bolts.delete(e);
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        const flash = flashes[i]!;
        flash.left -= dt;
        flash.mesh.visibility = Math.max(0, flash.left / FLASH_TIME) * 0.6;
        if (flash.left > 0) continue;
        flash.mesh.dispose();
        flashes.splice(i, 1);
      }
    },
  };
}
