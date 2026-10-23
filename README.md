# Infinite Tower

An SAO-style souls-like browser game (in progress). Plan: explore floors on a 2D map; touching an
enemy drops you into a small 2.5D arena fight: 3D monsters, 2D billboard players. Babylon.js + Havok
physics, custom ECS on top, React + Tailwind for the UI over the canvas.

**Current prototype (single-player):** a 2D grass field with a wandering boar and a patch of tall grass.
Touch the boar (it chases you once it spots you, "!") or walk through the tall grass (12% chance per tile)
and you're pulled into a 2.5D arena fight. Win and that boar is gone (another shows up ~8 s later); die and you
wake up back at the start. Press Enter after the fight to return to the field. HP and stamina carry over from one
fight to the next (the field HUD shows them); nothing refills them yet except dying. The field HUD also counts the
fights you've won ("Boars defeated"), kept with your account like HP and stamina.
The game opens on a title screen with a login form (username + password, or "Create an account"); in dev there's
a seeded account, **test / test**. Logging in goes straight into the game; after that the title shows Play
(Enter / Space / J, or click) and Log out, and the login is remembered for 30 days. If the server is down it says
so and Play becomes Retry. The game downloads and gets ready behind the title, so after Play there is only the
server's hello to wait for. In the game, Esc (or the gear on the field HUD) opens **Settings**: camera sensitivity, key
bindings, and Return to title, which disconnects from the server. Losing the connection also lands on the title, with Retry.
Playing from a second tab or browser takes over: the first one goes back to the title.
(The earlier tower-climbing platformer is preserved at git tag `tower-platformer`.)

Needs Node and Docker (Docker Desktop running): the dev database is Postgres in a container (`compose.yaml`).
Local settings (the database's user, password and port, `DATABASE_URL`, the server's `PORT`) live in `.env`, which
is git-ignored; `npm run dev` copies it from `.env.example` the first time, and you edit your copy.

```sh
npm install
npm run dev        # database (:5433) + seed, then server (:8787) + client (http://localhost:5173, proxies /ws and /api)
npm start          # production: build the client, server serves it + /ws + /api on http://localhost:8787
npm run typecheck  # shared, server, client
npm run db:up      # start the database (and wait until it's ready); db:down stops it, data is kept
npm run db:reset   # delete all its data (then seeds it again)
npm run db:seed    # add the dev data if it's missing: the account test / test
npm run db:psql    # SQL shell
npm run db:generate -- --name <what-changed>  # after editing server/src/db/schema.ts: writes the migration
```

The server reads `.env` (server/src/env.ts; variables set in the shell win), connects to `DATABASE_URL` and
applies new migrations when it starts. Changing `POSTGRES_USER`, `_PASSWORD` or `_DB` after the database exists
needs `npm run db:reset`.

Playwright and other scripts can log in with `POST /api/login` `{"username":"test","password":"test"}` (the
cookie it sets is what `/ws` checks). After Play, `?debug` exposes `window.battle` (arena context: world, scene, camera view), `window.field` (field scene + level),
`window.mode()`, `window.components`, `window.ui` (the HUD stores), `window.settings` (key bindings, camera) and
`window.encounter()` (asks the server for a fight; dev server only).

## Controls

Every key can be changed in Settings (Esc); changes are saved on the server with your account, so they follow you
to any browser. The defaults (below) and the list of
actions are in `client/src/settings/bindings.ts`. Esc itself always opens and closes Settings. While Settings is open
the game gets no input, but it keeps running: a fight doesn't pause.

**Field:** WASD / arrow keys to walk.

**Arena:** works with keyboard only (laptop) or keyboard + mouse / trackpad, interchangeably.
Click the game to capture the mouse (Esc releases it and opens Settings); until then the keyboard does everything.
Mouse buttons are fixed. Settings → Camera → Sensitivity (25–300%) scales how fast the camera turns and tilts,
from the mouse / trackpad and the keys alike.

| Keyboard only | Mouse / trackpad | |
|---|---|---|
| WASD | WASD | move (relative to the camera) |
| J | left click / tap | slash (chain by pressing again); **you attack wherever the camera faces** |
| K / Shift | right click / two-finger tap | dodge roll (i-frames; backstep if standing still) |
| H / L (or ← →) | move the mouse | turn the camera (there is no lock-on: aiming is up to you) |
| ↑ ↓ | move the mouse | tilt the camera |
| Space | Space | jump |
| Enter / E | Enter / E | after the fight: back to the field |
| Esc | Esc | Settings (in the field too); can't be rebound |

Slashing and dodging cost stamina (green bar); it regenerates when you stop acting. You start each fight with the
HP and stamina you ended the last one with.

## The boar

- **Gore** (close range): head drops and body rocks back for ~0.65 s, then a tusk swipe up. Dodge or back off.
- **Charge** (mid range): paws the ground, eyes glow, red line on the ground. It tracks you, then
  **locks its direction 0.3 s before launching**: dodge sideways then. If it hits the stone ring it's
  **stunned** for ~2 s: free hits.
- **Poise**: about 3–4 quick hits stagger it (not mid-charge).

Tuning: player in `shared/src/battle/constants.ts` (`PLAYER`); enemy stats and attacks in
`server/src/content/enemies.ts`; levels (layout, spawns, encounter tables, arena size) in `server/src/levels/`;
field-actor behavior numbers in `server/src/field/prefabs/`; camera feel at the top of
`client/src/battle/systems/camera.ts`.

## Layout

Three npm workspaces. The rule: **shared = code both sides run; server = anything a player must not be
able to change; client = drawing, input, feel.** Everything in `shared/` and `client/` ships to the browser.

```
shared/src/      Code client AND server run. No Babylon, no DOM (its tsconfig has no DOM lib).
  core/            ecs.ts (World, components, queries, deferred destroy), components.ts (LocalPlayer),
                   math.ts (Vec2/3, clamp, approach, damp, distXZ, wrapAngle, turnToward, seededRandom), time.ts
  field/           layout.ts (LevelLayout: what the client may see of a level; stepWalker for prediction + replay),
                   view.ts (VIEW: how much a screen shows, at most 16:9; viewCenter, the camera's edge rule)
  battle/          components.ts (Player, Health, Stamina, Fighter, ActiveHit, Enemy, GoreAttack, ChargeAttack),
                   constants.ts (PLAYER), defs.ts (EnemyDef = body + optional attacks, ArenaDef), input.ts (PlayerInput)
  net/             client-messages.ts (Zod schemas + inferred ClientMsg; server-only import),
                   server-messages.ts (ServerMsg types), handlers.ts (Handlers<Msg> map + dispatch by `t`),
                   accounts.ts (the /api routes, username / password rules, AccountInfo, socket CLOSE_CODES),
                   account-requests.ts (their Zod schemas; server-only import)

server/src/      Node + ws. Authoritative: levels, encounters, field actors, enemy stats, fight results.
  main.ts          Wires db -> accounts -> net -> online players -> loop; picks the player store
  net/             server.ts (HTTP: /api then static files; /ws only for a logged-in cookie), connection.ts (one
                   socket: Zod-validated in, typed out), http.ts (JSON body / reply helpers), static.ts
  auth/            accounts.ts (Accounts: create, verify, login sessions; tokens stored as SHA-256),
                   passwords.ts (scrypt), cookies.ts (the httpOnly login cookie), routes.ts (the /api handlers)
  game/            online.ts (who's playing: one session per account, load on join, save on leave, a second tab
                   takes over), session.ts (one player: world, level, wins, HP/stamina; saves after fights and on disconnect), handlers.ts (one
                   handler per ClientMsg), encounter.ts (start/end fights, refuse impossible wins and healing),
                   snapshot.ts (state msg: only actors near your screen), loop.ts (60 Hz)
  levels/          level.ts (LevelDef: layout, spawn point, spawns, encounter table, arena), index.ts (registry),
                   grass-field.ts
  field/           The field simulation. components.ts (FieldPos, FieldActor, FieldPlayer), parts.ts (spawnActor
                   from behavior parts), context.ts, player.ts (input replay + grass encounters), spawner.ts
    behaviors/       wander, chase (notice -> "!" -> chase), touch (encounter on touch), move
    prefabs/         boar.ts (= wander + chaseOnSight + encounterOnTouch), index.ts (FIELD_PREFABS by id)
  content/         enemies.ts (WILD_BOAR, ENEMIES by id)
  store/           player-store.ts (PlayerStore interface, PlayerSave = what's kept between connections),
                   pg-player-store.ts (PlayerStore on the `players` table; one query at a time per player)
  env.ts           DEV, PORT, DATABASE_URL from the environment (loads the repo's .env if there is one)
  db/              schema.ts (the tables, in TypeScript: Drizzle ORM), db.ts (connects to DATABASE_URL, applies new
                   migrations at startup), migrations/ (SQL written by `npm run db:generate`, plus drizzle-kit's
                   meta/; settings in server/drizzle.config.ts), seed.ts (dev data: the test / test account;
                   refuses to run in production)

client/src/      Browser game: Babylon rendering, Havok physics, input, React UI.
  main.ts          Bootstrap: mount the UI (title screen), ask who's logged in, and start preparing the game; logging
                   in (or Play) connects, then joins; Return to title (or a lost connection) leaves
  game/            start.ts (its own chunk with Babylon, imported lazily so the title shows first: prepareGame() builds
                   everything once behind the title: engine, Havok, both scenes and modes, input (off); join() starts a
                   session on a connection, leave() ends it), game.ts (sessions, routes server messages, field <-> battle
                   switching, who gets input), transition.ts (Mode, flash / fade)
  net/             connection.ts (WebSocket; queues messages until the game `listen`s with one handler per type),
                   account.ts (the /api calls: who's logged in, log in, register, log out)
  core/            keyboard.ts (off outside a session or with Settings open), mouse.ts (optional, pointer lock),
                   buttons.ts (held + latched presses), time.ts
  settings/        settings.ts (Settings: every kind of setting in one object; main.ts makes it once and passes it
                   to the game and the UI; `welcome` restores the player's, and syncSettings sends each change back), bindings.ts (ACTIONS: every action, label, default keys, fixed mouse
                   buttons; KeyBindings: the player's keys, restore / toSaved; the game reads
                   `settings.bindings.get()` every tick), camera.ts (CameraSettings: sensitivity; the
                   arena camera reads it every tick)
  gfx/             textures.ts (procedural textures), sprites.ts (pixelMaterial, spriteMaterial), characters.ts (art)
  ui/              React: everything drawn over the canvas (see "UI" below)
    mount.tsx        createRoot + <App>; App.tsx picks the HUD for the mode, then toasts, fade, title screen
    state.ts         UiState: the stores the game writes (title, screen, toasts, field HUD, battle HUD),
                     `settingsScreen` (open/closed: the UI writes it, the game watches it), and UiActions (what
                     the UI asks of the game: signIn, logOut, play, returnToTitle). No React.
    keyNames.ts      KeyboardEvent.code / mouse button -> printable name
    store.ts         Store<T> (set skips unchanged values); useStore.ts reads one value in a component
    components/      Reusable pieces: Bar.tsx (HUD bar + souls-style damage chip), PlayerBars.tsx (HP + stamina,
                     drawn in the same corner by both HUDs)
    hud/             FieldHud.tsx (HP / stamina, wins, level name, settings gear), BattleHud.tsx
    overlays/        Toasts.tsx (stacked, auto-fade, × to dismiss), Fade.tsx
    screens/         One folder per full-screen page, holding the parts only that page uses
      title/           TitleScreen.tsx (login form or Play / Retry + Log out, status line), LoginForm.tsx (log in /
                       create an account), Backdrop.tsx (SVG night sky + tower)
      settings/        SettingsScreen.tsx (Esc toggles, Return to title), CameraSection.tsx (sensitivity
                       slider), KeyBindingsList.tsx (rebinding), buttons.ts
    styles.css       Tailwind v4 entry + @theme tokens
  field/           The 2D field mode: mirrors the server
    field.ts         The mode: level loads, inputs, server state, render
    scene.ts         Babylon scene + ortho camera, FieldView, layerY
    prediction.ts    Predict your own walking, reconcile with the server's acks
    mirror.ts        Mirror the server's actors (spawned by kind via entities/)
    components.ts    FieldPos, FieldActor, FieldSprite
    input.ts         The walk keys -> a WalkInput
    entities/        player.ts, boar.ts, sprite.ts (flat quad), index.ts (FIELD_PREFABS by ActorSnap.kind)
    systems/         sprites (glide to server positions, tuft, "!"), camera (follow, shared/src/field/view.ts)
    levels/          Level renderers by LevelLayout.theme: index.ts (registry, loadLevel, unloadLevel), grass-field/
  battle/          The 2.5D arena mode (still simulated in the browser, see below)
    battle.ts        The mode: system order, start/end a fight (arena built/resized on demand)
    scene.ts         Babylon scene, Havok, camera, lights/fog/shadows/post
    context.ts       BattleContext + collision layers
    components.ts    Body, Meshes (+ disposers)
    materials.ts, arena.ts (ring, stones, forest)
    player/          spawn, components (PlayerSprite), input (keys/mouse -> PlayerInput), controller (move,
                     jump, slash, dodge, stamina), ground (grounded raycasts), sprite (frames, trail, shadow)
    enemies/         spawn.ts (enemy prefab: body + model + Enemy + one component per attack in the def)
      behaviors/       brain (approach/poise/stagger/stun/death), charge, gore, motor (velocity), common
      models/          index.ts (ENEMY_MODELS: add + animation + disposers), boar/ (model, animation)
    systems/         camera, combat, hud (fills the battle HUD state; everything that isn't one player or one enemy)
```

Arena system order (battle.ts). Fixed 60 Hz: player input → player controller → enemy brain → attacks → motor →
[physics] → player ground → combat. Per frame: camera, player sprite, enemy model animations, HUD.

Naming: the 2D map is **field** everywhere (shared `field/`, server `field/`, client `field/`, `Field*` components,
mode `"field"`); the fight is **battle** (client folder, mode) and the place it happens is the **arena**.

### Adding things

- **A message:** client -> server: add a Zod schema to `shared/src/net/client-messages.ts` and the union, then a
  handler in `server/src/game/handlers.ts` (TypeScript errors until you do). Server -> client: add to `ServerMsg`
  in `server-messages.ts` and a handler in `client/src/game/game.ts`'s `net.listen({...})`.
- **A level:** a file in `server/src/levels/` listed in `index.ts`; reuse a theme or add a renderer in `client/src/field/levels/`.
- **A field actor:** a prefab in `server/src/field/prefabs/` (a list of behavior parts) plus a client drawing in
  `client/src/field/entities/` under the same `kind`. New behavior: component + factory + system in `behaviors/`.
- **Something kept between connections:** a field on `PlayerSave` and `newPlayer()` in
  `server/src/store/player-store.ts`, read from it in `Session`'s constructor and written in `Session.save()`;
  a column in `server/src/db/schema.ts` (then a migration, below), and the queries in `pg-player-store.ts`.
  Another store is a class implementing `PlayerStore`, swapped in for `new PgPlayerStore(db)` in `server/src/main.ts`.
- **A schema change:** edit `server/src/db/schema.ts`, run `npm run db:generate -- --name <what-changed>`, read the
  SQL it wrote and commit it with `migrations/meta/`. drizzle-kit asks when it can't tell a rename from a drop + add.
  For data changes it can't work out, `npm run db:generate -- --custom --name <what>` writes an empty migration to
  fill in. Don't edit merged migrations: databases that already ran them won't run them again.
- **A key binding:** add the action to `ACTIONS` in `client/src/settings/bindings.ts` (label + default keys) and
  read it with `settings.bindings.get().<group>.<action>`; the settings screen lists it on its own.
- **A new kind of setting:** a store in `client/src/settings/` with `restore` / `toSaved` (see camera.ts), added to
  `Settings`, `createSettings()`, `restoreSettings()` and `toSaved()` in settings.ts, a field in
  `SavedSettingsSchema` (`shared/src/net/client-messages.ts`), and a section in `ui/screens/settings/` shown by
  SettingsScreen. The server stores whatever passes the schema as is (`players.settings`, jsonb). Game code
  reads it from the `settings` it already has (`ctx.settings` in the arena); nothing in between changes.
- **A UI screen or HUD piece:** a component in `client/src/ui/` (`hud/`, `overlays/`, or a folder of its own in
  `screens/`; parts used by more than one screen go in `components/`); if the
  game has to feed it, add the fields to a store in `ui/state.ts` and `set` them from game code. If it has to
  ask the game for something, add a function to `UiActions` (main.ts provides them).
- **An arena enemy:** an `EnemyDef` in `server/src/content/enemies.ts` combining attacks; a new attack type is a def
  shape in `shared/src/battle/defs.ts`, a component, an entry in `ATTACKS` (`enemies/spawn.ts`) and a system in
  `enemies/behaviors/`; a new look is a folder in `enemies/models/` listed in its `index.ts`.

Keep files small and single-purpose (roughly under 200 lines); add a folder per new mode or enemy
rather than growing an existing file. Small math (clamping, smoothing, distances, turning) goes in
`shared/src/core/math.ts` rather than being written inline again.

## UI

Everything over the canvas (HUDs, toasts, fades, menus) is **React** (`client/src/ui/`, mounted into `#ui`).
The canvas and anything in the 3D/2D world (sprites, in-world bars, name tags) is Babylon.

- **The game never touches the DOM.** It writes plain values into stores (`ui/state.ts`, e.g.
  `ui.battle.set({ hp })`, `ui.showToast(text)`); components read them with `useStore(store, s => s.hp)`.
  Writing every frame is fine: `Store.set` ignores unchanged values, so a component only re-renders when the
  value it selected changes. Select one primitive per `useStore` call.
- **Component files** are PascalCase `.tsx` and export components only (keeps Vite Fast Refresh working);
  game code stays `.ts` and imports nothing from React.
- **Text is escaped by JSX**, so server or player strings (names, chat) can be rendered safely. Don't use
  `dangerouslySetInnerHTML`.

### Styling

Components use **Tailwind CSS v4** (via `@tailwindcss/vite`, no config file) utility classes in `className`.
Game colours/fonts are `@theme` tokens in `client/src/ui/styles.css` (`bg-hp`, `text-victory`, `font-title`, ...);
shared pieces are `@utility` classes (`bar`, `bar-layer`). The title screen's motion (`animate-rise`,
`animate-twinkle`, `animate-drift`) always comes with `motion-reduce:animate-none`. Write class names out in full (pass
`"from-hp to-hp-dark"`, not a built string), because Tailwind can't detect names built by concatenation.

## Architecture rules

- **The server decides; the client asks and draws.** On the field the client sends one input per tick while you move
  (nothing while you stand still) and predicts its own walking with the shared `stepWalker`; the server replays the
  inputs (rate-limited, so sending more doesn't move you faster), rolls encounters, runs the level's actors, and sends
  state 20x/s with positions rounded to 1 cm.
- **Every screen sees the same amount, at most.** The view is 16:9 at most (23 x 13 field tiles): `client/index.html`
  puts the game in a frame that wide, so wider windows get bars on the sides and taller ones see a little less
  width. `state` only carries actors within that 16:9 view of the server's copy of you, plus 3 tiles, so a hacked
  client can't see further and actors appear off-screen.
- **Every player is logged in.** `/api/login` (or `/api/register`) sets an httpOnly cookie; `/ws` closes sockets
  without one (code 4001) before anything else happens, and a player's save is keyed by their account. There's no
  guest play. Levels, encounters, enemy stats, wins,
  respawns and the HP / stamina you carry between fights and connections (saved in Postgres) come from the server.
  Settings are saved there too: `welcome` brings them, and the client sends a `settings` message (debounced) after
  each change, which the server writes at most once a second. Everything the client sends is checked against a Zod schema first.
- **Fights are not server-authoritative yet.** The arena still runs in the browser (Havok) and reports "won/lost";
  the server only refuses wins faster than the player's maximum damage allows, and HP that went up during a fight. Moving the fight onto the server
  (Babylon NullEngine + Havok in Node, or simpler server physics) is the next step for real anti-cheat.
- **Two modes, two Babylon scenes, one client ECS world.** Field mirrors (`FieldPos`, `FieldActor`) and arena
  entities (`Fighter`, `Body`, ...) live side by side; only the active mode's systems run. The arena is stepped
  by Babylon's lockstep + Havok only while its scene renders. Arena fighters are spawned on encounter and
  destroyed when you return.
- **Havok owns dynamic-body transforms.** Systems move things by setting velocity, never position.
- **Fixed 60 Hz simulation** via Babylon's deterministic lockstep (`onBeforeStep` / `onAfterStep`); render-only systems run once per frame.
- **Attacks are data.** An attack's active frames add an `ActiveHit` (sector: range + angle) to the attacker; `combatSystem` resolves hits with plain math (no physics triggers), so the server can run the same code later.
- **AI and animation are separate.** The enemy behavior systems only set state, facing, wanted movement and hitboxes (the motor turns that into velocity); each model's animation system (`boarAnimationSystem`) reads the state and poses the 3D model (wind-up tells, gallop, stun, death).
- **Input enters only through `PlayerInput`** (world-space move + aim), so network input can replace keyboard/mouse later.
- **Destroy is deferred** to `world.flush()` at the end of each tick; remove hooks dispose meshes and bodies.
