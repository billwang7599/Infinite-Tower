# Drops

Status: **built**, as a stack of PRs: overworld piles, the arena after a win, death drops, and overworld piles opened
by looking at them as the arena's are. What's true of them is in [ARCHITECTURE.md](../ARCHITECTURE.md) and the
decisions in [AGENTS.md](../AGENTS.md). What's left here is still open.

## Open

- A death in a duel drops nothing today (a spar); whether that stays.
- A death's pile is seen and opened in the arena only once the fight is won, as the enemy's drops are; whether the
  others should be able to take from it mid-fight (the bag mid-fight is the shared fight's, so the pile would have to
  be too).
- Whether dropping things onto a pile (giving them to others) should be possible; for now a pile only gives.
- On the overworld the way you face is one of the chibi's four headings, so a pile 45° off is out of view until you
  turn toward it; whether looking there should follow the exact way of your last step instead.
