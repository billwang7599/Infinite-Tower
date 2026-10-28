import type { Mesh } from "@babylonjs/core";
import { MAGIC, type Reaction, type SpellElement, type Vec3 } from "@infinite-tower/shared";
import type { Arcs } from "./arcs.js";
import { lookOf, particleKeysOf, type LookKey } from "./looks.js";
import type { SpellParticles } from "./particles.js";
import type { ShaderMode, SpellShaders } from "./shaders.js";

const SHARD_COUNT = 7;

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

export interface Bursts {
  nova(elements: readonly SpellElement[], at: Vec3, radiusM: number): void;
  self(elements: readonly SpellElement[], at: Vec3): void;
  imbue(elements: readonly SpellElement[], at: Vec3): void;
  impact(elements: readonly SpellElement[], at: Vec3): void;
  reaction(reaction: Reaction, at: Vec3): void;
  tick(dtS: number): void;
  clear(): void;
}

export function createBursts(
  shaders: SpellShaders, particles: SpellParticles, arcs: Arcs, floorY: (at: Vec3) => number,
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
  const extras = (elements: readonly SpellElement[], at: Vec3, rM: number) => {
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
          radialArcs(at, 8, MAGIC.reactions.conduct.arcRange * 0.5, 0.3);
          fade("sphere", "shell", "lightning", at, { lifeS: 0.35, fromScale: 0.4, toScale: 1.4 });
          particles.burst("lightning", at, 60, 0.4, 1.5);
          break;
        case "doused":
          particles.burst("steam", at, 40, 0.6, 1);
          particles.burst("water", at, 20, 0.3, 1);
          break;
        case "fanned":
          fade("disc", "ring", "air", at, {
            lifeS: 0.5, fromScale: 0.5, toScale: MAGIC.reactions.fanned.spreadRange * 0.6, onFloor: true,
          });
          particles.burst("fire", at, 70, 0.5, 3);
          particles.burst("air", at, 25, 0.5, 1);
          break;
        case "eclipse": {
          const rM = MAGIC.reactions.eclipse.radius;
          fade("sphere", "flow", "darkness", at, { lifeS: 0.8, fromScale: 0.9, toScale: 0.6 });
          fade("sphere", "shell", "light", at, { lifeS: 0.8, fromScale: 1, toScale: 0.75 });
          fade("sphere", "shell", "darkness", at, { lifeS: 0.6, fromScale: 0.3, toScale: rM, alpha: 0.6 });
          fade("disc", "ring", "light", at, { lifeS: 0.6, fromScale: rM * 0.2, toScale: rM, onFloor: true });
          particles.burst("darkness", at, 40, 0.5, rM);
          break;
        }
      }
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
