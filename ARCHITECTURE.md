# Architecture

How Infinite Tower's code fits together, where every file lives, and how to add things. Keep it in sync when you
add, move or rename files, or change how the pieces talk to each other.

- [The big picture](#the-big-picture)
- [A player's visit, start to end](#a-players-visit-start-to-end)
- [Server: core plus outlets](#server-core-plus-outlets)
- [Client: two modes, one ECS world](#client-two-modes-one-ecs-world)
- [Networking](#networking)
- [Saving](#saving)
- [Rules](#rules)
- [Folders and files](#folders-and-files)
- [Adding things](#adding-things)
- [Where to tune things](#where-to-tune-things)

## The big picture

```
              Browser: client/
  ui/ (React)    game/    field/    battle/ (Babylon + Havok)
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

shared/: code both sides run (ECS, math, message types + Zod schemas, field walking, the view size)
```

Three npm workspaces. The rule: **shared = code both sides run; server = anything a player must not be able to
change; client = drawing, input, feel.** Everything in `shared/` and `client/` ships to the browser, so data only
the server needs (encounter rates, spawns, enemy stats, drop tables) stays in `server/`.

## A player's visit, start to end

1. **Title.** `client/src/main.ts` mounts the React UI (the title screen), asks `GET /api/me` who's logged in, and
   starts `prepareGame()` in the background: `game/start.ts` is its own lazily loaded chunk with Babylon, so the
   title shows first while the engine, Havok and both scenes get built behind it.
2. **Login.** The login form calls `POST /api/login` (or `/api/register`), which sets the httpOnly `it_session`
   cookie (30 days).
3. **Join.** Play opens `/ws`; the cookie goes with it. The server finds the account, loads the save and sends
   `welcome` (HP / stamina, stats, settings, character, wins, inventory). With no character yet, the client shows
   the character editor and the server waits for a `character` message; then it sends `level`.
4. **Field.** While you move, the client sends one `input` per 60 Hz tick and predicts its own walking with the
   shared `stepWalker`. The server replays the inputs, runs the level's actors, rolls encounters and sends `state`
   20 times a second with the actors near your screen. The client glides its mirrors toward those positions.
5. **Fight.** The server sends `encounter` (enemy, arena, your HP / stamina and stats). The client switches to
   battle mode and runs the fight itself, then reports `battleEnd { won, vitals }`. The server checks the claim,
   rolls drops, saves and answers `battleResult`; Enter goes back to the field.
6. **Leave.** Return to title, closing the tab or losing the connection closes the socket, and the server saves.
   A second tab on the same account takes over: the first one is closed and lands on the title.

## Server: core plus outlets

The server is hexagonal. `server/src/core/` is the game: sessions, the field, fights, levels, content and the
account rules. It knows nothing about sockets, HTTP, SQL or env; what it needs from outside it asks for through the
interfaces in `core/ports.ts`. The outlets plug into it, and `main.ts` is the only file that sees everything:

```
main.ts
 ├─ db = await connectDb(DEV)                              db/: connects to DATABASE_URL, applies new migrations
 ├─ accounts = new Accounts(new PgAccountStore(db))        core/ rules, db/ storage
 ├─ online = new OnlinePlayers(new PgPlayerStore(db), DEV) core/: who's playing, one GameSession each
 ├─ startServer({ accounts, socket: gameSockets(online) })
 │     ├─ api/  Fastify: /api routes, the built client, the /ws handshake
 │     └─ ws/   gameSockets(): each socket becomes a Connection (the PlayerLink) bound to a GameSession
 └─ timer -> FixedClock (60 steps a second) -> online.tick(dt)
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
  order. Services (the connection, keyboard, mouse, prediction) are plain classes.
- **Two modes, two Babylon scenes, one world.** `game/game.ts` routes server messages and switches between the
  field (`field/`, mode `"field"`) and the fight (`battle/`, mode `"battle"`). Field mirrors (`FieldPos`,
  `FieldActor`) and arena entities (`Fighter`, `Body`, ...) live side by side; only the active mode's systems run.
  Arena fighters are spawned on encounter and destroyed when you return.
- **The field draws what the server says.** `field/mirror.ts` spawns a drawing per actor `kind`;
  `field/prediction.ts` predicts your own walking and reconciles with the server's acks.
- **The arena runs in the browser for now.** Babylon's deterministic lockstep steps it at a fixed 60 Hz
  (`onBeforeStep` / `onAfterStep`), only while its scene renders; render-only systems run once per frame.
  System order (`battle/battle.ts`), fixed step: player input -> player controller -> enemy brain -> attacks ->
  motor -> [physics] -> player ground -> combat. Per frame: camera, player sprite, enemy model animations, HUD.
- **Havok owns dynamic-body transforms.** Systems move things by setting velocity, never position.
- **Attacks are data.** An attack's active frames add an `ActiveHit` (sector: range + angle) to the attacker;
  `combatSystem` resolves hits with plain math (no physics triggers), so the server can run the same code later.
- **AI and animation are separate.** Enemy behavior systems only set state, facing, wanted movement and hitboxes
  (the motor turns that into velocity); each model's animation system reads the state and poses the model.
- **Input enters only through `PlayerInput`** (world-space move + aim), so network input can replace it later.
  Keys come from `client/src/settings/bindings.ts`, never hardcoded.
- **Destroy is deferred** to `world.flush()` at the end of each tick; remove hooks dispose meshes and bodies.
- **The UI is React** (`client/src/ui/`, mounted into `#ui`); the canvas and anything in the world (sprites,
  in-world bars) is Babylon. The game never touches the DOM: it writes plain values into stores (`ui/state.ts`,
  e.g. `ui.battle.set({ hp })`, `ui.showToast(text)`), and components read them with `useStore(store, s => s.hp)`.
  Writing every frame is fine: `Store.set` skips unchanged values, so a component re-renders only when the value it
  selected changes (select one primitive per `useStore` call). What the UI asks of the game (sign in, play, return
  to title) goes through `UiActions`, which `main.ts` provides.
- **Styling is Tailwind v4** (`@tailwindcss/vite`, no config file). Colours and fonts are `@theme` tokens in
  `client/src/ui/styles.css` (`bg-hp`, `text-victory`, `font-title`, ...), shared pieces are `@utility` classes
  (`bar`, `bar-layer`). Write class names out in full (`"from-hp to-hp-dark"`, not a built string), because
  Tailwind can't find names built by concatenation. Motion comes with `motion-reduce:animate-none`.
- **Every screen sees the same amount, at most**: 16:9 (23 x 13 field tiles, `shared/src/field/view.ts`).
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
`GameSession`, which answers with `link.send(...)`. `state` isn't an answer: the clock ticks every session 60
times a second, and every 3rd tick in the field it sends one.

| Client -> server | When |
|---|---|
| `input {seq, moveX, moveZ}` | each tick while walking (nothing while standing still); replayed, rate-limited |
| `character` | made or changed your character |
| `rest` | Rest key by a campfire (the server checks you're there) |
| `useItem {item}` | used an item from the inventory |
| `battleEnd {won, vitals}` | the fight was decided and you left the arena |
| `settings` | a setting changed (debounced on the client) |
| `debug {cmd}` | dev server only: `encounter` starts a fight |

| Server -> client | When |
|---|---|
| `welcome` | after joining: HP / stamina, stats, settings, character (or null), wins, inventory, `dev` |
| `character` | your character, as saved |
| `level` | entering a level: its layout (what the client may see of it) and where you are |
| `state` | 20 a second in the field: `ack` (last input replayed), your position, nearby actors, wins |
| `encounter` | a fight starts: enemy, arena, your HP / stamina and stats |
| `battleResult` | the server's verdict on `battleEnd`: accepted?, wins, HP / stamina, loot, inventory |
| `rested`, `itemUsed` | what resting or eating did |

Close codes the client handles: 4001 not logged in (login form), 4000 the account is playing in another tab
(`CLOSE_CODES` in `shared/src/net/accounts.ts`); 1011 (loading the save failed), 1008 and 1009 end in "connection
lost". Positions in `state` are rounded to 1 cm, and it only carries actors within the 16:9 view of the server's
copy of you plus 3 tiles, so a hacked client can't see further.

## Saving

What's kept between connections is a `PlayerSave` (`core/ports.ts`): HP / stamina, wins, settings, character and
inventory, keyed by account. The `GameSession` saves after every fight, rest, item use and character change, on
disconnect, and within a second of a settings change. Position and level aren't saved (you start at the level's
start), and stats aren't either (everyone has the same).

Postgres is reached through Drizzle (`server/src/db/schema.ts`). The server applies new migrations when it starts;
`npm run db:generate` writes them (see "A schema change" below).

## Rules

- **The server decides; the client asks and draws.** Anything a player shouldn't be able to change lives on the
  server. Everything the client sends is checked against a Zod schema first.
- **The server is core plus outlets** (above). Game rules go in `core/`; anything that talks to the outside world
  goes in an outlet, behind a port.
- **Every player is logged in.** No guest play; `/ws` closes sockets without a login cookie before anything else.
- **Fights are not server-authoritative yet.** The arena runs in the browser and reports won / lost; the server
  only refuses wins faster than the player's maximum damage allows, and HP that went up during a fight. Don't add
  new trust in client claims. Moving the fight onto the server is planned
  ([plan/server-fights.md](plan/server-fights.md)).
- **Keys come from `client/src/settings/bindings.ts`.** When showing one on screen, read it from the bindings
  (`keyName`). Esc and ⌘ can't be rebound.
- **Text is escaped by JSX**, so server or player strings can be rendered safely. No `innerHTML` or
  `dangerouslySetInnerHTML`.
- **Small, single-purpose files** (roughly under 200 lines). Add a folder per new mode, enemy or screen rather than
  growing an existing file. Small math (clamping, smoothing, distances, turning) goes in `shared/src/core/math.ts`.

## Folders and files

**Names.** The 2D map is the **field** everywhere (shared `field/`, server `core/field/`, client `field/`, `Field*`
components, mode `"field"`); the fight is a **battle** (client folder, mode), and the place it happens is the
**arena**. React components are PascalCase `.tsx` files that export components only (so Vite Fast Refresh works);
game code stays `.ts` and imports nothing from React. Numbers with a unit say it in the name (`MAX_BODY_BYTES`).

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
  index.ts         Re-exports everything (import from "@infinite-tower/shared")
  core/            ecs.ts (World, components, queries, deferred destroy), components.ts (LocalPlayer),
                   math.ts (Vec2/3, clamp, approach, damp, distXZ, wrapAngle, turnToward, seededRandom), time.ts
  field/           layout.ts (LevelLayout: what the client may see of a level, campfires included; stepWalker for
                   prediction + replay; nearCampfire / REST_RANGE), view.ts (VIEW: how much a screen shows, at most
                   16:9; viewCenter, the camera's edge rule)
  battle/          components.ts (Player, Health, Stamina, Fighter, ActiveHit, Enemy, GoreAttack, ChargeAttack),
                   player.ts (PLAYER tuning, Vitals, GRAVITY), defs.ts (EnemyDef = body + stats + optional attacks,
                   ArenaDef),
                   input.ts (PlayerInput), stats.ts (Stats, FighterStats, physicalDamage / moveSpeed)
  character/       character.ts (Character = name + look; LOOKS: every cloak / skin / trouser option and its
                   colors; name rules)
  items/           items.ts (ITEMS: name, description, what using one does; Inventory = item id -> count)
  net/             client-messages.ts (Zod schemas + inferred ClientMsg; server-only import),
                   server-messages.ts (ServerMsg types), handlers.ts (Handlers<Msg> map + dispatch by `t`),
                   accounts.ts (the /api routes, username / password rules, AccountInfo, socket CLOSE_CODES),
                   account-requests.ts (their Zod schemas; server-only import), text-rules.ts (TextRules for the
                   username and character name, rulesHint), text-schema.ts (their Zod check; server-only),
                   settings.ts (MAX_KEYS_PER_ACTION)

server/          Node. Authoritative: levels, encounters, field actors, enemy stats, fight results, saves.
  drizzle.config.ts  drizzle-kit's settings (where the schema and migrations are)
  scripts/         check-layers.ts (the hexagonal import rules; run by `npm run typecheck`)
  src/
    main.ts          The only file that sees everything: builds db -> core -> api + ws, plugs them together, runs
                     the tick timer
    env.ts           DEV, PORT, DATABASE_URL from the environment (loads the repo's .env if there is one)
    core/            The game. No sockets, HTTP, SQL or env.
      ports.ts         What core needs from outside, as interfaces: PlayerStore (+ PlayerSave), AccountStore,
                       PlayerLink
      game/            online.ts (who's playing: one session per account, load on join, save on leave, a second
                       tab takes over), session.ts (GameSession, one player: their save, their field, the battle
                       they're in; a method per thing a player can ask), battle.ts (start / settle battles, refuse
                       impossible wins and healing), inventory.ts (addItems, removeOne, MAX_STACK), snapshot.ts
                       (the state message: only actors near your screen), clock.ts (FixedClock: 60 Hz steps,
                       catching up after stalls)
      field/           The field simulation. field.ts (Field: one player's world, level, systems and spawner),
                       components.ts (FieldPos, FieldActor, FieldPlayer), parts.ts (spawnActor from behavior
                       parts), context.ts (FieldContext, what systems get), player.ts (input queue + replay, grass
                       encounters, findPlayer), spawner.ts
        behaviors/       wander, chase (notice -> "!" -> chase), touch (encounter on touch), move
        prefabs/         boar.ts (= wander + chaseOnSight + encounterOnTouch), index.ts (FIELD_PREFABS by id)
      levels/          level.ts (LevelDef: layout, spawn point, spawns, encounter table, arena), index.ts
                       (registry), grass-field.ts
      content/         enemies.ts (ENEMIES by id), player.ts (PLAYER_STATS, fullVitals, newPlayer), drops.ts
                       (what each enemy drops and how often; rollDrops)
      accounts/        accounts.ts (Accounts: sign-up, login check, login sessions; tokens hashed before they're
                       stored), passwords.ts (scrypt)
    ws/              Outlet: the game socket. sockets.ts (takes each /ws socket api/ opened, with its account;
                     joins the player), connection.ts (one socket = the PlayerLink: Zod-checked in, typed out),
                     handlers.ts (each ClientMsg -> one call on the session)
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

client/          Browser game: Babylon rendering, Havok physics, input, React UI.
  index.html       The page: the 16:9 stage frame, the canvas, #ui
  vite.config.ts   Dev server :5173, proxies /ws and /api to the game server
  src/
    main.ts          Bootstrap: mount the UI (title screen), ask who's logged in, start preparing the game;
                     logging in (or Play) connects, then joins; Return to title (or a lost connection) leaves
    game/            start.ts (its own lazily loaded chunk with Babylon: prepareGame() builds the engine, Havok,
                     both scenes and modes and input (off) once, behind the title; join() starts a session on a
                     connection, leave() ends it), game.ts (sessions, routes server messages, field <-> battle
                     switching, who gets input, the character from `welcome` / `character`), dress.ts (repaints
                     the player's sprites in their look), transition.ts (Mode, flash / fade)
    net/             connection.ts (WebSocket; queues messages until the game `listen`s with one handler per
                     type), account.ts (the /api calls: who's logged in, log in, register, log out)
    core/            keyboard.ts (off outside a session or with Settings open), mouse.ts (optional, pointer
                     lock), buttons.ts (held + latched presses), time.ts
    settings/        settings.ts (Settings: every kind of setting in one object; main.ts makes it once and passes
                     it to the game and the UI; `welcome` restores the player's, syncSettings sends each change
                     back), bindings.ts (ACTIONS: every action, label, default keys, fixed mouse buttons;
                     KeyBindings: the player's keys), camera.ts (CameraSettings: sensitivity)
    gfx/             textures.ts (procedural textures), props.ts (scenery art: the campfire), sprites.ts
                     (pixelMaterial, spriteMaterial, redrawSprite), characters.ts (playerFrames(look) draws the
                     player in a character's colors)
    ui/              React: everything drawn over the canvas
      mount.tsx        createRoot + <App>; App.tsx picks the HUD for the mode, then toasts, fade, title screen
      state.ts         UiState: the stores the game writes (title, screen, toasts, field HUD, battle HUD),
                       `settingsScreen` (open / closed: the UI writes it, the game watches it), and UiActions
                       (what the UI asks of the game: signIn, logOut, play, returnToTitle). No React.
      store.ts         Store<T> (set skips unchanged values); useStore.ts reads one value in a component
      keyNames.ts      KeyboardEvent.code / mouse button -> printable name
      styles.css       Tailwind v4 entry + @theme tokens
      components/      Used by more than one screen: Bar.tsx (HUD bar + souls-style damage chip),
                       PlayerBars.tsx (HP + stamina, in the same corner on both HUDs)
      hud/             FieldHud.tsx (HP / stamina, wins, level name, character + settings buttons),
                       BattleHud.tsx, character/ (CharacterPanel.tsx: the stats; statText.ts), inventory/
                       (InventoryPanel.tsx), PanelFrame.tsx (the side panels' box), panelKeys.ts, icons.tsx
      overlays/        Toasts.tsx (stacked, auto-fade, × to dismiss), Fade.tsx
      screens/         One folder per full-screen page, holding the parts only that page uses
        title/           TitleScreen.tsx (login form or Play / Retry + Log out, status line), LoginForm.tsx,
                         Backdrop.tsx (SVG night sky + tower)
        settings/        SettingsScreen.tsx (Esc toggles, Return to title), CameraSection.tsx,
                         KeyBindingsList.tsx (rebinding), buttons.ts
        character/       CharacterEditor.tsx (make / change your character), SpritePreview.tsx, swatches.ts
    field/           The 2D field mode: mirrors the server
      field.ts         The mode: level loads, inputs, server state, render
      scene.ts         Babylon scene + ortho camera, FieldView, layerY
      prediction.ts    Predict your own walking, reconcile with the server's acks
      mirror.ts        Mirror the server's actors (spawned by kind via entities/)
      components.ts    FieldPos, FieldActor, FieldSprite
      input.ts         The walk keys -> a WalkInput
      entities/        player.ts, boar.ts, sprite.ts (flat quad), index.ts (FIELD_PREFABS by ActorSnap.kind)
      systems/         sprites.ts (glide to server positions, tuft, "!"), camera.ts (follow, the view's edge rule)
      levels/          Level renderers by LevelLayout.theme: index.ts (registry, loadLevel, unloadLevel),
                       campfires.ts (any theme's campfires, flickering), grass-field/ (terrain, textures)
    battle/          The 2.5D arena mode
      battle.ts        The mode: system order, start / end a fight (arena built / resized on demand)
      scene.ts         Babylon scene, Havok, camera, lights / fog / shadows / post
      context.ts       BattleContext + collision layers
      components.ts    Body, Meshes (+ disposers)
      materials.ts, arena.ts (ring, stones, forest)
      player/          spawn, components (PlayerSprite), input (keys / mouse -> PlayerInput), controller (move,
                       jump, slash, dodge, stamina), ground (grounded raycasts), sprite (frames, trail, shadow)
      enemies/         spawn.ts (enemy prefab: body + model + Enemy + one component per attack in the def)
        behaviors/       brain (approach / poise / stagger / stun / death), charge, gore, motor (velocity), common
        models/          index.ts (ENEMY_MODELS: add + animation + disposers), boar/ (model, animation)
      systems/         camera, combat, hud (fills the battle HUD's store)
```

## Adding things

- **A message.** Client -> server: a Zod schema in `shared/src/net/client-messages.ts` and the union, a method on
  `GameSession` (`server/src/core/game/session.ts`) that does it, and a handler in `server/src/ws/handlers.ts` that
  calls it (TypeScript errors until you do). Server -> client: a case in `ServerMsg` (`server-messages.ts`) and a
  handler in `client/src/game/game.ts`'s `net.listen({...})`.
- **A level.** A file in `server/src/core/levels/` listed in `index.ts`; reuse a theme or add a renderer in
  `client/src/field/levels/`.
- **A field actor.** A prefab in `server/src/core/field/prefabs/` (a list of behavior parts) plus a client drawing
  in `client/src/field/entities/` under the same `kind`. New behavior: component + factory + system in
  `behaviors/`.
- **An arena enemy.** An `EnemyDef` in `server/src/core/content/enemies.ts` combining attacks. A new attack type is
  a def shape in `shared/src/battle/defs.ts`, a component, an entry in `ATTACKS` (`client/src/battle/enemies/
  spawn.ts`) and a system in `enemies/behaviors/`; a new look is a folder in `enemies/models/` listed in its
  `index.ts`.
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

## Where to tune things

| What | Where |
|---|---|
| Player HP, speeds, slash, dodge (at stats of 10) | `shared/src/battle/player.ts` (`PLAYER`) |
| Player stats | `server/src/core/content/player.ts` (`PLAYER_STATS`) |
| Enemy stats and attacks | `server/src/core/content/enemies.ts` |
| Drops | `server/src/core/content/drops.ts` |
| Items | `shared/src/items/items.ts` |
| Levels: layout, spawns, encounter tables, campfires, arena size | `server/src/core/levels/` |
| Field-actor behavior numbers | `server/src/core/field/prefabs/` |
| Arena camera feel | top of `client/src/battle/systems/camera.ts` |
| View size | `shared/src/field/view.ts` (`VIEW`) |

Changing any of these changes how the game plays: ask first (see [AGENTS.md](AGENTS.md)).
