# Deploying

Status: **idea**, future plans only. Nothing is decided.

## The user's idea

The client on **Cloudflare Workers** (static assets), the server on **AWS EC2** or **Google Cloud Run**.

## Notes gathered so far

- **Keep one origin.** The login cookie belongs to the page's host, and the client always calls `/api` and `/ws` on
  its own host. A Worker in front of the static assets can forward `/api/*` and `/ws` to the game server
  (`assets.run_worker_first` with those paths), so the browser never talks to a second domain.
- **One VM fits better than Cloud Run** for now: Cloud Run ends WebSocket connections at its request timeout
  (5 minutes by default, 60 at most), and the server keeps who's online and every session in memory, so it must
  run as exactly one instance.
- **Postgres**: a managed instance in the same region as the server; the server only needs `DATABASE_URL`.
- **Server changes this needs** (none done yet, they belong in the deploy PR):
  - Fastify's `trustProxy`, or the login rate limit sees every player as the proxy's IP address.
  - A `HOST` setting: the server listens on every interface (`::`) right now; dev could use localhost only.
- `npm start` already builds the client and serves it, `/api` and `/ws` from one process; production cookies are
  `Secure`.

## Open questions

- AWS or Google? Which region?
- The domain name.
- Whether the server serves the client too (simplest) or Cloudflare does.
