# The core: what's left

Status: **the logic and saving are built** (PR 1). The rules the user decided are in AGENTS.md ("The core"), the
agent's picks for what they left open in AGENTS.md's agent-decided list, and every number in FORMULAS.md ("Stats",
"The core"). What's still to come:

## Next PRs

- **The sphere HUD.** Your character's portrait in the bottom-left corner; clicking it flips it over to show your
  core: the avatar's soul ([lore.md](lore.md)) as a sphere with light growing from its centre, not a filling orb, so
  nothing reads like XP. Each step the light grows bigger and brighter, and its colour changes with each realm, from
  fiery (Yan) to ethereal (Tian). Inside a step there's no number or bar: the light breathes (a slow pulse), and sparks
  show when a breakthrough is near. For now the HUD has a plain line of text (the realm and step) under the bars.
- **The stats chart.** A polygon chart (like Pokémon's) with a small number under each stat; more stats can be added,
  so it needn't stay a diamond. For now the character panel lists the stats, with + and − for free points.

## Later

- Enemies with realms that scale their stats (with floors), their realms not shown; an enemy of a later realm gives
  more essence, doubling per realm. Enemies' HP still comes from their own `maxHp`, not vitality.
- Other ways to fill the core: meditating, elixirs, using skills.
- Breakthrough as a small minigame (something rhythm-based) instead of automatic.
- Elemental affinity.

## For the user to review

- Whether losing a step on death can take you back a realm (built: it can).
- What taking a point back costs (built: being by a campfire, nothing else).
- Every number in FORMULAS.md's "Stats" and "The core", to tune in play.
