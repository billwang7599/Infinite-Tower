import { ParticleSystem, Vector3, type BaseTexture, type Scene } from "@babylonjs/core";
import type { Vec3 } from "@infinite-tower/shared";
import { glowTexture, puffTexture } from "../../../gfx/textures.js";
import { PARTICLE_LOOKS, type ParticleKey } from "./looks.js";

const CAPACITY = 160;

export interface SpellParticles {
  stream(key: ParticleKey, perSec: number, radiusM: number): ParticleSystem;
  release(system: ParticleSystem): void;
  burst(key: ParticleKey, at: Vec3, count: number, radiusM: number, speedFactor?: number): void;
  tick(dtS: number): void;
  clear(): void;
}

export function createSpellParticles(scene: Scene): SpellParticles {
  const glow = glowTexture(scene), puff = puffTexture(scene);
  const idle = new Map<ParticleKey, ParticleSystem[]>();
  const all: ParticleSystem[] = [];
  const bursting: { system: ParticleSystem; leftS: number }[] = [];

  const take = (key: ParticleKey, radiusM: number, speedFactor: number): ParticleSystem => {
    const look = PARTICLE_LOOKS[key];
    let system = idle.get(key)?.pop();
    if (!system) {
      system = new ParticleSystem(`spell-${key}`, CAPACITY, scene);
      const texture: BaseTexture = look.smoke ? puff : glow;
      system.particleTexture = texture;
      system.blendMode = look.smoke ? ParticleSystem.BLENDMODE_STANDARD : ParticleSystem.BLENDMODE_ADD;
      [system.color1, system.color2, system.colorDead] = look.colors;
      [system.minSize, system.maxSize] = look.sizeM;
      [system.minLifeTime, system.maxLifeTime] = look.lifeS;
      system.gravity = new Vector3(0, look.gravityMps2, 0);
      system.minAngularSpeed = -2;
      system.maxAngularSpeed = 2;
      system.updateSpeed = 1 / 60; // lifetimes and speeds in seconds at any frame rate
      system.emitter = new Vector3();
      all.push(system);
    }
    system.minEmitPower = look.speedMps[0] * speedFactor;
    system.maxEmitPower = look.speedMps[1] * speedFactor;
    system.createSphereEmitter(radiusM, 1);
    return system;
  };
  const give = (system: ParticleSystem) => {
    system.stop();
    const key = system.name.slice("spell-".length) as ParticleKey;
    const list = idle.get(key) ?? [];
    list.push(system);
    idle.set(key, list);
  };

  return {
    stream(key, perSec, radiusM) {
      const system = take(key, radiusM, 0.5);
      system.manualEmitCount = -1;
      system.emitRate = perSec;
      system.start();
      return system;
    },
    release: give,
    burst(key, at, count, radiusM, speedFactor = 1) {
      const system = take(key, radiusM, speedFactor);
      (system.emitter as Vector3).set(at.x, at.y, at.z);
      system.manualEmitCount = count;
      system.start();
      bursting.push({ system, leftS: PARTICLE_LOOKS[key].lifeS[1] + 0.1 });
    },
    tick(dtS) {
      for (let i = bursting.length - 1; i >= 0; i--) {
        const b = bursting[i]!;
        b.leftS -= dtS;
        if (b.leftS > 0) continue;
        give(b.system);
        bursting.splice(i, 1);
      }
    },
    clear() {
      for (const b of bursting) give(b.system);
      bursting.length = 0;
      for (const system of all) system.reset();
    },
  };
}
