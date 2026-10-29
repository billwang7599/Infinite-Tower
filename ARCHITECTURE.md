# Architecture

How Infinite Tower's code fits together, where every file lives, and how to add things. Keep it in sync when you
add, move or rename files, or change how the pieces talk to each other.

- [The big picture](#the-big-picture)
- [A player's visit, start to end](#a-players-visit-start-to-end)
- [Server: core plus outlets](#server-core-plus-outlets)
- [Client: two modes, one ECS world](#client-two-modes-one-ecs-world)
- [Networking](#networking)
- [Saving](#saving)
- [Tests](#tests)
- [Rules](#rules)
- [Folders and files](#folders-and-files)
- [Adding things](#adding-things)
- [Where to tune things](#where-to-tune-things)

## The big picture

```
              Browser: client/
  ui/ (React)    game/    modes/: overworld/, battle/    visuals/ (Babylon)
       │                                 │
       │ HTTP /api                       │ WebSocket /ws
       ▼                                 ▼
┌─ Node: server/ ──────────────────────────────────────────┐
│   api/  Fastify                   ws/  the game socket   │
│         └───────────────┬────────────────┘               │
│                         ▼                                │
│                  core/  the game                         │
│                         ▲                                │
│                  db/  Drizzle ───────────────────────────┼──► Postgres
└──────────────────────────────────────────────────────────┘
Arrows point at what each piece plugs into or calls.

shared/: code both sides run (ECS, math, message types + Zod schemas, overworld walking, the view size, the arena
         fight with its Rapier physics)
```

Three npm workspaces. The rule: **shared = code both sides run; server = anything a player must not be able to
change; client = drawing, input, feel.** Everything in `shared/` and `client/` ships to the browser, so data only
the server needs (encounter rates, spawns, enemy stats, drop tables) stays in `server/`.

## A player's visit, start to end

1. **Title.** `client/src/main.ts` mounts the React UI (the title screen), asks `GET /api/me` who's logged in, and
   starts `prepareGame()` in the background: `game/start.ts` is its own lazily loaded chunk with Babylon, so the
   title shows first while the engine, the arena's physics (Rapier) and both scenes get built behind it.
2. **Login.** The login form calls `POST /api/login` (or `/api/register`), which sets the httpOnly `it_session`
   cookie (30 days). Logged in, the title lists the game servers (`GET /api/servers`), the first picked.
3. **Join.** Play opens the picked server's socket (`/ws`); the cookie goes with it. Meanwhile the title plays its
   enter sequence (`ui/screens/title/sequence.ts`): the view goes into the tower and speeds up it until the game has
   joined. Only
   once the title has cleared off the world (`inWorld` in `ui/state.ts`) does the HUD show and the game, and the
   screens over it, take keys. The server finds the account, loads the save and sends
   `welcome` (HP / stamina, stats, settings, character, wins, gear, known words, the skillbook's pages). With no
   character yet, the white the
   title flashes into holds: character creation (`ui/screens/creation/`) plays on it, and the server waits for a
   `character` message (only one: a character is kept for good); then it sends `level`.
4. **Overworld.** While you move, the client sends one `input` per 60 Hz tick and predicts its own walking with the
   shared `stepWalker` (at the pace the gear's weight allows; solid tiles stop it). The server replays the inputs,
   runs the level's actors (walking by the same rule), rolls encounters in tall-grass tiles and sends `state`
   20 times a second with the actors near your screen. The client glides its mirrors toward those positions.
5. **Fight.** The server makes the fight (a `BattleRoom` running the shared `Fight`) and sends `encounter` with its
   setup (arena, enemy, your HP / stamina, stats, burden, the bag and what's worn (so whether a sword and a
   skillbook are in hand), and its pages). The client
   flashes into battle mode, builds the same
   fight and runs it itself, whole and at once, sending only its inputs, each tagged with its step (`battleInput`).
   The server runs the same fight on those inputs at those steps (hits, damage, stamina, deaths), sends a hash of it
   4 times a second (`battleHash`; a client whose copy differs asks for the whole of it, `battleSync`), and the
   moment it's decided, sends the final `battleSync`, rolls drops (or, on a loss, empties the bag and hands you a
   fresh sword and a blank skillbook), saves and sends
   `battleResult`: only then does the result show. Enter leaves the arena (`leaveBattle`) and the overworld goes on.
6. **Leave.** Return to title, closing the tab or losing the connection closes the socket, and the server saves.
   Mid-fight, that loses the fight (`LEAVING_LOSES`): the bag empties as on a death.
   A second tab on the same account takes over: the first one is closed and lands on the title.

## Server: core plus outlets

The server is hexagonal. `server/src/core/` is the game: sessions, the overworld, fights, levels, content and the
account rules. It knows nothing about sockets, HTTP, SQL or env; what it needs from outside it asks for through the
interfaces in `core/ports.ts`. The outlets plug into it, and `main.ts` is the only file that sees everything:

```
main.ts
 ├─ await initPhysics()                                   the arena fight's Rapier, loaded once
 ├─ db = await connectDb(DEV)                              db/: connects to DATABASE_URL, applies new migrations
 ├─ accounts = new Accounts(new PgAccountStore(db))        core/ rules, db/ storage
 ├─ online = new OnlinePlayers(new PgPlayerStore(db), DEV, MAX_PLAYERS)  core/: who's playing, one GameSession each
 ├─ startServer({ accounts, socket: gameSockets(online, { dev, pingMs }), servers })
 │     ├─ api/  Fastify: /api routes, /api/servers (this server's name and online.count), the built client, the
 │     │        /ws handshake
 │     └─ ws/   gameSockets(): each socket becomes a Connection (the PlayerLink) bound to a GameSession
 └─ timer -> FixedClock (60 steps a second) -> online.tick(dt): each session steps its overworld or its battle
```

| Port (`core/ports.ts`) | What core uses it for | Implemented by |
|---|---|---|
| `PlayerStore` | load / save a `PlayerSave` | `db/player-store.ts` (`PgPlayerStore`) |
| `AccountStore` | accounts and login sessions | `db/account-store.ts` (`PgAccountStore`) |
| `PlayerLink` | send messages to one player, close their connection | `ws/connection.ts` (`Connection`) |

- Core imports only `core/`, `shared` and `node:crypto`. An outlet imports `core/` and itself, never another
  outlet. When two outlets have to meet, the one that needs something defines an interface and `main.ts` passes in
  the other's implementation (`api/` defines `GameSocket`; `ws/` builds it).
- `npm run typecheck` runs `server/scripts/check-layers.ts`, which fails on an import that breaks these rules. Fix
  the import rather than loosening the check.
- Core sends the `shared` message types as they are (they're already the contract with the client), and it can run
  with fake stores and links, without Postgres or a browser.

## Client: two modes, one ECS world

- **Game data is ECS** (`shared/src/core/ecs.ts`: world, components, queries). Systems are functions run in a fixed
  order. Services (the connection, keyboard, mouse, prediction, the fight's sync) are plain classes.
- **Every key goes through one input system, in two parts.** The devices (`core/keyboard.ts`, the only key listener,
  and `core/mouse.ts`) only know buttons: held, latched presses, in order. `core/actions.ts` alone turns keys into
  actions, for a stack of layers (`whoHasTheKeys` in `ui/state.ts`, e.g. battle with Settings on top); only the top
  one gets keys, and it makes only its own actions (the bag's Esc is `closeBag`, not Settings' `menu`). One-off
  things listen by action name alone (`actions.on`, `useAction` in the UI), so an action name means one thing
  everywhere; the overworld's tick and the fight's steps call `actions.poll()` once each, for what's held and what was
  pressed since (in order), and the axes `move.x`, `move.z`, `turn` and `look` (-1, 0 or 1, from `AXES` there),
  only while their layer is on top (the chant's, and the arena's bag's, let through only the dodge and the walk keys,
  for the dodge's way; the arena's bag takes its R and Enter from the overworld's keys, first, then the arena's);
  the arena camera reads the fight's last poll. Actions also owns the mouse: the
  pointer may lock only while the arena is on top (`setLayers`, with Auto mouse lock), and the camera reads its
  movement each frame with `actions.lookDelta()` (it turns only while the right button, `dragCamera`, is held);
  no mode sees `Mouse`. Mouse movement in the arena is also read as swipes there: a quick move (`SWIPE`, scaled by
  the swing sensitivity) is pressed as the swing named by its way across the screen, in order with the keys and
  clicks, so the fight sees it like any attack; not while blocking or dragging the camera. In a text field only the
  arrows, Esc, the digits and Backspace count (the skill word search picks and undoes with them; a key nobody uses
  stays the field's); rebinding takes raw keys with `captureKey`.
  Pointer input in the UI stays plain DOM events.
- **Two modes, one world.** `game/game.ts` runs the frame loop and switches between the overworld
  (`modes/overworld/`, mode `"overworld"`) and the fight (`modes/battle/`, mode `"battle"`). Overworld mirrors
  (`OverworldPos`, `OverworldActor`) live in the game's world; only the active mode updates. The fighters live in the
  fight's own world (below), made on encounter and dropped when you return. The fight's result comes while you're
  still in the arena; game.ts holds it and applies it (gear, vitals, wins, notices) as you come back.
- **Drawing has one owner: `client/src/visuals/`.** It owns the engine, both Babylon scenes and everything in them
  (meshes, sprites and their painted frames, animation, the camera, effects). The modes do game logic only and import
  no Babylon (`npm run typecheck` checks it); they never call into drawing or hand it state. Each frame, after the
  mode's update, `game.ts` calls `drawing.frame(dt)` (and `drawing.show(mode)` when the mode changes), and the drawing
  reads the shown mode's state itself: `battle.ctx` (the fight, the lock, the camera's view, this frame's events) or
  `overworld.state` (the level, the actors). Every kind of thing in a fight has one row in `VISUALS`
  (`visuals/visuals.ts`), picked by `kindOf` from the components it already has (`Player`, an `Enemy`'s id, a
  `SkillObject`'s kind); a row is `{ spawn, frame, dispose }`, and `frame` diffs the fight's entities against what it
  has drawn: it spawns the new, frames the rest and disposes the gone. A row's own state holds only its meshes and
  smoothing (squash, eased angles); its pose comes from the components each frame, from Babylon-free pose functions
  that are tested (`visuals/battle/pose.ts`, `visuals/battle/weapons.ts` for any wielder's blade, `arm.ts` for a
  3D humanoid's arms, each enemy's `pose.ts`). One-shot effects are a second table, `EFFECTS`,
  by fight event type (the camera's shake, a Nova's burst, a weapon hit's hit-stop and jolt, a blocked or parried
  blade's bounce and sparks); each fires once per step and event (`FiredEffects`), so
  a step replayed after a resync doesn't fire it again. Hit-stop is drawing only (`visuals/battle/impact.ts`): the
  fight runs on, the two fighters' drawings hold still for the weapon's `hitStopMs` and then ease after their bodies.
  The overworld's actors are drawn the same way, from `WALKERS` by their `kind`. `fighter()`
  (`visuals/battle/battle.ts`) wraps every fighter's row, so what any `Skilled` fighter is doing is drawn the same: the
  circle at its feet while it chants or winds up, and, over anyone but you, its chant's words as a row of squares in
  front of it (`chantWords.ts`). The player's look is read from `ui.overworld`'s character and painted once
  (`visuals/characters.ts`), with the weapon in whichever hand its `Wielder` holds it.
- **The overworld shows what the server says.** `modes/overworld/mirror.ts` mirrors each actor with its `kind`;
  `modes/overworld/prediction.ts` predicts your own walking and reconciles with the server's acks.
- **The fight is a shared `Fight`** (`shared/src/battle/fight/`, imported from `@infinite-tower/shared/fight`, its
  own entry point so Rapier stays out of the title's chunk and the rest of the server). One object per battle, with
  no state outside it: its own ECS world, its own Rapier world, fixed steps of `FIXED_DT`, and `step(inputs)` with
  one `PlayerInputData` per player (any number of players and enemies), counted in `steps`. Its only random numbers
  come from seeds in its own state (a swordsman's swings, where split Bolts start; the server picks the seeds), and
  Rapier's deterministic build gives the same numbers on every machine, so the same setup and inputs always give
  the same fight. Its whole state goes out and back in as plain JSON (`save()` / `load()`, `fight/state.ts`: what
  changes in a fight, exactly; the colliders are put where their bodies are), and `hash()` (`hashFight`, there too)
  is a fingerprint of it with every number rounded to 2 decimals. Rapier loads once (`initPhysics()`: as the server
  starts, and in `prepareGame()` behind the title) before any fight is made. System order (`fight.ts`): player
  controller -> enemy brain -> attacks -> motor -> physics -> player ground -> combat -> outcome. It reports what
  happened in a step as `events` (hits, blocks, a charge slamming the wall). How a fight ends is
  `fight/outcome.ts`: lost when no player stands, won when no enemy does, lost after `MAX_FIGHT_TIME` (10 minutes,
  a guard on the server's resources), and a player who disconnects is down and has lost it (`LEAVING_LOSES`).
  Every hit, skill and burn hurts through `hurt` (`fight/skills/statuses.ts`), which spares an invulnerable player
  (`Player.invulnerable`, a dev cheat from the setup, or set by the server mid-fight).
- **The server runs it** (`server/src/core/battle/`): a `BattleRoom` per battle, from the moment every player has
  sent their first input. It keeps a clock (steps since the fight started, one a 60 Hz tick) and runs the fight up to
  it as soon as it knows every player's input for the next step (`InputTimeline`), holding a step back for a late
  input at most `MAX_INPUT_DELAY` ("A fight on the wire" below has the rules). It's authoritative: hits, damage,
  stamina, deaths and the result. Once it's decided, each player's `onEnd` settles the battle for them
  (`core/game/battle.ts`) and the fight is freed. A room takes any number of players; every battle has one for now,
  and that player's session steps it.
- **The browser runs its own copy of the whole fight** (`modes/battle/`), built from the encounter's setup, so the boar
  reacts to you at once. Each frame its clock (`modes/battle/pace.ts`: real time since the fight's first step, plus an
  offset that keeps it in step with the server's) says how many steps are due, and `modes/battle/sync.ts` (`FightSync`)
  runs them with the keys' input, sends its changes, and on a hash mismatch loads the server's fight and replays
  (the bodies it moved are the frame's `corrections`, and their drawings ease over the jump; every step's events,
  replays included, are `sync.events`). (Babylon's own lockstep isn't used: it would catch up stalls a second time.)
  HP and hits show at once from the client's copy, but the result is only ever the server's: the banner waits for
  `battleResult`. After its steps the mode moves the camera's orbit (`modes/battle/camera.ts`: plain numbers, since
  its yaw is also the aim) and fills the HUD's store. The lock-on is the client's alone (`ctx.lock`, steered by
  `modes/battle/lock.ts` each step): it only changes the move and aim the input carries (toward the target), so the
  fight and the server don't know about it.
- **Fighters are moved by code, not by forces.** Systems set a body's velocity (`Body.vel`); the physics step
  (`fight/physics/move.ts`) adds gravity and moves each collider with Rapier's character controller, so the floor
  and the arena's ring of wall stop it and take the speed out. Bodies bumping into each other follow the fight's own
  rule: an enemy shoves a player along, a player never pushes an enemy (a player pinned against the wall holds it
  back), and dodging, knocked back or dead, a player passes through. Rapier simulates nothing itself
  (`fight/physics/arena-physics.ts`): it sweeps, finds contacts and casts rays (`grounded`, the blob shadow).
- **Attacks are data.** An attack's active frames add an `ActiveHit` (an arc: range + angle; or a stab's ray: range +
  width) to the attacker; `combatSystem` (`fight/combat.ts`) resolves hits with plain math, not physics: a player may
  parry an enemy's swing (the reverse swing or a neighbour 45° off it, or a stab with a stab, live within
  `PARRY.window` before it lands: the enemy is stunned; hurt invulnerability doesn't stop a parry) or block it (held,
  facing it: stopped for stamina); a swordsman on guard parries a player's swing coming in near the side its blade is
  held toward (`GUARD`; the player is staggered) and blocks a stab; anything else lands, and a swing that lands turns
  its guard that way (`turnGuard`). How much of a parry each makes is `parryShare` / `guardShare`: 1 head-on,
  `PARRY.offAngleShare` 45° off (the stun or stagger and the knockback scale by it), 0 for none. An enemy's swing is
  named as the player facing it sees it.
- **Weapons are a system of their own, like skills.** The rules and numbers are in `shared/src/weapons/weapons.ts`:
  `WEAPONS`, the arsenal (each weapon by item id: its `kind`, the moveset it swings with, and its length, mass,
  balance and power), eight swings named by their way across the screen (`lr`: left to right, `SCREEN_DIR`) and a
  stab, their hit shapes (`attackShape`: the wielder's own arm reach plus the weapon's length), the swings' inertia
  (`SWING`, `planSwing`) and `PARRY`. Fighters care only which weapon they hold. Anyone with a `Wielder` (what each
  hand holds, its arm reach, the swing under way, and its `Blade`: a point in the screen plane, where it is and how it
  moves) swings the weapon in hand. `planSwing` works out an attack from the blade, the weapon and the wielder's
  strength: its wind-up (setting or looping the blade to the swing's start, a stab's to the guard and drawn back, then
  the drive to impact), its drive and follow-through times, the factor its live time scales by, its flow, its impact
  momentum (damage, poise damage, a block's cost, a parry's stun) and its effort (stamina). `strokeOf` gives where a swing's blade is on any step, so
  every visual draws the blade where the fight has it. The player's controller and an enemy's weapon attack
  (`fight/behaviors/weapon.ts`, whose wind-ups are telegraphs the plan's is only a floor to) decide when and what, and
  call `startSwing` (`fight/weapons/swing.ts`) with the swing's steps (when its drive starts, its blade goes live, is
  done, lets go and is over) and its hit; `weaponSystem` then runs every swing the same way, raising its hitbox exactly
  while it's live, and stops the blade `SWING.gapTime` after a swing ends, leaving it where it is, so the next wind-up
  starts from there. Ending an action or an enemy state (`enter`) ends its swing (`endSwing`, which rests the blade at
  the guard if the swing hadn't let go yet, else leaves it following through); a block, a dodge or a hit taken rests
  it too (`restBlade`). A blade that meets a guard (blocked, or parried) stops dead there (`stopBlade`): its hitbox
  goes, `stoppedAt` holds its stroke still while the swing runs its time out, and it ends still at that point
  (`stoppedBlade`). Between swings the visuals draw the blade held where the fight has it. A parry reads the
  target's swing.
- **Skills are inputs too, and any fighter's.** Every fighter is `Skilled` (`fight/skills/skilled.ts`): what it's
  chanting (`chanting`, `words`), the skill winding up (`casting`, `castTime`), a held Beam, where its skills go (`aim`,
  `target`) and its seed. Whoever drives it calls the same three things: `startCast` (a quick-cast, or a chant's
  release; one at a time), `chant(words)` and `releaseChant`; the player's controller does it from the input, a
  casting enemy's `skillAttackSystem` (`fight/behaviors/skill.ts`) from its own choices. A player's input carries a
  whole skill (`cast`) only on the step its key goes down, then just `castHeld` while the key stays down: the fight
  keeps the skill, so a long one isn't resent in every input; the chant's words come the same way, whole, on the step
  they change (`chantWords`). The controller
  winds a cast up as the "cast" action, `windUpSystem` counts any wind-up's time early in the step (so a sidestep sees
  it), and `skillSystem` (`fight/skills/cast.ts`) pays its stamina (if the caster has any) and fires it once the
  wind-up is over. Whatever lasts is a `SkillObject` entity (its `kind`: a Bolt flying
  by plain-math sweeps, not a physics body; a Beam ticking along its line, held while `castHeld` is; a lingering
  Nova's cloud; an Imbue waiting for the caster's sword hits, seen in the step's `hit` events; a Delay's wait); a
  Nova and Self go off at once; each segment fires when the one before it completes (`handOff`), once per Bolt. A
  Follow Bolt homes, at a limited turn rate, onto the caster's `target` (a player's is the input's `locked` enemy) or
  the nearest; split ones aim side by side beside it (`fanM`) until close. Split Bolts start in an upright circle round
  the caster and fly in to meet a point ahead (`splitBolts`; they climb or drop to it: `climbPerM`). A hit runs
  `strike` (`fight/skills/strike.ts`): every element's status on the target's `Statuses`, then the reactions, then
  the damage. `statusSystem` runs statuses down and burns. Statuses also change sword hits (Empowered, Cursed,
  Warded, the Light shield, Siphoning: `fight/skills/statuses.ts`). Every number is in `SKILL_EFFECTS`
  (`shared/src/skills/effects.ts`). The chant is a held input (`chant`) and the "chant" action, which holds the
  player still, with or without the skillbook; a skill on none of the player's pages (`book`, from the setup), or any
  skill with no book in hand, starts only from it. Writing a page (`write`, from the chant, book in hand) is the
  "write" action: after `SAVE_IN_FIGHT_TIME` the fight's `book` has it (a
  `pageWritten` event), and the server saves that book with the result. A stun breaks either off, and so does a
  dodge; it reopens only once the input is let go (`brokenOff`), and the client closes its popup when it sees that.
  A stun while chanting also loses the chant's words (a dodge keeps them), for any chanter: an enemy stunned, parried
  or staggered is broken off the same way (`cantCast`).
  The bag works the same way: the bag screen open in a fight is the held input `bag` and the "bag" action (held
  still, broken off by a stun or a dodge; a page can be written from it with the book in hand), and a move in it is
  the pressed input `gear` (a `GearMove`), run with the shared `moveGear` on the fight's `gear` (the bag and the
  equipment; no cloth). The `Wielder`'s hands follow the equipment, and the server settles the battle with the
  fight's gear.
- **AI and animation are separate.** Enemy behavior systems (`fight/behaviors/`) only set state, facing, wanted
  movement and hitboxes (the motor turns that into velocity); each model's visual (client) reads the state and
  poses the model.
- **Input enters only as `PlayerInputData`** (world-space move + aim): from the keys in the browser, from
  `battleInput` on the server. Keys come from `client/src/settings/bindings.ts` as actions, never hardcoded.
- **Destroy is deferred** to `world.flush()` at the end of each tick; the drawing disposes an entity's meshes the
  next frame it doesn't find it.
- **The UI is React** (`client/src/ui/`, mounted into `#ui`), the HUD's bars included; the canvas and anything in
  the world (sprites, the boar, the sword trail) is Babylon. The game never touches the DOM: it writes plain values
  into stores (`ui/state.ts`, e.g. `ui.battle.set({ hpFraction })`), and components read them with
  `useStore(store, s => s.hpFraction)`.
  What the game says to the player goes through one call, `say(ui.notifications, event)` (`ui/notifications/`),
  e.g. `say(ui.notifications, { kind: "rested" })`. Its table, `EVENT_MESSAGES`, has an entry for every kind of
  `GameEvent` (a kind without one doesn't compile) with where it goes and its words: `"corner"` is a small notice
  in the bottom-right corner (loot, a full bag, dying, resting, eating), `"centre"` the big centre banner, kept for
  bigger events (only a fight starting so far; the arena's result banner is the fight's end).
  Writing every frame is fine: `Store.set` skips unchanged values, so a component re-renders only when the value it
  selected changes (select one primitive per `useStore` call). What the UI asks of the game (sign in, play, return
  to title) goes through `UiActions`, which `main.ts` provides.
- **Styling is Tailwind v4** (`@tailwindcss/vite`, no config file). Colours and fonts are `@theme` tokens in
  `client/src/ui/styles.css` (`bg-hp`, `text-victory`, `font-title`, ...), shared pieces are `@utility` classes
  (`bar`, `bar-layer`). Write each class name out in full (`"from-hp to-hp-dark"`, not `` `from-${bar}` ``),
  because Tailwind can't find names built from pieces; joining whole names (a long list over two strings) is
  fine. Motion comes with `motion-reduce:animate-none`.
- **Every screen sees the same amount, at most**: 16:9 (`shared/src/overworld/view.ts`).
  `client/index.html` puts the game in a frame that wide, so wider windows get bars on the sides and taller ones see
  a little less width.

## Networking

The browser only ever talks to its own page's host: in dev, Vite on :5173 forwards `/ws` and `/api` to the server
on :8787; in production the server serves the built client itself.

**HTTP** (`server/src/api/`, Fastify). Every error is `{ "error": "<a sentence the title screen can show>" }`.

| Route | Answers |
|---|---|
| `POST /api/register` `{username, password}` | 201 `AccountInfo` + login cookie; 409 if the name is taken |
| `POST /api/login` `{username, password}` | 200 `AccountInfo` + login cookie; 401 on a wrong name or password |
| `POST /api/logout` | 204, cookie cleared |
| `GET /api/me` | 200 `AccountInfo`; 401 if not logged in |
| `GET /api/servers` | 200 `GameServer[]`: name, socket, players online, `MAX_PLAYERS`; for now only this server |

Login and sign-up share 20 tries a minute per IP address (then 429). Bodies must be JSON (415 otherwise), at most
4 KB, and are checked by the shared Zod schemas in `shared/src/net/api-requests.ts`. The client makes every HTTP
call through `client/src/net/api.ts`.

**The game socket** (`/ws`). Opening one:

```
Browser                 api/routes/game-socket.ts       ws/sockets.ts             core/
  │── GET /ws + cookie ──►│ before the upgrade:            │                          │
  │                       │ accounts.forToken(cookie) ─────────────────────────────►  │
  │◄── HTTP 503 ──────────│ if the lookup threw            │                          │
  │◄── 101, open ─────────│ accept(ws, account) ──────────►│ new Connection(ws)       │
  │◄── close 4001 ─────────────────────────── no account ──│                          │
  │                       │                                │ online.join(conn) ──────►│ full: close 4002; else
  │                       │                                │                          │ closes the account's
  │                       │                                │                          │ other tab (4000), loads
  │◄── welcome ──────────────────────────────────────────────────────────────────────│ the save, new GameSession
```

While playing, each message goes ws (over 16 KB: close 1009) -> `Connection` (Zod check; dropped if invalid, more
than 20 invalid: close 1008) -> `ws/handlers.ts` (one call on the `GameSession` per message type) ->
`GameSession`, which answers with `link.send(...)`. `state` and `battleHash` aren't answers: the clock ticks every
session 60 times a second; on the overworld every 3rd tick sends a `state`, and in a fight every 15th step of the
server's fight a `battleHash`. A `ping` never reaches the session: `Connection` answers it with a `pong` itself.

In the browser, one `Net` (`client/src/net/net.ts`) owns the socket. `Net.connect(socket)` opens a server's socket
(from the list: a path on the page's host, or a whole URL) and resolves with it and the `welcome`; `net.send(msg)`
sends; each part of the game subscribes to the messages it needs with `net.on(type, fn)`, which returns an
unsubscribe: the overworld to `level`, `state`, `encounter` and `gear`, the battle to `battleHash` and `battleSync`
from its start to its end, and `game.ts` to the rest. Messages that come before anyone listens
(the level, while the game still loads) are held and delivered, in order, once the first listeners are in.
`net.onLost(fn)` hears a dropped socket (with a sentence for the title), `net.onPing(fn)` the ping, and
`net.close()` hangs up quietly.

| Client -> server | When |
|---|---|
| `input {seq, moveX, moveZ}` | each tick while walking (nothing while standing still); replayed, rate-limited |
| `character` | made your character (ignored if you have one) |
| `rest` | Rest key by a campfire (the server checks you're there) |
| `useItem {at}` | used one of the item in a bag or cloth cell `at` (`{in, x, y}`) |
| `moveItem {from, to, turned}` | moved what's at spot `from` (a bag or cloth cell, or an equipment slot) to `to`: on a grid, its top-left there (overworld only; shown at once; in a fight it's a `gear` fight input) |
| `closeBag` | the bag screen closed: what's on the cloth is lost |
| `saveSkill {page, skill}` | write a skill on a page of the skillbook, outside fights (in one, it's a `write` fight input); refused in a battle, without the book in hand or with a word the player doesn't know |
| `battleInput {upTo, inputs}` | in a fight, once a frame: each change of input with its step (a cast carries its skill on its first step only, and the chant its words when they change, either dropped by the server if the player doesn't know its words; a gear move its two spots), and the last step run |
| `battleResync` | in a fight: your copy didn't match the server's hash; send the whole fight |
| `leaveBattle` | the Leave key after a fight's result: back to the overworld (ignored mid-fight) |
| `settings` | a setting changed (debounced on the client) |
| `ping {id}` | every 2 s, for the HUD's ping |
| `cheat {cheat}` | dev server only (production ignores it), from the admin panel (F1): `encounter` a fight against an enemy, `invulnerable` on / off, `give` an item and count, `heal` |

| Server -> client | When |
|---|---|
| `welcome` | after joining: HP / stamina, stats, settings, character (or null), wins, gear, known words, skillbook, `dev` |
| `character` | your character, as saved |
| `level` | entering a level: its layout (what the client may see of it) and where you are |
| `state` | 20 a second in the overworld: `ack` (last input replayed), your position, nearby actors |
| `encounter` | a fight starts: its `setup` (arena, enemy, your HP / stamina, stats, burden, what you wield, your pages) and your `seat` in it |
| `battleHash` | 4 a second in a fight: the server's fight's hash after `step`, and how late your inputs come |
| `battleSync` | the whole fight after `step`: on `battleResync`, and as the fight is decided (before the result) |
| `battleResult` | as the fight is decided (still in the arena): won?, wins, HP / stamina, loot, `lost`, gear, skillbook |
| `rested`, `itemUsed` | what resting or eating did |
| `healed`, `given`, `invulnerable` | what a cheat did (dev): vitals refilled, items packed (and how many didn't fit), invulnerability now on or off |
| `gear` | your bag, cloth and equipment after a `moveItem` (allowed or not), or when the cloth is left behind |
| `skillbook` | the skillbook's pages after a `saveSkill` (written or not) |
| `pong {id}` | the answer to `ping {id}` |

Close codes the client handles: 4001 not logged in (login form), 4000 the account is playing in another tab, 4002
the server is full (`MAX_PLAYERS` are on; a player already on it may still take over from another tab) (`CLOSE_CODES`
in `shared/src/net/server-messages.ts`); 1011 (loading the save failed), 1008 and 1009 end in "connection
lost". Positions in `state` are rounded to 1 cm, and it only carries actors within `VIEW_RADIUS_TILES` of the
server's copy of you (a circle, as the camera may look any way), so a hacked client can't see further.

**A fight on the wire.** Both sides number the fight's steps from 1. Each frame the client sends the changes of its
input since the last message, each tagged with the step it's for and rounded to 3 decimals (so both sides run the same
numbers), and `upTo`, the last step its copy has run; with nothing new, `upTo` alone every 3 steps
(`INPUT_HEARTBEAT_STEPS`). The server checks each message (`battleInput`'s Zod schema: steps in order and not after
`upTo`, the aim a direction, the move no longer than two keys make) and runs every input on its own step: up to
`MAX_INPUT_DELAY` (0.2 s, `MAX_INPUT_DELAY_STEPS` = 12) late it waits, later it runs it on its next step, presses kept,
and more than `MAX_INPUT_LEAD_STEPS` (6) ahead of its clock it drops it. A step run without the player's input holds
what they held; after `SILENT_STOP_STEPS` of those in a row, their move keys let go. After every `HASH_EVERY_STEPS`-th
step (15: 4 a second) it sends `battleHash`: the step, the hash of its fight there (`Fight.hash`: the whole state, every
number rounded to 2 decimals, so last-bit differences between machines don't count until they grow), and how late the
player's inputs come (`lateSteps`: `pace.ts` moves the client's clock ahead when they come late and back when they come
early, less what the client caused itself). The client compares it with its own hash at that step (kept for 1 s; a hash
for a step it hasn't run yet waits until it has), and on a mismatch sends `battleResync` once; the server answers with
`battleSync`, its whole fight (`FightSnapshot`, about 1.5 KB of exact JSON) at its own step, at most every 5 steps
(`MIN_SYNC_GAP_STEPS`); the client loads it and replays its inputs since (or, behind it, jumps there). That's about 0.45
KB/s down for one player against one boar; up, about 7 KB/s while the aim changes every step (the camera turning, or
locked on to a moving enemy), a fraction of that while it doesn't. There's no message that says how a fight ended: only
the server's fight decides it, and its final `battleSync` and `battleResult` say so.

**A simulated ping (dev only).** A dev server delays every game socket's messages by half of `DEV_PING_MS` each way
(`.env`, any whole number of ms, 50 if left out), in order, the close included (`ws/delay.ts`), so the netcode can be
felt on localhost. A page can ask for another with `?ping=N` (the client passes it on to `/ws`; anything but a whole
number of ms gets the `.env`'s). Production never delays.

**The HUD's ping.** `Net` sends a `ping` every 2 s (`client/src/net/ping.ts`) and reports the average of the last 4
round trips to `net.onPing`, which puts it in `ui.ping`; `ui/hud/Ping.tsx` shows it in both HUDs unless Show ping
(`settings.hud`) is off. The `pong` is delayed like everything else, so `?ping=200` reads about 200.

## Saving

What's kept between connections is a `PlayerSave` (`core/ports.ts`): HP / stamina, wins, settings, character, bag,
equipment (items gone from the game or in the wrong slot are dropped on load), the skill words they know
(`knownWords`) and the skillbook's 4 pages (`skillbook`, each a skill or null), keyed by account; words not in the
shared `WORDS` are dropped on load, and so is a page that's no longer a skill of known words. The `GameSession` saves
after every fight (the moment it's decided, or lost by leaving it), rest, item use and making a character, on
disconnect, and within a second of a settings change, a move in the bag or a page written. The cloth is never saved.
Position and level aren't saved (you start at the level's start), and stats aren't either (everyone has the same).

Postgres is reached through Drizzle (`server/src/db/schema.ts`). The server applies new migrations when it starts;
`npm run db:generate` writes them (see "A schema change" below).

## Tests

`npm test` runs every `*.test.ts` under `shared/test/`, `server/test/` and `client/test/` with Node's test runner
(`tsx --test`); no test framework, database or browser. Each `test/` folder mirrors its `src/` and has a tsconfig
of its own (Node's types), checked by `npm run typecheck`. New work is written test-first (see AGENTS.md).

- **shared**: the ECS, math, walking, the view rules, every Zod schema, and the arena fight run headless with
  enemies whose numbers the tests own (`shared/test/battle/fight/fixtures.ts`): the same inputs give the same fight
  byte for byte, gravity and the floor, the wall, shoving and passing through, knockback, each attack's reach and
  shape, the blade's inertia (each order's wind-up, flow, damage, poise and cost as `planSwing` says, staying where a
  swing left it, back at the guard after a block, a dodge or a hit),
  blocking (stamina by momentum, push back,
  only in front, the guard breaking), whole fights won and lost, the time limit and leaving, a fight's whole state
  (exact through JSON; loaded into a new fight, or one that went its own way, it plays on step for step the same, live
  hitboxes included), its hash (the same for the same inputs, changed by anything that matters, not by a last-bit
  difference), a dodge's i-frames step by step (a dodge on the very step a hit lands beats it; its stamina and burden
  costs), and a dodge pressed during a swing waiting for it to let go (on any step of it, once, ahead of a buffered
  swing, through a save and a rollback). Skills (`shared/test/battle/fight/skills/`): the wind-up, its cost at release,
  waiting behind a swing, cancelled by a dodge or a hit; the chant (held still, broken off by a stun or a dodge but
  not a sword hit, the only way to cast a skill on no page, needing no book; its words in the fight: kept by a dodge,
  lost to a stun or a release); an enemy that chants word by word, releases, quick-casts and is broken off by a stun
  (`skilled.test.ts`) and writing a page in it (its time, standing still,
  cancelled by a stun or closing, through a save); Bolt, Nova and Self; chains (from a hit, at full range, at
  the wall, a Bolt after a Nova); a Bolt through a save and the hash; each element's damage, status and resistance;
  the four reactions, their order and cooldowns; Self per element (sword hits included); an invulnerable player
  taking no damage, its flag in the state and hash. Each fight test file awaits
  `initPhysics()` first. Also the battle inputs' rounding and what counts as a change.
- **server core**, through its ports: `server/test/fixtures/` has a `FakeLink` (records what a player was sent and
  how the link was closed), a `MemoryPlayerStore` and a `MemoryAccountStore`, plus `TEST_LEVEL`, a level whose
  numbers the tests own. Joining, a second tab, saving, the overworld's input replay and encounters, resting, items,
  accounts and passwords are all tested without a database or a socket, and so are battles: the server deciding a
  win from the player's inputs alone, a loss emptying the bag, leaving mid-fight (or a second tab) losing it, the
  time limit, the room against a client's copy (`server/test/fixtures/fight.ts`: a `FakeClient` and an in-order wire
  that can hold messages back): waiting for the first input, each input on its own step hash for hash, never past
  its clock, waiting for a late input up to `MAX_INPUT_DELAY_STEPS` and running a later one on its next step,
  dropping inputs too far ahead, a silent client's fight going on (and still lost at the time limit), lateness,
  `battleSync` on asking and as it's decided; dodging a bite k steps before it lands, on time, 150 ms late and too
  late, with the same hit or miss and HP on both sides; parrying the Kobold's swing the same way; the Kobold as
  tuned, beaten by a player who reads its wind-ups whatever its seed; a cast or a page written with a word the player
  doesn't know dropped (and chant words), a skill on none of the pages cast only from a chant, chanting without the
  book; the skillbook (pages written, refused for
  an unknown word, without the book in hand or mid-battle; a page written in the fight saved with its result, blanked
  by a death); and the input timeline (changes held, late presses and casts kept, too far ahead dropped, a
  silent player stopping, lateness, the latest of late chant words kept).
  The dev cheats: each ignored in production, and invulnerability and a heal mid-fight reaching the fight and the
  client.
- **server outlets**: `api/` with `buildServer()` and `app.inject()` / `app.injectWS()` (routes, cookies, error
  sentences, the rate limit, cache headers, the `/ws` login check and its `?ping=`); `ws/` with a fake WebSocket,
  the simulated ping included (each way half of it, in order, 0 for none, never in production); `env.ts`'s
  `DEV_PING_MS`, `SERVER_NAME` and `MAX_PLAYERS`; `/api/servers`; a full server refusing a new player; a `ping`
  answered with a `pong`. `db/` has no tests yet ([plan/tests.md](plan/tests.md)).
- **client**: only logic that runs without Babylon or the DOM: key bindings (a save that clashes with new defaults
  falls back to them), the keyboard (held, latched, text fields, rebinding's raw key), where each key goes (the
  layer on top, each with its own keys; held keys read only there) and who has them, what the keys and buttons ask
  for (actions; the attack pressed last; swipes into swings), the player's pose, sword trail and thrust, the boar's
  and the Kobold's poses, effects fired once per step and event, camera, mouse and HUD settings, settings sync, when
  the mouse is captured, overworld prediction, the fight's sync (only changes sent,
  with their steps and heartbeats; the whole fight run at once; hashes checked, now or once it gets there; one resync
  asked, the server's fight loaded and replayed to where the server gets, or jumped to; a dodge neither replayed twice
  nor dropped; every step's events reported, a replayed step's again; the result and its banner waiting for the
  server) and pace (real time's steps, catching up after a stall,
  a backlog dropped, ahead when late and back when early, lateness it caused itself not made up twice, old news
  ignored), the title's sequence timing, the ping (its average, stale pongs) and its readout, character creation's steps
  and rows, the chant's carousel (what the next square takes, known words only, why one doesn't fit, the search,
  number picks, Backspace, words into a skill and back), the bag screen's mouse (bagMouse.ts: hover, select, drag
  between the bag, the cloth and the slots, turn, use) and tooltip (itemInfo.ts), the item pictures' sizes, and the
  look's pictures (each view's size: the portrait, the chibi facing each way, the battle sprite in each pose; the
  chibi's legs standing together in two boots, the right one in shadow). Rendering, how the fight feels and the React
  screens are tried in a browser.

Time and chance are faked with node:test's mocks (`t.mock.timers`, `t.mock.method(Math, "random")`), and tests read
tuning numbers from the code, so retuning the game doesn't break them.

CI (`.github/workflows/ci.yml`, GitHub Actions) runs `npm run typecheck`, `npm test` and `npm run build` on
Node 26 for every pull request into `main` and every push to it. A PR is merged only once that check is green.

## Rules

- **The server decides; the client asks and draws.** Anything a player shouldn't be able to change lives on the
  server. Everything the client sends is checked against a Zod schema first.
- **The server is core plus outlets** (above). Game rules go in `core/`; anything that talks to the outside world
  goes in an outlet, behind a port.
- **Every player is logged in.** No guest play; `/ws` closes sockets without a login cookie before anything else.
- **Fights are server-authoritative.** The arena's `Fight` is shared code; the server runs it and decides hits,
  damage, stamina, deaths and the result. The client runs its own copy to show it at once, sends only its inputs
  (tagged with their steps) and takes the server's fight whenever the hashes differ. There's no message a client
  could claim a result with, and the result shows only when the server's comes; keep it that way.
- **Keys come from `client/src/settings/bindings.ts`, through `core/keyboard.ts`**, the page's only key listener.
  Game code asks about actions (`core/actions.ts`), the UI listens with `useAction`; neither sees key codes, and
  nothing else listens for keys. When showing a key on screen, read it from the bindings (`keyName`). Esc (the
  settings) and ⌘ can't be rebound.
- **Text is escaped by JSX**, so server or player strings can be rendered safely. No `innerHTML` or
  `dangerouslySetInnerHTML`.
- **Drawing has one owner, `client/src/visuals/`**, the only code that imports Babylon (`npm run typecheck` fails
  otherwise, and on a mode importing visuals/). It reads the modes' state each frame; game code never draws, and
  never hands state to drawing code.
- **Small, single-purpose files** (roughly under 200 lines). Add a folder per new mode, enemy or screen rather than
  growing an existing file. Small math (clamping, smoothing, distances, turning) goes in `shared/src/core/math.ts`.

## Folders and files

**Names.** The map you walk is the **overworld** everywhere (shared `overworld/`, server `core/overworld/`, client
`modes/overworld/`, `Overworld*` components, mode `"overworld"`); the fight is a **battle** (client folder, mode),
and the place it happens is the **arena**. The tower's places are the **world** (shared `world/`, server
`core/world/`, client `visuals/levels/` and `visuals/arenas/`): the tower has floors, a floor has levels, and a level
names the arena its fights happen in. React components are PascalCase `.tsx` files that export components only
(so Vite Fast Refresh works); game code stays `.ts` and imports nothing from React. Numbers with a unit say it in the
name (`MAX_BODY_BYTES`).

**Top level.**

| | |
|---|---|
| `README.md` | a short description, the finished features, how to run it, the top-level folders |
| `ARCHITECTURE.md` | this file |
| `AGENTS.md` | how to work in this repo: ask before game mechanics, decisions so far, checks, git and PRs |
| `plan/` | future plans and parked ideas, one file each |
| `package.json` | the workspaces and every `npm run` script (the workspaces have only their own dev / build) |
| `compose.yaml` | the dev database: Postgres 17 in Docker, on 127.0.0.1 |
| `.env.example` | local settings (database, ports) with working dev values; `.env` is the git-ignored copy |
| `tsconfig.base.json` | strict TypeScript settings every workspace extends |

```
shared/src/      Code client AND server run. No Babylon, no DOM (its tsconfig has no DOM lib).
  index.ts         Re-exports everything but the fight (import from "@infinite-tower/shared")
  core/            ecs.ts (World, components, queries, deferred destroy), components.ts (LocalPlayer),
                   math.ts (Vec2/3, clamp, approach, damp, distXZ, wrapAngle, turnToward, seededRandom, nextRandom),
                   time.ts
  world/           The tower's places. layout.ts (LevelLayout: what the client may see of a level, its floor, tile
                   map and campfires; moveWalker, the one collision rule, and stepWalker on it for prediction +
                   replay; nearCampfire / REST_RANGE), tiles.ts (TILES: each tile kind's character and rules, solid
                   or tall grass; tileAt, isSolid, inTallGrass, mapHalfSize), arena.ts (ArenaDef: an arena's id,
                   radius and ArenaLook, sent in each encounter's FightSetup), day.ts (the time of day from the
                   wall clock, the same everywhere with no messages: DayClock, timeOfDay, retimeDay; sunAt and
                   moonAt, their arcs. Drawing only: nothing in a fight reads it)
  overworld/       view.ts (VIEW: a screen's widest shape, 16:9)
  battle/          components.ts (Player, Wielder and its swing, Health, Stamina, Statuses, Body, Fighter, ActiveHit,
                   SkillObject, Enemy, LungeAttack, ChargeAttack, WeaponAttack, SkillAttack),
                   player.ts (PLAYER tuning, Vitals, GRAVITY), defs.ts (ENEMY_IDS; EnemyDef = body + stats +
                   optional attacks), input.ts (PlayerInput; StepInput, a change of input on the wire,
                   with its step; IDLE_INPUT, copyInput, sameInput, quantizeInput), netcode.ts (what both sides
                   agree on: HASH_EVERY_STEPS, MAX_INPUT_DELAY, MAX_INPUT_LEAD_STEPS), stats.ts (Stats,
                   FighterStats, physicalDamage / skillDamage / moveSpeed / carryLimit)
    fight/           The arena fight, "@infinite-tower/shared/fight" (index.ts; Rapier comes with it).
                     fight.ts (Fight: its own world and physics, the system order, step(inputs), steps, save /
                     load / hash, leave(player), outcome, events, dispose; the enemy motor and player ground
                     systems), setup.ts (FightSetup, the one-on-one
                     starting spots, spawning players and enemies: components + a collider, one component per
                     attack in the def, a Wielder for whoever holds things), context.ts (FightContext,
                     FightOutcome, FightEvent), combat.ts (addHit,
                     hits in an arc or a ray, parrying, blocking, knockback, the hit timers), outcome.ts (won /
                     lost; MAX_FIGHT_TIME, LEAVING_LOSES, playerResult), state.ts (FightSnapshot: the whole state,
                     exactly, out and back in; saveFight, loadFight; hashFight: its fingerprint, numbers rounded
                     to 2 decimals)
      physics/         init.ts (initPhysics: load Rapier once), arena-physics.ts (ArenaPhysics: the floor and the
                       ring of wall, a collider per fighter, sweeps with the character controller, contacts, rays),
                       move.ts (gravity, moving every body, who shoves whom and who passes through)
      player/          controller.ts (move, jump, when to attack, block, dodge, a cast's wind-up, the chant
                       (held still; a skill on no page cast only from it), the bag (held still; gear moved) and
                       writing a page, stamina; controlPlayer; no sword in hand, no attacks or block; no
                       skillbook, no quick-casts or pages)
      skills/          cast.ts (skillSystem: casts released and paid for, segments fired in turn and their modifiers,
                       the skill objects (Bolts, Beams, clouds, Imbues, Delays) stepped, a page written once
                       SAVE_IN_FIGHT_TIME is up; imbueOf),
                       skilled.ts (any fighter's skills: startCast, chant, releaseChant, endCast, interrupt,
                       cantCast, windUpSystem), strike.ts (a stage hitting a target: statuses, reactions, damage;
                       foesNear), statuses.ts
                       (statusSystem; what statuses do to damage dealt and taken, healing, walking speed)
      behaviors/       What enemies do; each enemy is a mix of them. brain.ts (target, approach (or keeping away) /
                       poise / stagger / stun / parried / death), lunge.ts, charge.ts, weapon.ts (seeded chains of
                       swings with the weapon in hand, the Kobold's; on guard, its blade held toward a side that
                       changes at seeded times), skill.ts (casting: a quick-cast up close, a
                       chant a word at a time from farther, backing away while it chants if kept away, seeded
                       extra modifiers, stamina like a player's; the warlock's), sidestep.ts (stepping aside from
                       a Bolt winding up at it), common.ts (enter, roll: the enemy's seeded random numbers)
      weapons/         swing.ts (weaponSystem: every wielder's swing run alike, its hitbox up while live, its blade
                       stopping where it is after a gap, or dead where a guard met it; startSwing, endSwing,
                       stopBlade, restBlade; handsOf)
  character/       character.ts (Character = name + gender + look; LOOK_OPTIONS: every look part's option ids,
                   drawn by client/src/gfx/look/; GENDERS (boy / girl: how the game refers to you, nothing else);
                   name rules)
  items/           items.ts (ITEMS: name, description, size in cells, stack size, weight, what using one does;
                   ItemCounts = item id -> count), bag.ts (Bag: a grid of placed stacks; fits, addItem,
                   moveItem, takeOne, bagWeight, bagProblems: the rules both sides fit items by), gear.ts (Gear:
                   the bag, the cloth (CLOTH) and the Equipment slots; Spot, moveGear between them, gearWeight
                   without the cloth, heldIn), burden.ts (BURDEN, gearBurden: light / heavy / overloaded, and what
                   each does to walking and dodging)
  skills/          skill.ts (a skill as data: segments of a Form, elements and modifiers; FORMS, ELEMENTS, OPPOSITE,
                   MODIFIER_FITS, WORDS (all of them); validateWord / validateSkill: why a word is refused, for the builder
                   and the server's check; skillCost, releaseTime; SKILL: their numbers; SKILLBOOK_PAGES, Skillbook,
                   blankSkillbook, SAVE_IN_FIGHT_TIME, sameSkill; wordKind, NEXT_WORDS, skillOf / wordsOf: words in
                   the order they're chanted <-> a skill), effects.ts (SKILL_EFFECTS: what skills
                   do in a fight, every number; STATUSES, REACTIONS; shotOf: a segment's modifiers
                   applied in order)
  weapons/         weapons.ts (WEAPONS, the arsenal by item id, each of a WEAPON_KINDS kind; weaponIn, weaponItemIn;
                   SWING_DIRS, ATTACK_KINDS, SCREEN_DIR, attackShape (arm reach + length); SWING, Blade,
                   planSwing: a swing from the blade's inertia; liveStep, stepsUntil; PARRY; GUARD)
  net/             client-messages.ts (Zod schemas + inferred ClientMsg, SkillSchema; server-only import),
                   server-messages.ts (ServerMsg types, ServerMsgOf<t>, the socket's CLOSE_CODES), handlers.ts
                   (Handlers<Msg> map + dispatch by `t`, the server's), api.ts (the HTTP API's types: username /
                   password rules, Credentials, AccountInfo, GameServer, ApiError), api-requests.ts (its Zod schemas;
                   server-only import), text-rules.ts (TextRules for the
                   username and character name, rulesHint), text-schema.ts (their Zod check; server-only),
                   settings.ts (MAX_KEYS_PER_ACTION)
shared/test/      Unit tests, mirroring src/ (npm test)

server/          Node. Authoritative: levels, encounters, overworld actors, enemy stats, fight results, saves.
  drizzle.config.ts  drizzle-kit's settings (where the schema and migrations are)
  scripts/         check-layers.ts (the hexagonal import rules; run by `npm run typecheck`)
  test/            Unit tests, mirroring src/. fixtures/: fakes.ts (FakeLink, MemoryPlayerStore,
                   MemoryAccountStore: core's ports in memory), level.ts (TEST_LEVEL, TEST_CHARACTER), fight.ts
                   (a BattleRoom against a FakeClient's copy of the fight, over a wire that can hold messages back)
  src/
    main.ts          The only file that sees everything: loads the fight's physics, builds db -> core -> api + ws,
                     plugs them together, runs the tick timer
    env.ts           DEV, PORT, DATABASE_URL, DEV_PING_MS, SERVER_NAME, MAX_PLAYERS from the environment (loads
                     the repo's .env if there is one; parseDevPing, parsePingMs, parseServerName, parseMaxPlayers)
    core/            The game. No sockets, HTTP, SQL or env.
      ports.ts         What core needs from outside, as interfaces: PlayerStore (+ PlayerSave), AccountStore,
                       PlayerLink
      game/            online.ts (who's playing: one session per account, load on join, save on leave, a second
                       tab takes over, a new player refused past maxPlayers; count), session.ts (GameSession, one
                       player: their save, their overworld, the battle they're in; a method per thing a player can
                       ask; disconnect: mid-fight, leaving it),
                       cheats.ts (runCheat: the dev cheats; in a fight they edit the room's fight),
                       battle.ts (start a battle in a BattleRoom with the bag and what's worn, settle its end for
                       the player: the gear as the fight left it, wins, loot packed into the bag, a loss emptying it
                       and handing a fresh sword and skillbook, vitals), snapshot.ts (the state message: only
                       actors within VIEW_RADIUS_TILES), clock.ts (FixedClock: 60 Hz steps, catching up after stalls)
      battle/          The fight, run by the server. room.ts (BattleRoom: its clock, waits for everyone's first
                       input, runs each step once it has everyone's input or it's MAX_INPUT_DELAY late, sends
                       battleHash and battleSync, ends and frees it; `edit` changes a player's fighter between steps
                       and sends everyone the fight; MAX_START_WAIT_TIME, MIN_SYNC_GAP_STEPS),
                       inputs.ts (InputTimeline: one player's changes of input by step, what's known, late ones
                       on the next step, too far ahead dropped, a silent player let go; SILENT_STOP_STEPS)
      overworld/       The overworld simulation. overworld.ts (Overworld: one player's world, level, systems and
                       spawner), components.ts (OverworldPos, OverworldActor, OverworldPlayer), parts.ts (spawnActor
                       from behavior parts), context.ts (OverworldContext, what systems get), player.ts (input queue
                       + replay, grass encounters, findPlayer), spawner.ts (each spawn an enemy's overworld actor)
        behaviors/       wander, chase (notice -> "!" -> chase), touch (encounter on touch), move (moveWalker)
      world/           The tower: floors, their levels and the arenas fights happen in. level.ts (LevelDef:
                       layout, spawn point, spawns (each may name its own arenaId), encounter table, arenaId;
                       rollEnemy), index.ts (LEVELS and ARENAS by id, START_LEVEL, getLevel, getArena)
        floors/1/        Floor 1's levels, a file each: grass-field.ts (the Grass Field's tile map and spawns, and its
                         arenas)
      enemies/         One file per enemy, by its EnemyId: wild-boar.ts, kobold-swordsman.ts, kobold-greatsword.ts
                       (the swordsman with a greatsword), goblin-warlock.ts (its EnemyDef, its drops, its overworld
                       actor's behavior parts). index.ts (ENEMIES, one line each; isEnemyId, rollDrops)
      content/         player.ts (PLAYER_STATS, fullVitals, newPlayer, giveIfMissing)
      accounts/        accounts.ts (Accounts: sign-up, login check, login sessions; tokens hashed before they're
                       stored), passwords.ts (scrypt)
    ws/              Outlet: the game socket. sockets.ts (takes each /ws socket api/ opened, with its account;
                     joins the player; the connection's simulated ping), connection.ts (one socket = the
                     PlayerLink: Zod-checked in, typed out, delayed both ways by a dev ping), delay.ts (DelayLine:
                     a FIFO that holds each message for a while, in order), handlers.ts (each ClientMsg -> one call
                     on the session; connection.ts answers `ping` itself)
    api/             Outlet: HTTP, on Fastify. server.ts (builds the app: plugins, JSON-only bodies, the built
                     client from client/dist, with hashed assets/ cached for good; /api/servers), cookies.ts (the
                     httpOnly login cookie), errors.ts (every error as `{error}` with a sentence the title screen
                     can show)
      routes/          One Fastify plugin per file, each registered in server.ts. accounts.ts (accountRoutes:
                       the /api handlers; login + sign-up rate-limited), game-socket.ts (gameSocketRoute, /ws:
                       checks the login cookie before the upgrade, then hands the socket on)
    db/              Outlet: Postgres. schema.ts (the tables, in TypeScript: Drizzle ORM), db.ts (connects to
                     DATABASE_URL, applies new migrations at startup), player-store.ts / account-store.ts (the
                     two stores core asks for; one query at a time per player), migrations/ (SQL written by
                     `npm run db:generate`, plus drizzle-kit's meta/), seed.ts (dev data: accounts test1-3,
                     password = username, knowing every skill word, a longsword and a greatsword; refuses to run
                     in production)

client/          Browser game: the two modes, their drawing (Babylon), input, React UI.
  index.html       The page: the 16:9 stage frame, the canvas, #ui
  vite.config.ts   Dev server :5173, proxies /ws and /api to the game server
  test/            Unit tests of the logic that runs without Babylon or the DOM, mirroring src/
  src/
    main.ts          Bootstrap: make the keyboard, mouse and Actions, mount the UI (title screen), ask who's logged
                     in, start preparing the game;
                     logging in (or Play) connects, then joins; Return to title (or a lost connection) leaves
    game/            start.ts (its own lazily loaded chunk with Babylon and Rapier: prepareGame() loads the
                     physics and builds the modes and the drawing (createDrawing: the engine and both scenes) once,
                     behind the title, and returns the Game),
                     game.ts (Game: join() starts a session on a connection, leave() ends it; subscribes to
                     the server messages no mode owns, keeps the settings in sync, runs the frame loop (the
                     mode's update, then `drawing.frame`), overworld <-> battle switching, who has the keys,
                     the character from `welcome` / `character`, opening creation without one; tells the player
                     what happened with `say`; the known words and pages from the server; the fight breaking off
                     the chant; `saveSkill` as the fight's `write` in a battle),
                     transition.ts (Mode,
                     flash / fade), debug.ts (the dev handles on `window`, `cast(skill)` among them)
    net/             net.ts (Net, the game socket: connect, send, `on(type)` with an unsubscribe, onLost, onPing,
                     close; passes on the page's `?ping=`; holds messages until the first listeners), api.ts (every
                     HTTP call: who's logged in, log in, register, log out, the server list), ping.ts
                     (startPinging: Net's ping, every 2 s)
    core/            keyboard.ts (the page's one key listener: held and latched keys, each keydown raw to Actions;
                     text fields keep their keys but the arrows, Esc, the digits and Backspace; captureKey for
                     rebinding), mouse.ts (optional,
                     pointer lock: on a click in the arena, or by itself as the arena starts wanting the mouse when
                     auto lock is on; shouldAutoLock is that rule; buttons as "Mouse0"…), buttons.ts (held +
                     latched presses, counted in order), actions.ts (Actions: the bindings turned around, key ->
                     action, general's plus the place's; the layer stack, `on` for listeners, `poll` for the top
                     layer's held and pressed actions and its axes, the swings read from the mouse's movement
                     (`SWIPE`), `lookDelta` for the arena's mouse movement, and when the mouse may lock)
    settings/        settings.ts (Settings: every kind of setting in one object; main.ts makes it once and passes
                     it to the game and the UI; `welcome` restores the player's, syncSettings sends each change
                     back), bindings.ts (ACTIONS: every action in general, overworld or battle, label, default
                     keys, fixed mouse buttons; MENUS: the title's, creation's, the bag's, the chant's and the
                     skillbook's fixed keys; KeyBindings:
                     the player's keys; keys saved where they used to be,
                     MOVED_FROM, load where they are now), camera.ts (CameraSettings: sensitivity, the
                     overworld camera's quarter turns), mouse.ts
                     (MouseSettings: auto lock, on by default, so a save without it reads as on; swing
                     sensitivity, SWING_SENSITIVITY), hud.ts
                     (HudSettings: show ping, the same way)
    gfx/             Pictures drawn in code onto plain pixels, no Babylon (the UI uses them too)
      items/           items.ts (drawItem: each item's picture for the bag, 16 pixels a cell, in the same pixel
                       kit as look/)
      look/            Character art (ART.md is the style guide): a look drawn as a 64x64 portrait (creation, the
                       character panel, later dialogue), a 32x32 chibi facing front, back or side (the world) and a
                       64x64 battle sprite from behind in each pose (the arena), in code. art.ts (VIEWS,
                       CHIBI_FACINGS, layers, Frame, render), pixels.ts (Pen, masks), palette.ts (ramps), body.ts
                       (body types), battle.ts (POSES, SWORD_POSES, leftHanded), moves.ts (the sword fight's frames),
                       head.ts (face shapes), face.ts (eye and mouth types), hair/ (styles), outfit.ts + jerkin.ts
                       (wear), sword.ts, look.ts (Look -> picture: drawPortrait, drawChibi, drawBattle)
    dev/             art-lab.ts: localhost:5173/art.html (dev server only) draws every look option as the portrait,
                     the chibi facing each way and the battle sprite in each pose and frame, to check art
    ui/              React: everything drawn over the canvas
      mount.tsx        createRoot + <App>; App.tsx picks the HUD for the mode, then notices, banner, the fade between
                       modes (game/transition.ts sets it), Settings, character creation, title screen (the HUD and
                       Settings only once `inWorld` and not creating; creation as soon as a game runs without a
                       character, under the title)
      state.ts         UiState: the stores the game writes (title, screen, overworld HUD, battle HUD, ping, skills:
                       the known words and the book's pages; bars are `...Fraction`, 0..1), `notifications`
                       (notifications/), `settingsScreen`, `creation`, `overworldPanel` (which side panel is open),
                       `chant`, `battleBag`, `skillbookScreen` and `admin` (the UI writes them too, the game watches
                       them; `whoHasTheKeys`: the layer stack, the top one gets the keys), and UiActions (what the
                       UI asks of the game: signIn, logOut, play, rest, useItem, moveItem, castSkill, saveSkill,
                       saveCharacter, returnToTitle, cheat, setDayClock). No React.
      store.ts         Store<T> (set skips unchanged values); useStore.ts reads one value in a component
      keyNames.ts      KeyboardEvent.code / mouse button -> printable name
      styles.css       Tailwind v4 entry + @theme tokens
      components/      Used by more than one screen: Bar.tsx (HUD bar + souls-style damage chip),
                       PlayerBars.tsx (HP + stamina, in the same corner on both HUDs), styles.ts (BUTTON,
                       TEXT_INPUT), noFocus.ts (buttons a click can't focus, so Space / Enter stay with the game),
                       useAction.ts (a component listening for actions), LookPicture.tsx (a look on a
                       canvas: the portrait, or the chibi facing front)
      hud/             OverworldHud.tsx (HP / stamina, wins, level name, ping, the buttons, the panel and rest keys),
                       BattleHud.tsx (and the bag in a fight: the fight's gear, no cloth, no eating; the book over
                       it), HudLayer.tsx (the layer both draw in), character/ (CharacterPanel.tsx: the
                       portrait and stats), inventory/ (the bag screen: InventoryPanel.tsx lays out the equipment,
                       the cloth and the bag, wires the mouse and the bag keys, and shows the selected item, the
                       dragged ghost and the tooltip; BagGrid.tsx draws a grid (the bag or the cloth) and its
                       hovered / selected / landing states, EquipmentSlots.tsx the slots; bagMouse.ts holds those
                       states as plain data, itemInfo.ts the tooltip's lines, grid.ts the cell and slot sizes),
                       PanelFrame.tsx (the side panels'
                       box), layout.ts (the side panels' widths and the Rest button's place, which the notices keep
                       clear of), icons.tsx, Ping.tsx (both HUDs' ping)
      skills/          chant.ts (ChantState; the carousel's rules: what the next square takes, `choices` with why
                       a known word doesn't fit, `quickPick`, addWord / undoWord, skillText),
                       SkillBuilder.tsx (the squares sliding left, the word search and list, the number and Backspace
                       keys), ChantPopup.tsx (the fight's chant: open / close, cast, a page written, shown
                       while the fight writes it; the fight breaks it off, through game.ts), SkillbookScreen.tsx
                       (the book in hand, over the bag: its 4 pages, written at once), Hotbar.tsx (the pages on
                       the battle HUD with their keys)
      notifications/   What the player is told, and where. say.ts (`say(to, event)`; `GameEvent`, what happened;
                       `EVENT_MESSAGES`, one entry per kind of event: where it goes, "centre" or "corner", and its
                       lines), battleResult.ts (what a `battleResult` says: found, left behind, died / lost,
                       refused), state.ts (Notifications, UiState's `notifications`: the notices' and the banner's
                       stores, notify / announce / dismiss / clear, MAX_NOTICES), Notices.tsx (the corner: newest
                       at the bottom, at most 5 showing, wrapping at 20rem, about 8 s each, beside an open side panel
                       and above the Rest button), Announcement.tsx (the centre banner: one at a time, wraps in the
                       middle 80%, no ×: it fades on its own), useFadeOut.ts (hold, fade, dismiss)
      screens/         One folder per full-screen page, holding the parts only that page uses
        title/           TitleScreen.tsx (login form, or the server list, Play / Retry and Log out; status line, the
                         sequence's layers), LoginForm.tsx, ServerList.tsx (name and players / cap, or Full),
                         MenuButton.tsx (the big "◆ Play"), styles.ts, sequence.ts (the enter / leave sequences'
                         stages and timing), useSequence.ts (the stage for the title's phase)
          backdrop/        The title's low-poly scene on a 2D canvas: Backdrop.tsx (the scene + light shafts, motes,
                         grain, vignette), Scene.tsx (canvas, frame loop), draw.ts (painter's order, glow layer),
                         world.ts (tiles, tower, its shadow, crystals), light.ts (moon, the tower's own light,
                         glint, rim, fog into dark / light, tone map), path.ts (the camera through the sequence),
                         space.ts
        admin/           AdminPanel.tsx (dev only, F1 toggles, Esc closes: the cheats; the time of day and its speed set
                         through `setDayClock`), admin.ts (its times, speeds and counts)
        settings/        SettingsScreen.tsx (Esc toggles, Show ping, Return to title), CameraSection.tsx
                         (camera and swing sensitivity, Auto mouse lock), KeyBindingsList.tsx (rebinding), styles.ts (a setting's row)
        creation/        A new player making their character, on white: CreationScreen.tsx (the scene: the System's
                         greeting, the panel beside the portrait and chibi, "Is this you?", saving, the farewell,
                         the white clearing off the world), scene.ts (its steps, a pure reducer), lines.ts (what
                         the System says), LookMaker.tsx (the panel), options.ts (its rows), SystemWindow.tsx,
                         useTyped.ts (text typed out), styles.ts (dark on white)
    modes/           The two game modes: game logic only, no Babylon (visuals/ draws them)
      overworld/       The overworld mode: mirrors the server
        overworld.ts     The mode: its state (the level, the actors, the camera's turns), level loads, the walk keys
                         (turned to the camera) and the camera's turn keys, server state, the overworld HUD
        prediction.ts    Predict your own walking (and heading), reconcile with the server's acks
        facing.ts        Heading (north / east / south / west, on the map) and Facing (up / right / down / left, on
                         screen): faceToward, mapMove (walk keys to a move on the map), facingOnScreen, mirrorFor
        mirror.ts        Mirror the server's actors, each with its kind
        components.ts    OverworldPos, OverworldActor (its kind: the player, a boar, a Kobold, a goblin),
                         OverworldState
      battle/          The 2.5D arena mode: your own copy of the whole fight, run at once and kept in line
        battle.ts        The mode: start / end a fight (the fight's copy from the encounter's setup), per frame the
                         fight's steps (as many as pace.ts says) and the inputs out (1-4 quick-cast the fight's pages, the
                         chant held open, a page to write), the fight's pages into the HUD, hashes, syncs and the
                         result in; each frame's events and corrections
        sync.ts          FightSync: runs the fight with your inputs, sends their changes with their steps, checks the
                         server's hashes, loads its fight and replays on a mismatch; every step's events (`events`,
                         replays included); the server's outcome; stats (INPUT_HEARTBEAT_STEPS, HISTORY_STEPS)
        pace.ts          Pace: the fight's clock, steps due each frame, in step with the server's (PACE_SLACK_STEPS,
                         MAX_STEPS_PER_FRAME, MAX_BACKLOG_STEPS)
        context.ts       BattleContext (the fight, its sync, its outcome as the server says, the lock, the camera's
                         view, this frame's events and corrections, the skills waiting to be cast), resultShown
        camera.ts        The camera's orbit, locked or not, in plain numbers (ArenaView: yaw, pitch, eye, at): its
                         yaw is the aim
        lock.ts          The lock-on: steerLock (lock / unlock / lock closest / retarget by screen side, off when the
                         target dies), lockYaw (the way to face it), no Babylon: tested
        input.ts         A poll -> PlayerInputData (the attack is the last pressed)
        hud.ts           Fills the battle HUD's store, stunned and the skillbook in hand included
    visuals/         All the drawing: the only code that imports Babylon. Reads the modes' state; nothing hands it any
      visuals.ts       The owner: createDrawing (the engine, both scenes; `show(mode)`, `frame(dt)`; the player's look
                       painted); Visual ({ spawn, frame, dispose }); VISUALS (each kind of thing in a fight) and
                       kindOf; EFFECTS (each fight event's one-shot effect) and FiredEffects (once per step and event)
      characters.ts    PlayerLook: paints a look's chibi at once and its battle frames one per slice after, or the
                       rest when a fight starts, again when the fight's weapon or its hand changes (its `Wielder`);
                       BATTLE_FRAMES; the "!" alert
      enemies/         One folder per enemy, by its EnemyId: wild-boar/, kobold-swordsman/, goblin-warlock/, each
                       with model.ts (built from primitives), pose.ts (where its parts head, from its state; no
                       Babylon: tested), animation.ts (its fight visual: the pose eased into, the walk) and sprite.ts
                       (its overworld picture and size); kobold-greatsword/ has only its sprite.ts and animation.ts:
                       the swordsman's lizard model, bulkier and plated (KoboldBuild; its blade comes from
                       WEAPON_LOOKS). index.ts (ENEMY_LOOKS, one line each;
                       byEnemy)
      sprites.ts       spriteMaterial, redrawSprite; textures.ts (procedural textures; glowTexture and
                       puffTexture for particles); materials.ts (colorMaterial)
      battle/
        scene.ts         ArenaScene (what the arena's visuals share): the scene, camera, its sky, post, materials, the
                         skill kit, each fighter's node, the shake, each fighter's impact
        impact.ts        Weapon impacts, drawing only: a hit's hit-stop and the target's jolt the blade's way, a stopped
                         blade's bounce and sparks (strike, clash); impactPose and joltOf (no Babylon: tested)
        battle.ts        fighter() (a fighter's node following its body, eased over corrections, held by a hit-stop and
                         pushed by a jolt, its reactions' bursts, and any skilled fighter's chant circle and chant
                         words), arenaStage (the scenery per arena, the camera on the mode's view plus shake, the
                         lock-on's diamond)
        materials.ts     The arena's materials (the player's frames among them)
        player.ts        The player's visual: the sprite, its shadow, the sword's trail, thrust and guard (in an
                         Imbue's colour)
        chantWords.ts    Another fighter's chant: its last words and the next, empty square, in front of it
        pose.ts          The player's pose and frame, from the action and the swing. No Babylon: tested
        arm.ts           The humanoid arm rig every 3D enemy's arms use: shoulder, upper arm, elbow, forearm and hand,
                         reached each frame with two-joint IK (reachArm, no Babylon: tested) to where its pose puts
                         the hand; a wielder's arm is its armReachM long
        weapons.ts       Any wielder's weapon, from its swing: the frame (wind-up, live, follow-through); MOTIONS, by
                         weapon kind: the trail's line and the stab's thrust (by the blade's place on its stroke), a 3D
                         blade's way through a wind-up and a
                         swing (the Kobold's); WEAPON_LOOKS, by weapon: its picture in the player's sprite, a 3D
                         model's blade and its hit-stop. No Babylon: tested
        skills.ts        The skills' effects, built in code, pooled: the kit (bursts: Nova, Self, Imbue's cast, a
                         Bolt's impact, the reactions, Earth's shards, a clash's sparks), the chant's and wind-up's
                         circle, and a visual per SkillObject kind (a Bolt's core and trail or an Earth rock, a
                         Beam's tubes and flares, a cloud's dome and pulse, a Delay's orb, an Imbue's glow at the
                         sword hand)
        skillLooks.ts    SHADER_LOOKS and PARTICLE_LOOKS (each element's colours and motion), the skill shader
                         (GLSL: flow / shell / circle / ring) and its pooled meshes, pooled particles, Lightning's arcs
      overworld/       The overworld, drawn HD-2D style: pixel-art billboards on 3D ground (the flat 2D one is
                       archived: plan/overworld-2d.md)
        scene.ts         OverworldScene: perspective camera, its sky, bloom, colour grade, vignette and the
                         tilt-shift blur (GLSL); the sprite materials; standingQuad
        overworld.ts     WALKERS (chibi and enemy billboards: glide, hop, facing, the sky's tint and blob shadows, "!"),
                         overworldStage (the level, the camera following the player and easing through its quarter
                         turns, the sky's frame)
        scenery.ts       Scenery's shapes (ledges, props) and the rules every level's keeps: groundY, isTall
        terrain.ts       Builds it: hands the sky the level's look and campfire lights; cliff blocks (shadow casters),
                         grass tops and fringes, the map's ground (paintGround), instanced props (the tiles' and the
                         scenery's, each tinted by the light where it stands; a tall one's shadows come from upright
                         cards only shadow maps see, one kept turned to the sun or moon and one turned to each campfire
                         in reach, each cast by its own light), the campfires; face turns the props to the camera
        props.ts         The pixel-art props (trees, pines, bushes, rocks, ruins, grass, flowers), drawn standing up;
                         Pen
      levels/          Each level's drawing, a folder per LevelLayout.theme. index.ts (LEVEL_LOOKS: its env (daylight
                       colours and fog), tile looks and the 3D surroundings; the campfire's picture and light,
                       campfireLights), tiles.ts (paintGround and tileProps: a map's ground picture and props from its
                       tile looks)
        grass-field/     tiles.ts (GRASS_FIELD_TILES: each tile kind's ground painter and props, dusky colours),
                         scenery.ts (the 3D cliffs and woods round the map; no Babylon: tested)
      sky/             sky.ts: the one owner of the arena's and overworld's lights and shadows (nothing else makes a
                       light or a shadow generator): the time of day's sun or moon (one shadow-casting light,
                       cross-faded at the horizon) and their discs, the sky light, sky colour and fog over a look's
                       colours (SkyLook), the map's flickering point lights (the nearest the camera cast shadows), a
                       sprite's tint and blob shadows (Blobs: a round one from the sky light, and one away from each
                       light that reaches it, as dark as that light's share there; blobShadowsAt, tested), the yaw
                       that turns a shadow card to a light; setDayClock (dev: `?time=`, `window.setTime`)
      arenas/          Each arena's look, a folder per ArenaLook. index.ts (ARENA_LOOKS, one line each: a look's
                         env (its daylight colours and fog), its map lights and build; showArena, the one call
                         battle.ts makes: hands the sky its look and returns the look's root, whose disposal takes
                         its meshes and materials), parts.ts (what
                         the looks share: lookRoot, speckled, floor, scatter, ringSpots, settle)
        forest-clearing/ the boar's and tall grass's: moss, a dirt floor, standing stones, pines, ferns, logs
        stone-ruins/     the Kobolds': flagstones, broken columns and walls, two arches, far ruins, cypresses
        mire/            the Goblin Warlock's: peat, stumps, glowing mushrooms, pools, reeds, dead trees
```

## Adding things

- **A message.** Client -> server: a Zod schema in `shared/src/net/client-messages.ts` and the union, a method on
  `GameSession` (`server/src/core/game/session.ts`) that does it, and a handler in `server/src/ws/handlers.ts` that
  calls it (TypeScript errors until you do). Server -> client: a case in `ServerMsg` (`server-messages.ts`) and a
  `net.on("<type>", ...)` where it's used (the mode that owns it, or `client/src/game/game.ts`).
- **A level.** A file in its floor's folder, `server/src/core/world/floors/<n>/<level-id>.ts`, exporting its
  `LevelDef` (its `floor`, and its map as rows of tile characters, north first, centred on 0, 0), and its line in
  `LEVELS` (`server/src/core/world/index.ts`). It names its arena by `arenaId`. The level's test walks the map: the
  start, the campfires and every spawn (mirrored too, as the spawner may) clear of solid tiles and reachable. For a
  new look, a theme in `LevelLayout["theme"]` (`shared/src/world/layout.ts`), a folder named by it in
  `client/src/visuals/levels/` (its tile looks and 3D scenery) and its line in `LEVEL_LOOKS`.
- **A tile kind.** Its line in `TILES` (`shared/src/world/tiles.ts`: a character no other kind uses, solid or not,
  tall grass or not); walking, encounters and enemies follow from it. Then how it looks in every level look's tile
  table (`client/src/visuals/levels/<theme>/tiles.ts`: a ground painter, and props if it has any; TypeScript errors
  until it's there), which the overworld draws. A new prop is its art in `PROP_ART`.
- **An arena.** An `ArenaDef` (id, radius, look) beside the level that fights in it, and its line in `ARENAS`. The
  level's `arenaId` is where tall grass and spawns without one fight; a spawn's own `arenaId` takes its fights
  elsewhere (`startBattle`). Every arena has the same radius for now (tested). The wall's shape is the fight's
  (`arena-physics.ts`), from the radius; a look never changes how a fight plays.
- **An arena look.** Its name in `ARENA_LOOK_IDS` (`shared/src/world/arena.ts`), a folder named by it in
  `client/src/visuals/arenas/` exporting an `ArenaLookDef` (`env`: sky, fog, ambient, sky light, sun; `build`: every
  mesh under one `lookRoot`, its materials `own`ed, ending in `settle`), and its line in `ARENA_LOOKS` (TypeScript
  errors until it's there). Dressing stays outside the radius: nothing inside the wall but the floor.
- **An enemy.** Its id in `EnemyId` (`shared/src/battle/defs.ts`); a file named by it in `server/src/core/enemies/`
  (its `EnemyDef` combining behaviors, its drops, its overworld actor's behavior parts) and its line in `ENEMIES`;
  a folder named by it in `client/src/visuals/enemies/` (model, pose and its test, animation, sprite) and its line
  in `ENEMY_LOOKS` (TypeScript errors until both are there); and a spawn in a level. A new enemy behavior is a def
  shape in `shared/src/battle/defs.ts`, a component and its states in `EnemyState`
  (`shared/src/battle/components.ts`), an entry in `ATTACKS` (`shared/src/battle/fight/setup.ts`) and a system in
  `shared/src/battle/fight/behaviors/`, listed in `fight.ts`, its state in `fight/state.ts`. A new overworld
  behavior: component + factory + system in `server/src/core/overworld/behaviors/`.
- **A weapon.** An item in `ITEMS` (`shared/src/items/items.ts`, worn on a hand), its row in `WEAPONS`
  (`shared/src/weapons/weapons.ts`: kind, length, damage, speed), its bag picture (`client/src/gfx/items/items.ts`)
  and its row in `WEAPON_LOOKS` (`client/src/visuals/battle/weapons.ts`). Whoever holds it swings it with the
  kind's moves and `MOTIONS` row, so a weapon of a kind that exists needs no animation code. A new kind is a name in
  `WEAPON_KINDS` and a `MOTIONS` row (and, for the player, its sprite poses).
- **An enemy that wields a weapon.** `wielder` on its `EnemyDef` (`{ hands: { rightHand: "kobold-blade" },
  armReachM }`) gives it a `Wielder`; a `weapon` attack makes it fight like the Kobold, or its own AI calls
  `startSwing` (`fight/weapons/swing.ts`) with the swing's steps and damage. The weapon system does the rest. A 3D
  model draws its blade from `WEAPON_LOOKS` (two-handed or not) and moves it with its weapon kind's `MOTIONS` row,
  in the hand of an arm from `visuals/battle/arm.ts`; its pose puts the hand and turns the body ahead of the blade.
- **A visual** (anything new drawn in a fight). One row in `VISUALS` (`client/src/visuals/visuals.ts`): a
  `Visual` with `spawn` (build its meshes), `frame` (pose them from the entity's components, each frame) and
  `dispose`, and its kind in `kindOf`, from a component the entity already has. Its pose is a function of that
  state, without Babylon, beside it and tested; its own state holds only meshes and smoothing. A one-shot effect of a
  fight event is an entry in `EFFECTS`. Nothing outside `visuals/` changes: the mode already holds the state it
  draws (if it doesn't, add it to the mode's state, not a call into drawing).
- **Something kept between connections.** A field on `PlayerSave` (`server/src/core/ports.ts`) and `newPlayer()`
  (`core/content/player.ts`), read in `GameSession`'s constructor and written in `GameSession.save()`; a column in
  `server/src/db/schema.ts` (then a migration, below), and `toRow` / `fromRow` in `db/player-store.ts`.
  Another store is a class implementing `PlayerStore`, swapped in for `new PgPlayerStore(db)` in `main.ts`.
- **A schema change.** Edit `server/src/db/schema.ts`, run `npm run db:generate -- --name <what-changed>`, read the
  SQL it wrote and commit it with `migrations/meta/`. drizzle-kit asks when it can't tell a rename from a drop +
  add. For a data change it can't work out, `npm run db:generate -- --custom --name <what>` writes an empty
  migration to fill in. Don't edit merged migrations: databases that already ran them won't run them again.
- **An HTTP route.** A handler in `server/src/api/routes/accounts.ts` (or a new plugin file in `api/routes/`,
  registered in `api/server.ts`), with its body's Zod schema in `shared/src/net/` as `schema: { body }`;
  `req.body` comes typed and checked. Throw `HttpError(status, sentence)` for an answer the client should show.
  Logic goes in core, not in the handler.
- **Something core needs from outside** (a clock, mail, another database). An interface in `core/ports.ts`, an
  implementation in an outlet (or a new outlet folder, added to `OUTLETS` in `server/scripts/check-layers.ts`),
  and one line in `main.ts` passing it in. Core never imports the implementation.
- **A key binding.** The action in `ACTIONS` (`client/src/settings/bindings.ts`, label + default keys) in general,
  overworld or battle, read from `actions.poll()` (`held`, `pressed`; a pair of opposites goes in `AXES`), or
  listened for with `useAction(input, [<action>], ...)`, and added to its layer in `LayerActions` (`core/actions.ts`)
  if it isn't the whole group's; the settings screen lists it on its own.
- **A new kind of setting.** A store in `client/src/settings/` with `restore` / `toSaved` (see camera.ts), added to
  `Settings`, `createSettings()`, `restoreSettings()` and `toSaved()` in settings.ts, a field in
  `SavedSettingsSchema` (`shared/src/net/client-messages.ts`), and a section in `ui/screens/settings/` shown by
  SettingsScreen. The server stores whatever passes the schema (`players.settings`, jsonb). Game code reads it
  from the `settings` it already has (`ctx.settings` in the arena).
- **A UI screen or HUD piece.** A component in `client/src/ui/` (`hud/`, or a folder of its own in
  `screens/`; parts used by more than one screen go in `components/`). If the game has to feed it, add fields to a
  store in `ui/state.ts` and `set` them from game code; if it has to ask the game for something, add a function to
  `UiActions` (main.ts provides them).
- **A cheat** (dev only). A case in `CheatSchema` (`shared/src/net/client-messages.ts`), its branch in `runCheat`
  (`server/src/core/game/cheats.ts`; a fight's state changes through `room.edit`), a test that production ignores it,
  and a button in `client/src/ui/screens/admin/AdminPanel.tsx`.
- **Something the game says to the player.** A case in `GameEvent` (`client/src/ui/notifications/say.ts`) and its
  entry in `EVENT_MESSAGES` (TypeScript errors until you add it): `where: "corner"` (a notice) for anything small,
  `"centre"` (the banner) only for bigger events like a fight starting; long wording gets its own file there, like
  battleResult.ts. Game code calls `say(ui.notifications, { kind: ... })`. Test the words in
  `client/test/ui/notifications/say.test.ts`; its placement test lists the events allowed in the centre.

## Where to tune things

| What | Where |
|---|---|
| Player HP, speeds, swing / stab / block / dodge costs and feel (at stats of 10) | `shared/src/battle/player.ts` (`PLAYER`) |
| Weapons: the arsenal (length, mass, balance, power); swing times, flow, the clamp; parrying, an enemy's guard sides | `shared/src/weapons/weapons.ts` (`WEAPONS`, `SWING`, `PARRY`, `GUARD`) |
| Arm reach (to the hilt) | `PLAYER.armReachM`; an enemy's `wielder.armReachM` |
| Player stats | `server/src/core/content/player.ts` (`PLAYER_STATS`) |
| Enemy stats, attacks, sidesteps, keeping away, what and how it casts, drops, overworld wandering and chasing | `server/src/core/enemies/<id>.ts` |
| Items: size, stack size, weight, healing, the slot they're worn in | `shared/src/items/items.ts` |
| Bag size | `shared/src/items/bag.ts` (`STARTER_BAG`) |
| Cloth size, slots, the starting equipment | `shared/src/items/gear.ts` (`CLOTH`, `SLOTS`, `starterEquipment`) |
| Players a server lets on, its name in the server list | `.env` (`MAX_PLAYERS`, `SERVER_NAME`); defaults in `server/src/env.ts` |
| Carry limit | `shared/src/battle/stats.ts` (`CARRY`) |
| What carrying too much does | `shared/src/items/burden.ts` (`BURDEN`) |
| Skills: word costs, how a chain's cost grows, release time; which modifiers fit which Form | `shared/src/skills/skill.ts` (`SKILL`, `MODIFIER_FITS`) |
| How long writing a page takes in a fight | `shared/src/skills/skill.ts` (`SAVE_IN_FIGHT_TIME`) |
| Skills in a fight: D, the Forms, each element, the reactions, Self, the modifiers, the object caps | `shared/src/skills/effects.ts` (`SKILL_EFFECTS`) |
| How each element's skills look (colours, how ragged and fast they move, their particles) | `client/src/visuals/battle/skillLooks.ts` |
| How far back a Kobold draws its blade (and leans) before a swing or stab, drawn only | `KOBOLD_DRAWBACK` in `client/src/visuals/enemies/kobold-swordsman/pose.ts` |
| Hit-stop by weapon; a parry's, the hit's jolt and a stopped blade's bounce | `hitStopMs` in `WEAPON_LOOKS` (`client/src/visuals/battle/weapons.ts`); top of `client/src/visuals/battle/impact.ts` |
| Levels: map, spawns, encounter tables, campfires, arena size, which arena each spawn fights in | `server/src/core/world/floors/` |
| Which tiles block walking or roll encounters | `shared/src/world/tiles.ts` (`TILES`) |
| How big a walker is against solid tiles | `shared/src/world/layout.ts` (`WALKER_RADIUS`) |
| How each tile looks; the overworld's colour grade and camera (its turn time), a walker's blob size | `client/src/visuals/levels/` (`tiles.ts` per look), `client/src/visuals/overworld/scene.ts`, top of `client/src/visuals/overworld/overworld.ts` |
| A level's daylight sky, fog and light; a campfire's light | `env` in `LEVEL_LOOKS` and `CAMPFIRE_LIGHT` in `client/src/visuals/levels/index.ts` |
| An arena look's daylight sky, fog and light; its map lights | `env` and `lights` in each `client/src/visuals/arenas/<look>/` |
| The day's length; the sun's and moon's arcs | top of `shared/src/world/day.ts` |
| The time of day's light: colours by sun height, moonlight, fades, map-light shadows, sprite tint, blob shadows, sun and moon discs | top of `client/src/visuals/sky/sky.ts` |
| Arena camera feel, locked and not | top of `client/src/modes/battle/camera.ts` |
| How quick a mouse flick swings (distance, time, rest between sweeps) | `SWIPE` in `client/src/core/actions.ts` |
| Retarget ties | `client/src/modes/battle/lock.ts` (`RETARGET_TIE_RAD`) |
| Where a fight starts | `shared/src/battle/fight/setup.ts` |
| The arena's wall and floor | `shared/src/battle/fight/physics/arena-physics.ts` |
| How a fight ends: time limit, leaving mid-fight | `shared/src/battle/fight/outcome.ts` |
| Fight netcode: hash rate, how late an input may be, how far ahead | `shared/src/battle/netcode.ts` |
| Fight netcode: start wait, resync gap | `server/src/core/battle/room.ts` |
| Fight netcode: a silent player letting go | `server/src/core/battle/inputs.ts` |
| Fight netcode: heartbeat, history, pacing | `client/src/modes/battle/sync.ts`, `client/src/modes/battle/pace.ts` |
| View: a screen's widest shape; how far round the player actors are sent | `shared/src/overworld/view.ts` (`VIEW`); `VIEW_RADIUS_TILES` in `server/src/core/game/snapshot.ts` |

Changing any of these changes how the game plays: ask first (see [AGENTS.md](AGENTS.md)).
