import { Color3, Mesh, MeshBuilder, StandardMaterial, Vector3, type InstancedMesh, type Scene } from "@babylonjs/core";
import { seededRandom, type Vec3 } from "@infinite-tower/shared";

const SHAPES = 4;
const KINKS = 9;
const HALF_WIDTH_M = 0.025;

// Jagged strips 1 m long along +z, stretched between two points.
export interface Arcs {
  flash(from: Vec3, to: Vec3, lifeS: number): void;
  tick(dtS: number): void;
  clear(): void;
}

export function createArcs(scene: Scene): Arcs {
  const material = new StandardMaterial("spell-arc", scene);
  material.disableLighting = true;
  material.emissiveColor = new Color3(2.4, 2.3, 3);
  material.backFaceCulling = false;
  const rand = seededRandom(11);
  const shapes = Array.from({ length: SHAPES }, (_, s) => {
    const line = Array.from({ length: KINKS + 1 }, (_, i) => {
      const u = i / KINKS, sway = i === 0 || i === KINKS ? 0 : 0.14 * Math.sin(u * Math.PI);
      return new Vector3((rand() - 0.5) * sway * 2, (rand() - 0.5) * sway * 2, u);
    });
    const strip = (side: Vector3) => MeshBuilder.CreateRibbon(`arc-${s}`, {
      pathArray: [line.map((p) => p.subtract(side)), line.map((p) => p.add(side))],
    }, scene);
    const mesh = Mesh.MergeMeshes([strip(new Vector3(HALF_WIDTH_M, 0, 0)), strip(new Vector3(0, HALF_WIDTH_M, 0))])!;
    mesh.material = material;
    mesh.isPickable = false;
    mesh.setEnabled(false);
    return mesh;
  });
  const idle: InstancedMesh[] = [];
  const live: { arc: InstancedMesh; leftS: number }[] = [];
  const target = new Vector3();

  const give = (arc: InstancedMesh) => {
    arc.setEnabled(false);
    idle.push(arc);
  };
  return {
    flash(from, to, lifeS) {
      const shape = shapes[Math.floor(Math.random() * SHAPES)]!;
      const arc = idle.find((a) => a.sourceMesh === shape) ?? shape.createInstance("arc");
      if (idle.includes(arc)) idle.splice(idle.indexOf(arc), 1);
      arc.isPickable = false;
      arc.position.set(from.x, from.y, from.z);
      arc.lookAt(target.set(to.x, to.y, to.z));
      const lengthM = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
      const flip = Math.random() < 0.5 ? -1 : 1;
      arc.scaling.set(flip, flip, Math.max(0.01, lengthM));
      arc.setEnabled(true);
      live.push({ arc, leftS: lifeS });
    },
    tick(dtS) {
      for (let i = live.length - 1; i >= 0; i--) {
        const l = live[i]!;
        l.leftS -= dtS;
        if (l.leftS > 0) continue;
        give(l.arc);
        live.splice(i, 1);
      }
    },
    clear() {
      for (const l of live) give(l.arc);
      live.length = 0;
    },
  };
}
