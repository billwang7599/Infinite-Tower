# ART.md

How the game's art should look, and how to make it. Read this before drawing anything. All art is code: there are
no image files, and nothing is painted by hand outside the source. Hand-drawn art from an artist is a plan for later
([plan/art.md](plan/art.md)); for now it stays code-first. [What to draw](#what-to-draw) says how much there would
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
- **Face rows** (portrait): lashes on row 21, the lower lid 27, nose 30, mouth 33, chin 39. Shoulders start at row
  45, so a short neck shows under the jaw: a long one makes the head look stuck on, none makes it look sunk in.
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
| portrait | 64x64 | `drawPortrait(look)` | head and shoulders, three-quarter view; dialogue (speaker lit, listener dimmed) and creation |
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
the light's); three guards of a frame each, the blade held up on the left, level over the head, or up on the right;
a stagger; and a guard break's grab, the free hand reaching ahead and the sword held low. A wind-up cocks the elbow, a follow-through straightens the arm. Nothing is mirrored: the sword stays in the
right hand. Seen from behind and above, a blade pointing away is short and points up the screen, and what's in front of
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
| battle | 64x64 | 48: stand, slash, down, and 21 sword-fight frames, from behind and from the front | in code the front's outline is the back's mirrored, but what's on it is drawn for the front |

So something seen in every view and pose is 52 drawings. The axes that need drawings of their own:

| Axis | Options | Each option needs |
| --- | --- | --- |
| body type | skinny, medium, wide | its body in every view and pose (52), and its own drawing of every wrap-around piece |
| face shape | soft, sharp, square | 3: the portrait's jaw, the chibi's front jaw and the battle sprite's front jaw (the chibi's back and side, and battle from behind, are shared) |
| hair style | short, bob, long, ponytail | 6: portrait, chibi front, back and side, battle from behind and from the front (one for every pose: it moves with the head). Hair behind the head is a second layer (`hairBack`): in the chibi's front and the battle sprite's, and the portrait's for long and ponytail |
| eye type | round, sharp, sleepy, cat | 4: the portrait's near eye and far eye, one chibi eye (mirrored for the other; facing side shows its first two columns) and one for the battle sprite's front. None facing back or in battle from behind |
| mouth type | smile, flat, grin, cat, pout | 3: the portrait's, the chibi's (facing side shows its first column) and the battle sprite's front. None facing back or in battle from behind |

Gender (boy, girl) changes no art. The head is the same on every body type, and hair, eyes and mouths fit every
face shape, so none of them multiply. In code the battle sprite's front head is the chibi's front one scaled up,
with the chibi's own eyes and mouth, so it costs no drawings yet; drawn by hand it would be its own.

Color only, no drawings: skin (5), hair color (8), eye color (6), outfit dye (6) and accent (6) are ramps
(`palette.ts`), and every drawing recolors with them.

| Piece of gear | Drawings |
| --- | --- |
| on the head (a helmet) | 6: portrait, chibi front, back and side, battle from behind and from the front (one for every pose); the same on every body |
| held (the sword, battle only) | 48: a pose or frame each, from each side, since each holds it at its own angle |
| rigid on the body (a pair of shoulder guards) | 6: a view each, for both shoulders, placed at each body type's landmark |
| wrap-around top (a chest piece) | 156: 3 body types x 52 |
| wrap-around legs (trousers) | 147: none in the portrait (it stops at the chest), 3 chibi facings for every body (the chibi's legs are the same on all), 3 body types x 48 battle frames |

Each item also has one bag picture (`gfx/items/`): boar meat, hide and tusk, the sword and the skillbook. Of what's
worn, only the sword is drawn on the character, in the arena: in the hand that holds it, or not at all. In the left
hand the body is the right-handed frame flipped (a swing uses its mirror image's), so it needs no drawings of its own.

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
  ([plan/art.md](plan/art.md)), which is why [What to draw](#what-to-draw) counts 114 for a chest piece.
- **The portrait's head, face and hair are hand-drawn grids**: rows of letters, one per pixel, each a tone of a
  material (`pen.grid`, with a legend). At 64x64 every pixel shows, so the parts that make a face read (eyes,
  mouth, hair clumps) are placed by hand. Hair grids are full-width rows from the top of the picture, one file per
  style (`hair/`); each eye type is a near-eye and a far-eye grid. The face's outline is a few rows of spans
  (`spans()`). Grids hold tones, not colors, so every grid recolors with the player's picks.
- **Bodies, clothes, the chibi and the battle sprite are shapes**: polygons, ellipses, `taper()` for a pointed
  lock. Shading is done the same way every time: fill with the base tone, then retone parts of it (the far side, a
  band of light).
- **Casting shadows**: a layer can darken the layers under it (`pen.castShadow`), as bangs do on the forehead and
  the jaw on the neck.

### Adding things

- **A look option** (hair style, eye type, mouth, face shape, a color): add its id to `LOOK_OPTIONS` in
  `shared/src/character/character.ts` (the server checks against it, the creation screen lists it), then its Art
  to its list (`HAIR_STYLES`, `EYE_TYPES`, `MOUTH_TYPES`, `FACE_SHAPES`) with a piece for every view and chibi
  facing, or its ramp to `palette.ts`. Until the art exists it won't compile.
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
- **Check it** on the dev page: `npm run dev`, then http://localhost:5173/art.html. It shows every option, the
  portrait, the chibi facing each way, the battle sprite in each pose and every sword-fight frame, the sample jerkin
  on and off, a mock dialogue and a crowd of random looks. The battle sprite is shown from behind and the front,
  with the sword in either hand.

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
