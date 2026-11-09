# AGENTS.md

Infinite Tower is a browser game: an open-world RPG with souls-like fights, in the spirit of AdventureQuest Worlds
and SAO but with more immersive combat. You walk an HD-2D overworld (pixel sprites on 3D ground) shared with everyone
online; fights happen in a small 3D arena, in first person. A TypeScript monorepo: `shared/` (code both sides run),
`server/` (Node, authoritative, hexagonal), `client/` (Vite, Babylon.js, React) and `art-lab/` (a dev tool for
drawing art, never shipped).

The user's rules for every project (subagents, code style, test-first, PRs and stacks) are in `~/.pi/agent/AGENTS.md`.
This file has only what's specific to this repo.

## Goals

- **Never locked out.** A semi-sandbox RPG: every choice (a god, a build, a path) can be changed later for some
  effort, never for free and never for good.
- **Readable, committed fights.** Simple to learn, deep to master (Souls, Sekiro, For Honor): a player who loses an
  exchange knows why, and fights are won by reads and stamina, never stunlocks. Feel beats numbers.
- **One shared world**, seamless and open, for everyone online, with duels and fights others can join.
- **Progression without levels**: the core, a soul grown with monster essence. Nothing should read like XP.
- **A story that knows it's a game**: players are souls from our world, summoned as avatars
  ([plan/lore.md](plan/lore.md)).

## The docs, and keeping them current

This section is the one owner of how docs are kept. Each doc is a high-level overview; the code, tests and git log
hold the details.

- [README.md](README.md): what the game is, its features at a headline level, how to run and host it.
- [ARCHITECTURE.md](ARCHITECTURE.md): how the pieces fit and talk, the architecture rules, the major folders, recipes.
- [FORMULAS.md](FORMULAS.md): the shape of each gameplay calculation and the file that owns its numbers.
- [ART.md](ART.md): the art direction and how to use the art lab.
- [plan/](plan/README.md): one file per plan: its goal, what's decided (in detail), what's open; and
  [plan/agent-picks.md](plan/agent-picks.md), what agents decided when told to, for the user to review.
- AGENTS.md: the goals, the working rules and the user's standing decisions, one line each.
- [SOUNDS.md](SOUNDS.md) is a licence ledger (CC0 only): every sound or music file added or removed changes its row.

Update a doc only when the big picture, a rule, a goal or a standing decision changes (a new system, a new way the
pieces talk, a new major folder, a calculation whose shape changes, a decision the user makes). Never add file
listings, tuning numbers, test names or counts, change logs or per-tweak history: they belong in the code, the tests
and the PR description. A standing decision is one line below, in the present tense, with no number that lives in
code; when one replaces another, rewrite its line, and put its detail in the plan it belongs to. An agent's pick goes
in a line of plan/agent-picks.md. Read ARCHITECTURE.md before changing code you haven't worked in.

## Ask before deciding any game mechanic

Don't pick a game mechanic yourself. If a task needs a decision about how the game plays, stop and ask, with the
options, before building it: stats (HP, stamina, damage, costs, cooldowns, regeneration), what heals or refills,
what's kept or lost (on death, between fights, on disconnect), encounters, rewards and progression, and how controls
feel (speeds, timings, camera), obvious-seeming defaults included. If something built implies a mechanic nobody
approved, say so and ask. When the user decides, add a line below.

Details the user left to agents (most numbers, layouts, names, lines, looks) are changeable picks living in the code.
The world as it stands is a test world (the user: "the starter stuff is just to test things"): its regions, items and
numbers may be tweaked freely for testing; don't build on them as the real game.

## Standing decisions

World and story:

- One rule set: what the overworld and the arena both have (the bag, eating, piles, Interact) works the same in both,
  through the same code; a difference needs a reason.
- One seamless open world: regions are labels on one map, walked between with no loading, sent and drawn in chunks;
  monsters may chase across borders; no floors or realm locks.
- The tower of floors is on hold; Highmere and the test areas (Waking Hollow, Grass Field, Mistwood, Old Quarry) stay.
- Highmere, the Empire's sacred Door City, grows ward by ward, joined by gates; it has three shops, one summoning pad
  (the Castle Ward's platform), no campfires and no enemies but the butcher's chickens.
- New players start there with nothing (no words, empty hands, only a starter backpack), on its platform. The herald
  greets them and names the controls only in what he says. An old man (Bram) gives an old stick.
- The start is linear: the herald, then Bram's training yard, then the butcher's chickens, which teach tall grass
  (his pen is the city's only tall grass). Wenna's and Tamsin's quests are open from the start.
- Summoning pads are respawn points: Interact by any pad binds you, free; logging in and dying wake you on your pad.
  Only the pad is saved, not your position.
- Campfires refill HP and stamina, as often as you like, and are in the wild only.
- NPC names go the medieval way: city surnames from old trades, country bynames, noble houses.
- NPCs are data, kept like monsters: each one's file says where it stands and what it says by the story.
- A recurring NPC moves on with the story, leaving a trace that points the way, so nobody is stuck.
- Quests come from NPCs (Accept or Not now, no other dialogue choices); each player's story is their own.
- The questbook holds only what your character has found out, with hints as told; no map markers, no minimap.

Character and progression ([plan/core.md](plan/core.md)):

- A character is a name, boy or girl (words only) and a look: cosmetic, classless, fixed after creation for now.
- The core is the progression: five realms of three steps filled with monster essence, shown as a glowing sphere whose
  light grows, never a bar.
- Every step raises every stat and gives free points; points can always be taken back, for some effort.
- Scaling (the user: "scaling should feel rewarding, as leveling up should be exponentially harder per stage"): each
  step takes exponentially more kills of its own realm's foes, by one rule; each step is a clear jump in power;
  enemies keep up by a fixed growth per area, not by the player's; equal realms fight alike at every step; buffs stop
  at a cap. The numbers are the agents' (plan/agent-picks.md).
- Dying is hardcore: all you carry drops where you fell and the core loses its fill (or a step). Words, skillbook
  pages, the story and inscriptions are kept.
- HP and stamina carry over between fights and connections.
- Inscriptions: permanent passives carved into the core, shown as rings, capped by its growth, costly to remove, kept
  on every death.
- Blessings come from faith with a god; separate from inscriptions, no cap.
- Every item has a rarity; a unique thing exists once in the world, goes back after 7 days away, and can be traded.

Combat (every decision in detail: [plan/combat-v2.md](plan/combat-v2.md)):

- Combat is gear (weapons) plus skills. Fights are in first person only and always locked on; their looks are tuned
  for first person (third person need only not look broken), and work on 3D people goes into the skeleton, motion and
  physics, not sculpting.
- One sword system: light, heavy, stab, a held block with a perfect block, a swing parry, a dodge. No kick. A swing's
  way comes from a mouse flick (seven ways, no upward swing); locked on, attacks go where you face.
- Each weapon is a table of its own stats (the user: "every weapon just now has a table of stats to read from");
  strength over its minimum quickens it a little, up to a cap (the user: "maybe strength (over minimum required)
  slightly increases speed, but only up to 5-10%"), and cheapens it; otherwise strength adds damage, so weapons keep
  their character (the user: "if things get too quick, they lose uniqueness and its unbalanced"). A better weapon
  keeps its table and only hits harder (the user: "higher tier weapons would be around the same weight wise").
- Each weapon has a minimum strength: under it you can't equip it (the user: "they cant wield it if they dont have
  sufficient strenght"), and one that falls under it leaves the hand. A lone blade is held in both hands, putting in
  1.5× the strength, which counts toward the minimum.
- Strength over a weapon's minimum makes its swings cheaper, capped, never dearer, so stamina matters less the
  stronger you are, on purpose (the user: "the more we level, the less we worry about trivial things like sword
  swings").
- Enemies swing by the same rule as players, from their weapon's table and their strength; balance goes through
  weapons, stats and pacing.
- Every wind-up has a hard floor, so every attack is reactable. Momentum pays in damage, never speed.
- Hits do damage only (no knockback, no stun); enemies stagger only when their poise breaks. A stun resets an enemy's
  attack; a swordsman's counter after a parry or perfect block can be met.
- Blocking is the safe defence, the swing parry the risky one; both scale with the blade. Only heavies can be feinted.
  Blocks push back, as movement only that never locks controls; a wall behind you makes the chip cost more.
- A shield blocks best, then one blade, then two; Q switches hands with two blades. The Kobolds stay one-handed.
- Weapon damage is typed (slash, stab, blunt); sword stabs stay weak, rapiers and spears will be the stab weapons.
- Stamina is a player's only bar (no mana, no player poise); a hit that empties it breaks the guard.
- Enemy tells are sound and animation only; your own aim ring is the only marker, drawn as HUD.
- Nothing ever pauses the fight; hit-stop is local and drawing only. A dodge never cancels an attack.
- Bows are placeholders (hold to draw, two-handed, a quiver at the hip, Minecraft-like flight). Bows and skills share
  one aim; aiming frees the camera and shows a crosshair.
- Lock-on stays, so skills are balanced on the defender's side: Bolts don't lead, homing turns slowly.
- Leaving a fight mid-way is a loss, and a fight that runs too long ends as one.

Skills ([plan/skills.md](plan/skills.md)):

- Skills are words in a grammar (a Form, elements, modifiers, each applied in order); nothing about them is magic-only.
- No caps on modifiers or segments: stamina is the only limit. No mana and no cooldowns.
- Skills work in fights only. Anyone may chant, with no book, and others see the words.
- The skillbook only saves skills for quick-cast. A new player knows no words; how words are learned is open.

Items, drops and money ([plan/items.md](plan/items.md)):

- The bag is a grid (extraction-shooter style): a tiny base bag plus a backpack grid of its own, never joined.
- Carried weight counts against a limit that grows with strength (Dark Souls' equip load).
- Gear slots cover the hands, armour, belt, back, wrists, rings and hip; cosmetic slots never give stats.
- An item is its components (consumable, wearable, weapon), as data. New item effects are mechanics to ask about.
- Using an item is one rule everywhere: it takes time, you stand still, a hit stops it.
- The bag screen is mouse-only; the world doesn't pause while it's open.
- Drops are piles opened by facing them; loot is shared, first come first served, and unpicked piles vanish.
- A won arena stays open for its loot and closes by itself; what's left there becomes an overworld pile.
- Money is gold, silver and copper coins in the bag (lost on death), changed only at shops and money changers; monsters
  drop none.
- Prices go by place, and a first purchase at each shop is cheaper.
- A saved item the game no longer has is dropped on load.

Multiplayer and server:

- The server decides. Postgres (through Drizzle) is the only database. You log in to play; no guests.
- One shared overworld: an enemy someone touches is gone for everyone until it respawns; players pass each other.
- Duels come by challenge and are spars, costing and winning nothing. Others may join a fight; no friendly fire.
- Chat is the whole server's. The title lists the game servers (one for now).
- Spamming messages or sitting idle disconnects you (the user: "if its spam, then sure disconnect. or if theyre afk").
- Settings live on the server with the save; only the dev admin panel's are kept in the browser.

Controls and presentation:

- The game holds the mouse in fights (a setting, on by default); on the overworld the pointer is free.
- The overworld camera turns freely with the arrows or a right drag (the pointer hidden while dragging), tilts within
  caps, and walking follows it.
- The overworld is HD-2D in 3D; the flat 2D view is archived ([plan/overworld-2d.md](plan/overworld-2d.md)).
- No on-screen control hints or fps counters, but the HUD's ping (a setting hides it) and the leave key after a fight.
- The HUD and menus are "Inscribed" (carved stone), the foe's bar red, the pointer the game's own.
- What the player is told is a small corner notice; no centre banners. Every screen sees at most 16:9.
- The character panel has Stats (with Advanced numbers), Core and Relationships (faith per god) tabs.
- Dev servers have an F1 admin panel and chat cheats, mid-fight too (keep inventory on by default, kill the enemy,
  complete the current quest, reset the save), and a simulated ping. Cheats need `CHEATS=1` in `.env`
  (`.env.example` sets it; production never does).

## Commands and the database

The commands are in the README ("Running it"); run them from the root (the workspaces have no typecheck of their own).

Settings come from `.env` (git-ignored, copied from `.env.example`). A new one goes in `.env.example` with a working
dev value and is read in `server/src/env.ts` (or `loadEnv` in `client/vite.config.ts` for the dev proxy). Never
commit `.env` or put a database address in code. If the server won't start, see the README's troubleshooting.

Database (Drizzle): query with the builder, `` sql`...` `` only where it can't express something. After changing
`schema.ts`, always run `db:generate`, read the SQL and commit it with `migrations/meta/` (typecheck passes without
it, but the database never gets the change). A data change drizzle-kit can't work out: `db:generate -- --custom`.
Never edit a merged migration or `meta/`; after rebasing onto a new migration, drop yours (`npx drizzle-kit drop` in
`server/`) and generate it again. "Relation ... already exists" on start means the database came from another
branch: `db:reset`.

## Test first and done

- Test-first as in the global rules; settle a mechanic with the user first, so the tests say what was agreed.
- Tests mirror `src/` in each workspace's `test/` (`node:test` through tsx, each with its own tsconfig). Server core
  is tested through its ports with the fakes in `server/test/fixtures/`, the HTTP API with `app.inject()`. Fake time
  and chance with node:test's mocks (mock `Math.random` before an `Overworld` is made); step fights by hand (await
  `initPhysics()` first). Tuning numbers come from the code.
- Done means `npm test`, `npm run typecheck` and `npm run build` pass (CI runs them on every PR into `main`; merge
  only once green), the docs still match, and it's tried in a headless browser unless the user says not to: log in
  as test3 or test2 through `/api/login`, open `/?debug`, and use the debug handles (`window.encounter(...)`,
  `window.cast(...)`, `window.audio()`) or F1 (turn keep inventory off to see a death drop). What has no unit tests
  (drawing, React screens, how a fight feels, the Postgres stores) is always tried in a browser.
- Never log in as test1 on the user's dev server (:8787): it's theirs, and a second login kicks them out.

## Subagents in this repo

- Subagents don't decide game mechanics either: one that needs a decision stops and reports the options.
- Worktree: `git worktree add /tmp/it-<branch> -b <branch> <base>`, then `npm ci` (never symlink `node_modules`:
  `@infinite-tower/shared` would resolve to the other checkout).
- The user's dev servers are :8787 and :5173 in the main checkout; saving a server file there restarts theirs.
- One that runs the game gets its own database (`docker compose exec -T db createdb -U infinite_tower it_<name>`), its
  own `.env` (`npm run env:init`, then `DATABASE_URL` and `PORT`) and its own ports (`npm run dev -w` each workspace),
  and drops the database after (`dropdb`).
- Whichever of two PRs merges second rebases and fixes the doc conflicts.

## Code style

- Follow [ARCHITECTURE.md](ARCHITECTURE.md)'s rules: the server decides, core plus outlets, one owner each for keys,
  drawing, sound and what the player is told. Ask before adding a package core may import.
- Strict TypeScript, ESM with `.js` imports, `import type`; unused names fail typecheck (prefix a kept one with `_`).
- Files stay small and single-purpose (roughly under 200 lines): a folder per mode, enemy or screen; UI used by more
  than one screen in `ui/components/`. Follow the naming of the folder you're in.
- React components are PascalCase `.tsx` files that export only components (constants go in a `.ts` beside them).
  Tailwind v4 classes are written out in full; theme tokens are in `client/src/ui/styles.css`.
- Game time is seconds (a name ending in Time, Delay or Duration is seconds); milliseconds say `Ms`, and a name says
  what kind of number it holds (`lungeSpeed`, `staminaRegenPerSec`).
- Words: the **overworld** is the map you walk, a **battle** a fight, the **arena** where it happens. **Gear** is
  anything equipped. A **skill** is built from **words** (a form, elements, modifiers) by the **skill grammar**; a
  **skill sequence** is one string of words (a skillbook page holds one); **building** is chanting or quick-casting
  it, **validating** checks it (internal, never shown), **release** is when it fires, an **effect** what it leaves, a
  **cast** the whole lifecycle (one open per fighter for now). **Skillpower** scales skill damage. Avoid "channel".

## Git and PRs

- PRs are squash-merged. Never commit `.bookmarks`.
- Read inline review comments with `gh api repos/billwang7599/Infinite-Tower/pulls/<n>/comments`, and resolve each
  thread after fixing it.
