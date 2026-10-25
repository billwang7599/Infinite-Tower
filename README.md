# Infinite Tower

A browser game in progress: an SAO-style souls-like where you explore a 2D field and fight monsters in small 2.5D
arenas. Single-player for now.

Babylon.js + Havok in the browser, React + Tailwind for the UI, a Node server (Fastify + ws), Postgres (Drizzle).

## Features

What's built so far:

- **Accounts:** sign up or log in with a username and password, and stay logged in for 30 days. Logins are limited
  to 20 tries a minute per IP. Playing from a second tab takes over from the first.
- **Title screen:** the login form and Play beside a low-poly tower of glowing white glass and gold in a dark world
  (lit like a shader would, on a 2D canvas, no WebGL). The game loads while you're on it. Play becomes Retry if the
  server is down. Logging in (or Play) glides into the tower, looks straight up it and speeds up it while the server
  loads you, then flashes white into the world; Return to title plays it backwards.
- **Character:** a name and a look (cloak, skin and trouser colors), made on the first visit and changeable later.
  The character panel shows your stats.
- **Field:** a 2D top-down grass field with a boar that wanders and chases you on sight. Touching it, or walking
  through tall grass, starts a fight. Wider screens than 16:9 get side bars.
- **Fights:** a 2D sprite against a 3D boar in a small round arena. Slash (chained), dodge roll with i-frames,
  jump, stamina. You attack where the camera faces (no lock-on). The boar lunges up close and does a telegraphed
  charge from further away (it's stunned if it hits the wall), and staggers after a few quick hits.
- **Controls:** keyboard only, or keyboard + mouse / trackpad (click a fight to capture the mouse).
  Every key can be rebound in Settings.
- **Stats:** strength, agility, stamina, mana and spellpower on every fighter (mana and spellpower do nothing yet).
- **Vitals carry over:** HP and stamina stay between fights and visits. Resting at the campfire, eating boar meat
  or dying refills them.
- **Inventory:** boars sometimes drop boar meat, which heals.
- **HUD:** HP and stamina bars, boars beaten, the level's name, and buttons for the character panel, the inventory
  and Settings.
- **Settings** (Esc): camera sensitivity, key bindings, return to title.
- **Saving:** your character, vitals, wins, inventory and settings are kept with your account in Postgres.
- **Server:** runs the field and checks every fight result before saving it. The fight itself still runs in the
  browser ([plan/server-fights.md](plan/server-fights.md)).

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

Local settings (database user, password and port, `DATABASE_URL`, the server's `PORT`) live in `.env`, which is
git-ignored. `npm run dev` copies it from `.env.example` the first time. Changing `POSTGRES_USER`, `_PASSWORD` or
`_DB` after the database exists needs `npm run db:reset`.

**Troubleshooting.**

- `EADDRINUSE` on :8787: an older `npm run dev` is still running.
- "can't reach Postgres": Docker Desktop isn't running, the database isn't up (`npm run db:up`), or `.env`'s
  `DATABASE_URL` doesn't match its `POSTGRES_*` lines.
- "a migration failed (relation ... already exists)": the dev database was made by another branch.
  `npm run db:reset`.

## Files

```
shared/            code the server and the browser both run: ECS, math, fight rules and data, the Zod messages
server/src/
  core/            the game itself: accounts, the field, encounters, saving rules (no I/O)
  api/  ws/  db/   what plugs into core: HTTP (Fastify), the game socket, Postgres (Drizzle)
  main.ts          wires them together
client/src/
  field/ battle/   the two modes, drawn with Babylon.js
  net/             talking to the server
  ui/              the React UI (title, HUD, panels, settings)
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
