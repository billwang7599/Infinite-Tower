# The 2D overworld (archived)

The overworld used to be drawn flat: a straight-down orthographic camera over the tile map, every sprite and prop a
flat quad, a dusk tint, a tuft of grass over the feet in tall grass. The HD-2D one (pixel-art billboards on 3D ground,
`?world=3d` while it was being tried) became the only one, because the user prefers it: "i think 3d view is much cooler
actually. can we make that default? and archive 2d view for now".

The last commit with both is the git tag `archive/overworld-2d` (`git show archive/overworld-2d`). What was removed:

- `client/src/visuals/overworld/` as it was then: `scene.ts` (the ortho camera, `flatSprite`, `layerY`) and
  `overworld.ts` (`WALKERS` as flat sprites with the tall-grass tuft, the camera held inside `viewCenter`)
- in `client/src/visuals/levels/index.ts`: `buildLevel` (the flat ground with a margin of `outside` tiles, flat
  props, the campfires' additive glow), `FLAT_DUSK`, and `LEVEL_LOOKS`' `outside`
- the margin in `levels/tiles.ts` (`paintGround` and `tileProps` filled it with the `outside` kind)
- `tuftTexture` and `pixelTexture` (`textures.ts`), `pixelMaterial`'s `unlit` option (`sprites.ts`)
- the switch: `OverworldLook` and `overworldLookFrom` (`?world=`) in `visuals/visuals.ts`, which took a drawing
  (`create`, `walkers`, `stage`) per look

## Bringing it back

Restore those files from the tag beside today's `visuals/overworld/`, give the two a switch again (a setting rather
than a query string, if it's for players), and put the margin back in `paintGround` / `tileProps`. Both views share
the tile looks (`levels/<theme>/tiles.ts`), the chibi facings and the enemies' overworld sprites, so new tiles and
enemies come along; anything added to the 3D world alone (scenery, lights) has no flat drawing.

The server still sends the actors within the flat view's screen plus 3 tiles (`VIEW` and `viewCenter` in
`shared/src/overworld/view.ts`, `server/src/core/game/snapshot.ts`), which the 2D camera was built around.
