# Infinite Tower

An SAO-style souls-like browser game (in progress). Plan: explore floors on a 2D map; touching an
enemy drops you into a small 2.5D arena fight: 3D monsters, 2D billboard players. Babylon.js + Havok
physics, custom ECS on top.

**Current prototype:** single-player arena fight against a Wild Boar.
(The earlier tower-climbing platformer is preserved at git tag `tower-platformer`.)

```sh
npm install
npm run dev        # http://localhost:5173  (?debug also exposes window.game in production builds)
npm run typecheck
npm run build
```

## Controls

Click the game to capture the mouse (Esc releases it).

| | |
|---|---|
| WASD | move (relative to the camera) |
| Mouse / arrow keys | turn the camera; **you attack wherever the camera faces** |
| Left click / J | slash (chain by pressing again) |
| Shift / right click / L | dodge roll (i-frames; backstep if standing still) |
| Space | jump |
| R | restart the fight |

Slashing and dodging cost stamina (green bar); it regenerates when you stop acting.

## The boar

- **Gore** (close range): head drops and body rocks back for ~0.65 s, then a tusk swipe up. Dodge or back off.
- **Charge** (mid range): paws the ground, eyes glow, red line on the ground. It tracks you, then
  **locks its direction 0.3 s before launching**: dodge sideways then. If it hits the stone ring it's
  **stunned** for ~2 s: free hits.
- **Poise**: about 3–4 quick hits stagger it (not mid-charge).

All tuning numbers live in `shared/src/constants.ts` (`PLAYER`, `BOAR`, `ARENA`).

## Layout

```
shared/   Engine-agnostic code that client AND (future) server run. No Babylon imports.
  ecs.ts         World, defineComponent, query, deferred destroy, remove hooks
  components.ts  Gameplay data: Player, PlayerInput, Health, Stamina, Fighter, ActiveHit, Boar
  constants.ts   Tick rate, gravity, player/boar/arena tuning
client/   Browser game: Babylon rendering, Havok physics, input, HUD.
  main.ts        Bootstrap, restart, system order (the game's contract)
  components.ts  Handles to engine objects (Body, SpriteView, BoarView, Meshes) + disposers
  spawn.ts       Entity factories (player sprite + sword trail, boar model from primitives)
  arena.ts       Dirt clearing, standing-stone ring (wall colliders), instanced forest
  systems/       fixed 60 Hz: input → player → boar → [physics] → ground → combat
                 per frame:   camera, sprite, boarView, hud
```

## Architecture rules

- **Havok owns dynamic-body transforms.** Systems move things by setting velocity, never position.
- **Fixed 60 Hz simulation** via Babylon's deterministic lockstep (`onBeforeStep` / `onAfterStep`); render-only systems run once per frame.
- **Attacks are data.** An attack's active frames add an `ActiveHit` (sector: range + angle) to the attacker; `combatSystem` resolves hits with plain math (no physics triggers), so a server can run the same code.
- **AI and animation are separate.** `boarSystem` is a state machine that only sets velocity/facing/hitboxes; `boarViewSystem` reads the state and poses the 3D model (wind-up tells, gallop, stun, death).
- **Input enters only through `PlayerInput`** (world-space move + aim), so network input can replace keyboard/mouse later.
- **Destroy is deferred** to `world.flush()` at the end of each tick; remove hooks dispose meshes and bodies.
