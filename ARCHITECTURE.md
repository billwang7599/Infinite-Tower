# Architecture

How Infinite Tower's code fits together: the pieces, how they talk, the rules, where things live and how to add
them. The numbers that decide how the game plays are in [FORMULAS.md](FORMULAS.md) and the code.

## The big picture

```
              Browser: client/
  ui/ (React)    game/    modes/: overworld/, battle/    visuals/ (Babylon)    audio/ (Web Audio)
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

shared/: code both sides run (ECS, math, message types + Zod schemas, walking, the world's tiles, items and the
         arena fight with its Rapier physics)
art-lab/: a dev tool beside the game, never shipped: it imports the client's art; nothing imports it
```

The rule: **shared = code both sides run; server = anything a player must not be able to change; client = drawing,
input, feel.** Everything in `shared/` and `client/` ships to the browser, so data only the server needs (encounter
rates, spawns, enemy stats, drop tables) stays in `server/`.

## A player's visit

1. **Title.** The React title screen shows at once while the game (Babylon, Rapier, both scenes) loads behind it as
   its own lazily loaded chunk.
2. **Login.** `POST /api/login` sets an httpOnly session cookie; the title then lists the game servers.
3. **Join.** Play opens the picked server's `/ws` with the cookie. The server loads the save and sends `welcome`;
   a player with no character makes one first (the server takes only one). Then come the world's map and the
   chunks of tiles round you.
4. **Overworld.** The client sends its walking inputs each tick and predicts its own walk with the shared walker;
   the server replays them, runs the world's actors and tall-grass encounters, and sends `state` with what's near.
   Chunks arrive and are dropped as you move.
5. **Fight.** The server makes a fight and sends `encounter` with its setup. The browser builds the same fight and
   runs it at once, sending only its inputs; the server runs the same fight on them, decides it, rolls drops into
   the arena and sends the result. After a win the arena stays open for the loot until the last player leaves.
6. **Leave.** Closing the socket saves. Leaving mid-fight loses it. A second tab on the same account takes over.

## Server: core plus outlets

The server is hexagonal. `server/src/core/` is the game: sessions, the overworld, fights, the world, content and the
account rules. It knows nothing about sockets, HTTP, SQL or env; what it needs from outside it asks for through the
interfaces in `core/ports.ts`. Outlets plug into it, and `main.ts` is the only file that sees everything: it loads
Rapier, connects the database (applying migrations), builds the account and player stores, starts Fastify with the
game socket, and runs a fixed 60 Hz clock that ticks the overworld and every session.

| Port (`core/ports.ts`) | What core uses it for | Implemented by |
|---|---|---|
| `PlayerStore` | load and save a player; who holds each unique thing | `db/` (Postgres) |
| `AccountStore` | accounts and login sessions | `db/` (Postgres) |
| `PlayerLink` | send messages to one player, close their connection | `ws/` (the socket) |

- Core imports only `core/`, `shared` and `node:crypto`. An outlet imports core and itself, never another outlet;
  when two must meet, the one that needs something defines an interface and `main.ts` passes in the other's.
- `npm run typecheck` runs `server/scripts/check-layers.ts`, which fails on an import that breaks this.
- Core runs with fake stores and links in tests, without Postgres or a browser. Each player is a `GameSession`
  (`core/game/`), which does everything a player can ask for.

## Client: two modes, one ECS world

- **Game data is ECS** (`shared/src/core/ecs.ts`); systems are functions run in a fixed order. Services (the
  connection, keyboard, mouse, prediction, the fight's sync) are plain classes.
- **Two modes.** `game/game.ts` runs the frame loop and switches between the overworld (`modes/overworld/`) and the
  fight (`modes/battle/`). The modes do game logic only and import no Babylon.
- **One input system.** The devices (`core/keyboard.ts`, the page's only key listener, and `core/mouse.ts`) know only
  buttons; `core/actions.ts` alone turns them into actions, for a stack of layers where only the top one gets keys
  (the arena, with Settings or the chat over it). Game code polls actions each tick; the UI listens with
  `useAction`. Actions also own the mouse: pointer lock in fights, drags that turn the camera, flicks that aim swings.
- **Drawing has one owner, `client/src/visuals/`**, the only code that imports Babylon. Each frame it reads the shown
  mode's state itself: every kind of thing in a fight is one row in `VISUALS` (spawn, frame, dispose), every one-shot
  effect of a fight event a row in `EFFECTS`, and poses are Babylon-free functions that are tested. Game code never
  draws or hands state to the drawing.
- **Sound has one owner, `client/src/audio/`**, built the same way: it hears the mode's state each frame and returns
  plain cues and loops (tested), and only `audio/audio.ts` touches Web Audio. Music is picked the same way, by mode,
  region and arena. Every file is CC0 (SOUNDS.md).
- **The UI is React** (`client/src/ui/`) over the canvas. The game writes plain values into stores (`ui/state.ts`)
  and never touches the DOM; components read them with `useStore`. What the game says to the player goes through
  `say` and one table of words per event. The UI asks the game for things through `UiActions`.
- **Every screen sees at most 16:9**; wider windows get bars.

## The fight

- **One shared `Fight`** (`shared/src/battle/fight/`, its own entry point so Rapier stays out of the title's chunk):
  one object per battle with its own ECS world, its own Rapier world and fixed steps, for any number of players and
  enemies. Its only randomness comes from seeds in its state and Rapier's deterministic build, so the same setup and
  inputs always give the same fight. Its whole state saves and loads as plain JSON and hashes to a fingerprint.
- **Systems run in order**: player controller, enemy brain, attacks, motor, physics, ground, combat, outcome. A step
  reports what happened as events (hits, blocks, releases), which drawing and sound read once each.
- **Fighters are moved by code, not forces**: systems set velocities, and the physics only resolves collisions.
- **Attacks and enemies are data.** Weapons are items with a `weapon` component and a kind whose moves are data;
  enemy behaviours are components with a system each, combined in an enemy's def. AI only sets state and hitboxes;
  the drawing reads that state to pose models.
- **Skills are inputs too**: every fighter is `Skilled`, so players and enemies chant and cast through the same calls.
- **Any damage goes through one `hurt`**, which applies defenses, statuses and invulnerability.
- **The server runs it** (`server/src/core/battle/`): a room per battle keeps a clock and runs the fight as soon as it
  has every player's input for the next step, waiting a little for late ones. It decides hits, damage, stamina,
  deaths and the result. Players can join a fight under way, and duels are fights between two players.
- **The browser runs its own copy** (`modes/battle/`), built from the encounter's setup, so you and the enemies answer
  at once; other players are predicted and corrected by replay. The result, loot and saving wait for the server's.

## Networking

The browser only talks to its own page's host: in dev Vite forwards `/ws` and `/api` to the server; in production
the server serves the built client itself, behind a Cloudflare Tunnel (README, "Hosting").

**HTTP** (`server/src/api/`, Fastify): register, login, logout, who's logged in, and the server list. Bodies are
small JSON, checked by the shared Zod schemas; errors are a sentence the title can show; logins are rate-limited per
address. The client makes every HTTP call through `client/src/net/api.ts`.

**The game socket** (`/ws`, plain `ws`; Fastify only does the handshake). Before the upgrade the API looks up the
cookie's account; then `ws/` wraps the socket in a `Connection` (the `PlayerLink`) and joins it to `OnlinePlayers`,
which closes the account's other tab, loads the save and makes a `GameSession`. Each message then flows:

```
socket -> Connection (rate and size caps, Zod check; flooding or repeated bad messages close it)
       -> OnlinePlayers.heard (idle tracking) -> ws/handlers.ts -> GameSession -> link.send(...)
```

Overworld `state` and fight hashes aren't answers: the clock sends them. Client messages are in
`shared/src/net/client-messages.ts` (with their schemas), server messages in `server-messages.ts`, close codes there
too. In the browser one `Net` (`client/src/net/net.ts`) owns the socket; each part of the game subscribes to the
messages it needs with `net.on(type, fn)`.

**A fight on the wire.** Both sides number the fight's steps. The client sends its changes of input, each tagged
with its step; the server runs each on its own step (late ones within a window, early ones held, far-ahead ones
dropped, so nobody runs ahead of real time). A few times a second the server sends a hash of its fight; a client
whose copy differs asks for the whole fight, loads it and replays its inputs since. With other players in the fight
the server relays their inputs, and a client predicts them as repeating their last and replays when the real ones
arrive. No message says how a fight ended except the server's own result. What's still open:
[plan/server-fights.md](plan/server-fights.md).

**Chat** is one log for the whole server, in memory only, rate-limited, stamped with the speaker's name by the server.
**A simulated ping** delays a dev server's socket messages so the netcode can be felt locally; production never does.

## Saving

What's kept between connections is a `PlayerSave` (`core/ports.ts`), keyed by account: vitals, the core, character,
settings, gear (bag, backpack, quiver, slots), known words, the skillbook, the story, faith, first purchases and the
bound pad. Position isn't saved. The store only maps columns; every rule about what of a stored save still fits the
game (items, words, quests or ids that no longer exist, grids of another size) is in `keptSave`, run as a player
joins. The session saves after every fight, rest, item use and quest step, on disconnect, and soon after a settings
change, a bag move, a trade or a page written. The cloth, open piles and overworld piles are never saved. Who holds
each unique thing is saved apart. Postgres is reached through Drizzle (`server/src/db/schema.ts`); the server applies
new migrations as it starts.

## Tests

`npm test` runs every `*.test.ts` under each workspace's `test/` with Node's test runner; no framework, database or
browser. Each `test/` mirrors its `src/` and has its own tsconfig, checked by typecheck. Server core is tested
through its ports with fakes (`server/test/fixtures/`), the HTTP API with `app.inject()`, and the fight headless with
enemies whose numbers the tests own; they check mechanics, never who wins a fight. Pure logic on the client
(poses, sound cues, actions, notifications) and the art lab's editor is tested without a browser. CI runs typecheck,
test and build on every PR into `main`.

## Rules

- **The server decides; the client asks and draws.** Anything a player shouldn't be able to change lives on the
  server. Everything the client sends is checked against a Zod schema first.
- **Core plus outlets.** Game rules go in `core/`; anything that talks to the outside world goes in an outlet,
  behind a port. Fix a layering error by fixing the import, never by loosening the check.
- **`shared/` is only for code both sides run.** **Every player is logged in**: `/ws` closes sockets without a login
  cookie before anything else.
- **Fights are server-authoritative.** No client message may claim a result, a hit or HP, and the result shows only
  when the server's comes; keep it that way.
- **Keys come from `client/src/settings/bindings.ts`, through `core/keyboard.ts`.** Only `core/actions.ts` turns keys
  into actions; nothing else listens for keys, and on-screen keys are read from the bindings. Esc and ⌘ can't be
  rebound. The art lab has its own fixed shortcuts and its own listener.
- **Drawing has one owner, `client/src/visuals/`**, entered only through `visuals/visuals.ts` from `game/`
  (typecheck checks it). **Sound has one owner, `client/src/audio/`.** Both read state; game code never pushes it.
- **Text is escaped by JSX.** No `innerHTML` or `dangerouslySetInnerHTML`. What the player is told goes through `say`.
- **Small, single-purpose files**; a folder per mode, enemy or screen. Small math goes in `shared/src/core/math.ts`.

## Folders

The names: the map you walk is the **overworld** everywhere; a fight is a **battle**, the place it happens the
**arena**. The places are the **world**: one map whose named parts are **regions**, drawn and sent in **chunks**.

```
shared/src/
  core/            ECS, math, fixed time
  world/           the map, tiles, regions, chunks, water, arenas, the day clock, interact reach
  overworld/       the view's shape
  battle/          fight components, stats, statuses, inputs, netcode numbers
    fight/         the shared arena fight ("@infinite-tower/shared/fight"): systems, player, weapons,
                   behaviors, skills, physics, outcome, save / load / hash
  weapons/         weapon classes and their tables, damage, the sword's rules (hybrid.ts), bows
  skills/          the grammar, costs and effects
  soul/            the core, inscriptions, blessings
  items/           item kinds, the bag and gear, burden, using items, coins
  character/       looks and characters
  net/             client and server messages, HTTP requests, close codes
server/src/
  main.ts, env.ts  wiring and settings
  core/            the game: game/ (sessions), overworld/, battle/, world/ (regions, arenas), enemies/, npcs/,
                   content/ (quests, lore, shops, the new player), accounts/, ports.ts
  ws/  api/  db/   the outlets: the game socket, HTTP (Fastify), Postgres (Drizzle, migrations)
client/src/
  main.ts          mounts the UI, starts loading the game
  game/            the frame loop, mode switching, what the game hears and says
  modes/           overworld/ and battle/: game logic only
  core/            keyboard, mouse, actions
  net/             the socket and HTTP
  settings/        bindings, camera, audio, HUD settings
  visuals/         all drawing (Babylon): battle/, overworld/, enemies/, npcs/, regions/, arenas/, sky/, water/
  audio/           all sound and music
  gfx/             pictures drawn in code with no Babylon: looks, items, the core's sphere
  ui/              React: hud/, screens/, components/, notifications/, chat/, dialogue/, skills/
art-lab/           the art lab (npm run art): src/ (characters, editor/), files/ (saved drawings)
*/test/            unit tests mirroring each src/
plan/              future plans
```

## Adding things

Each recipe names the tables to touch; TypeScript errors until the client side is there too, and the data tests
check that ids are real and places reachable.

- **A message.** A schema in `client-messages.ts` and its union; a `GameSession` method; a handler in
  `ws/handlers.ts`. Server to client: a case in `ServerMsg` and a `net.on` where it's used.
- **A region.** A file in `server/src/core/world/regions/` (its tile map, origin, fill, spawns, maybe tall grass)
  and its line in `DEFS`; it must meet its neighbours. A new look: a `Theme` and its folder in
  `client/src/visuals/regions/`.
- **A tile kind.** Its line in `TILES` (`shared/src/world/tiles.ts`), then its look in every region look's tiles.
- **An arena or arena look.** An `ArenaDef` in `server/src/core/world/arenas.ts`; a look is a folder in
  `client/src/visuals/arenas/` and its line in `ARENA_LOOKS`. Looks never change how a fight plays.
- **An enemy.** Its id in `EnemyId`, a file in `server/src/core/enemies/` (its def, drops, overworld behaviour) and a
  folder in `client/src/visuals/enemies/` (model, pose, animation, sprite), and a spawn or a grass table. A new
  behaviour is a def shape, a component, a system in `fight/behaviors/` and a row in `ATTACKS`.
- **An enemy that wields a weapon.** `wielder` on its def; the weapon system does the rest.
- **An NPC.** Its id in `NPC_IDS`, a file in `server/src/core/npcs/` (its stops: where it stands and what it says by
  the story) and a look in `client/src/visuals/npcs/`. Moving on is a new stop with a condition and a trace.
- **A quest or lore entry.** An entry in its giver's `quests`, its id in `QUEST_ORDER`, and the giver's lines for it;
  lore is a row in `LORE`, revealed by a step's reward.
- **An item, weapon or wearable.** An item in `ITEMS` with its components (`consumable`, `wearable`, `weapon`,
  `pack`), and its bag picture in `client/src/gfx/items/`; a weapon also its row in `WEAPON_LOOKS` and a class,
  its stats that class's table with its own fields over it. A new class is a table in `CLASS_TABLES` and a `MOVES` row
  (a new way of fighting, a `MOTIONS` row too).
- **A visual or effect.** A row in `VISUALS` (or `EFFECTS` for a fight event), its pose a tested Babylon-free function.
- **Something kept between connections.** A `PlayerSave` field, `newPlayer()`, `keptSave`, the session's load and
  save, a column in `schema.ts` (then `npm run db:generate`, AGENTS.md) and the store's row mapping.
- **An HTTP route.** A handler in `api/routes/` with its body's Zod schema; logic stays in core.
- **Something core needs from outside.** An interface in `core/ports.ts`, an implementation in an outlet, one line in
  `main.ts`.
- **A key binding.** The action in `ACTIONS` (`client/src/settings/bindings.ts`), read from `actions.poll()` or
  `useAction`; a player whose saved keys hold its default gets it unbound.
- **A setting.** A store in `client/src/settings/`, its field in `SavedSettingsSchema`, a section in Settings.
- **A UI screen or HUD piece.** A component in `client/src/ui/` fed by stores in `ui/state.ts`.
- **A cheat** (dev only). A case in `CheatSchema`, its branch in `server/src/core/game/cheats.ts`, a test that
  production ignores it, a button in the admin panel and a chat command.
- **Something the game says.** A `GameEvent` case and its words in `EVENT_MESSAGES` (and a sound if it has one).
- **A sound or music.** A CC0 file only, its row in SOUNDS.md, and its row in `SOUNDS` or `TRACKS`/`MUSIC`
  (`client/src/audio/`); its cue comes from the fight's or the overworld's state.

Changing a number that decides how the game plays changes the game: ask first (AGENTS.md).
