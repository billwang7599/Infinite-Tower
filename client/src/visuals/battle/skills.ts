import {
  Color3, Vector3, type Mesh, type ParticleSystem, type Scene, type StandardMaterial, type TransformNode,
} from "@babylonjs/core";
import {
  releaseTime, SKILL_EFFECTS, SkillObject, type BodyData, type Reaction, type SkillElement, type SkilledData,
  type SkillObjectData, type Vec3,
} from "@infinite-tower/shared";
import type { Visual } from "../visuals.js";
import type { ArenaScene } from "./scene.js";
import {
  createArcs, createSkillParticles, createSkillShaders, lookOf, particleKeysOf, SHADER_LOOKS, type Arcs,
  type LookKey, type ShaderMode, type SkillParticles, type SkillShaders,
} from "./skillLooks.js";

const CHANT_RADIUS_M = 1.3;
const CLOUD_ALPHA = 0.3;
const PULSE_TIME_S = 0.35;
// Where the sword sits on the battle sprite, from its body's centre, along the camera's right.
const SWORD_SIDE_M = 0.45;
const SWORD_UP_M = 0.25;
const SHARD_COUNT = 7;
const SPARK_COUNT = 24;

export interface SkillKit {
  shaders: SkillShaders;
  particles: SkillParticles;
  arcs: Arcs;
  bursts: Bursts;
  floorY(at: Vec3): number;
  slashFor(look: LookKey | null): StandardMaterial;
  tick(dtS: number): void;
  clear(): void;
}

export function createSkillKit(
  scene: Scene, floorY: (at: Vec3) => number, plainSlash: StandardMaterial,
): SkillKit {
  const shaders = createSkillShaders(scene);
  const particles = createSkillParticles(scene);
  const arcs = createArcs(scene);
  const bursts = createBursts(shaders, particles, arcs, floorY);
  const slashes = new Map<LookKey, StandardMaterial>();
  return {
    shaders, particles, arcs, bursts, floorY,
    slashFor(look) {
      if (look === null) return plainSlash;
      let m = slashes.get(look);
      if (!m) {
        m = plainSlash.clone(`slash-${look}`);
        m.emissiveColor = look === "darkness" ? new Color3(1, 0.3, 1.8) : SHADER_LOOKS[look].core.scale(1.2);
        slashes.set(look, m);
      }
      return m;
    },
    tick(dtS) {
      shaders.tick(dtS);
      particles.tick(dtS);
      arcs.tick(dtS);
      bursts.tick(dtS);
    },
    clear() {
      bursts.clear();
      arcs.clear();
      particles.clear();
    },
  };
}

export interface ChantCircle { look: LookKey; disc: Mesh; motes: ParticleSystem }

export function drawChantCircle(
  kit: SkillKit, c: ChantCircle | null, skilled: SkilledData, body: BodyData, node: TransformNode,
): ChantCircle | null {
  const skill = skilled.casting;
  if (!skilled.chanting && !skill) return dropChantCircle(kit, c);
  const look = skill ? lookOf(skill.segments[0]!.elements) : "none";
  if (c && c.look !== look) c = dropChantCircle(kit, c);
  if (!c) {
    const key = skill ? particleKeysOf(skill.segments[0]!.elements)[0]! : "none";
    const motes = kit.particles.stream(key, 20, CHANT_RADIUS_M * 0.8);
    c = { look, disc: kit.shaders.take("disc", "circle", look), motes };
  }
  const feetY = node.position.y - body.centerHeight + 0.04;
  const progress = skill ? Math.min(1, skilled.castTime / releaseTime(skill)) : 1;
  c.disc.position.set(node.position.x, feetY, node.position.z);
  c.disc.scaling.setAll(skill ? 0.7 + 0.3 * progress : CHANT_RADIUS_M);
  c.disc.visibility = skill ? 0.3 + 0.7 * progress : 0.85;
  (c.motes.emitter as Vector3).set(node.position.x, feetY + 0.2, node.position.z);
  return c;
}

export function dropChantCircle(kit: SkillKit, c: ChantCircle | null): null {
  if (c) {
    kit.shaders.give(c.disc);
    kit.particles.release(c.motes);
  }
  return null;
}

interface Drawn {
  ctx: ArenaScene;
  o: SkillObjectData;
  elements: readonly SkillElement[];
  meshes: Mesh[];
  streams: ParticleSystem[];
  lastTickLeft: number;
  pulseS: number;
  floorY: number;
}

function skillObject(
  build: (kit: SkillKit, look: LookKey, o: SkillObjectData) => { meshes: Mesh[]; perSec: number; radiusM: number },
  place: (d: Drawn, dtS: number) => Vec3,
  gone?: (d: Drawn) => void,
): Visual<Drawn> {
  return {
    spawn(ctx, world, e) {
      const o = world.require(e, SkillObject), elements = o.skill.segments[o.segment]!.elements;
      const { meshes, perSec, radiusM } = build(ctx.skills, lookOf(elements), o);
      const streams = particleKeysOf(elements).map((key) => ctx.skills.particles.stream(key, perSec, radiusM));
      const floorY = ctx.skills.floorY(o.pos);
      return { ctx, o, elements, meshes, streams, lastTickLeft: o.tickLeft, pulseS: 0, floorY };
    },
    frame(d, world, e, dtS) {
      d.o = world.require(e, SkillObject);
      const at = place(d, dtS);
      d.lastTickLeft = d.o.tickLeft;
      for (const s of d.streams) (s.emitter as Vector3).set(at.x, at.y, at.z);
    },
    dispose(d) {
      gone?.(d);
      for (const mesh of d.meshes) d.ctx.skills.shaders.give(mesh);
      for (const s of d.streams) d.ctx.skills.particles.release(s);
    },
  };
}

export const boltVisual = skillObject(
  ({ shaders }, look, o) => ({
    meshes: o.skill.segments[o.segment]!.elements.includes("earth") ? [shaders.rock()]
      : [shaders.take("sphere", "flow", look), shaders.take("sphere", "flow", look)],
    perSec: 120 * o.reachM / SKILL_EFFECTS.bolt.radiusM,
    radiusM: o.reachM / 2,
  }),
  (d, dtS) => {
    const { o } = d, [a, b] = d.meshes, rM = o.reachM;
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
    if (has(d, "lightning") && Math.random() < 0.4) d.ctx.skills.arcs.flash(o.pos, jitter(o.pos, 0.7), 0.06);
    return o.pos;
  },
  (d) => d.ctx.skills.bursts.impact(d.elements, d.o.pos),
);

export const beamVisual = skillObject(
  ({ shaders }, look) => ({
    meshes: [
      shaders.take("tube", "flow", look), shaders.take("tube", "flow", look),
      shaders.take("sphere", "flow", look), shaders.take("sphere", "flow", look),
    ],
    perSec: 60,
    radiusM: 0.2,
  }),
  (d) => {
    const { o } = d, [a, b, start, end] = d.meshes;
    const yaw = Math.atan2(o.dir.x, o.dir.z), rM = SKILL_EFFECTS.beam.radiusM;
    for (const [mesh, k] of [[a!, 1], [b!, 0.35]] as const) {
      mesh.position.set(o.pos.x, o.pos.y, o.pos.z);
      mesh.rotation.y = yaw;
      mesh.scaling.set(rM * k, rM * k, Math.max(0.01, o.reachM));
    }
    const at = { x: o.pos.x + o.dir.x * o.reachM, y: o.pos.y, z: o.pos.z + o.dir.z * o.reachM };
    const flicker = 0.85 + 0.3 * Math.random();
    start!.position.set(o.pos.x, o.pos.y, o.pos.z);
    start!.scaling.setAll(rM * 1.2 * flicker);
    end!.position.set(at.x, at.y, at.z);
    end!.scaling.setAll(rM * 1.6 * flicker);
    if (has(d, "lightning") && Math.random() < 0.5) d.ctx.skills.arcs.flash(o.pos, at, 0.05);
    return at;
  },
);

export const cloudVisual = skillObject(
  ({ shaders }, look, o) => ({
    meshes: [shaders.take("sphere", "shell", look), shaders.take("disc", "circle", look)],
    perSec: 25,
    radiusM: o.reachM * 0.7,
  }),
  (d, dtS) => {
    const { o } = d, [a, b] = d.meshes;
    if (o.tickLeft > d.lastTickLeft + 1e-6) {
      d.pulseS = PULSE_TIME_S;
      if (has(d, "lightning")) d.ctx.skills.arcs.flash({ ...o.pos, y: d.floorY + 0.3 }, jitter(o.pos, o.reachM), 0.12);
    }
    d.pulseS = Math.max(0, d.pulseS - dtS);
    const pulse = d.pulseS / PULSE_TIME_S;
    a!.position.set(o.pos.x, d.floorY, o.pos.z);
    a!.scaling.set(o.reachM, o.reachM * (0.4 + 0.1 * pulse), o.reachM);
    a!.visibility = CLOUD_ALPHA + 0.4 * pulse;
    b!.position.set(o.pos.x, d.floorY + 0.04, o.pos.z);
    b!.scaling.setAll(o.reachM);
    b!.visibility = 0.45 + 0.4 * pulse;
    return { x: o.pos.x, y: d.floorY + 0.4, z: o.pos.z };
  },
);

export const waitVisual = skillObject(
  ({ shaders }, look) => ({ meshes: [shaders.take("sphere", "flow", look)], perSec: 15, radiusM: 0.1 }),
  (d) => {
    const { o } = d;
    d.meshes[0]!.position.set(o.pos.x, o.pos.y, o.pos.z);
    d.meshes[0]!.scaling.setAll(0.18 + 0.04 * Math.sin(performance.now() / 90));
    return o.pos;
  },
);

const right = new Vector3();
export const imbueVisual = skillObject(
  ({ shaders }, look) => ({ meshes: [shaders.take("sphere", "flow", look)], perSec: 30, radiusM: 0.1 }),
  (d) => {
    const { o, ctx } = d;
    let at: Vec3 = o.pos;
    const node = ctx.nodes.get(o.caster)?.position;
    if (node) {
      ctx.camera.getDirectionToRef(Vector3.RightReadOnly, right);
      at = { x: node.x + right.x * SWORD_SIDE_M, y: node.y + SWORD_UP_M, z: node.z + right.z * SWORD_SIDE_M };
    }
    d.meshes[0]!.position.set(at.x, at.y, at.z);
    d.meshes[0]!.scaling.setAll(0.14 * (0.85 + 0.3 * Math.random()));
    return at;
  },
);

const has = (d: Drawn, element: SkillElement) => d.elements.includes(element);
const spread = (rM: number) => (Math.random() - 0.5) * 2 * rM;
const jitter = (at: Vec3, rM: number): Vec3 =>
  ({ x: at.x + spread(rM), y: at.y + spread(rM / 2), z: at.z + spread(rM) });

interface Fading {
  mesh: Mesh;
  ageS: number;
  lifeS: number;
  fromScale: number;
  toScale: number;
  alpha: number;
  riseM?: number;
  floorY?: number;
}

interface Bursts {
  nova(elements: readonly SkillElement[], at: Vec3, radiusM: number): void;
  self(elements: readonly SkillElement[], at: Vec3): void;
  imbue(elements: readonly SkillElement[], at: Vec3): void;
  impact(elements: readonly SkillElement[], at: Vec3): void;
  reaction(reaction: Reaction, at: Vec3): void;
  sparks(at: Vec3): void;
  tick(dtS: number): void;
  clear(): void;
}

function createBursts(
  shaders: SkillShaders, particles: SkillParticles, arcs: Arcs, floorY: (at: Vec3) => number,
): Bursts {
  const fading: Fading[] = [];
  const fade = (
    shape: "sphere" | "disc", mode: ShaderMode, look: LookKey, at: Vec3,
    o: { lifeS: number; fromScale: number; toScale: number; alpha?: number; onFloor?: boolean },
  ) => {
    const mesh = shaders.take(shape, mode, look);
    mesh.position.set(at.x, o.onFloor ? floorY(at) + 0.05 : at.y, at.z);
    mesh.scaling.setAll(o.fromScale);
    fading.push({ mesh, ageS: 0, lifeS: o.lifeS, fromScale: o.fromScale, toScale: o.toScale, alpha: o.alpha ?? 1 });
  };
  const radialArcs = (at: Vec3, count: number, reachM: number, lifeS: number) => {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6, rM = reachM * (0.6 + Math.random() * 0.4);
      const yM = (Math.random() - 0.5) * reachM * 0.5;
      arcs.flash(at, { x: at.x + Math.cos(angle) * rM, y: at.y + yM, z: at.z + Math.sin(angle) * rM }, lifeS);
    }
  };
  const shards = (at: Vec3, rM: number) => {
    const y = floorY(at);
    for (let i = 0; i < SHARD_COUNT; i++) {
      const angle = (i / SHARD_COUNT) * Math.PI * 2 + Math.random() * 0.4;
      const mesh = shaders.rock();
      mesh.position.set(at.x + Math.cos(angle) * rM, y, at.z + Math.sin(angle) * rM);
      mesh.rotation.set((Math.random() - 0.5) * 0.6, Math.random() * Math.PI, (Math.random() - 0.5) * 0.6);
      mesh.scaling.set(0.5, 1.4 + Math.random() * 0.8, 0.5);
      fading.push({ mesh, ageS: 0, lifeS: 0.9, fromScale: 1, toScale: 1, alpha: 1, riseM: 0.7, floorY: y });
    }
  };
  const extras = (elements: readonly SkillElement[], at: Vec3, rM: number) => {
    if (elements.includes("lightning")) radialArcs(at, 6, rM, 0.18);
    if (elements.includes("earth")) shards(at, rM * 0.75);
  };

  return {
    nova(elements, at, radiusM) {
      const look = lookOf(elements);
      fade("sphere", "shell", look, at, { lifeS: 0.45, fromScale: radiusM * 0.2, toScale: radiusM, alpha: 0.9 });
      fade("disc", "ring", look, at, { lifeS: 0.55, fromScale: radiusM * 0.3, toScale: radiusM * 1.1, onFloor: true });
      for (const key of particleKeysOf(elements)) particles.burst(key, at, 50, 0.3, radiusM * 1.2);
      extras(elements, at, radiusM);
    },
    self(elements, at) {
      const look = lookOf(elements);
      fade("sphere", "shell", look, at, { lifeS: 0.7, fromScale: 1.1, toScale: 0.8, alpha: 0.7 });
      fade("disc", "ring", look, at, { lifeS: 0.8, fromScale: 0.4, toScale: 1.4, onFloor: true });
      for (const key of particleKeysOf(elements)) particles.burst(key, at, 40, 0.7, 0.8);
    },
    imbue(elements, at) {
      const look = lookOf(elements);
      fade("disc", "circle", look, at, { lifeS: 0.6, fromScale: 1.2, toScale: 0.5, onFloor: true });
      for (const key of particleKeysOf(elements)) particles.burst(key, at, 30, 1, 0.6);
    },
    impact(elements, at) {
      fade("sphere", "shell", lookOf(elements), at, { lifeS: 0.25, fromScale: 0.2, toScale: 0.7 });
      for (const key of particleKeysOf(elements)) particles.burst(key, at, 18, 0.15, 1.6);
      extras(elements, at, 1);
    },
    reaction(reaction, at) {
      switch (reaction) {
        case "conduct":
          radialArcs(at, 8, SKILL_EFFECTS.reactions.conduct.arcRange * 0.5, 0.3);
          fade("sphere", "shell", "lightning", at, { lifeS: 0.35, fromScale: 0.4, toScale: 1.4 });
          particles.burst("lightning", at, 60, 0.4, 1.5);
          break;
        case "doused":
          particles.burst("steam", at, 40, 0.6, 1);
          particles.burst("water", at, 20, 0.3, 1);
          break;
        case "fanned":
          fade("disc", "ring", "air", at, {
            lifeS: 0.5, fromScale: 0.5, toScale: SKILL_EFFECTS.reactions.fanned.spreadRange * 0.6, onFloor: true,
          });
          particles.burst("fire", at, 70, 0.5, 3);
          particles.burst("air", at, 25, 0.5, 1);
          break;
        case "eclipse": {
          const rM = SKILL_EFFECTS.reactions.eclipse.radius;
          fade("sphere", "flow", "darkness", at, { lifeS: 0.8, fromScale: 0.9, toScale: 0.6 });
          fade("sphere", "shell", "light", at, { lifeS: 0.8, fromScale: 1, toScale: 0.75 });
          fade("sphere", "shell", "darkness", at, { lifeS: 0.6, fromScale: 0.3, toScale: rM, alpha: 0.6 });
          fade("disc", "ring", "light", at, { lifeS: 0.6, fromScale: rM * 0.2, toScale: rM, onFloor: true });
          particles.burst("darkness", at, 40, 0.5, rM);
          break;
        }
      }
    },
    sparks(at) {
      particles.burst("sparks", at, SPARK_COUNT, 0.05);
    },
    tick(dtS) {
      for (let i = fading.length - 1; i >= 0; i--) {
        const f = fading[i]!;
        f.ageS += dtS;
        const t = Math.min(1, f.ageS / f.lifeS);
        if (f.riseM !== undefined) {
          const up = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
          f.mesh.position.y = f.floorY! - f.mesh.scaling.y * 0.5 + up * f.riseM * f.mesh.scaling.y;
        } else {
          f.mesh.scaling.setAll(f.fromScale + (f.toScale - f.fromScale) * (1 - (1 - t) ** 3));
          f.mesh.visibility = f.alpha * (1 - t) ** 1.5;
        }
        if (t < 1) continue;
        shaders.give(f.mesh);
        fading.splice(i, 1);
      }
    },
    clear() {
      for (const f of fading) shaders.give(f.mesh);
      fading.length = 0;
    },
  };
}
