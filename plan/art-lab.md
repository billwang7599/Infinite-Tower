# The art lab

The art lab (`art-lab/`, `npm run art`) is where the game's art is drawn by hand: sprites, tiles and animations
(ART.md, "The pixel editor"). It only exports files (PNG and JSON); nothing it makes is wired into the game yet.

## Open

- **A level editor.** Levels stay in code for now (the user: "maybe i can make levels by code level changes, that
  might be fine too"). One may come later; nothing about it is decided.
- **Tiles that join**: edge and corner variants (grass meeting dirt) and a preview of tiles side by side; the game
  paints its ground in code with edges where neighbours differ (`client/src/visuals/levels/ground.ts`).
- **Animations**: a duration per frame, and playing them on the canvas, not only in the preview.
- **Wiring drawings into the game**: loading exported sheets instead of the code-drawn art (see [art.md](art.md)).
