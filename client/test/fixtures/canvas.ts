import { AbstractEngine } from "@babylonjs/core";

// Node has no canvas: one that draws nothing is enough to build meshes that paint their own textures.
export function stubCanvas(): void {
  Object.assign(AbstractEngine, {
    _CreateCanvas: (width: number, height: number) => {
      const context: object = new Proxy({}, {
        get: (_, key) => key === "getImageData"
          ? () => ({ data: new Uint8ClampedArray(width * height * 4) })
          : () => context,
        set: () => true,
      });
      return { width, height, getContext: () => context };
    },
  });
}
