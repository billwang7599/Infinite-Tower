# ART.md

How the game's art should look, and how to make it. Read this before drawing anything. All art is code: there are
no image files, and nothing is painted by hand outside the source.

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
- **The jaw in three-quarter view**: the cheek runs back to the ear, the far cheek stays full down to the mouth,
  and the jaw's corner sits under the ear at mouth level. From there a short, flat jawline runs forward to a small
  rounded chin, with a row or two of straight edge at its tip. A jaw cornered up at the nose, falling in one
  straight diagonal to a point, reads as a kite, not a face.
- **Smooth curves.** Along a curved edge the steps between rows grow or shrink steadily (a jaw's far side moves
  0, 0, 1, 1, 1, 2, 2 pixels a row toward the chin). A step that jumps then stalls (1, 2, 0) shows as a notch.

### Views

Every character is one look drawn several ways. All views have a transparent background.

| View | Size | What it's for |
| --- | --- | --- |
| portrait | 64x64 | head and shoulders, three-quarter view; dialogue (speaker lit, listener dimmed) and creation |
| chibi | 32x32 | the world, about 1.7 heads tall; front, back and side (facing left), one per way it walks |
| battle | 64x64 | the arena, from behind, sword in hand; the figure is 48 wide, the sides are room for the sword |

The battle sprite is only ever seen from behind: the arena camera sits behind the player, who always attacks where
it looks. It has a picture per pose (`battle.ts`): stand (also running), slash (sword arm out to our right; it's
never mirrored, and every swing's trail starts on that side) and down (knelt, slumped, sword dropped). From behind
the head is all hair, so face shapes, eyes and mouths draw nothing there.

The chibi turns the way it walks: down the screen shows the front, up the back, a side the side view (the game
mirrors it for the other side). Front and back share a body outline; from behind there's no face, and the side
shows only the near eye. A diagonal keeps the way it was already facing, so it doesn't flicker.

Coming later: a chibi walk cycle, and portrait expressions for dialogue.

### Colors

Every material is a ramp of six tones: outline, deep, shadow, base, light, shine (`gfx/look/palette.ts`).
Pictures record which material and tone each pixel is, and are only colored at the end, so a new hair color is a
new ramp and nothing else. Ramps a player picks: skin, hair, eyes (iris), outfit (cloth) and accent; cloth and
gear stay near-neutral, the accent goes on small trims only. Fixed ones everyone shares: eye whites, lash lines,
mouth, blush, linen, wool, leather, brass, steel. Gear adds its own (iron, silk...).

### How a character is built

Everything you can see on a character is an `Art` (`gfx/look/art.ts`): for each view, one draw function per layer
it shows up on. The body is an Art, so is each hair style, eye type, mouth and piece of clothing. A picture draws
every Art layer by layer, bottom to top:

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
  types few anyway: each is another shape gear must look right on.
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
  to its list (`HAIR_STYLES`, `EYE_TYPES`, `MOUTH_TYPES`, `FACE_SHAPES`) with a piece for every view, or its ramp
  to `palette.ts`. Until the art exists it won't compile.
- **Gear**: a new Art drawing on the layers of its slot (a chest piece: `torsowear`, maybe `armwear` for
  shoulders), against the frame it's handed. Fixed materials make it look the same on everyone; use `cloth` only
  for things the player dyes. `jerkin.ts` is the example.
- **A body type**: a new entry in `BODY_TYPES` with every frame field, for every view (`battleFrames` builds the
  battle poses from a few widths). Then check every piece of gear on it.
- **A battle pose**: a name in `POSES` and its frame in `battleFrames` (`battle.ts`), then a sprite frame for it
  (`gfx/characters.ts`).
- **Check it** on the dev page: `npm run dev`, then http://localhost:5173/art.html. It shows every option, every
  view and battle pose, the sample jerkin on and off, a mock dialogue and a crowd of random looks.

### Don'ts

- No pure black, no pure-white outlines, no colors outside a ramp.
- No half-pixels: shapes are tested at pixel centers, grids are whole pixels.
- No front-facing portraits: the three-quarter view is what makes a 64x64 face look alive.
- No per-character art for gear (one drawing per view fits everyone), and no gear that only fits one hair style or
  one body type.
- No bright, clean, saturated clothes or shiny new metal: this world is old and worn.

## Other art

- **Title screen**: a low-poly, cartoony tower with shader-like lighting, drawn on a 2D canvas
  (`ui/screens/title/backdrop/`): dark-fantasy night around a glowing white and gold tower.
- **World and arena**: code-drawn too (`gfx/`): pixel sprites for the field and the player in the arena, simple 3D
  models for enemies.
