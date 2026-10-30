import { Mesh, VertexBuffer, VertexData, type Scene } from "@babylonjs/core";
import { mapHalfSize, tileAt, type LevelLayout } from "@infinite-tower/shared";
import { PX_PER_TILE } from "../overworld/props.js";
import { WATER_DEPTH_TILES, waterMap } from "./map.js";
import { setWater, waterMaterial, type WaterLook } from "./water.js";

const STEPS_PER_TILE = 4;
/** A bank's wall is the land's edge pixels run down to the bed, this much darker at its foot. */
const WALL_SHADE = { top: 0.75, foot: 0.3 };
const WALL_INSET_TILES = 1.5 / PX_PER_TILE;

interface Point { x: number; y: number; z: number }

export function levelWater(scene: Scene, level: LevelLayout, look: WaterLook): { ground: Mesh; surface: Mesh } {
  const map = waterMap(level), { halfWidth: L, halfDepth: D } = mapHalfSize(level);
  const ground = new Builder(), surface = new Builder();
  const fieldUV = (x: number, z: number): [number, number] => [(x + L) / (2 * L), (z + D) / (2 * D)];
  const up = { x: 0, y: 1, z: 0 };

  for (let z = -D; z < D; z++) {
    for (let x = -L; x < L;) {
      const dry = (at: number) => at < L && tileAt(level, at + 0.5, z + 0.5) !== "water";
      if (!dry(x)) { x++; continue; }
      let end = x + 1;
      while (dry(end)) end++;
      const corner = (cx: number, cz: number) => ground.vertex({ x: cx, y: 0, z: cz }, fieldUV(cx, cz), 1);
      ground.quad([corner(x, z), corner(end, z), corner(end, z + 1), corner(x, z + 1)], up);
      x = end;
    }
  }

  const step = 1 / STEPS_PER_TILE;
  const bed = new Map<string, number>(), top = new Map<string, number>();
  const shared = (store: Map<string, number>, i: number, j: number, make: (x: number, z: number) => number) => {
    const key = `${i},${j}`;
    let k = store.get(key);
    if (k === undefined) store.set(key, k = make(i * step, j * step));
    return k;
  };
  for (const t of map.tiles) {
    const i0 = Math.round(t.x * STEPS_PER_TILE), j0 = Math.round(t.z * STEPS_PER_TILE);
    for (let i = i0; i < i0 + STEPS_PER_TILE; i++) {
      for (let j = j0; j < j0 + STEPS_PER_TILE; j++) {
        const cell = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]] as const;
        ground.quad(cell.map(([a, b]) => shared(bed, a, b, (x, z) =>
          ground.vertex({ x, y: -map.at(x, z).depth, z }, fieldUV(x, z), 1))), up);
        surface.quad(cell.map(([a, b]) => shared(top, a, b, (x, z) =>
          surface.vertex({ x, y: -WATER_DEPTH_TILES.surface, z }, [0, 0], 1))), up);
      }
    }
  }

  const foot = -WATER_DEPTH_TILES.bank - 0.02;
  for (const { from, to, toLand } of map.banks) {
    const uvAt = (p: { x: number; z: number }) =>
      fieldUV(p.x + toLand.x * WALL_INSET_TILES, p.z + toLand.z * WALL_INSET_TILES);
    ground.quad([
      ground.vertex({ x: from.x, y: 0, z: from.z }, uvAt(from), WALL_SHADE.top),
      ground.vertex({ x: to.x, y: 0, z: to.z }, uvAt(to), WALL_SHADE.top),
      ground.vertex({ x: to.x, y: foot, z: to.z }, uvAt(to), WALL_SHADE.foot),
      ground.vertex({ x: from.x, y: foot, z: from.z }, uvAt(from), WALL_SHADE.foot),
    ], { x: -toLand.x, y: 0, z: -toLand.z });
  }

  const groundMesh = ground.build(scene, `level-ground-${level.id}`);
  const surfaceMesh = surface.build(scene, `water-${level.id}`);
  setWater(surfaceMesh, (x, z) => {
    const p = map.at(x, z);
    return { ...p, column: p.depth - WATER_DEPTH_TILES.surface };
  });
  surfaceMesh.material = waterMaterial(scene, `water-${level.id}`, look);
  return { ground: groundMesh, surface: surfaceMesh };
}

class Builder {
  private readonly positions: number[] = [];
  private readonly uvs: number[] = [];
  private readonly colors: number[] = [];
  private readonly indices: number[] = [];

  vertex(p: Point, [u, v]: [number, number], shade: number): number {
    this.positions.push(p.x, p.y, p.z);
    this.uvs.push(u, v);
    this.colors.push(shade, shade, shade, 1);
    return this.positions.length / 3 - 1;
  }

  quad(corners: readonly number[], facing: Point): void {
    const at = (k: number): Point => {
      const i = corners[k]! * 3;
      return { x: this.positions[i]!, y: this.positions[i + 1]!, z: this.positions[i + 2]! };
    };
    const [a, b, c] = [at(0), at(1), at(2)];
    const e1 = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }, e2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
    const along = (e1.y * e2.z - e1.z * e2.y) * facing.x + (e1.z * e2.x - e1.x * e2.z) * facing.y
      + (e1.x * e2.y - e1.y * e2.x) * facing.z;
    const [k0, k1, k2, k3] = along >= 0 ? corners : [...corners].reverse();
    this.indices.push(k0!, k1!, k2!, k0!, k2!, k3!);
  }

  build(scene: Scene, name: string): Mesh {
    const data = new VertexData(), normals: number[] = [];
    VertexData.ComputeNormals(this.positions, this.indices, normals);
    Object.assign(data, { positions: this.positions, indices: this.indices, normals, uvs: this.uvs });
    const mesh = new Mesh(name, scene);
    data.applyToMesh(mesh);
    mesh.setVerticesData(VertexBuffer.ColorKind, this.colors, false, 4);
    return mesh;
  }
}
