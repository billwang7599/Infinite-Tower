import { Vector3, type Matrix, type Mesh, type TransformNode } from "@babylonjs/core";
import type { Arm } from "../../src/visuals/battle/arm.js";
import { sectionAt, type Section } from "../../src/visuals/battle/person/loft.js";

export interface Loft { node: TransformNode; sections: readonly Section[]; roundness: number }

/** How deep (m) a point is inside any of the lofts, each grown by `growM`: along the way out from its middle. */
export function depthIn(lofts: readonly Loft[], at: Vector3, growM = 0): number {
  let deepest = 0;
  for (const { node, sections, roundness: r } of lofts) {
    const p = Vector3.TransformCoordinates(at, node.getWorldMatrix().clone().invert());
    if (p.y < sections[0]!.y || p.y > sections.at(-1)!.y) continue;
    const s = sectionAt(sections, p.y), x = p.x - (s.dx ?? 0), z = p.z - (s.dz ?? 0);
    const w = s.x + growM, d = s.z + growM, size = ((Math.abs(x) / w) ** r + (Math.abs(z) / d) ** r) ** (1 / r);
    if (size >= 1) continue;
    deepest = Math.max(deepest, size < 1e-6 ? Math.min(w, d) : Math.hypot(x, z) * (1 / size - 1));
  }
  return deepest;
}

export function loftSurface(
  sections: readonly Section[], roundness: number, world: Matrix, fromY: number, toY: number, step: number,
): Vector3[] {
  const points: Vector3[] = [];
  for (let y = fromY; y <= toY + 1e-9; y += step) {
    const s = sectionAt(sections, y);
    for (let k = 0; k < 12; k++) {
      const a = (2 * Math.PI * k) / 12, sin = Math.sin(a), cos = Math.cos(a);
      const x = (s.dx ?? 0) + s.x * Math.sign(sin) * Math.abs(sin) ** (2 / roundness);
      const z = (s.dz ?? 0) + s.z * Math.sign(cos) * Math.abs(cos) ** (2 / roundness);
      points.push(Vector3.TransformCoordinates(new Vector3(x, y, z), world));
    }
  }
  return points;
}

export const alongSegment = (from: Vector3, to: Vector3, n: number): Vector3[] =>
  Array.from({ length: n + 1 }, (_, i) => Vector3.Lerp(from, to, i / n));

function boneEnds(bone: Mesh): [Vector3, Vector3] {
  bone.computeWorldMatrix(true);
  const { minimum, maximum } = bone.getBoundingInfo().boundingBox, world = bone.getWorldMatrix();
  return [minimum.y, maximum.y].map((y) => Vector3.TransformCoordinates(new Vector3(0, y, 0), world)) as
    [Vector3, Vector3];
}

export function armDepth(
  lofts: readonly Loft[], arm: Arm, half: { upperM: number; foreM: number; handM: number }, jointShare: number,
): { depthM: number; part: string } {
  let worst = { depthM: 0, part: "" };
  const check = (part: string, at: Vector3, growM: number) => {
    const depthM = depthIn(lofts, at, growM);
    if (depthM > worst.depthM) worst = { depthM, part };
  };
  const [shoulder, elbow] = boneEnds(arm.upper);
  for (const at of alongSegment(Vector3.Lerp(shoulder, elbow, jointShare), elbow, 10)) {
    check("upper arm", at, half.upperM);
  }
  for (const at of alongSegment(...boneEnds(arm.fore), 10)) check("forearm", at, half.foreM);
  arm.hand.computeWorldMatrix(true);
  check("fist", arm.hand.getAbsolutePosition(), half.handM);
  return worst;
}
