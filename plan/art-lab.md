# The art lab

The art lab (`art-lab/`, `npm run art`) is where the game's art is drawn by hand: sprites, tiles and animations
(ART.md, "The pixel editor"). It saves files (PNG and JSON, into `art-lab/files/`); nothing it makes is wired into
the game yet.

## Open

- **A level editor.** Levels stay in code for now (the user: "maybe i can make levels by code level changes, that
  might be fine too"). One may come later; nothing about it is decided.
- **Tiles that join**: edge and corner variants (grass meeting dirt) and a preview of tiles side by side; the game
  paints its ground in code with edges where neighbours differ (`client/src/visuals/levels/ground.ts`).
- **Animations**: a duration per frame, and playing them on the canvas, not only in the preview.
- **Selections**: flip and rotate, and copying between drawings through the system clipboard (the clipboard is the
  lab's own for now). A paste floats over the layer it's pasted on, but not on a layer of its own.
- **Templates in layers**: a template comes in as one layer; the game's art could be split by part (body, head,
  hair...) into the lab's part layers. The enemies' 3D battle models, the campfire and the arena's looks need Babylon
  and aren't templates.
- **Wiring drawings into the game**: loading exported sheets instead of the code-drawn art (see [art.md](art.md)).
