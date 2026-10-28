# Character art that can grow

Status: **later**. The user: "add it as a plan. for now, we'll just go with the code-first approach."

**Current approach: code-first.** All art stays drawn in code, as [ART.md](../ART.md) describes: no image files.
Everything below is a plan for later: cooler gear, more animation, and hand-drawn gear and bodies once there's an
artist, without the art becoming a pile of special cases. Nothing here is built or scheduled. The decisions below
are the user's; the open questions at the end need the user's say before they're built.

## Where it stands

- Everything on a character is an `Art`: per view, a `(pen, frame)` draw function per layer
  (`client/src/gfx/look/art.ts`). Gear draws against the body's `Frame`, so one drawing fits every body type:
  `TUNIC` in `outfit.ts`, `LEATHER_JERKIN` in `jerkin.ts`.
- Body types are skinny, medium and wide (`BODY_TYPES` in `body.ts`). They differ from the neck down (the neck's
  width too, in the portrait and battle). The head is the same on every body: it reads nothing from the frame but
  the battle pose's `head` offset, which no body type changes. Face shapes (soft, sharp, square) differ only at the
  jaw (`head.ts`). The portrait's widths are 0.86 and 1.1 times medium, but the code scales the outline's points
  and then fills pixels, so its edges stay clean.
- Hand-drawn pixels already exist as letter grids: the portrait's hair, eyes and mouths (`pen.grid` with a legend
  of material and tone, `hair/index.ts`, `face.ts`).
- The battle poses are hand-set numbers: stand, slash and down per pose in `battleFrames` (`battle.ts`; slash's
  shoulder and hand points, down's `shift(mask, 0, 9)` and `head: [0, 14]`, each pose's sword ends), and the sword
  fight's frames as keys from the shoulders in `moves.ts`.

### Weaknesses to fix

- **A missing view fails silently.** `Art`'s views are optional (`art.ts`), `look.ts` reads `art.chibi?.[facing]`
  and `render` skips what isn't there, so the piece is just invisible. `LEATHER_JERKIN` has no chibi back or side
  and no battle piece: it vanishes when the chibi turns, and in the arena. `client/test/gfx/look.test.ts` checks
  that each picture has something drawn, not that each piece is in it.
- **Fixed sizes.** `backCollar` scans the neck across 64 columns (`outfit.ts:25`); `TUNIC` draws rows as
  full-width `rect(0, y, 63, ...)` in battle (`outfit.ts:111, 119, 120`) and `rect(0, y, 31, ...)` on the chibi
  (68, 79, 81, 95), with `columns(..., 32)` (93, 97); chibi shading splits at fixed columns (`x >= 17`, `x >= 16`:
  `outfit.ts:66, 74, 86`, `jerkin.ts:35`) and brass dots sit at x 15 and 16 (`outfit.ts:69-70`, `jerkin.ts:36`)
  instead of at `middle`.
- **No hair hiding.** Every hair style draws in full (`hair/index.ts`), so a helmet would have to cover all of it.
- **Only the starter clothes are worn.** `lookArts` defaults `wear` to `STARTER_CLOTHES` (`look.ts`), and
  `playerFrames` (`gfx/characters.ts`) and `ui/components/LookPicture.tsx` never pass anything else. The jerkin
  shows only in the art lab (`dev/art-lab.ts`). There's no equip code anywhere.

## Decided

For when hand-drawn art starts. Until then everything stays code (above).

### A human artist draws the hand-made art

Not the agent. Design for an artist working in a pixel editor such as Aseprite: pictures in a fixed palette,
drawn on templates the game exports. How much there is to draw is in ART.md's
[What to draw](../ART.md#what-to-draw).

### New gear is pictures

New gear is drawn by the artist and uploaded as a picture (the format is open, below). The code-drawn pieces
that exist today (`TUNIC`, `TROUSERS`, `BOOTS` in `outfit.ts`, `LEATHER_JERKIN`) stay code until pictures replace
them; both kinds draw into the same picture, so they can be worn together. Code shapes with picture details on
top are not the default.

- **Material palette.** Each reserved color means "material X, tone N" (a ramp's six tones, `palette.ts`). The game
  writes the palette file for the editor from `palette.ts`; where two tones share a color (white's light and
  shine), one is nudged so every color means one thing.
- **Loader.** It turns a picture into the same material and tone pixels the code paints, so dyes (`cloth`,
  `accent`), the outline pass and layer order keep working. A color outside the palette is an error, not a
  guess. As with the hair grids, the artist leaves the silhouette's outline to the outline pass.
- **Landmarks.** A picture is pinned to a point on the frame: top of the head, a shoulder, a hand, the chest's
  middle, the waist. The frame has some of these (`shoulders`, `middle` with `chestY` and `waistY`); the rest
  become named points on every frame. One picture per layer the piece draws on.

### Fitting body types: never stretch

Scaling a picture by 0.86 drops about one column in seven, by 1.1 doubles one in ten, and its lines go lumpy. So
pictures are never scaled to a body; they fit by kind of piece:

| Kind of piece | Examples | How it fits |
|---|---|---|
| On the head or hands, or held | helmet, gloves, a weapon | one picture per view (a weapon: per angle it's held at), pinned to a point (top of the head, a hand); the same on every body |
| Rigid, on the body | shoulder guards, buckle, chest emblem | the same picture per view, placed at each body type's landmark |
| Wraps the body | breastplate, coat, trousers | the artist adjusts it to each body type: one picture per body type, view and battle pose |

So a helmet is 5 pictures and a wrap-around chest piece 114 (3 bodies x 38), and every body type, view, facing or
pose added multiplies the wrap-around ones: the counts are in [What to draw](../ART.md#what-to-draw).

**Artist templates**: one per body type x view (x battle pose), the bare body faint underneath and the
landmarks marked; wrap-around gear is drawn on them. The art lab can make them with the existing renderer and
download them; no new packages. The artist draws on a layer above, hides the template, and exports. A pinned
picture is drawn on the medium template, and the loader keeps it relative to its landmark, so it moves with that
landmark on the other bodies.

### Hair shows under helmets

A helmet hides only the hair inside it (a mask per view), not all hair: bangs below the brim, a ponytail and long
hair still show. The hair layers (`hairBack`, `hair`) don't draw inside a worn piece's mask; in a picture the
mask is one more reserved color, "no hair here", that draws nothing. An earlier mockup outside the repo
(`/tmp/art/mock/kit.ts`, `hides`) cleared hair under the mask before drawing headwear.

### Battle animation from a skeleton

- A small skeleton of joint angles replaces the per-pose numbers: shoulders, elbows, hands, hips, knees, head,
  sword. A frame is a set of angles; the body's shapes and landmarks are computed from the joints (`limb()` in
  `battle.ts` already draws a limb between two points). Code gear draws against the frame as now, so it follows.
- Pinned pictures attach to a bone and are drawn at a few angles; the nearest one is used. Never rotated in code:
  rotating pixel art smears it. Wrap-around pictures are drawn per frame, on that frame's template.
- When the look changes, every frame is redrawn (not rotated copies) into one sprite sheet. Today each frame is its
  own material (`player` in `modes/battle/materials.ts`), all 34 repainted by `applyLook` (`game/game.ts`).
- Not chosen now: limb textures rotated in Babylon (loses the crisp pixel look); rendering a 3D model as pixels,
  Dead Cells style (a separate pipeline; only if animation gets very ambitious).
- Portraits are the easiest place to go fully hand-drawn: one view, no animation.

## Hand-drawn bodies (later, once there's an artist)

Eventually the body is hand-drawn too: a code body under artist-drawn gear would clash in style, and the body is
where code art looks worst (the chin, the neck, tube arms). Until there's an artist, the code body is the
placeholder, and it's the template the artist draws over.

- **Layers, not whole characters.** Body, face shape, eyes, mouth and hair stay separate pictures, so the options
  still mix. The counts are in [What to draw](../ART.md#what-to-draw): 38 per body type, 2 per face shape (the
  chibi's back and side of the head are shared by all), 3 per eye type, 2 per mouth, 5 per hair style.
- **Reserved colors.** Drawn in the material palette above: skin in the six tones of `skin`, clothes in `cloth`,
  hair in `hair`, and so on, so the player's skin, hair and dye picks still recolor it.
- **Landmarks come with it.** Today the code computes them: each body type's `Frame` (`art.ts`, filled in by
  `body.ts`) has the collar, chest, armpit and waist rows, the breastbone's column, the shoulders and the neck, and
  gear fits to them. A drawn body has to supply them: marker pixels in the picture, or a small data file per body
  type and view. Code gear still worn alongside it (the tunic is the torso grown by a pixel) also reads the
  frame's shapes (`neck`, `torso`, `arms`, `legs`), so those must come with it too.
- **Animation first.** How the body is cut up depends on how it animates ([below](#animation-open)): whole
  frames, or parts on a skeleton. So that's decided before the body is drawn.
- **Order**: the portrait's face and hair first (the biggest payoff: one view, no animation), then the chibi, then
  battle once its animation is decided.

## Animation (open)

Not decided, apart from the battle skeleton above. Today there's hardly any:

- The overworld chibi has one picture per facing (the two sides share one, mirrored). Walking is a small hop: the
  sprite moves, the picture stays the same (`modes/overworld/systems/sprites.ts`).
- The battle sprite plays the sword fight's frames (a wind-up, strike and follow-through per swing; the stab, block
  and stagger) and stands or kneels in single stills. It bobs, squashes and stretches by moving and scaling the
  sprite, and the swing's arc is a separate effect, the sword trail (`modes/battle/player/sprite.ts`).

Three ways to animate:

| Approach | How | Cost |
| --- | --- | --- |
| Frame by frame | the artist draws every frame | the best look, but drawings multiply: a 4-frame walk x 3 facings x 3 body types is 36 drawings per chest piece, for walking alone |
| Skeleton, baked | an animation is a list of joint angles. When the game loads, the parts are placed on the joints and each frame is drawn once into a sprite sheet. Hand-drawn limbs are drawn at a few angles and the nearest is used, never rotated | gear is drawn per body part, not per frame, so a new animation needs no new drawings |
| Limbs rotated live in Babylon | each limb is its own texture, rotated every frame | smooth and unlimited, but rotated pixel art goes jagged or blurry. Not recommended |

The battle skeleton decided above is this second way, with one difference: there, wrap-around pictures are drawn
per frame, on that frame's template, and What to draw counts them that way; here, gear is drawn per body part.
Which one holds is open.

A suggestion, per view:

- **Portrait**: just a blink and a talking mouth, a few frames of the eye and mouth layers.
- **Chibi** (32x32): frame by frame, kept short: a step of 2 to 4 frames. The legs are the same on every body
  type, so it stays cheap, and code can add a 1-pixel bob.
- **Battle** (64x64): the baked skeleton.

At runtime all three end the same way: each character's sprite sheet is drawn once when it loads, and the game
picks a frame each tick. Nothing is redrawn per frame. That's true today too: the sprites are drawn once (and again
when the look changes: `game/game.ts`), and the per-frame code only moves them and swaps their materials.

## PNG export and artist templates (not built)

How it would work. Every character drawing is already a grid of pixels before it reaches the GPU (`Pixels` in
`pixels.ts`: each pixel's material, tone and layer), so a small script can call the draw functions for every
option and write PNGs. Two kinds:

- **Finished pictures**, colored, for looking at the art.
- **Artist templates**: the body in the reserved colors, one PNG per layer, the landmarks marked. The artist draws
  gear on top (in Aseprite, say), with the body's layers faded or hidden, and sends PNGs back.

Loading is the same mapping the other way round: a reserved color back to its material and tone. So template
export and the picture loader are one feature: step 2 below, picture-backed pieces, which already has template
export from the art lab ([Artist templates](#fitting-body-types-never-stretch) above).

## Order of work

Code-first for now (top), so none of these is scheduled. Each step is its own PR, test-first
([AGENTS.md](../AGENTS.md)).

1. **Every piece in every view, no fixed sizes.** A test draws each worn piece on every body type in every view,
   facing and pose, and fails where it draws nothing. Views become required in `Art`'s type, with `{}` saying
   "nothing here" (trousers in the portrait, faces in battle), so the compiler catches a missing one too. Draw the
   jerkin's missing views. Replace the fixed sizes with the picture's size (`Pen` has `width`; add `height`) and
   the frame's `middle`.
2. **Picture-backed pieces.** The material palette, the loader and template export (one feature, see
   [PNG export](#png-export-and-artist-templates-not-built)), landmark points on every frame, the hair mask, and
   one sample hand-made helmet (placeholder art until there's an artist). ART.md gets the artist's how-to and stops
   saying all art is code.
3. **Battle skeleton.** Remake the battle poses from joint angles, pixel-identical to today's or with the
   differences approved by the user on art.html. Then the sprite sheet, then new frames.

## Open questions

Gear mechanics, for the user (see "Ask before deciding any game mechanic" in AGENTS.md):

- **Stats**: does gear change anything in play, or is it looks only for now?
- **Weight**: worn gear already counts toward the carry limit without taking bag space (AGENTS.md); how much does
  each piece weigh?
- **Death**: dying empties the bag; is worn gear lost too? ([inventory.md](inventory.md) asks the same of the
  sword.)
- **Durability**: does gear wear out?
- **Color**: per piece, fixed colors or a dyeable accent?
- **Slots**: which get hand-drawn art first. The slots for now: helmet, chest, cape, belt, pants, boots, gloves.

Also for the user:

- **Animation**: which approach for each view, and whether hand-drawn gear is drawn per frame or per body part
  ([Animation](#animation-open)).
- **Picture format**: the user said "png or svg or something". Pixel art is naturally a PNG at the view's own size
  (64x64, 32x32), one pixel per pixel; an SVG would have to be snapped to the pixel grid when it's loaded, and
  shapes off the grid come out lumpy, as stretched pictures do.

For whoever builds it:

- Drawing is synchronous today (`drawBattle` returns a picture) and tests run in Node without Vite, so either a
  script turns each picture into a checked-in module, or the pictures are decoded once before the first draw.
- Slots to layers (`LAYERS` in `art.ts`): a cape has no layer yet (behind the body from the front, over it from
  behind), the belt is drawn inside the tunic's `torsowear` today, and gloves would go on `armwear` over `hands`.
  The chibi has no hands of its own (they're the ends of `arms`, as thick as the body type's arm: `body.ts`), so
  gloves there need a hand landmark first.
- Equipping (where worn gear comes from, and passing it to `playerFrames`) is its own feature, after the
  questions above.
