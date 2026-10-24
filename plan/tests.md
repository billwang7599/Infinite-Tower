# Server tests

Status: **later** (the user: "we can add tests later").

## Today

There are no automated tests in the repo. `npm run typecheck` (TypeScript plus the server's layer check) and
`npm run build` are the only checks; features are tried in a browser, often with Playwright scripts kept outside
the repo.

## The idea

- A `server/test/` folder, run with Node's own test runner through tsx (`tsx --test`), so no test framework is
  needed.
- **Core with fakes**: core takes its outside world through ports (`PlayerStore`, `AccountStore`, `PlayerLink`),
  so tests can hand it in-memory fakes and a `FixedClock` they step by hand. A throwaway script did this once and
  covered joining, the character, a dev encounter, a second tab taking over, saving on leave, and a failed load.
- **HTTP with `app.inject()`**: `buildServer()` in `server/src/api/server.ts` can be called without listening, so
  routes, errors, cookies and the rate limit can be tested without a port.
- Maybe an `npm test` script at the root, and running it before a PR like typecheck.

## Open questions

- Tests for the client (the fight, prediction) too, or the server only?
- A database for the store tests: a throwaway Postgres (the Docker one on another port), or only fakes?
