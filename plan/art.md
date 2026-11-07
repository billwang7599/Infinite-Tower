# Art that can grow, and the art lab

Status: **later**. The user: "add it as a plan. for now, we'll just go with the code-first approach." All art stays
drawn in code (ART.md). This is the plan for cooler gear, more animation, and hand-drawn gear and bodies once there's
an artist, without the art becoming a pile of special cases. Nothing here is scheduled.

## Where it stands

- Everything on a character is an `Art` (`client/src/gfx/look/art.ts`): per view, a draw function per layer. Gear
  draws against the body's frame, so one drawing fits every body type.
- Hand-drawn pixels already exist as letter grids (the portrait's hair, eyes and mouths).
- Weaknesses to fix first: a missing view fails silently (the piece just vanishes); some pieces draw at fixed sizes
  and columns instead of the frame's; every hair style draws in full, so a helmet would have to hide all of it; only
  the starter clothes are worn (there's no equip code for looks).

## Decided by the user

- **A human artist draws the hand-made art**, not the agent, in a pixel editor such as Aseprite, in a fixed palette,
  on templates the game exports.
- **New gear is pictures**, uploaded by the artist; today's code-drawn pieces stay code until pictures replace them,
  and both draw into the same picture. A material palette (each reserved colour means one material and tone), a
  loader that turns a picture into the same material and tone pixels the code paints (so dyes, outlines and layers
  keep working; a colour off the palette is an error), and landmarks a picture is pinned to.
- **Never stretch.** A picture is never scaled to a body. Pieces on the head or hands, or held, are one picture per
  view pinned to a point; rigid pieces on the body sit at each body's landmark; wrap-around pieces are drawn per body
  type, view and pose, on artist templates (the bare body faint underneath, landmarks marked).
- **Hair shows under helmets**: a helmet hides only the hair inside its mask, so bangs and long hair still show.
- **Battle animation from a skeleton** of joint angles. Pinned pictures attach to a bone, drawn at a few angles,
  never rotated in code (rotating pixel art smears it); every frame is redrawn into one sheet when the look changes.
- **Hand-drawn bodies later**, as layers (body, face shape, eyes, mouth, hair stay separate), in the reserved colours,
  with their landmarks supplied by the picture or a data file. How the body animates is decided first. Order: the
  portrait, then the chibi, then battle.
- **Levels stay in code** for now ("maybe i can make levels by code level changes, that might be fine too"); a level
  editor may come later, nothing decided.

## Order of work

1. Every piece in every view, no fixed sizes: a test that fails where a piece draws nothing; views required by type.
2. Picture-backed pieces: the palette, the loader and template export (one feature), landmarks on every frame, the
   hair mask, one sample helmet. ART.md then gets the artist's how-to.
3. The battle skeleton, pixel-identical to today's poses or with differences the user approves.

## The art lab: what's next

The lab (ART.md) draws sprites, tiles and animations and saves files; nothing it makes is in the game yet.

- **Wiring drawings into the game**: loading exported sheets instead of code-drawn art. First step: a part drawn in
  the lab (a layer per game layer, as New part makes them) replacing that part's code-drawn piece, so a new hair style
  or tunic can be drawn instead of coded.
- **Tiles that join**: edge and corner variants and a preview of tiles side by side (the game paints edges in code).
- **Animations**: a duration per frame, and playing them on the canvas, not only in the preview.
- **Selections**: flip and rotate; copying between drawings through the system clipboard; pastes on their own layer.
- **The underlay** is drawn under every layer, so hair drawn over the head hides the face; it could sit at the base's
  place in the stack. Enemies' 3D models, the campfire and arena looks need Babylon and aren't templates.

## Open

- Animation per view: frame by frame (best look, drawings multiply), a baked skeleton (gear per body part, no new
  drawings per animation) or limbs rotated live (smooth but blurry: not recommended); and whether wrap-around gear is
  drawn per frame or per body part. The agent's suggestion: the portrait blinks and talks, the chibi gets a short
  frame-by-frame step, battle the baked skeleton.
- The picture format: the user said "png or svg or something"; pixel art is naturally a PNG at the view's size.
- Gear mechanics, for the user: stats, weight per piece, durability, colours (fixed or a dyeable accent), which slots
  get hand-drawn art first.
- For whoever builds it: drawing is synchronous and tests run without Vite, so pictures become checked-in modules or
  are decoded before the first draw; capes, belts and gloves need layers or landmarks of their own.
