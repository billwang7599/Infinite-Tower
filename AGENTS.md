# AGENTS.md

Infinite Tower is a browser game, single-player for now. You walk a 2D top-down field, and fights happen in a
small 2.5D arena (3D enemy, 2D sprite player). It's a TypeScript monorepo with three workspaces:

- `shared/`: code both sides run (simulation, message types)
- `server/`: Node + ws, authoritative
- `client/`: Vite, Babylon.js + Havok, React UI

[README.md](README.md) has the file layout, the controls, recipes for adding things, and the architecture rules.
Keep it in sync when you add, move or rename files.

## Ask before deciding any game mechanic

Don't pick a game mechanic yourself. If a task needs a decision about how the game plays, stop and ask, with the
options, before you build it. That includes:

- player and enemy stats: HP, stamina, damage, costs, cooldowns, regeneration
- what heals or refills, and when
- what's kept or lost: on death, between fights, on disconnect / reconnect, when returning to the title
- encounters (where, how often, what appears), rewards and progression
- how controls feel (speeds, timings, camera)

This applies to defaults that seem obvious, too. If you notice that something already built implies a mechanic
nobody approved, say so and ask. When the user decides something, add it to the list below.

Decided by the user:

- HP and stamina carry over between fights and are **not** reset on a new connection. Until there's a database,
  they go through a server-side player store whose stub hands out max stats. A real store has to be able to
  replace the stub without changing game code.
- The view is 16:9 at most (23 x 13 field tiles). Wider windows get bars on the sides; taller ones see a little
  less width. The server sends only the actors within that view plus 3 tiles (a guess at the screen would be
  cheatable, so it always assumes the full 16:9).
- No lock-on or auto-aim in fights. Only the player turns the camera, and attacks go where it faces, so aiming
  is a skill.

## Commands

```sh
npm install
npm run dev        # server :8787 (tsx watch, reloads on save) + client http://localhost:5173 (Vite, proxies /ws)
npm run typecheck  # run it from the root; the workspaces have no typecheck script of their own
npm run build      # client bundle
npm start          # production: builds the client, then the server serves it + /ws on :8787
```

If the server fails with `EADDRINUSE` on :8787, an older `npm run dev` is still running.

## Before calling something done

- `npm run typecheck` and `npm run build` pass.
- Try it in a browser. Playwright works: open `/?debug` and click Play (`#title-screen nav button`). Then the
  debug handles are available: `window.mode()`, `window.battle`, `window.field`, `window.ui`, `window.bindings`,
  `window.cameraSettings` and `window.encounter()` (dev server only).
- In your report, say what you tested. Say plainly if nothing was hand-played.

## Architecture rules (details in the README)

- **The server decides; the client asks and draws.** Anything a player shouldn't be able to change lives on the
  server: levels, encounters, enemy stats, fight results, wins, HP / stamina. Client messages are checked with Zod
  (`shared/src/net/client-messages.ts`).
- **`shared/` is only for code both sides run.** Data only the server needs (encounter rates, spawns, enemy
  stats) stays in `server/`.
- **The arena fight still runs in the browser** and reports the result; the server can only bound what it's told.
  Don't add new trust in client claims. Moving the fight onto the server is the plan.
- **ECS for game data** (`shared/src/core/ecs.ts`). Plain classes for services (connection, keyboard, mouse,
  prediction).
- **Keys come from `client/src/settings/bindings.ts`.** Never hardcode a key, and when showing one on screen, read
  it from the bindings (`keyName`). Esc and ⌘ can't be rebound.
- **UI is React over the canvas** (`client/src/ui/`). Game code writes plain values into the stores in
  `ui/state.ts` and never touches the DOM. No `innerHTML` or `dangerouslySetInnerHTML`.

## Code style

- Strict TypeScript, ESM with `.js` in import paths, and `import type` for types (`verbatimModuleSyntax`).
- Follow the naming of the folder you're in. React components are PascalCase `.tsx` files that export components
  only (so Fast Refresh works); constants they need go in a `.ts` file next to them.
- Words: the 2D map is the **field**, a fight is a **battle**, and the place it happens is the **arena**.
- Keep files small and single-purpose (roughly under 200 lines). Make a folder per mode, enemy or screen
  (`client/src/ui/screens/<name>/`); UI used by more than one screen goes in `ui/components/`. Small math goes in
  `shared/src/core/math.ts`.
- Comments only where they explain something non-obvious (why, units, gotchas). Don't write comments that restate
  a name or a type.
- Styling is Tailwind v4 classes, with theme tokens in `client/src/ui/styles.css`. Write class names out in full.
- No on-screen control hints or fps counters.

## Git and PRs

- One PR per feature. If a request mixes features, they go in separate PRs.
- Branch off an up-to-date `main`. PRs are squash-merged.
- To change an open PR, amend its commit, `git push --force-with-lease`, and update the PR description. If the PR
  has already been merged, make a new branch off `main` instead.
- Never commit `.bookmarks`.
- A PR description covers what changed, how it was tested, and what's not done yet.
- Read inline review comments with `gh api repos/billwang7599/Infinite-Tower/pulls/<n>/comments`, and resolve
  each thread after fixing it.
