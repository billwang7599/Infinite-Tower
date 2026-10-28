import { Color3, type Mesh, type ParticleSystem, type StandardMaterial, type Vector3 } from "@babylonjs/core";
import {
  MAGIC, SpellObject, type Entity, type SpellElement, type SpellObjectData, type Vec3, type World,
} from "@infinite-tower/shared";
import { BodyNode } from "../components.js";
import { PlayerSprite } from "../player/components.js";
import type { Arcs } from "./arcs.js";
import type { Bursts } from "./bursts.js";
import { lookOf, particleKeysOf, SHADER_LOOKS, type LookKey } from "./looks.js";
import type { SpellParticles } from "./particles.js";
import type { SpellShaders } from "./shaders.js";

const CLOUD_ALPHA = 0.3;
const PULSE_TIME_S = 0.35;
// Where the sword sits on the battle sprite, from its body's centre, along the camera's right.
const SWORD_SIDE_M = 0.45;
const SWORD_UP_M = 0.25;

interface Drawn {
  o: SpellObjectData;
  elements: readonly SpellElement[];
  meshes: Mesh[];
  streams: ParticleSystem[];
  lastTickLeft: number;
  pulseS: number;
  floorY: number;
}

export interface ObjectDrawings {
  draw(world: World, dtS: number, cameraRight: Vector3): void;
  clear(world: World | null): void;
}

export function createObjectDrawings(
  shaders: SpellShaders, particles: SpellParticles, arcs: Arcs, bursts: Bursts,
  floorY: (at: Vec3) => number, plainSlash: StandardMaterial,
): ObjectDrawings {
  const drawn = new Map<Entity, Drawn>();
  const slashes = new Map<LookKey, StandardMaterial>();
  const slashFor = (look: LookKey) => {
    let m = slashes.get(look);
    if (!m) {
      m = plainSlash.clone(`slash-${look}`);
      m.emissiveColor = look === "darkness" ? new Color3(1, 0.3, 1.8) : SHADER_LOOKS[look].core.scale(1.2);
      slashes.set(look, m);
    }
    return m;
  };
  const swordOf = (world: World, caster: Entity, material: StandardMaterial) => {
    const sprite = world.get(caster, PlayerSprite);
    if (!sprite) return;
    sprite.slash.material = material;
    for (const mesh of sprite.thrust.getChildMeshes()) mesh.material = material;
  };

  const make = (o: SpellObjectData): Drawn => {
    const elements = o.spell.segments[o.segment]!.elements, look = lookOf(elements);
    const d: Drawn = {
      o, elements, meshes: [], streams: [], lastTickLeft: o.tickLeft, pulseS: 0, floorY: floorY(o.pos),
    };
    const stream = (perSec: number, radiusM: number) => {
      for (const key of particleKeysOf(elements)) d.streams.push(particles.stream(key, perSec, radiusM));
    };
    switch (o.kind) {
      case "bolt":
        if (elements.includes("earth")) d.meshes.push(shaders.rock());
        else d.meshes.push(shaders.take("sphere", "flow", look), shaders.take("sphere", "flow", look));
        stream(120 * o.reachM / MAGIC.bolt.radiusM, o.reachM / 2);
        break;
      case "beam":
        d.meshes.push(
          shaders.take("tube", "flow", look), shaders.take("tube", "flow", look),
          shaders.take("sphere", "flow", look), shaders.take("sphere", "flow", look),
        );
        stream(60, 0.2);
        break;
      case "cloud":
        d.meshes.push(shaders.take("sphere", "shell", look), shaders.take("disc", "circle", look));
        stream(25, o.reachM * 0.7);
        break;
      case "wait":
        d.meshes.push(shaders.take("sphere", "flow", look));
        stream(15, 0.1);
        break;
      case "imbue":
        d.meshes.push(shaders.take("sphere", "flow", look));
        stream(30, 0.1);
        break;
    }
    return d;
  };
  const drop = (world: World | null, e: Entity, d: Drawn) => {
    for (const mesh of d.meshes) shaders.give(mesh);
    for (const s of d.streams) particles.release(s);
    if (d.o.kind === "imbue" && world) swordOf(world, d.o.caster, plainSlash);
    drawn.delete(e);
  };

  return {
    draw(world, dtS, right) {
      const live = new Set<Entity>();
      for (const [e, o] of world.query(SpellObject)) {
        live.add(e);
        let d = drawn.get(e);
        if (!d) drawn.set(e, d = make(o));
        d.o = o;
        const [a, b] = d.meshes;
        let at: Vec3 = o.pos;
        if (o.kind === "bolt") {
          const rM = o.reachM;
          if (b) {
            a!.scaling.set(rM, rM, rM * 2.4);
            a!.rotation.y = Math.atan2(o.dir.x, o.dir.z);
            a!.position.set(o.pos.x - o.dir.x * rM, o.pos.y, o.pos.z - o.dir.z * rM);
            b.scaling.setAll(rM * 0.4);
            b.position.set(o.pos.x, o.pos.y, o.pos.z);
          } else {
            a!.rotation.addInPlaceFromFloats(dtS * 7, dtS * 5, 0);
            a!.position.set(o.pos.x, o.pos.y, o.pos.z);
          }
          if (has(d, "lightning") && Math.random() < 0.4) arcs.flash(o.pos, jitter(o.pos, 0.7), 0.06);
        } else if (o.kind === "beam") {
          const yaw = Math.atan2(o.dir.x, o.dir.z), rM = MAGIC.beam.radiusM;
          for (const [mesh, k] of [[a!, 1], [b!, 0.35]] as const) {
            mesh.position.set(o.pos.x, o.pos.y, o.pos.z);
            mesh.rotation.y = yaw;
            mesh.scaling.set(rM * k, rM * k, Math.max(0.01, o.reachM));
          }
          at = { x: o.pos.x + o.dir.x * o.reachM, y: o.pos.y, z: o.pos.z + o.dir.z * o.reachM };
          const [, , start, end] = d.meshes, flicker = 0.85 + 0.3 * Math.random();
          start!.position.set(o.pos.x, o.pos.y, o.pos.z);
          start!.scaling.setAll(rM * 1.2 * flicker);
          end!.position.set(at.x, at.y, at.z);
          end!.scaling.setAll(rM * 1.6 * flicker);
          if (has(d, "lightning") && Math.random() < 0.5) arcs.flash(o.pos, at, 0.05);
        } else if (o.kind === "cloud") {
          if (o.tickLeft > d.lastTickLeft + 1e-6) {
            d.pulseS = PULSE_TIME_S;
            if (has(d, "lightning")) arcs.flash({ ...o.pos, y: d.floorY + 0.3 }, jitter(o.pos, o.reachM), 0.12);
          }
          d.pulseS = Math.max(0, d.pulseS - dtS);
          const pulse = d.pulseS / PULSE_TIME_S;
          a!.position.set(o.pos.x, d.floorY, o.pos.z);
          a!.scaling.set(o.reachM, o.reachM * (0.4 + 0.1 * pulse), o.reachM);
          a!.visibility = CLOUD_ALPHA + 0.4 * pulse;
          b!.position.set(o.pos.x, d.floorY + 0.04, o.pos.z);
          b!.scaling.setAll(o.reachM);
          b!.visibility = 0.45 + 0.4 * pulse;
          at = { x: o.pos.x, y: d.floorY + 0.4, z: o.pos.z };
        } else if (o.kind === "wait") {
          a!.position.set(o.pos.x, o.pos.y, o.pos.z);
          a!.scaling.setAll(0.18 + 0.04 * Math.sin(performance.now() / 90));
        } else {
          const node = world.get(o.caster, BodyNode)?.node.position;
          if (node) {
            at = { x: node.x + right.x * SWORD_SIDE_M, y: node.y + SWORD_UP_M, z: node.z + right.z * SWORD_SIDE_M };
          }
          a!.position.set(at.x, at.y, at.z);
          a!.scaling.setAll(0.14 * (0.85 + 0.3 * Math.random()));
          swordOf(world, o.caster, slashFor(lookOf(d.elements)));
        }
        d.lastTickLeft = o.tickLeft;
        for (const s of d.streams) (s.emitter as Vector3).set(at.x, at.y, at.z);
      }
      for (const [e, d] of drawn) {
        if (live.has(e)) continue;
        if (d.o.kind === "bolt") bursts.impact(d.elements, d.o.pos);
        drop(world, e, d);
      }
    },
    clear(world) {
      for (const [e, d] of drawn) drop(world, e, d);
    },
  };
}

const has = (d: Drawn, element: SpellElement) => d.elements.includes(element);
const spread = (rM: number) => (Math.random() - 0.5) * 2 * rM;
const jitter = (at: Vec3, rM: number): Vec3 =>
  ({ x: at.x + spread(rM), y: at.y + spread(rM / 2), z: at.z + spread(rM) });
