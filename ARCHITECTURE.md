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
  ui/ (React)    game/    overworld/    battle/ (Babylon)
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
   cookie (30 days).
3. **Join.** Play opens `/ws`; the cookie goes with it. Meanwhile the title plays its enter sequence
   (`ui/screens/title/sequence.ts`): the view goes into the tower and speeds up it until the game has joined. Only
   once the title has cleared off the world (`inWorld` in `ui/state.ts`) does the HUD show and the game, and the
   screens over it, take keys. The server finds the account, loads the save and sends
   `welcome` (HP / stamina, stats, settings, character, wins, bag). With no character yet, the white the
   title flashes into holds: character creation (`ui/screens/creation/`) plays on it, and the server waits for a
   `character` message (only one: a character is kept for good); then it sends `level`.
4. **Overworld.** While you move, the client sends one `input` per 60 Hz tick and predicts its own walking with the
   shared `stepWalker` (at the pace the bag's weight allows). The server replays the inputs, runs the level's
   actors, rolls encounters and sends `state`
   20 times a second with the actors near your screen. The client glides its mirrors toward those positions.
5. **Fight.** The server makes the fight (a `BattleRoom` running the shared `Fight`) and sends `encounter` with its
   setup (arena, enemy, your HP / stamina, stats and burden). The client flashes into battle mode, builds the same
   fight and runs it itself, whole and at once, sending only its inputs, each tagged with its step (`battleInput`).
   The server runs the same fight on those inputs at those steps (hits, damage, stamina, deaths), sends a hash of it
   4 times a second (`battleHash`; a client whose copy differs asks for the whole of it, `battleSync`), and the
   moment it's decided, sends the final `battleSync`, rolls drops (or, on a loss, empties the bag), saves and sends
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
 ├─ online = new OnlinePlayers(new PgPlayerStore(db), DEV) core/: who's playing, one GameSession each
 ├─ startServer({ accounts, socket: gameSockets(online, { dev, pingMs }) })
 │     ├─ api/  Fastify: /api routes, the built client, the /ws handshake
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
- **Two modes, two Babylon scenes, one world.** `game/game.ts` routes server messages and switches between the
  overworld (`overworld/`, mode `"overworld"`) and the fight (`battle/`, mode `"battle"`). Overworld mirrors
  (`OverworldPos`, `OverworldActor`) and the arena's scenery live in the game's world; only the active mode's
  systems run. The fighters live in the fight's own world (below), made on encounter and dropped when you return.
  The fight's result comes while you're still in the arena; game.ts holds it and applies it (bag, vitals, wins,
  notices) as you come back.
- **The overworld draws what the server says.** `overworld/mirror.ts` spawns a drawing per actor `kind`;
  `overworld/prediction.ts` predicts your own walking and reconciles with the server's acks.
- **The fight is a shared `Fight`** (`shared/src/battle/fight/`, imported from `@infinite-tower/shared/fight`, its
  own entry point so Rapier stays out of the title's chunk and the rest of the server). One object per battle, with
  no state outside it: its own ECS world, its own Rapier world, fixed steps of `FIXED_DT`, and `step(inputs)` with
  one `PlayerInputData` per player (any number of players and enemies), counted in `steps`. Nothing in it is random,
  and Rapier's deterministic build gives the same numbers on every machine, so the same setup and inputs always give
  the same fight. Its whole state goes out and back in as plain JSON (`save()` / `load()`, `fight/state.ts`: what
  changes in a fight, exactly; the colliders are put where their bodies are), and `hash()` (`fight/hash.ts`) is a
  fingerprint of it with every number rounded to 2 decimals. Rapier loads once (`initPhysics()`: as the server
  starts, and in `prepareGame()` behind the title) before any fight is made. System order (`fight.ts`): player
  controller -> enemy brain -> attacks -> motor -> physics -> player ground -> combat -> outcome. It reports what
  happened in a step as `events` (hits, a charge slamming the wall). How a fight ends is `fight/outcome.ts`: lost
  when no player stands, won when no enemy does, lost after `MAX_FIGHT_TIME` (10 minutes, a guard on the server's
  resources), and a player who disconnects is down and has lost it (`LEAVING_LOSES`).
- **The server runs it** (`server/src/core/battle/`): a `BattleRoom` per battle, from the moment every player has
  sent their first input (they're past the flash into the arena). It keeps a clock (steps since the fight started,
  one a 60 Hz tick) and runs the fight up to it as soon as it knows every player's input for the next step
  (`InputTimeline`: each change of input from its step until the next, known up to the client's `upTo`). It holds a
  step back for a late input at most `MAX_INPUT_DELAY` (200 ms); then it runs the step without it (the player's
  input held; after `SILENT_STOP_STEPS` of that in a row, their move keys let go), and the input counts on the next
  step when it comes, its presses kept. It never runs past its clock, and drops inputs for steps more than
  `MAX_INPUT_LEAD_STEPS` ahead of it. It's authoritative: hits, damage, stamina, deaths and the result. After every
  `HASH_EVERY_STEPS`-th step (4 a second) each player gets a `battleHash`; asked (`battleResync`), it sends the whole
  fight (`battleSync`), and does once more as it's decided. Then each player's `onEnd` settles the battle for them
  (`core/game/battle.ts`) and the fight is freed. A room takes any number of players; every battle has one for now,
  and that player's session steps it.
- **The browser runs its own copy of the whole fight** (`battle/`). It builds the same `Fight` from the encounter's
  setup and runs it as it draws it, enemies and hits included, so the boar reacts to you at once. Each frame the
  arena's scene renders, its clock (`battle/pace.ts`: real time since the fight's first step at 60 steps a second,
  catching up after a slow frame, plus an offset that keeps it in step with the server's clock) says how many steps
  are due; the keys are read into a `PlayerInputData` and `battle/sync.ts` (`FightSync`) runs the fight that many
  steps with it, rounded for the wire, and queues it to send if it changed, tagged with its step (and, every few
  steps, how far it has run). It keeps 1 s of its inputs and its own hashes: when the server's hash for a step
  differs from its own, it asks for the server's fight, loads it and replays its inputs since; every fighter's
  drawing eases over the jump (`DrawOffset`). The offset comes from the lateness each hash reports, less what the
  client knows it caused itself (it was behind its own clock): ahead when its inputs come late, back when they come
  too early. (Babylon's own lockstep isn't used: it would catch up stalls a second time.) HP and hits show at once
  from the client's copy, but the result is only ever the server's: the banner waits for `battleResult` (timed from
  the step the client's copy was decided on, if it agrees). The client hangs its drawings (a node that follows
  `Body`, the sprite, the boar model) on the fight's own entities; render systems run once per frame on the fight's
  world: follow, camera, player sprite, enemy model animations, HUD.
- **Fighters are moved by code, not by forces.** Systems set a body's velocity (`Body.vel`); the physics step
  (`fight/physics/move.ts`) adds gravity and moves each collider with Rapier's character controller, so the floor
  and the arena's ring of wall stop it and take the speed out. Bodies bumping into each other follow the fight's own
  rule: an enemy shoves a player along, a player never pushes an enemy (a player pinned against the wall holds it
  back), and dodging, knocked back or dead, a player passes through. Rapier simulates nothing itself
  (`fight/physics/arena-physics.ts`): it sweeps, finds contacts and casts rays (`grounded`, the blob shadow).
- **Attacks are data.** An attack's active frames add an `ActiveHit` (sector: range + angle) to the attacker;
  `combatSystem` (`fight/combat.ts`) resolves hits with plain math, not physics.
- **AI and animation are separate.** Enemy behavior systems (`fight/enemies/`) only set state, facing, wanted
  movement and hitboxes (the motor turns that into velocity); each model's animation system (client) reads the
  state and poses the model.
- **Input enters only as `PlayerInputData`** (world-space move + aim): from the keys in the browser, from
  `battleInput` on the server. Keys come from `client/src/settings/bindings.ts`, never hardcoded.
- **Destroy is deferred** to `world.flush()` at the end of each tick; remove hooks dispose meshes.
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
- **Every screen sees the same amount, at most**: 16:9 (23 x 13 overworld tiles, `shared/src/overworld/view.ts`).
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

Login and sign-up share 20 tries a minute per IP address (then 429). Bodies must be JSON (415 otherwise), at most
4 KB, and are checked by the shared Zod schemas in `shared/src/net/account-requests.ts`.

**The game socket** (`/ws`). Opening one:

```
Browser                 api/routes/game-socket.ts       ws/sockets.ts             core/
  │── GET /ws + cookie ──►│ before the upgrade:            │                          │
  │                       │ accounts.forToken(cookie) ─────────────────────────────►  │
  │◄── HTTP 503 ──────────│ if the lookup threw            │                          │
  │◄── 101, open ─────────│ accept(ws, account) ──────────►│ new Connection(ws)       │
  │◄── close 4001 ─────────────────────────── no account ──│                          │
  │                       │                                │ online.join(conn) ──────►│ closes the account's
  │                       │                                │                          │ other tab (4000), loads
  │◄── welcome ──────────────────────────────────────────────────────────────────────│ the save, new GameSession
```

While playing, each message goes ws (over 16 KB: close 1009) -> `Connection` (Zod check; dropped if invalid, more
than 20 invalid: close 1008) -> `ws/handlers.ts` (one call on the `GameSession` per message type) ->
`GameSession`, which answers with `link.send(...)`. `state` and `battleHash` aren't answers: the clock ticks every
session 60 times a second; on the overworld every 3rd tick sends a `state`, and in a fight every 15th step of the
server's fight a `battleHash`.

| Client -> server | When |
|---|---|
| `input {seq, moveX, moveZ}` | each tick while walking (nothing while standing still); replayed, rate-limited |
| `character` | made your character (ignored if you have one) |
| `rest` | Rest key by a campfire (the server checks you're there) |
| `useItem {at}` | used one of the item in bag cell `at` |
| `moveItem {from, to, turned}` | moved cell `from`'s item so its top-left is at `to` (overworld only; shown at once) |
| `battleInput {upTo, inputs}` | in a fight, once a frame: each change of input with its step, and the last step run |
| `battleResync` | in a fight: your copy didn't match the server's hash; send the whole fight |
| `leaveBattle` | the Leave key after a fight's result: back to the overworld (ignored mid-fight) |
| `settings` | a setting changed (debounced on the client) |
| `debug {cmd}` | dev server only: `encounter` starts a fight |

| Server -> client | When |
|---|---|
| `welcome` | after joining: HP / stamina, stats, settings, character (or null), wins, bag, `dev` |
| `character` | your character, as saved |
| `level` | entering a level: its layout (what the client may see of it) and where you are |
| `state` | 20 a second in the overworld: `ack` (last input replayed), your position, nearby actors |
| `encounter` | a fight starts: its `setup` (arena, enemy, your HP / stamina, stats and burden) and your `seat` in it |
| `battleHash` | 4 a second in a fight: the server's fight's hash after `step`, and how late your inputs come |
| `battleSync` | the whole fight after `step`: on `battleResync`, and as the fight is decided (before the result) |
| `battleResult` | as the fight is decided (still in the arena): won?, wins, HP / stamina, loot, `lost`, bag |
| `rested`, `itemUsed` | what resting or eating did |
| `bag` | your bag after a `moveItem`, whether or not the move was allowed |

Close codes the client handles: 4001 not logged in (login form), 4000 the account is playing in another tab
(`CLOSE_CODES` in `shared/src/net/accounts.ts`); 1011 (loading the save failed), 1008 and 1009 end in "connection
lost". Positions in `state` are rounded to 1 cm, and it only carries actors within the 16:9 view of the server's
copy of you plus 3 tiles, so a hacked client can't see further.

**A fight on the wire.** Both sides number the fight's steps from 1. Each frame the client sends the changes of its
input since the last message, each tagged with the step it's for and rounded to 3 decimals (so both sides run the
same numbers), and `upTo`, the last step its copy has run; with nothing new, `upTo` alone every 3 steps
(`INPUT_HEARTBEAT_STEPS`). The server checks each message (`battleInput`'s Zod schema: steps in order and not after
`upTo`, the aim a direction, the move no longer than two keys make) and runs every input on its own step, as
above: up to `MAX_INPUT_DELAY` (0.2 s, `MAX_INPUT_DELAY_STEPS` = 12) late it waits, later it runs it on its next
step, more than `MAX_INPUT_LEAD_STEPS` (6) ahead of its clock it drops it. After every `HASH_EVERY_STEPS`-th step
(15: 4 a second) it sends `battleHash`: the step, the hash of its fight there (`Fight.hash`: the whole state, every
number rounded to 2 decimals, so last-bit differences between machines don't count until they grow), and how late
the player's inputs come (`lateSteps`, for `pace.ts`). The client compares it with its own hash at that step (kept
for 1 s; a hash for a step it hasn't run yet waits until it has), and on a mismatch sends `battleResync` once; the
server answers with `battleSync`, its whole fight (`FightSnapshot`, about 1.5 KB of exact JSON) at its own step, at
most every 5 steps (`MIN_SYNC_GAP_STEPS`); the client loads it and replays its inputs since (or, behind it, jumps
there). That's about 0.45 KB/s down for one player against one boar, against 14 KB/s of 20-a-second states before;
up, about 7 KB/s while the camera turns every step, a fraction of that while it doesn't. There's no message that
says how a fight ended: only the server's fight decides it, and its final `battleSync` and `battleResult` say so.

**A simulated ping (dev only).** A dev server delays every game socket's messages by half of `DEV_PING_MS` each way
(`.env`, any whole number of ms, 50 if left out), in order, the close included (`ws/delay.ts`), so the netcode can be
felt on localhost. A page can ask for another with `?ping=N` (the client passes it on to `/ws`; anything but a whole
number of ms gets the `.env`'s). Production never delays.

## Saving

What's kept between connections is a `PlayerSave` (`core/ports.ts`): HP / stamina, wins, settings, character and
bag, keyed by account. The `GameSession` saves after every fight (the moment it's decided, or lost by leaving it),
rest, item use and making a character, on disconnect, and within a second of a settings change or a move in the
bag. Position and level aren't saved (you
start at the level's start), and stats aren't either (everyone has the same).

Postgres is reached through Drizzle (`server/src/db/schema.ts`). The server applies new migrations when it starts;
`npm run db:generate` writes them (see "A schema change" below).

## Tests

`npm test` runs every `*.test.ts` under `shared/test/`, `server/test/` and `client/test/` with Node's test runner
(`tsx --test`); no test framework, database or browser. Each `test/` folder mirrors its `src/` and has a tsconfig
of its own (Node's types), checked by `npm run typecheck`. New work is written test-first (see AGENTS.md).

- **shared**: the ECS, math, walking (`stepWalker`, grass, campfires), the view rules, every Zod schema (what
  the server accepts from clients and the sentences it answers with), and the arena fight, run headless with
  enemies whose numbers the tests own (`shared/test/battle/fight/fixtures.ts`): the same inputs give the same fight
  byte for byte, gravity and the floor, the wall, shoving and passing through, knockback, the slash's reach and arc,
  whole fights won and lost, the time limit and leaving, a fight's whole state (exact through JSON; loaded into a new
  fight, or one that went its own way, it plays on step for step the same, live hitboxes included), its hash (the
  same for the same inputs, changed by anything that matters, not by a last-bit difference), a dodge's i-frames
  step by step (a dodge on the very step a hit lands beats it; its stamina and burden costs), and a dodge pressed
  during a slash waiting for it to let go (on any step of it, once, ahead of a buffered slash, through a save and a
  rollback). Each fight test file awaits `initPhysics()` first. Also the battle inputs' rounding and what counts as
  a change.
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
  late, with the same hit or miss and HP on both sides; and the input timeline (changes held, late presses kept,
  too far ahead dropped, a silent player stopping, lateness).
- **server outlets**: `api/` with `buildServer()` and `app.inject()` / `app.injectWS()` (routes, cookies, error
  sentences, the rate limit, cache headers, the `/ws` login check and its `?ping=`); `ws/` with a fake WebSocket,
  the simulated ping included (each way half of it, in order, 0 for none, never in production); `env.ts`'s
  `DEV_PING_MS`. `db/` has no tests yet ([plan/tests.md](plan/tests.md)).
- **client**: only logic that runs without Babylon or the DOM: key bindings, camera and mouse settings, settings
  sync, when the mouse is captured, overworld prediction, the fight's sync (only changes sent, with their steps and
  heartbeats; the whole fight run at once; hashes checked, now or once it gets there; one resync asked, the server's
  fight loaded and replayed to where the server gets, or jumped to; a dodge neither replayed twice nor dropped; the
  result and its banner waiting for the server) and pace (real time's steps, catching up after a stall, a backlog
  dropped, ahead when late and back when early, lateness it caused itself not made up twice, old news ignored), the
  title's sequence timing, character creation's steps
  and rows, the bag screen's mouse (bagMouse.ts: hover, select, drag, turn, use) and tooltip (itemInfo.ts), the
  item pictures' sizes, and the look's pictures (each view's size: the portrait, the chibi facing each way, the
  battle sprite in each pose; the chibi's legs standing together in two boots, the right one in shadow). Rendering,
  how the fight feels and the React screens are tried in a browser.

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
- **Keys come from `client/src/settings/bindings.ts`.** When showing one on screen, read it from the bindings
  (`keyName`). Esc and ⌘ can't be rebound.
- **Text is escaped by JSX**, so server or player strings can be rendered safely. No `innerHTML` or
  `dangerouslySetInnerHTML`.
- **Small, single-purpose files** (roughly under 200 lines). Add a folder per new mode, enemy or screen rather than
  growing an existing file. Small math (clamping, smoothing, distances, turning) goes in `shared/src/core/math.ts`.

## Folders and files

**Names.** The 2D map is the **overworld** everywhere (shared `overworld/`, server `core/overworld/`, client
`overworld/`, `Overworld*` components, mode `"overworld"`); the fight is a **battle** (client folder, mode), and the
place it happens is the **arena**. React components are PascalCase `.tsx` files that export components only (so
Vite Fast Refresh works); game code stays `.ts` and imports nothing from React. Numbers with a unit say it in the
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
                   math.ts (Vec2/3, clamp, approach, damp, distXZ, wrapAngle, turnToward, seededRandom), time.ts
  overworld/       layout.ts (LevelLayout: what the client may see of a level, campfires included; stepWalker for
                   prediction + replay; nearCampfire / REST_RANGE), view.ts (VIEW: how much a screen shows, at most
                   16:9; viewCenter, the camera's edge rule)
  battle/          components.ts (Player, Health, Stamina, Body, Fighter, ActiveHit, Enemy, LungeAttack,
                   ChargeAttack), player.ts (PLAYER tuning, Vitals, GRAVITY), defs.ts (EnemyDef = body + stats +
                   optional attacks, ArenaDef), input.ts (PlayerInput; StepInput, a change of input on the wire,
                   with its step; IDLE_INPUT, copyInput, sameInput, quantizeInput), netcode.ts (what both sides
                   agree on: HASH_EVERY_STEPS, MAX_INPUT_DELAY, MAX_INPUT_LEAD_STEPS), stats.ts (Stats,
                   FighterStats, physicalDamage / moveSpeed / carryLimit)
    fight/           The arena fight, "@infinite-tower/shared/fight" (index.ts; Rapier comes with it).
                     fight.ts (Fight: its own world and physics, the system order, step(inputs), steps, save /
                     load / hash, leave(player), outcome, events, dispose), setup.ts (FightSetup, the one-on-one
                     starting spots, spawning players and enemies: components + a collider, one component per
                     attack in the def), context.ts (FightContext, FightOutcome, FightEvent), combat.ts (addHit,
                     hits, knockback, the hit timers), outcome.ts (won / lost; MAX_FIGHT_TIME, LEAVING_LOSES,
                     playerResult), state.ts (FightSnapshot: the whole state, exactly, out and back in; saveFight,
                     loadFight), hash.ts (hashFight: the state's fingerprint, numbers rounded to 2 decimals)
      physics/         init.ts (initPhysics: load Rapier once), arena-physics.ts (ArenaPhysics: the floor and the
                       ring of wall, a collider per fighter, sweeps with the character controller, contacts, rays),
                       move.ts (gravity, moving every body, who shoves whom and who passes through)
      player/          controller.ts (move, jump, slash, dodge, stamina; controlPlayer), ground.ts (grounded, from
                       rays; groundPlayer)
      enemies/         brain.ts (target, approach / poise / stagger / stun / death), lunge.ts, charge.ts, motor.ts
                       (wanted movement -> velocity), common.ts
  character/       character.ts (Character = name + gender + look; LOOK_OPTIONS: every look part's option ids,
                   drawn by client/src/gfx/look/; GENDERS (boy / girl: how the game refers to you, nothing else);
                   name rules)
  items/           items.ts (ITEMS: name, description, size in cells, stack size, weight, what using one does;
                   ItemCounts = item id -> count), bag.ts (Bag: a grid of placed stacks; fits, addItem,
                   moveItem, takeOne, bagWeight, bagProblems: the rules both sides fit items by), burden.ts
                   (BURDEN, bagBurden: light / heavy / overloaded, and what each does to walking and dodging)
  net/             client-messages.ts (Zod schemas + inferred ClientMsg; server-only import),
                   server-messages.ts (ServerMsg types, ServerMsgOf<t>), handlers.ts (Handlers<Msg> map +
                   dispatch by `t`),
                   accounts.ts (the /api routes, username / password rules, AccountInfo, socket CLOSE_CODES),
                   account-requests.ts (their Zod schemas; server-only import), text-rules.ts (TextRules for the
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
    env.ts           DEV, PORT, DATABASE_URL, DEV_PING_MS from the environment (loads the repo's .env if there is
                     one; parseDevPing, parsePingMs)
    core/            The game. No sockets, HTTP, SQL or env.
      ports.ts         What core needs from outside, as interfaces: PlayerStore (+ PlayerSave), AccountStore,
                       PlayerLink
      game/            online.ts (who's playing: one session per account, load on join, save on leave, a second
                       tab takes over), session.ts (GameSession, one player: their save, their overworld, the battle
                       they're in; a method per thing a player can ask; disconnect: mid-fight, leaving it),
                       battle.ts (start a battle in a BattleRoom, settle its end for the player: wins, loot, a loss
                       emptying the bag, vitals; leave the arena), inventory.ts (packLoot: drops into the bag),
                       snapshot.ts (the state message: only actors near your screen), clock.ts (FixedClock: 60 Hz
                       steps, catching up after stalls)
      battle/          The fight, run by the server. room.ts (BattleRoom: its clock, waits for everyone's first
                       input, runs each step once it has everyone's input or it's MAX_INPUT_DELAY late, sends
                       battleHash and battleSync, ends and frees it; MAX_START_WAIT_TIME, MIN_SYNC_GAP_STEPS),
                       inputs.ts (InputTimeline: one player's changes of input by step, what's known, late ones
                       on the next step, too far ahead dropped, a silent player let go; SILENT_STOP_STEPS)
      overworld/       The overworld simulation. overworld.ts (Overworld: one player's world, level, systems and
                       spawner), components.ts (OverworldPos, OverworldActor, OverworldPlayer), parts.ts (spawnActor
                       from behavior parts), context.ts (OverworldContext, what systems get), player.ts (input queue
                       + replay, grass encounters, findPlayer), spawner.ts
        behaviors/       wander, chase (notice -> "!" -> chase), touch (encounter on touch), move
        prefabs/         boar.ts (= wander + chaseOnSight + encounterOnTouch), index.ts (OVERWORLD_PREFABS by id)
      levels/          level.ts (LevelDef: layout, spawn point, spawns, encounter table, arena), index.ts
                       (registry), grass-field.ts
      content/         enemies.ts (ENEMIES by id), player.ts (PLAYER_STATS, fullVitals, newPlayer), drops.ts
                       (what each enemy drops and how often; rollDrops)
      accounts/        accounts.ts (Accounts: sign-up, login check, login sessions; tokens hashed before they're
                       stored), passwords.ts (scrypt)
    ws/              Outlet: the game socket. sockets.ts (takes each /ws socket api/ opened, with its account;
                     joins the player; the connection's simulated ping), connection.ts (one socket = the
                     PlayerLink: Zod-checked in, typed out, delayed both ways by a dev ping), delay.ts (DelayLine:
                     a FIFO that holds each message for a while, in order), handlers.ts (each ClientMsg -> one call
                     on the session)
    api/             Outlet: HTTP, on Fastify. server.ts (builds the app: plugins, JSON-only bodies, the built
                     client from client/dist, with hashed assets/ cached for good), cookies.ts (the httpOnly login
                     cookie), errors.ts (every error as `{error}` with a sentence the title screen can show)
      routes/          One Fastify plugin per file, each registered in server.ts. accounts.ts (accountRoutes:
                       the /api handlers; login + sign-up rate-limited), game-socket.ts (gameSocketRoute, /ws:
                       checks the login cookie before the upgrade, then hands the socket on)
    db/              Outlet: Postgres. schema.ts (the tables, in TypeScript: Drizzle ORM), db.ts (connects to
                     DATABASE_URL, applies new migrations at startup), player-store.ts / account-store.ts (the
                     two stores core asks for; one query at a time per player), migrations/ (SQL written by
                     `npm run db:generate`, plus drizzle-kit's meta/), seed.ts (dev data: accounts test1-3,
                     password = username; refuses to run in production)

client/          Browser game: Babylon rendering, input, React UI.
  index.html       The page: the 16:9 stage frame, the canvas, #ui
  vite.config.ts   Dev server :5173, proxies /ws and /api to the game server
  test/            Unit tests of the logic that runs without Babylon or the DOM, mirroring src/
  src/
    main.ts          Bootstrap: mount the UI (title screen), ask who's logged in, start preparing the game;
                     logging in (or Play) connects, then joins; Return to title (or a lost connection) leaves
    game/            start.ts (its own lazily loaded chunk with Babylon and Rapier: prepareGame() loads the
                     physics and builds the engine, both scenes and modes and input (off) once, behind the title,
                     and returns the Game),
                     game.ts (Game: join() starts a session on a connection, leave() ends it; routes server
                     messages, keeps the settings in sync, overworld <-> battle switching, who gets input, the
                     character from `welcome` / `character`, opening creation without one; tells the player
                     what happened with `say`), look.ts (repaints the player's sprites in their look),
                     transition.ts (Mode, flash / fade), debug.ts (the dev handles on `window`)
    net/             connection.ts (WebSocket, passing on the page's `?ping=`; queues messages until the game
                     `listen`s with one handler per type; a lost connection becomes a sentence for the title),
                     account.ts (the /api calls: who's
                     logged in, log in, register, log out)
    core/            keyboard.ts (off outside a session, with Settings open, or the bag), mouse.ts (optional,
                     pointer lock: on a click in the arena, or by itself as the arena starts wanting the mouse when
                     auto lock is on; shouldAutoLock is that rule), buttons.ts (held + latched presses), time.ts
    settings/        settings.ts (Settings: every kind of setting in one object; main.ts makes it once and passes
                     it to the game and the UI; `welcome` restores the player's, syncSettings sends each change
                     back), bindings.ts (ACTIONS: every action, label, default keys, fixed mouse buttons;
                     KeyBindings: the player's keys; keys saved under the old group name `field` load as the
                     overworld's), camera.ts (CameraSettings: sensitivity), mouse.ts (MouseSettings: auto lock, on
                     by default, so a save without it reads as on)
    gfx/             textures.ts (procedural textures; drawnTexture), materials.ts (colorMaterial), props.ts
                     (scenery art: the campfire), sprites.ts (pixelMaterial, spriteMaterial, redrawSprite),
                     characters.ts (playerFrames(look): the look's chibi facing each way on the overworld, its battle
                     sprite in each pose in the arena; the boar)
      items/           items.ts (drawItem: each item's picture for the bag, 16 pixels a cell, in the same pixel
                       kit as look/)
      look/            Character art (ART.md is the style guide): a look drawn as a 64x64 portrait (creation, the
                       character panel, later dialogue), a 32x32 chibi facing front, back or side (the world) and a
                       64x64 battle sprite from behind in each pose (the arena), in code. art.ts (VIEWS,
                       CHIBI_FACINGS, layers, Frame, render), pixels.ts (Pen, masks), palette.ts (ramps), body.ts
                       (body types), battle.ts (POSES), head.ts (face shapes), face.ts (eye and mouth types), hair/
                       (styles), outfit.ts + jerkin.ts (wear), sword.ts, look.ts (Look -> picture: drawPortrait,
                       drawChibi, drawBattle)
    dev/             art-lab.ts: localhost:5173/art.html (dev server only) draws every look option as the portrait,
                     the chibi facing each way and the battle sprite in each pose, to check art
    ui/              React: everything drawn over the canvas
      mount.tsx        createRoot + <App>; App.tsx picks the HUD for the mode, then notices, banner, fade, Settings,
                       character creation, title screen (the HUD and Settings only once `inWorld` and not
                       creating; creation as soon as a game runs without a character, under the title)
      state.ts         UiState: the stores the game writes (title, screen, overworld HUD, battle HUD; bars are
                       `...Fraction`, 0..1), `notifications` (notifications/), `settingsScreen`, `creation` and
                       `overworldPanel` (which side panel is open: the UI writes them too, the game watches them;
                       the open bag has the keys, `bagHasTheKeys`), and UiActions (what the UI asks of the game:
                       signIn, logOut, play, rest, useItem, moveItem, saveCharacter, returnToTitle). No React.
      store.ts         Store<T> (set skips unchanged values); useStore.ts reads one value in a component
      keyNames.ts      KeyboardEvent.code / mouse button -> printable name
      styles.css       Tailwind v4 entry + @theme tokens
      components/      Used by more than one screen: Bar.tsx (HUD bar + souls-style damage chip),
                       PlayerBars.tsx (HP + stamina, in the same corner on both HUDs), Dialog.tsx (a modal's
                       backdrop), styles.ts (BUTTON, TEXT_INPUT, DIALOG_BOX / DIALOG_TITLE), noFocus.ts (buttons a
                       click can't focus, so Space / Enter stay with the game), useKeydown.ts (a window key listener),
                       LookPicture.tsx (a look on a canvas: the portrait, or the chibi facing front), ItemPicture.tsx
      hud/             OverworldHud.tsx (HP / stamina, wins, level name, character + settings buttons),
                       BattleHud.tsx, HudLayer.tsx (the layer both draw in), character/ (CharacterPanel.tsx: the
                       portrait and stats; statText.ts), inventory/ (the bag screen: InventoryPanel.tsx wires
                       the mouse and the bag keys, BagGrid.tsx draws the grid and the hovered / selected /
                       dragged states, bagMouse.ts holds those as plain data, BagDetails.tsx the selected item,
                       ItemTooltip.tsx + itemInfo.ts the tooltip, grid.ts the cell size), PanelFrame.tsx (the
                       side panels' box), layout.ts (the side panels' widths and the Rest button's place, which
                       the notices keep clear of), panelKeys.ts, icons.tsx
      notifications/   What the player is told, and where. say.ts (`say(to, event)`; `GameEvent`, what happened;
                       `EVENT_MESSAGES`, one entry per kind of event: where it goes, "centre" or "corner", and its
                       lines), battleResult.ts (what a `battleResult` says: found, left behind, died / lost,
                       refused), state.ts (Notifications, UiState's `notifications`: the notices' and the banner's
                       stores, notify / announce / dismiss / clear, MAX_NOTICES), Notices.tsx (the corner: newest
                       at the bottom, at most 5 showing, wrapping at 20rem, about 8 s each, beside an open side panel
                       and above the Rest button), Announcement.tsx (the centre banner: one at a time, wraps in the
                       middle 80%, no ×: it fades on its own), DismissButton.tsx (a notice's ×), useFadeOut.ts
                       (hold, fade, dismiss)
      overlays/        Fade.tsx (the screen's flash / fade between modes; game/transition.ts sets it)
      screens/         One folder per full-screen page, holding the parts only that page uses
        title/           TitleScreen.tsx (login form or Play / Retry + Log out, status line, the sequence's layers),
                         LoginForm.tsx, MenuButton.tsx (the big "◆ Play"), styles.ts, sequence.ts (the enter / leave
                         sequences' stages and timing), useSequence.ts (the stage for the title's phase)
          backdrop/        The title's low-poly scene on a 2D canvas: Backdrop.tsx (the scene + light shafts, motes,
                         grain, vignette), Scene.tsx (canvas, frame loop), draw.ts (painter's order, glow layer),
                         world.ts (tiles, tower, its shadow, crystals), light.ts (moon, the tower's own light,
                         glint, rim, fog into dark / light, tone map), path.ts (the camera through the sequence),
                         space.ts
        settings/        SettingsScreen.tsx (Esc toggles, Return to title), CameraSection.tsx (sensitivity,
                         Auto mouse lock), KeyBindingsList.tsx (rebinding), styles.ts (a setting's row)
        creation/        A new player making their character, on white: CreationScreen.tsx (the scene: the System's
                         greeting, the panel beside the portrait and chibi, "Is this you?", saving, the farewell,
                         the white clearing off the world), scene.ts (its steps, a pure reducer), lines.ts (what
                         the System says), LookMaker.tsx (the panel), options.ts (its rows), SystemWindow.tsx,
                         useTyped.ts (text typed out), styles.ts (dark on white)
    overworld/       The 2D overworld mode: mirrors the server
      overworld.ts     The mode: level loads, the walk keys, server state, the overworld HUD, render
      scene.ts         Babylon scene + ortho camera, OverworldView, layerY, flatSprite (a quad lying on the overworld)
      prediction.ts    Predict your own walking (and facing), reconcile with the server's acks
      facing.ts        Facing (down / up / left / right, the way a walker faces on screen): faceToward, mirrorFor
      mirror.ts        Mirror the server's actors (spawned by kind via entities/)
      components.ts    OverworldPos, OverworldActor, OverworldSprite
      entities/        actor.ts (spawnOverworldActor: position + sprite + overlays), player.ts, boar.ts, index.ts
                       (OVERWORLD_PREFABS by ActorSnap.kind)
      systems/         sprites.ts (glide to server positions, the chibi's facing, tuft, "!"), camera.ts (follow, the
                       view's edge rule)
      levels/          Level renderers by LevelLayout.theme: index.ts (registry, loadLevel, unloadLevel),
                       campfires.ts (any theme's campfires, flickering), grass-field/ (terrain, textures)
    battle/          The 2.5D arena mode: your own copy of the whole fight, run at once and kept in line
      battle.ts        The mode: start / end a fight (arena built / resized on demand; the fight's copy from the
                       encounter's setup), per frame the fight's steps (as many as pace.ts says) and the inputs
                       out, hashes, syncs and the result in, the render systems
      sync.ts          FightSync: runs the fight with your inputs, sends their changes with their steps, checks the
                       server's hashes, loads its fight and replays on a mismatch; the server's outcome; stats
                       (INPUT_HEARTBEAT_STEPS, HISTORY_STEPS)
      pace.ts          Pace: the fight's clock, steps due each frame, in step with the server's (PACE_SLACK_STEPS,
                       MAX_STEPS_PER_FRAME, MAX_BACKLOG_STEPS)
      scene.ts         Babylon scene, camera, lights / fog / shadows / post
      context.ts       BattleContext (the fight being drawn, its sync, its outcome as the server says), resultShown
      components.ts    BodyNode (what a fighter's drawing hangs from), DrawOffset (a correction easing out),
                       Meshes (+ disposers)
      materials.ts, arena.ts (scenery: grass, stones, forest)
      player/          spawn (the sprite, shadow and trail on the fight's player), components (PlayerSprite), input
                       (keys / mouse -> PlayerInputData), sprite (puts pose on the meshes, shadow), pose (frame and
                       sword trail from the action, no Babylon: tested)
      enemies/         spawn.ts (the model on the fight's enemy)
        models/          index.ts (ENEMY_MODELS: add + animation + disposers), boar/ (model, animation)
      systems/         follow (drawings to their bodies, easing corrections), camera (the orbit, and its shake
                       for each step's hard hits: addImpactShake), hud (fills the battle HUD's store)
```

## Adding things

- **A message.** Client -> server: a Zod schema in `shared/src/net/client-messages.ts` and the union, a method on
  `GameSession` (`server/src/core/game/session.ts`) that does it, and a handler in `server/src/ws/handlers.ts` that
  calls it (TypeScript errors until you do). Server -> client: a case in `ServerMsg` (`server-messages.ts`) and a
  handler in `client/src/game/game.ts`'s `net.listen({...})`.
- **A level.** A file in `server/src/core/levels/` listed in `index.ts`; reuse a theme or add a renderer in
  `client/src/overworld/levels/`.
- **An overworld actor.** A prefab in `server/src/core/overworld/prefabs/` (a list of behavior parts) plus a client
  drawing in `client/src/overworld/entities/` under the same `kind`. New behavior: component + factory + system in
  `behaviors/`.
- **An arena enemy.** An `EnemyDef` in `server/src/core/content/enemies.ts` combining attacks. A new attack type is
  a def shape in `shared/src/battle/defs.ts`, a component and its states in `EnemyState`
  (`shared/src/battle/components.ts`), an entry in `ATTACKS` (`shared/src/battle/fight/setup.ts`) and a system in
  `shared/src/battle/fight/enemies/`, listed in `fight.ts`; a new look is a folder in
  `client/src/battle/enemies/models/` listed in its `index.ts`.
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
- **A key binding.** The action in `ACTIONS` (`client/src/settings/bindings.ts`, label + default keys), read with
  `settings.bindings.get().<group>.<action>`; the settings screen lists it on its own.
- **A new kind of setting.** A store in `client/src/settings/` with `restore` / `toSaved` (see camera.ts), added to
  `Settings`, `createSettings()`, `restoreSettings()` and `toSaved()` in settings.ts, a field in
  `SavedSettingsSchema` (`shared/src/net/client-messages.ts`), and a section in `ui/screens/settings/` shown by
  SettingsScreen. The server stores whatever passes the schema (`players.settings`, jsonb). Game code reads it
  from the `settings` it already has (`ctx.settings` in the arena).
- **A UI screen or HUD piece.** A component in `client/src/ui/` (`hud/`, `overlays/`, or a folder of its own in
  `screens/`; parts used by more than one screen go in `components/`). If the game has to feed it, add fields to a
  store in `ui/state.ts` and `set` them from game code; if it has to ask the game for something, add a function to
  `UiActions` (main.ts provides them).
- **Something the game says to the player.** A case in `GameEvent` (`client/src/ui/notifications/say.ts`) and its
  entry in `EVENT_MESSAGES` (TypeScript errors until you add it): `where: "corner"` (a notice) for anything small,
  `"centre"` (the banner) only for bigger events like a fight starting; long wording gets its own file there, like
  battleResult.ts. Game code calls `say(ui.notifications, { kind: ... })`. Test the words in
  `client/test/ui/notifications/say.test.ts`; its placement test lists the events allowed in the centre.

## Where to tune things

| What | Where |
|---|---|
| Player HP, speeds, slash, dodge (at stats of 10) | `shared/src/battle/player.ts` (`PLAYER`) |
| Player stats | `server/src/core/content/player.ts` (`PLAYER_STATS`) |
| Enemy stats and attacks | `server/src/core/content/enemies.ts` |
| Drops | `server/src/core/content/drops.ts` |
| Items: size, stack size, weight, healing | `shared/src/items/items.ts` |
| Bag size | `shared/src/items/bag.ts` (`STARTER_BAG`) |
| Carry limit | `shared/src/battle/stats.ts` (`CARRY`) |
| What carrying too much does | `shared/src/items/burden.ts` (`BURDEN`) |
| Levels: layout, spawns, encounter tables, campfires, arena size | `server/src/core/levels/` |
| Overworld-actor behavior numbers | `server/src/core/overworld/prefabs/` |
| Arena camera feel | top of `client/src/battle/systems/camera.ts` |
| Where a fight starts | `shared/src/battle/fight/setup.ts` |
| The arena's wall and floor | `shared/src/battle/fight/physics/arena-physics.ts` |
| How a fight ends: time limit, leaving mid-fight | `shared/src/battle/fight/outcome.ts` |
| Fight netcode: hash rate, how late an input may be, how far ahead | `shared/src/battle/netcode.ts` |
| Fight netcode: start wait, resync gap | `server/src/core/battle/room.ts` |
| Fight netcode: a silent player letting go | `server/src/core/battle/inputs.ts` |
| Fight netcode: heartbeat, history, pacing | `client/src/battle/sync.ts`, `client/src/battle/pace.ts` |
| View size | `shared/src/overworld/view.ts` (`VIEW`) |

Changing any of these changes how the game plays: ask first (see [AGENTS.md](AGENTS.md)).
