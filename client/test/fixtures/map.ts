import type { Theme, WorldLayout } from "@infinite-tower/shared";

export function testMap(tiles: string[], theme: Theme = "grass-field", extra: Partial<WorldLayout> = {}): WorldLayout {
  const w = tiles[0]!.length, h = tiles.length, area = { x: -w / 2, z: -h / 2, w, h };
  return {
    bounds: area, tiles, regions: [{ id: "test", name: "Test", theme, area }], playerSpeed: 5, campfires: [],
    npcs: [], traces: [], pads: [], ...extra,
  };
}
