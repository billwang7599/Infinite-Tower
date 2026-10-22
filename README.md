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
npm run dev        # http://localhost:5173  (?debug also exposes window.game in production builds)
npm run typecheck
npm run build
```

## Controls

**Field:** WASD / arrow keys to walk.

**Arena:** click the game to capture the mouse (Esc releases it).

| | |
|---|---|
| WASD | move (relative to the camera) |
| Mouse / arrow keys | turn the camera; **you attack wherever the camera faces** |
| Left click / J | slash (chain by pressing again) |
| Shift / right click / L | dodge roll (i-frames; backstep if standing still) |
| Space | jump |
| Enter / E | after the fight: back to the field |

Slashing and dodging cost stamina (green bar); it regenerates when you stop acting.

## The boar

- **Gore** (close range): head drops and body rocks back for ~0.65 s, then a tusk swipe up. Dodge or back off.
- **Charge** (mid range): paws the ground, eyes glow, red line on the ground. It tracks you, then
  **locks its direction 0.3 s before launching**: dodge sideways then. If it hits the stone ring it's
  **stunned** for ~2 s: free hits.
- **Poise**: about 3–4 quick hits stagger it (not mid-charge).

All tuning numbers live in `shared/src/constants.ts` (`PLAYER`, `BOAR`, `ARENA`, `MAP`).

## Layout

```
shared/src/      Engine-agnostic code that client AND (future) server run. No Babylon imports.
  core/            ecs.ts (World, components, queries, deferred destroy), input.ts (PlayerInput),
                   math.ts (Vec2/3, approach, wrapAngle, seededRandom), time.ts (tick rate)
  battle/          components.ts (Player, Health, Stamina, Fighter, ActiveHit, Boar), constants.ts (tuning)
  overworld/       components.ts (MapPos, MapPlayer, MapBoar), constants.ts (MAP), systems.ts (map rules)

client/src/      Browser game: Babylon rendering, Havok physics, input, HUD.
  main.ts          Bootstrap: engine, world, both modes, game
  game/            game.ts (map <-> battle mode switching), transition.ts (flash / fade timing)
  core/            input.ts (Keyboard, Mouse with pointer lock)
  gfx/             textures.ts (procedural textures), sprites.ts (pixel-sprite frames), characters.ts (the art)
  ui/              overlay.ts (HUD containers, toast, fade), styles.css
  battle/          The 2.5D arena
    battle.ts        Scene + Havok setup, start/end a fight, system order (the game's contract)
    context.ts       GameContext + collision layers
    components.ts    Handles to engine objects (Body, SpriteView, BoarView, Meshes) + disposers
    materials.ts, look.ts (lighting/post), arena.ts (ring, stones, forest)
    spawn/           player.ts, boar.ts, boarModel.ts (boar built from primitives)
    systems/         fixed 60 Hz: input → player → boar → [physics] → ground → combat
                     per frame:   camera, sprite, boarView, hud
  overworld/       The 2D field
    overworld.ts     Fixed-step loop, respawns, return from a fight
    scene.ts, terrain.ts, textures.ts, components.ts (MapSprite), spawn.ts
    systems/         input, sprites (placement, tuft, "!"), camera (follow)
```

Keep files small and single-purpose (roughly under 200 lines); add a folder per new mode or enemy
rather than growing an existing file.

## Architecture rules

- **Two modes, two Babylon scenes, one ECS world.** Map entities (`MapPos`, `MapPlayer`, `MapBoar`) and arena
  entities (`Fighter`, `Body`, ...) live side by side; only the active mode's systems run. The arena is stepped
  by Babylon's lockstep + Havok only while its scene renders; the map has its own fixed-step loop (no physics).
  Arena fighters are spawned on encounter and destroyed when you return.
- **Havok owns dynamic-body transforms.** Systems move things by setting velocity, never position.
- **Fixed 60 Hz simulation** via Babylon's deterministic lockstep (`onBeforeStep` / `onAfterStep`); render-only systems run once per frame.
- **Attacks are data.** An attack's active frames add an `ActiveHit` (sector: range + angle) to the attacker; `combatSystem` resolves hits with plain math (no physics triggers), so a server can run the same code.
- **AI and animation are separate.** `boarSystem` is a state machine that only sets velocity/facing/hitboxes; `boarViewSystem` reads the state and poses the 3D model (wind-up tells, gallop, stun, death).
- **Input enters only through `PlayerInput`** (world-space move + aim), so network input can replace keyboard/mouse later.
- **Destroy is deferred** to `world.flush()` at the end of each tick; remove hooks dispose meshes and bodies.
