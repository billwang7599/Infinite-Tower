# Spells

Status: **being built**. The user's design, condensed (their own doc isn't in the repo). A spell is a chain of words
built at a campfire and cast from the hotbar in fights. Numbers marked *placeholder* are the agent's picks, to tune.

## Decided

- **Grammar:** `spell = segment {segment}`, `segment = form stage`, `stage = {element} {augment}`. Every segment has
  its own Form; each fires when the previous one completes. A spell is data (`{ segments: [{ form, elements,
  augments }] }`), not parsed text.
- **Forms:** Bolt (a projectile), Beam (a channelled stream), Nova (a burst around its origin), Imbue (your weapon,
  imbuable props or your summoned objects carry it on their next hits: 3 hits or 8 s), Self (you only, for now),
  Summon (makes objects whose kind follows the element: Earth makes rocks).
- **Elements** are a set (order doesn't matter): Fire, Water, Earth, Air, Lightning, Light, Darkness. Opposites
  (Fire / Water, Earth / Air, Light / Darkness) can't share a stage, but may be in different segments.
- **Augments** change their whole stage: Amplify, Widen, Pierce, Split, Extend, Swift, Delay (holds back the hand-off
  after the segment completes), Follow (homing; spells may home, unlike weapons). Repeating one gives diminishing
  returns: 100%, then 50%, then 25%. Extend only ever means "lasts longer"; Extend on Nova is a lingering cloud
  (like Minecraft's lingering potion).
- **Which augments fit which Form** (the builder rejects the rest): Amplify any; Widen Beam, Nova; Pierce Bolt,
  Beam; Split Bolt; Extend Beam, Nova, Imbue, Self; Swift Bolt, Beam, Imbue.
- **Cost:** stamina, not mana. Form 3, element 2, augment 1 (placeholders). No word cap: a chain's cost grows
  exponentially with its number of segments, and that is the only limit. Dev servers will use a near-minimal cost
  through one scale. Cast time 0.3 s + 0.1 s per word.
- **Casting:** stamina is paid at release, and the spell fails if you're short (no overdraw). You move slower while
  winding up; a hit interrupts the wind-up at no cost. A Beam is held and paid per second.
- **Hand-off:** each projectile hands off once, when it ends (Split x3 gives three next segments; Pierce or a
  multi-hit Nova never multiply it). A later Bolt or Beam keeps the previous segment's travel direction; after a
  directionless one (Nova, Self, Imbue, Summon) it takes the caster's facing when it fires.
- **Objects** (summons, clouds) last until the fight ends; allies may use each other's. Hidden caps guard the server,
  like `MAX_FIGHT_TIME`: 12 per player, 60 per fight.
- **No spells on the overworld.**
- **Stats:** the mana stat goes; spellpower stays and scales spell damage.
- **Reactions:** v1 ships four: Wet + Lightning, Wet + Fire, Burning + Air, Marked + Darkness. Any other pair just
  applies both statuses.
- **Words** are learned per player and saved in the database. A new player knows none for now; the dev accounts
  test1-3 know every word. Chaining unlocks when a player learns a second Form.
- **Building:** at campfires, by typing words into boxes that autofill from learned words; a rejected word is greyed
  out with its reason. Spells are saved to a hotbar (keys 1-4), and one key casts.
- Player-only spells for now; enemies and bosses use authored attacks with the same statuses.

## PRs

1. **A** this plan.
2. **B** the grammar: words, validation with a reason per rejected word, stamina cost, cast time
   (`shared/src/spells/spell.ts`).
3. **C** casting in the shared `Fight` (the server decides; the client sends inputs only): wind-up, stamina, Bolt and
   Nova, the element / status engine with the four reactions, hand-off, the object caps, mana removed, plain
   placeholder visuals, and a dev-only way to cast so it can be hand-played.
4. **D** the builder screen at campfires, learned words and saved spells (database), the hotbar 1-4.
5. **E** the remaining Forms and augments.
6. **F** real art and effects.

## Open

- The agent's placeholders for fits nobody decided: Delay fits every Form, Follow only Bolt, and Summon takes only
  Amplify and Delay.
- The chain's growth: each extra segment doubles the whole spell's cost (`SPELL.chainGrowth`, placeholder).
- The agent's reading of the grammar: a repeated element is refused (elements are a set); Lightning has no opposite.
- Each element's role and status (the user's table isn't in the repo), and the four reactions' effects.
- Renaming spellpower to Intellect.
- How strong each augment is (how much wider, longer, faster), the dev cost scale, what Self does per element.
