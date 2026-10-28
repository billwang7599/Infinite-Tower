import { Color3, MeshBuilder, StandardMaterial, type Mesh, type Scene } from "@babylonjs/core";
import {
  Body, MAGIC, SpellObject, type Entity, type SpellElement, type SpellObjectData, type System,
} from "@infinite-tower/shared";
import type { FightEvent } from "@infinite-tower/shared/fight";
import type { BattleContext } from "../context.js";

const ELEMENT_COLORS: Record<SpellElement | "none", string> = {
  fire: "#ff6a1a", water: "#3a8cff", earth: "#9a7a44", air: "#d8f4ff", lightning: "#f4ea4a", light: "#fffbe0",
  darkness: "#6a2a9a", none: "#c8c8d8",
};
const FLASH_TIME = 0.35;
const SELF_RADIUS = 1;
const MARK_DIAMETER_M = 0.25;
const IMBUE_HEIGHT_M = 1;

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
  const meshFor = (e: Entity, o: SpellObjectData): Mesh => {
    const name = `spell-${o.kind}-${e}`;
    switch (o.kind) {
      case "bolt": return MeshBuilder.CreateSphere(name, { diameter: MAGIC.bolt.radiusM * 2, segments: 8 }, ctx.scene);
      // 1 m long along z, stretched to the beam's length each frame.
      case "beam": {
        const mesh = MeshBuilder.CreateCylinder(name, { height: 1, diameter: MAGIC.beam.radiusM * 2 }, ctx.scene);
        mesh.rotation.x = Math.PI / 2;
        mesh.bakeCurrentTransformIntoVertices();
        return mesh;
      }
      case "cloud": {
        const mesh = MeshBuilder.CreateCylinder(name, { height: 0.6, diameter: o.reachM * 2 }, ctx.scene);
        mesh.visibility = 0.3;
        return mesh;
      }
      default: return MeshBuilder.CreateSphere(name, { diameter: MARK_DIAMETER_M, segments: 6 }, ctx.scene);
    }
  };
  const drawn = new Map<Entity, Mesh>();
  const flashes: Flash[] = [];

  return {
    clear() {
      for (const mesh of drawn.values()) mesh.dispose();
      for (const { mesh } of flashes) mesh.dispose();
      drawn.clear();
      flashes.length = 0;
    },
    addEvents(events) {
      for (const event of events) {
        if (event.type !== "spell") continue;
        const radius = event.radiusM ?? SELF_RADIUS;
        const mesh = MeshBuilder.CreateSphere("spell-flash", { diameter: radius * 2, segments: 12 }, ctx.scene);
        mesh.material = materialFor(ctx.scene, event.elements);
        mesh.position.set(event.at.x, event.at.y, event.at.z);
        mesh.isPickable = false;
        flashes.push({ mesh, left: FLASH_TIME });
      }
    },
    system(world, dt) {
      const live = new Set<Entity>();
      for (const [e, o] of world.query(SpellObject)) {
        live.add(e);
        let mesh = drawn.get(e);
        if (!mesh) {
          mesh = meshFor(e, o);
          mesh.material = materialFor(ctx.scene, o.spell.segments[o.segment]!.elements);
          mesh.isPickable = false;
          drawn.set(e, mesh);
        }
        if (o.kind === "imbue") {
          const at = world.require(o.caster, Body).pos;
          mesh.position.set(at.x, at.y + IMBUE_HEIGHT_M, at.z);
        } else if (o.kind === "beam") {
          mesh.position.set(o.pos.x + o.dir.x * o.reachM / 2, o.pos.y, o.pos.z + o.dir.z * o.reachM / 2);
          mesh.rotation.y = Math.atan2(o.dir.x, o.dir.z);
          mesh.scaling.z = Math.max(0.01, o.reachM);
        } else mesh.position.set(o.pos.x, o.pos.y, o.pos.z);
      }
      for (const [e, mesh] of drawn) {
        if (live.has(e)) continue;
        mesh.dispose();
        drawn.delete(e);
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
