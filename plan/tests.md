# Tests: what's not covered yet

Status: **later**. The unit tests exist (`npm test`; how they work is in [ARCHITECTURE.md](../ARCHITECTURE.md)
and [AGENTS.md](../AGENTS.md)). These parts have none yet:

- **The Postgres stores** (`server/src/db/`: `PgPlayerStore`, `PgAccountStore`, migrations). They'd need a real
  database: a throwaway one from `compose.yaml` on another port, created and dropped by the test run. Open: is
  that worth the extra setup, or are the fakes enough?
- **The arena fight** (`client/src/battle/`). It runs on Babylon + Havok; it gets tests when it moves to the server
  ([server-fights.md](server-fights.md)), where it can run headless.
- **React screens** (`client/src/ui/`). Would need jsdom and React Testing Library. Today they're tried in a
  browser (Playwright scripts kept outside the repo).
- **Blocking a red merge**: CI runs on every PR, but GitHub only enforces a required check (branch protection or a
  ruleset) on a public repo or with GitHub Pro. Until then a PR with a failing check can still be merged by hand.
