# The art lab

The art lab (`art-lab/`, `npm run art`) is where the game's art is drawn by hand: sprites now, then tiles and
animations. It only exports files (PNG and JSON); nothing it makes is wired into the game yet.

## Being built

- **Tiles**: tiles at the overworld's size, a 3x3 wrap preview to show seams, a tileset of several tiles, exported
  as a PNG sheet and JSON.
- **Animations**: frames on a timeline, onion skin, playback at a set fps, exported as a sprite sheet and JSON.

## Open

- **A level editor.** Levels stay in code for now (the user: "maybe i can make levels by code level changes, that
  might be fine too"). One may come later; nothing about it is decided.
- **Wiring drawings into the game**: loading exported sheets instead of the code-drawn art (see [art.md](art.md)).
