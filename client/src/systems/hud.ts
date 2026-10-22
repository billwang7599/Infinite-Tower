import { LocalPlayer, Player, PLAYER, floorAtHeight, type System } from "@infinite-tower/shared";
import { Body } from "../components.js";
import type { GameContext } from "../context.js";
import { ZONES, zoneIndex } from "../materials.js";

/** DOM overlay. Only touches the DOM when the text changes. */
export function hudSystem(ctx: GameContext, el: HTMLElement): System {
  let last = "";
  let fpsTimer = 0, fps = 0;
  return (world, dt) => {
    fpsTimer += dt;
    if (fpsTimer > 0.5) { fps = Math.round(ctx.scene.getEngine().getFps()); fpsTimer = 0; }

    const row = world.first(LocalPlayer, Player, Body);
    if (!row) return;
    const [, , player, body] = row;
    const floor = floorAtHeight(body.mesh.position.y - PLAYER.height / 2);
    const checkpoint = floorAtHeight(player.spawnPoint.y);
    const html =
      `Floor ${floor} &nbsp;·&nbsp; Best ${player.bestFloor}<br>` +
      `<small>${ZONES[zoneIndex(floor)]!.name} · checkpoint ${checkpoint} · ${fps} fps · ${world.entityCount} entities</small><br>` +
      `<small>WASD to move · Space to jump · Arrows to turn the camera</small>`;
    if (html !== last) { el.innerHTML = html; last = html; }
  };
}
