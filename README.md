# Infinite Tower

A browser game in progress: an SAO-style souls-like where you explore a 2D overworld and fight monsters in small 2.5D
arenas. Single-player for now.

Babylon.js in the browser, Rapier for the arena's physics, React + Tailwind for the UI, a Node server (Fastify + ws),
Postgres (Drizzle).

## Features

What's built so far:

- **Accounts:** sign up or log in with a username and password, and stay logged in for 30 days. Logins are limited
  to 20 tries a minute per IP. Playing from a second tab takes over from the first.
- **Title screen:** the login form and Play beside a low-poly tower of glowing white glass and gold in a dark world
  (lit like a shader would, on a 2D canvas, no WebGL). The game loads while you're on it. Play becomes Retry if the
  server is down. Logging in (or Play) glides into the tower, looks straight up it and speeds up it while the server
  loads you, then flashes white into the world; Return to title plays it backwards.
- **Character creation:** a new player's way in holds on white, where a faceless System greets them; then they
  pick a name, boy or girl, and a look (build, face, skin, hair and its color, eyes and their color, mouth,
  clothes and trim colors) beside a pixel-art anime portrait and the chibi they'll be in the world. Confirmed, it's
  kept for good. The character panel shows the portrait and your stats.
- **Overworld:** a 2D top-down grass field with a boar that wanders and chases you on sight. Touching it, or walking
  through tall grass, starts a fight. Wider screens than 16:9 get side bars.
- **Fights:** a 2D sprite against a 3D boar in a small round arena. A sword with eight swings (one per way across
  the screen) and a stab, a held block, a dodge roll with i-frames, jump, stamina. Horizontal swings hit wide and
  short, vertical ones narrow and long, the stab a long thin line. Swings chain: the next starts quicker or slower
  by how it follows the last (the reverse swing quickest) and builds momentum, more damage a hit (the HUD shows the
  combo), until a gap, a block, a dodge or a hit taken; a stab after a chain spends it. A block stops what hits it
  from in front for stamina, and breaks, staggering you, when the stamina runs out. You attack where the camera
  faces (no lock-on). The boar lunges up close and does a telegraphed charge from further away (it's stunned if it
  hits the wall), and staggers after a few quick hits.
- **Controls:** keyboard only, or keyboard + mouse / trackpad (a fight captures the mouse as it starts, or on a
  click with Auto mouse lock off). Every key can be rebound in Settings. In a fight: WASD move, Q / E turn the
  camera, Space jumps, F (or a right click) dodges, Shift blocks; U I O / J K L / M , . is a grid where K stabs
  and each other key swings from its side to the opposite one (J or a left click: left to right).
- **Stats:** strength, agility, stamina, mana and spellpower on every fighter (mana and spellpower do nothing yet).
- **Vitals carry over:** HP and stamina stay between fights and visits. Resting at the campfire, eating boar meat
  or dying refills them.
- **Inventory:** a 6 x 4 bag that items fit into by size, and a weight limit that grows with strength. Over the
  limit a dodge costs more stamina; 20% over it, you can't dodge and walk at half speed. Boars sometimes drop meat
  (heals), a hide or a tusk; what doesn't fit is left behind. Dying empties the bag. The bag screen (B) is the
  grid, worked with the mouse (you stand still while it's open): hover for an item's tooltip, click to select,
  drag to move, R or a right click to turn, Enter or a double click to eat.
- **HUD:** HP and stamina bars, boars beaten, the level's name, the ping, and buttons for the character panel, the
  inventory and Settings. Small notices (loot, a full bag, dying, resting, eating) stack in the bottom-right corner
  and fade; only a fight starting gets the big banner in the middle.
- **Settings** (Esc): camera sensitivity, auto mouse lock and show ping (both on by default), key bindings (general:
  Esc, WASD, the panels; the overworld's; the arena's), return to title.
- **Saving:** your character, vitals, wins, bag and settings are kept with your account in Postgres.
- **Server:** runs the overworld and the fights, and decides both: hits, damage, stamina, deaths and who won. In a
  fight the browser runs its own copy of the whole fight, so you and the boar answer at once, and sends only its
  inputs, each for a numbered step; the server runs them on those steps (up to 200 ms late), checks the browser's
  copy 4 times a second and corrects it when they differ. The result shows only once the server says so. Leaving
  mid-fight loses it (the bag empties, as on a death); a fight ends as a loss after 10 minutes.

## Running it

Needs Node and Docker (Docker Desktop running): the dev database is Postgres in a container.

```sh
npm install
npm run dev
```

Open http://localhost:5173 and log in as **test1 / test1** (or test2 / test2, test3 / test3), or create an
account. `npm run dev` starts the database, adds those accounts if they're missing, then runs the server (:8787)
and the client (Vite on :5173, which forwards `/ws` and `/api` to the server).

```sh
npm start          # production: build the client; the server serves it + /ws + /api on http://localhost:8787
npm test           # unit tests (shared, server, client); no database needed. CI runs typecheck, test, build
npm run typecheck  # shared, server, client and their tests, then the server's layering (server/scripts/check-layers.ts)
npm run build      # the client bundle
npm run db:up      # start the database (and wait until it's ready); db:down stops it, data is kept
npm run db:reset   # delete all its data, then seed it again
npm run db:seed    # add the dev accounts if they're missing: test1, test2, test3 (password = username)
npm run db:psql    # SQL shell
npm run db:generate -- --name <what-changed>  # after editing server/src/db/schema.ts: writes the migration
```

Local settings (database user, password and port, `DATABASE_URL`, the server's `PORT`, `DEV_PING_MS`) live in
`.env`, which is git-ignored. `npm run dev` copies it from `.env.example` the first time. Changing `POSTGRES_USER`,
`_PASSWORD` or `_DB` after the database exists needs `npm run db:reset`.

**A simulated ping (dev only).** The dev server delays the game's messages by half of `DEV_PING_MS` each way (50 ms
if it's left out; any whole number of ms, 0 for none), so the netcode can be felt on localhost. For one tab, add
`?ping=N` to the page's address (http://localhost:5173/?ping=200; the HUD's ping then reads about 200); no restart
needed. Production never delays.

**Troubleshooting.**

- `EADDRINUSE` on :8787: an older `npm run dev` is still running.
- "can't reach Postgres": Docker Desktop isn't running, the database isn't up (`npm run db:up`), or `.env`'s
  `DATABASE_URL` doesn't match its `POSTGRES_*` lines.
- "a migration failed (relation ... already exists)": the dev database was made by another branch.
  `npm run db:reset`.

## Files

```
shared/            code the server and the browser both run: ECS, math, the arena fight (Rapier), the Zod messages
server/src/
  core/            the game itself: accounts, the overworld, encounters, saving rules (no I/O)
  api/  ws/  db/   what plugs into core: HTTP (Fastify), the game socket, Postgres (Drizzle)
  main.ts          wires them together
client/src/
  overworld/       the 2D map mode, drawn with Babylon.js
  battle/          the 2.5D arena fight mode, drawn with Babylon.js
  net/             talking to the server
  ui/              the React UI (title, HUD, panels, settings)
  gfx/look/        character art in code: portrait, chibi, battle (style: ART.md; preview: localhost:5173/art.html)
  gfx/items/       item pictures for the bag, drawn the same way
*/test/            unit tests for each workspace, mirroring its src/ (npm test)
.github/workflows/ CI: typecheck, test and build on every PR
plan/              future plans and parked ideas
compose.yaml       the dev database (Postgres in Docker)
.env.example       local settings; copied to .env
```

| Doc | What's in it |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | how the code fits together, every folder and file, how to add things, where to tune |
| [AGENTS.md](AGENTS.md) | how to work in this repo: ask before game mechanics, decisions so far, checks, git and PRs |
| [plan/](plan/README.md) | where it's headed |
