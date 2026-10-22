# Infinite Tower

A multiplayer 2.5D browser platformer: climb a procedurally generated, never-ending tower.
3D world (Babylon.js + Havok physics), 2D billboard characters, custom ECS on top.

```sh
npm install
npm run dev        # http://localhost:5173  (?seed=42 for another tower, ?debug exposes window.game)
npm run typecheck
npm run build
```

Controls: WASD / arrows to move, Space to jump (hold for higher). Checkpoint every 10 floors; fall too far and you respawn there.

## Layout

```
shared/   Engine-agnostic code that client AND server will run. No Babylon imports.
  ecs.ts         World, defineComponent, query, deferred destroy, remove hooks
  components.ts  Gameplay data: Player, PlayerInput, LocalPlayer, Platform
  constants.ts   Tick rate, gravity, movement tuning, tower dimensions
  tower.ts       Deterministic floor generation from a seed (same tower everywhere)
client/   Browser game: Babylon rendering, Havok physics, input, HUD.
  main.ts        Bootstrap + system order (the game's contract)
  components.ts  Handles to engine objects (Body, SpriteView, Meshes) + disposers
  spawn.ts       Entity factories (player, floor)
  systems/       input → movement → [physics] → ground → progress → tower | sprite, camera, hud
server/   (next) Authoritative/relay game server
```

## Architecture rules

- **Havok owns dynamic-body transforms.** Systems move players by setting velocity, never position (`teleport()` is the one exception).
- **Fixed 60 Hz simulation** via Babylon's deterministic lockstep (`onBeforeStep` / `onAfterStep`); render-only systems run once per frame.
- **Destroy is deferred** to `world.flush()` at the end of each tick; remove hooks dispose meshes and bodies.
- **Gameplay data goes in `shared/`**, engine handles in `client/`. Input enters only through `PlayerInput`, so network input can replace the keyboard without touching movement code.
- Platforms are one-way (players jump up through them); side walls are always solid.
