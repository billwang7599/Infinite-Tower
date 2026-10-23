# Infinite Tower

An SAO-style souls-like browser game (in progress). Plan: explore floors on a 2D map; touching an
enemy drops you into a small 2.5D arena fight: 3D monsters, 2D billboard players. Babylon.js + Havok
physics, custom ECS on top.

**Current prototype (single-player):** a 2D grass field with a wandering boar and a patch of tall grass.
Touch the boar (it chases you once it spots you, "!") or walk through the tall grass (12% chance per tile)
and you're pulled into a 2.5D arena fight. Win and that boar is gone (another shows up ~8 s later); die and you
wake up back at the start. Press Enter after the fight to return to the field.
(The earlier tower-climbing platformer is preserved at git tag `tower-platformer`.)

```sh
npm install
npm run dev        # server (:8787) + client (http://localhost:5173, proxies /ws to the server)
npm start          # production: build the client, server serves it + /ws on http://localhost:8787
npm run typecheck  # shared, server, client
```

`?debug` exposes `window.game` and `window.encounter()` (asks the server for a fight; dev server only).

## Controls

**Field:** WASD / arrow keys to walk.

**Arena:** works with keyboard only (laptop) or keyboard + mouse / trackpad, interchangeably.
Click the game to capture the mouse (Esc releases it); until then the keyboard does everything.
Bindings live in `client/src/battle/keys.ts`.

| Keyboard only | Mouse / trackpad | |
|---|---|---|
| WASD | WASD | move (relative to the camera) |
| J | left click / tap | slash (chain by pressing again); **you attack wherever the camera faces** |
| K / Shift | right click / two-finger tap | dodge roll (i-frames; backstep if standing still) |
| ; | middle click (wheel) | toggle lock-on (on at the start of a fight): the camera keeps the enemy in front, so slashes aim at it |
| H / L (or ← →) | move the mouse | turn the camera by hand; this drops lock-on |
| ↑ ↓ | move the mouse | tilt the camera |
| Space | Space | jump |
| Enter / E | Enter / E | after the fight: back to the field |

Slashing and dodging cost stamina (green bar); it regenerates when you stop acting.

## The boar

- **Gore** (close range): head drops and body rocks back for ~0.65 s, then a tusk swipe up. Dodge or back off.
- **Charge** (mid range): paws the ground, eyes glow, red line on the ground. It tracks you, then
  **locks its direction 0.3 s before launching**: dodge sideways then. If it hits the stone ring it's
  **stunned** for ~2 s: free hits.
- **Poise**: about 3–4 quick hits stagger it (not mid-charge).

Tuning: player in `shared/src/battle/constants.ts` (`PLAYER`); enemy stats and attacks in
`server/src/content/enemies.ts`; levels (layout, spawns, encounter tables, arena size) in `server/src/levels/`;
field-actor behavior numbers in `server/src/entities/prefabs/`.

## Layout

Three npm workspaces. The rule: **shared = code both sides run; server = anything a player must not be
able to change; client = drawing, input, feel.** Everything in `shared/` and `client/` ships to the browser.

```
shared/src/      Code client AND server run. No Babylon, no DOM (its tsconfig has no DOM lib).
  core/            ecs.ts (World, components, queries, deferred destroy), input.ts (PlayerInput),
                   math.ts (Vec2/3, approach, wrapAngle, seededRandom), time.ts (tick rate)
  battle/          components.ts (Player, Health, Stamina, Fighter, ActiveHit, Enemy, GoreAttack, ChargeAttack),
                   constants.ts (PLAYER), defs.ts (EnemyDef = body + optional attacks, ArenaDef)
  field/           layout.ts (LevelLayout: what the client may see of a level; stepWalker for prediction + replay)
  net/             client-messages.ts (Zod schemas + inferred ClientMsg; server-only import),
                   server-messages.ts (ServerMsg types), handlers.ts (Handlers<Msg> map + dispatch by `t`)

server/src/      Node + ws. Authoritative: levels, encounters, field actors, enemy stats, fight results.
  main.ts          Wires net -> sessions -> loop
  net/             server.ts (HTTP + /ws), connection.ts (one socket: Zod-validated in, typed out), static.ts
  game/            session.ts (one player: world, level, progress), handlers.ts (one handler per ClientMsg),
                   encounter.ts (start/end fights, refuse impossible wins), snapshot.ts (state msg), loop.ts (60 Hz)
  levels/          level.ts (LevelDef: layout, spawn point, spawns, encounter table, arena), index.ts (registry),
                   grass-field.ts
  entities/        components.ts (FieldPos, Actor, FieldPlayer), parts.ts (spawnActor from behavior parts),
                   context.ts, player.ts (input replay + grass encounters), spawner.ts (spawn/respawn per level)
    behaviors/       wander, chase (notice -> "!" -> chase), touch (encounter on touch), move
    prefabs/         boar.ts (= wander + chaseOnSight + encounterOnTouch), index.ts (PREFABS by id)
  content/         enemies.ts (WILD_BOAR, ENEMIES by id)

client/src/      Browser game: Babylon rendering, Havok physics, input, HUD.
  main.ts          Bootstrap: connect, engine, world, both modes, game
  net/             connection.ts (WebSocket; queues messages until the game `listen`s with one handler per type)
  game/            game.ts (routes server messages, map <-> battle switching), transition.ts (flash / fade)
  levels/          Level renderers by LevelLayout.theme: index.ts (registry), grass-field/ (terrain, textures)
  core/            input.ts (Keyboard with latched presses), mouse.ts (optional mouse/trackpad, pointer lock)
  gfx/             textures.ts (procedural textures), sprites.ts (pixel-sprite frames), characters.ts (the art)
  ui/              overlay.ts (HUD containers, toast, fade), styles.css (Tailwind v4 entry + @theme tokens)
  battle/          The 2.5D arena (still simulated in the browser, see below)
    battle.ts        Scene + Havok setup, start/end a fight (arena built/resized on demand), system order
    context.ts       GameContext + collision layers
    components.ts    Handles to engine objects (Body, SpriteView, BoarView, Meshes) + disposers
    materials.ts, look.ts (lighting/post), arena.ts (ring, stones, forest), keys.ts (bindings)
    player/          spawn.ts
    enemies/         spawn.ts (enemy prefab: body + model + Enemy + one component per attack in the def)
      behaviors/       brain (approach/poise/stagger/stun/death), charge, gore, motor (velocity), common
      models/          index.ts (by EnemyDef.model), boar.ts (built from primitives), boarView.ts (animation)
    systems/         fixed 60 Hz: input → player → enemy brain → attacks → motor → [physics] → ground → combat
                     per frame:   camera, sprite, boarView, hud
  overworld/       The 2D field: mirrors the server
    overworld.ts     Wiring: level loads, send inputs, apply server state, HUD
    prediction.ts    Predict your own walking, reconcile with the server's acks
    mirror.ts        Mirror the server's actors (spawned by kind via entities/)
    entities/        player.ts, boar.ts, index.ts (MAP_PREFABS by ActorSnap.kind)
    scene.ts (scene, camera, loadLevel), textures.ts, components.ts (MapPos, MapActor, MapSprite)
    systems/         input, sprites (glide to server positions, tuft, "!"), camera (follow)
```

### Adding things

- **A message:** client -> server: add a Zod schema to `shared/src/net/client-messages.ts` and the union, then a
  handler in `server/src/game/handlers.ts` (TypeScript errors until you do). Server -> client: add to `ServerMsg`
  in `server-messages.ts` and a handler in `client/src/game/game.ts`'s `net.listen({...})`.
- **A level:** a file in `server/src/levels/` listed in `index.ts`; reuse a theme or add a renderer in `client/src/levels/`.
- **A field actor:** a prefab in `server/src/entities/prefabs/` (a list of behavior parts) plus a client drawing in
  `client/src/overworld/entities/` under the same `kind`. New behavior: component + factory + system in `behaviors/`.
- **An arena enemy:** an `EnemyDef` in `server/src/content/enemies.ts` combining attacks; a new attack type is a def
  shape in `shared/src/battle/defs.ts`, a component, an entry in `ATTACKS` (`enemies/spawn.ts`) and a system in
  `enemies/behaviors/`; a new look is a model in `enemies/models/`.

Keep files small and single-purpose (roughly under 200 lines); add a folder per new mode or enemy
rather than growing an existing file.

## Styling

DOM overlays use **Tailwind CSS v4** (via `@tailwindcss/vite`, no config file). Write utility classes in the
markup (`index.html` or HTML strings in `.ts`). Game colours/fonts are `@theme` tokens in `client/src/ui/styles.css`
(`bg-hp`, `text-victory`, `font-title`, ...); shared pieces are `@utility` classes (`bar`, `bar-layer`).
Write class names out in full, because Tailwind can't detect names built with string concatenation.
In-world UI (enemy bars, name tags) belongs in Babylon, not the DOM.

## Architecture rules

- **The server decides; the client asks and draws.** On the field the client sends one input per tick and predicts
  its own walking with the shared `stepWalker`; the server replays the inputs (rate-limited, so sending more doesn't
  move you faster), rolls encounters, runs the level's actors, and sends state 20x/s. Levels, encounters, enemy stats, wins and
  respawns come from the server. Everything the client sends is checked against a Zod schema first.
- **Fights are not server-authoritative yet.** The arena still runs in the browser (Havok) and reports "won/lost";
  the server only refuses wins faster than the player's maximum damage allows. Moving the fight onto the server
  (Babylon NullEngine + Havok in Node, or simpler server physics) is the next step for real anti-cheat.
- **Two modes, two Babylon scenes, one client ECS world.** Map mirrors (`MapPos`, `MapActor`) and arena
  entities (`Fighter`, `Body`, ...) live side by side; only the active mode's systems run. The arena is stepped
  by Babylon's lockstep + Havok only while its scene renders. Arena fighters are spawned on encounter and
  destroyed when you return.
- **Havok owns dynamic-body transforms.** Systems move things by setting velocity, never position.
- **Fixed 60 Hz simulation** via Babylon's deterministic lockstep (`onBeforeStep` / `onAfterStep`); render-only systems run once per frame.
- **Attacks are data.** An attack's active frames add an `ActiveHit` (sector: range + angle) to the attacker; `combatSystem` resolves hits with plain math (no physics triggers), so the server can run the same code later.
- **AI and animation are separate.** The enemy behavior systems only set state, facing, wanted movement and hitboxes (the motor turns that into velocity); `boarViewSystem` reads the state and poses the 3D model (wind-up tells, gallop, stun, death).
- **Input enters only through `PlayerInput`** (world-space move + aim), so network input can replace keyboard/mouse later.
- **Destroy is deferred** to `world.flush()` at the end of each tick; remove hooks dispose meshes and bodies.
