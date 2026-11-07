# Deploying

Status: **idea**. Hosting on one machine behind a Cloudflare Tunnel is built (README, "Hosting").

## Decided

- Squash the migrations into one before launch, while no real player's data exists; after launch they're only added
  to.

## Open

- The user's earlier idea: the client on Cloudflare Workers, the server on a cloud VM, with managed Postgres. One
  origin must be kept (the login cookie), and the server must stay a single instance while sessions live in memory.
- The domain name; with more than one server, running migrations once per deploy.
