# ART.md

How the game's art should look, and how to make it. Read this before drawing anything. All the game's art is code:
the game loads no image files. The portrait is traced from Stable Diffusion pictures (`client/art/sd/`, dev only) into
tone grids in the source; everything else is drawn in code. Hand-drawn art is a plan for later
([plan/art.md](plan/art.md)); the art lab's [pixel editor](#the-pixel-editor) draws it, but nothing it makes is in the
game yet. [What to draw](#what-to-draw) says how much there would
be to draw.

## Characters

### The look

- **The portrait reference**: a 64x64 pixel-art bust in three-quarter view, like a JRPG dialogue portrait, with
  Arknights' taste on top: clean anime faces, cel shading, muted clothes with one accent. Pretty, not realistic: a
  big head (about 60% of the picture), big eyes, a tiny nose and mouth, a small chin.
- **Turned three-quarters to our left, looking at us.** The far cheek is the face's left edge, the ear is on the
  right, both irises sit toward the right of their eyes. Flip the picture to face the other way (the mock dialogue
  does, for the speaker on the left).
- **Warm skin on cool everything else.** Skin is warm, with red-brown outlines and salmon-pink shadows; hair is
  slightly greyed; clothes are near-neutral (soot, ash, chalk, slate, oxblood, moss) and old: leather, tarnished
  brass. Each character has one bright accent (orange, cyan, crimson, gold, violet, white) on small things like
  piping or a hair tie. The eyes are the brightest thing on them.
- **Hard pixels, cel shading.** Scaled up by whole numbers with no smoothing. No anti-aliasing, no dithering, no
  gradients: every shape is a few flat tones with hard-edged shadows.
- **Light from the top left.** Shadows fall on the near (right) side of the body, under the chin onto the neck,
  under the bangs on the forehead, and on the back of the head.
- **Outlines are the darkest tone of their own color**: red-brown around skin, near-black around black hair. Where
  a part lies over another of the same material (bangs over the back hair, a sleeve over the coat) the line is a
  softer inner line, and none at all where they're one shape (`pen.blend`: a sleeve sewn into the shoulder). The
  picture's own edges get none: the bust just stops at the bottom.
- **Eyes**: big, a heavy upper lash line flicking out past the outer corner, the iris dark at the top (the lid's
  shadow) and light at the bottom with a white highlight top-left, the white showing on the side away from us.
  The far eye is narrower and starts right at the cheek's edge.
- **Hair**: clumps that end in points, a dark strand line up from each notch between them, a shine arc across
  the crown, the back of the head in shadow. Bangs stop at the lashes over the eyes and can come lower between them.
- **Bodies are athletic**, every type: shoulders well wider than the neck, sloping from it into rounded deltoids.
  Never heavy.
- **Face rows** (portrait): brows on row 19, lashes 23 and 24, the lower lid 28, nose 30, mouth 35, chin 41 (40 on
  the square face). The bodysuit's collar starts at row 39 behind the jaw and the shoulders at 44, so a short neck
  shows under the jaw: a long one makes the head look stuck on, none makes it look sunk in.
  The chibi's neck is 4 pixels wide, about a quarter of its head; at 2 it reads as a stalk.
- **The chibi's legs stand together**, one block of trousers with the right leg in shadow and a dark line where
  they meet, and a boot on each, its sole a pixel wider on the outside. Two thin legs apart under one wide boot
  read as a bench.
- **The jaw in three-quarter view**: the cheek runs back to the ear, the far cheek stays full down to the mouth,
  and the jaw's corner sits under the ear at mouth level. From there a short, flat jawline runs forward to a small
  rounded chin, with a row or two of straight edge at its tip. A jaw cornered up at the nose, falling in one
  straight diagonal to a point, reads as a kite, not a face.
- **Smooth curves.** Along a curved edge the steps between rows grow or shrink steadily (a jaw's far side moves
  0, 0, 1, 1, 1, 2, 2 pixels a row toward the chin). A step that jumps then stalls (1, 2, 0) shows as a notch.

### Views

Every character is one look drawn several ways. All views have a transparent background.

| View | Size | Drawn by | What it's for |
| --- | --- | --- | --- |
| portrait | 64x64 | `drawPortrait(look)` | head and shoulders, three-quarter view; dialogue (speaker lit, listener dimmed), creation, the character panel and the HUD's card |
| chibi | 32x32 | `drawChibi(look, facing)` | the world, about 1.7 heads tall; facing front, back or side (to the left), the way it walks |
| battle | 64x64 | `drawBattle(look, pose, frame, facing)` | the arena, from behind or the front, sword in hand; the figure is 48 wide, the sides are room for the sword |

The battle sprite is seen from behind or from the front (`BATTLE_FACINGS` in `art.ts`). Your own is from behind: the
arena camera sits behind you, and you attack where it looks. Another player's shows their front while your camera is
ahead of where they face (a duel, or across a joined fight), their back otherwise. It has a picture per pose (`POSES`
in `battle.ts`): stand (also running), slash (sword arm out to the player's right; the arena shows the sword fight's
swings instead) and down (knelt, slumped, sword dropped). From behind the head is all hair, so face shapes, eyes and
mouths draw nothing there. From the front the body is the same pose turned round, so its outline is the back's
mirrored (their right hand on our left), with the front of the clothes, and the head is the chibi's facing front,
scaled up to fill the hair seen from behind (`frontHead`), with the chibi's eyes and mouth where it puts them.

The sword fight's poses (`SWORD_POSES` in `battle.ts`, drawn in `moves.ts`, played by `visuals/battle/pose.ts`)
have a few frames each, played in order: `drawBattle(look, pose, frame)`. Five swings, named for the way the blade
moves on screen (`swing-tlbr`: top left to bottom right), each a wind-up, strike and follow-through: the lights across
from either side and down from the top, the heavies cleaving down and across from either side (the top's heavy uses
the light's); three guards of a frame each (held while aiming from that side, and the top one while blocking), the
blade held up on the left, level over the head, or up on the right; and a stagger. A wind-up cocks the elbow, a
follow-through straightens the arm. Nothing is mirrored: the sword stays in the right hand. Seen from behind and above, a blade pointing away is short and points up the screen, and what's in front of
the body is hidden by it, so the strike shows the blade where it comes out beside the head; a frame's `swordLayer` puts
the sword under the body (in front of the player) or over the head (the top guard). From the front what's in
front of the body is over it: an arm across the chest shows, and a blade in front of the player is drawn over
everything.

The chibi faces the way it walks (`CHIBI_FACINGS` in `art.ts`): walking down the screen it faces front, up it faces
back, and to a side it faces side (drawn facing left; the game mirrors it for walking right). Front and back share
a body outline; facing back there's no face, and facing side shows only the near eye. A diagonal keeps the way it
was already facing, so it doesn't flicker.

Coming later: a chibi walk cycle, portrait expressions for dialogue, and battle frames from a skeleton
([plan/art.md](plan/art.md)).

### Colors

Every material is a ramp of six tones: outline, deep, shadow, base, light, shine (`gfx/look/palette.ts`).
Pictures record which material and tone each pixel is, and are only colored at the end, so a new hair color is a
new ramp and nothing else. Ramps a player picks: skin, hair, eyes (iris), outfit (cloth) and accent; cloth and
gear stay near-neutral, the accent goes on small trims only. Fixed ones everyone shares: eye whites, lash lines,
mouth, blush, linen, wool, leather, brass, steel. Gear adds its own (iron, silk...).

### What to draw

How many drawings each thing needs, for whoever draws it. Read from the code: the options from `LOOK_OPTIONS`
(`shared/src/character/character.ts`), the views from `VIEWS`, `CHIBI_FACINGS` and `BATTLE_FACINGS` (`art.ts`) and
`POSES` (`battle.ts`).

| View | Canvas | Drawings | Notes |
| --- | --- | --- | --- |
| portrait | 64x64 | 1 | three-quarters to our left; flipped to face right, no extra drawing |
| chibi | 32x32 | 3: front, back, side | side is drawn facing left; facing right is its mirror image |
| battle | 64x64 | 46: stand, slash, down, and 20 sword-fight frames, from behind and from the front | in code the front's outline is the back's mirrored, but what's on it is drawn for the front |

So something seen in every view and pose is 50 drawings. The axes that need drawings of their own:

| Axis | Options | Each option needs |
| --- | --- | --- |
| body type | skinny, medium, wide | its body in every view and pose (50), and its own drawing of every wrap-around piece |
| face shape | soft, sharp, square | 3: the portrait's jaw, the chibi's front jaw and the battle sprite's front jaw (the chibi's back and side, and battle from behind, are shared) |
| hair style | short, bob, long, ponytail | 6: portrait, chibi front, back and side, battle from behind and from the front (one for every pose: it moves with the head). Hair behind the head is a second layer (`hairBack`): in the chibi's front and the battle sprite's, and the portrait's for long and ponytail |
| eye type | round, sharp, sleepy, cat | 4: the portrait's near eye and far eye, one chibi eye (mirrored for the other; facing side shows its first two columns) and one for the battle sprite's front. None facing back or in battle from behind |
| mouth type | smile, flat, grin, cat, pout | 3: the portrait's, the chibi's (facing side shows its first column) and the battle sprite's front. None facing back or in battle from behind |

Gender (boy, girl) changes no art. The head is the same on every body type, and hair, eyes and mouths fit every
face shape, so none of them multiply. The portrait's are Stable Diffusion pictures (one per option, as counted
above), all repainted on one base so they line up. In code the battle sprite's front head is the chibi's front one
scaled up, with the chibi's own eyes and mouth, so it costs no drawings yet; drawn by hand it would be its own.

Color only, no drawings: skin (5), hair color (8), eye color (6), outfit dye (6) and accent (6) are ramps
(`palette.ts`), and every drawing recolors with them.

| Piece of gear | Drawings |
| --- | --- |
| on the head (a helmet) | 6: portrait, chibi front, back and side, battle from behind and from the front (one for every pose); the same on every body |
| held (a weapon) | none: the arena puts a 3D blade (`WEAPON_LOOKS`) at the frame's sword hand |
| rigid on the body (a pair of shoulder guards) | 6: a view each, for both shoulders, placed at each body type's landmark |
| wrap-around top (a chest piece) | 150: 3 body types x 50 |
| wrap-around legs (trousers) | 141: none in the portrait (it stops at the chest), 3 chibi facings for every body (the chibi's legs are the same on all), 3 body types x 46 battle frames |

Each item also has one bag picture (`gfx/items/`): boar meat, hide and tusk, a wolf pelt and fang, a lurker scale, the
old stick, the swords, the skillbook, each monster's essence (one bead, in six colours), a bog pearl and the sigils
(one stone disc with a rune ring, glowing in its tier's colour). Of what's worn, only the
sword shows on the character, in the
arena: a 3D blade at the hand that holds it (`visuals/battle/blade.ts`), so the arena's frames are painted without it
(the art lab still draws `SWORD`). In the left hand the body is the right-handed frame flipped (a swing uses its
mirror image's), so it needs no drawings of its own.

Adding a body type adds a full set to every wrap-around piece (50 for a chest piece); adding a view or chibi facing
adds one per body type to each, and one to every hair style and helmet; adding a battle facing adds one per pose and
body type to each (23 per body type), one to every hair style and helmet, and 23 to every held piece; adding a
battle pose (every animation frame is one) adds two per body type to each, one from each side, and two to every held
piece. Face shapes, hair styles, eye and
mouth types add only their own row.

### How a character is built

Everything you can see on a character is an `Art` (`gfx/look/art.ts`): for each view (the chibi's and the battle
sprite's for each way it faces: `{ portrait, chibi: { front, back, side }, battle: { back, front } }`), one draw
function per layer it shows up on. The body
is an Art, so is each hair style, eye type, mouth and piece of clothing. A picture draws every Art layer by layer,
bottom to top:

```
hairBack, body, legwear, footwear, torsowear, weapon, arms, armwear, head, face, hair, headwear
```

then outlines every layer except `face` (eyes, brows and mouth carry their own lines) and colors it.

A picture is a `Sketch` (`look.ts`: `portraitSketch`, `chibiSketch`, `battleSketch`): its view, the body's frame,
the colors and each Art's piece named by its part (`base`, the body with its face shape; `hair`, `eyes`, `mouth`;
each piece of wear by its name in `STARTER_CLOTHES`; `weapon`). `render` draws it, or only some of its parts;
`renderParts` cuts it into a picture per part per layer it draws on, which stacked are the picture pixel for pixel,
each keeping what later parts cover. The art lab opens looks in parts with it.

- **One head, a few face shapes, a few body types.** Everyone shares the cranium, the ear and the rows the features
  sit on; face shapes (`head.ts`: soft, sharp, square) only change the jaw, so every hair style and eye fits every
  face. Below the head, each body type (`body.ts`: skinny, medium, wide) is a `Frame`: the same named shapes (neck,
  torso, arms, legs) and landmarks (`middle`, `collarY`, `chestY`, `armpitY`, `waistY`, `shoulders`) in every
  type. Every draw is handed the frame. The battle sprite's frame (`BattleFrame`) adds hands, feet, the boots'
  `shins`, where the head has moved to (`head`) and the sword's grip and tip; a pose is that frame with its shapes
  moved, so whatever is drawn against it follows the pose.
- **Gear is drawn against the frame, never at fixed pixels**: a tunic is the torso grown by a pixel, its V-neck
  is cut at `middle`, shoulder guards sit on `shoulders`; `columns()` measures the body where gear needs a width.
  That's what makes one drawing fit every body type, so adding a body type doesn't mean redrawing items. Keep body
  types few anyway: each is another shape gear must look right on. This holds for today's code-drawn pieces, which
  fit every body through its `Frame`; future artist-drawn wrap-around pieces would be one drawing per body type
  ([plan/art.md](plan/art.md)), which is why [What to draw](#what-to-draw) counts 150 for a chest piece.
- **The portrait is traced from Stable Diffusion** (SD 1.5 with the jrpg-v1 pixel LoRA at 1000 steps). The base is
  one bald, faceless bust in a sleeveless bodysuit (medium build, soft face; the face wiped). Every other option is
  that base repainted inside a mask (inpainting), so they all line up on it: the shoulders down for a body type, the
  lower head for a face shape (from a rough jaw sketched in, which Stable Diffusion redraws: on its own it keeps the
  base's chin), the hair, the eyes with their brows, the mouth. The pictures and masks are in `client/art/sd/`.
  `client/scripts/trace-portraits.ts` (`npm run trace -w @infinite-tower/client`) turns them into tone grids in
  `base.ts`: each pixel's material and tone is the nearest of the colors it reads them by (the base's own skin and
  bodysuit colors; for hair and eyes, the ramp the picture fits best, the hair recentred on its base tone), and Stable
  Diffusion's black outlines become each material's darkest tone. A part is what its picture changed inside its
  mask; hair outside the base's outline is the back layer (under the body, so a wider body covers it), hair over it
  the front, skin it darkened its shadow, and the bald crown it painted over with background is cut away. The body
  layer holds the skin and the bodysuit (the portrait's clothing: the tunic doesn't show there), and the frame gear
  is drawn against is read off it (`body.ts`). Traced grids carry their own outlines (`pen.traced`), so the outline
  pass leaves them alone. A test fails if `base.ts` isn't what the script makes of the pictures, or if a part, drawn
  alone on the base, strays from its picture. Don't edit `base.ts`: change a picture and run the script.
- **Clothes, the chibi and the battle sprite are shapes**: polygons, ellipses, `taper()` for a pointed
  lock. Shading is done the same way every time: fill with the base tone, then retone parts of it (the far side, a
  band of light).
- **Casting shadows**: a layer can darken the layers under it (`pen.castShadow`), as bangs do on the forehead and
  the jaw on the neck.

### Adding things

- **A look option** (hair style, eye type, mouth, face shape, a color): add its id to `LOOK_OPTIONS` in
  `shared/src/character/character.ts` (the server checks against it, the creation screen lists it), then its Art
  to its list (`HAIR_STYLES`, `EYE_TYPES`, `MOUTH_TYPES`, `FACE_SHAPES`) with a piece for every view and chibi
  facing, or its ramp to `palette.ts`. Its portrait is a picture repainted on the base in its part's mask, saved as
  `client/art/sd/<part>-<option>.png` and traced (above). Until the art exists it won't compile.
- **Gear**: a new Art drawing on the layers of its slot (a chest piece: `torsowear`, maybe `armwear` for
  shoulders), against the frame it's handed. Fixed materials make it look the same on everyone; use `cloth` only
  for things the player dyes. `jerkin.ts` is the example.
- **A body type**: a new entry in `BODY_TYPES` with every frame field, for every view and chibi facing
  (`battleFrames` builds the battle poses from a few widths). Then check every piece of gear on it.
- **A battle pose**: a name in `POSES` and its frame in `battleFrames` (`battle.ts`), then its frame count in
  `BATTLE_FRAMES` (`visuals/characters.ts`): it's keyed by pose, so it doesn't compile until it's there, and the
  arena's materials and their painting follow it. `visuals/battle/pose.ts` picks the pose and its frame. A sword-fight
  pose: its name and frame count in `SWORD_POSES` and its frames' keys in `moves.ts` (hands and sword tip from the
  shoulders, and `front` where the front needs other ones). Check it from the front too.
- **Check it** in the art lab: `npm run art`, then http://localhost:5175. Its Characters tab shows every option, the
  portrait, the chibi facing each way, the battle sprite in each pose and every sword-fight frame, the sample jerkin
  on and off, a mock dialogue and a crowd of random looks. The battle sprite is shown from behind and the front,
  with the sword in either hand. Under the first portrait, each Stable Diffusion picture beside its part traced
  (drawn alone on the base, in the picture's colors and in yours), then every body type with every hair style, eye
  type, mouth and face shape.

### Don'ts

- No pure black, no pure-white outlines, no colors outside a ramp.
- No half-pixels: shapes are tested at pixel centers, grids are whole pixels.
- No front-facing portraits: the three-quarter view is what makes a 64x64 face look alive.
- No per-character art for gear, and no gear that only fits one hair style or one body type: today one drawing per
  view fits everyone; hand-drawn wrap-around gear would be drawn per body type ([plan/art.md](plan/art.md)).
- No bright, clean, saturated clothes or shiny new metal: this world is old and worn.

## Other art

- **Title screen**: a low-poly, cartoony tower with shader-like lighting, drawn on a 2D canvas
  (`ui/screens/title/backdrop/`): dark-fantasy night around a glowing white and gold tower.
- **World and arena**: code-drawn too (`gfx/`): pixel sprites for the overworld and the player in the arena, simple 3D
  models for enemies.
- **Items** (`gfx/items/`): one picture per item for the bag, 16 x 16 pixels per cell it covers, lying flat (a
  turned item is the same picture turned on screen). Same pixel kit and rules as the characters: lit from the top
  left, outlines in the material's own dark, greyed colors, with raw meat the one rich red.

## The pixel editor

The art lab (`npm run art`, http://localhost:5175, the Pixel editor tab) draws art by hand: nothing it makes goes
into the game yet, and nothing is kept in the browser, so save the drawing as a file.

- **Canvas**: the game's view sizes (portrait 64x64, chibi 32x32, battle 64x64, from `VIEWS`) or any size up to
  512x512. The mouse wheel zooms a step a notch (a trackpad swipe steps once, then again only as it goes on), as do
  + and -; the middle or right button, Space held, or the Pan tool drags it about; a grid shows from 6x, stronger
  every 8 pixels.
- **Tools**: pencil (B), eraser (E), fill (G: the touching pixels of one color), eyedropper (I: from what shows),
  line (L), rectangle (U: filled with Shift or the checkbox), and select (M), whose box moves what's under it on the
  layer when dragged from inside. While there's a selection, drawing stays inside it. Ctrl (or ⌘) + C, X and V copy,
  cut and paste it; a paste, or a selection being moved, floats over the layer until something else is drawn, so it
  passes over what's under it. The arrows nudge it (Shift: 8 pixels), Delete clears it, Ctrl+A selects everything,
  Esc or Ctrl+D drops the selection; it can also be moved to a new layer or cropped to. Ctrl+Z undoes, Ctrl+Shift+Z
  or Ctrl+Y redoes, 100 steps. These keys are the lab's own and fixed (the game's keys come from its bindings), and
  they do nothing while typing in a box.
- **Colors**: every ramp in `palette.ts`, swatch by swatch, and any other color from a picker.
- **Layers**: body, outfit, head, face and hair to start, plus free ones; each can be shown or hidden, renamed,
  moved up or down, faded, deleted and exported on its own.
- **Your own sprites**: Open PNG (or PNGs dropped on the canvas) opens them pixel for pixel as a new drawing: no
  resizing, no blur, no snapping. Given a cell size, a sheet is split into frames (or tiles, in the Tiles mode),
  left to right then down, leaving out the empty cells it ends with; several PNGs at once become frames or layers,
  each at the top left of the biggest.
- **Importing a photo** (Import photo, or another kind of image dropped on the canvas): fitted inside the canvas,
  filling it cropped, or stretched; scaled smoothed or nearest-neighbour; and snapped to the game's ramps (pixels under
  half opacity dropped) so it reads as this game's art. It lands on a new layer, to trace over or paint into by hand.
  "Add the look's picture" puts the Characters tab's look on a layer the same way.
- **Tiles** (the Tiles mode): a tile is the overworld's tile size, 16x16 (`PX_PER_TILE`, `client/src/gfx/grid.ts`),
  with a ground and a detail layer to start. The preview repeats it 3x3 so seams show, and "Shift by half" wraps it
  round by half its size to bring the edges into the middle to paint them. A tileset is several tiles, each named,
  sharing their layers (a new tile is blank, Duplicate copies one); Export sheet makes one PNG, 8 tiles a row, and a
  JSON of the tile size (`width`, `height`) and each tile's name and place on the sheet (`tiles`).
- **Animations** (the Animation mode): frames of one size sharing their layers, in a strip like the tileset's (a new
  frame is blank, Duplicate copies the one you're on). Onion skin shows the frame before (faint) and after (fainter)
  under the one you're drawing. Play loops the frames in the preview at the set fps (8 to start, 1 to 60), while
  the canvas stays editable. Export sheet makes one PNG, 8 frames a row, and a JSON with the frame size, the fps and
  each frame's name and place (`frames`).
- **Templates**: New from template starts a drawing from the art the game draws today, drawn by the game's own code:
  the portrait in each body type and face shape, the chibi facing each way, the battle sprite in every pose (its
  frames as an animation), the NPCs' portraits, the enemies' overworld sprites, each level's tiles as a tileset, the
  props and the items; and from any saved drawing, as a copy. A character comes in parts, a layer each (`renderParts`
  above): the bare base, the hair, the eyes, the mouth, each piece of clothing and the sword. A part the game draws
  on several of its layers with others between (the hair behind the head and over it, the tunic under the arms and
  its sleeves over them) gets a layer for each, named for it: `hair (hairBack)`, `hair (hair)`. Stacked, the layers
  are the game's picture; hiding one shows what's under it whole.
- **A part alone**: New part opens one part (the base, a hair style, an eye or mouth type, a piece of wear, the sword)
  on a clear canvas, in the portrait, the chibi's facings or one battle pose's frames, on the picked body type and
  face shape, in the Characters tab's colors. Its export is just the part.
- **Underlay**: a base model under the canvas to draw over: never a layer, never exported, saved with the drawing.
  It's any of the pictures above that fits the canvas, on a picked body type, face shape and skin, bare or with a
  hair style and the clothes on; an animation's frames each get their own (the chibi's facings, a swing's frames).
  "Every body, tinted" draws the three body types at once, each its own color, to check a part fits them all. It
  has its own opacity, and H shows or hides it. A part opened alone comes with the bare base under it.
- **Saving**: Save (Ctrl+S) writes the drawing, under the name in the box, into `art-lab/files/` as `name.json` (its
  mode, every page, every layer's name, whether it shows, its opacity, its pixels, and the underlay) and `name.png`
  (the picture, or every page as a sheet), and downloads the PNG too. The folder is meant to be committed;
  `ART_LAB_FILES_DIR` in .env points it elsewhere (a lab run from another copy can save into the main checkout). Open
  lists what's there. There's no autosave. Without the dev server (a built lab) Save only downloads.
- **Out**: the whole picture as a PNG, each layer as its own, a sheet, and the project's JSON as a download; Open
  file loads a JSON back, switching to its mode (a dropped .json opens too). Each mode keeps its own project while
  you switch between them.
