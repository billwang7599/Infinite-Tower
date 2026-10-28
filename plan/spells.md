# Spells

Status: **being built**. The user's design, condensed (their own doc isn't in the repo). A spell is a chain of words.
Built so far: the grammar (`shared/src/spells/spell.ts`), the words each player knows (saved), casting in the
shared fight (PR C: Bolt, Nova and Self, the seven elements and four reactions), PR D's chanting in fights, the
spellbook's 4 pages (saved) and their keys 1-4 (`client/src/ui/spells/`), and PR E's Beam, Imbue, Forms with no
element and every augment, and PR F's effects (`client/src/visuals/battle/spells.ts`). Numbers marked *placeholder* are
the agent's picks, to tune; they all live in `MAGIC` (`shared/src/spells/effects.ts`).

## Decided by the user

- **Grammar:** `spell = segment {segment}`, `segment = form stage`, `stage = {element} {augment}`. Every segment has
  its own Form; each fires when the previous one completes. A spell is data (`{ segments: [{ form, elements,
  augments }] }`), not parsed text.
- **Forms:** Bolt (a projectile), Beam (a channelled stream), Nova (a burst around its origin), Imbue (carried on
  the next hits: 3 hits or 8 s), Self (you only, for now). Summon is removed for now.
- **Elements** are a set (order doesn't matter): Fire, Water, Earth, Air, Lightning, Light, Darkness. Opposites
  (Fire / Water, Earth / Air, Light / Darkness) can't share a stage, but may be in different segments.
- **Augments** change their whole stage: Amplify, Widen, Pierce, Split, Extend, Swift, Delay (holds back the hand-off
  after the segment completes), Follow (homing; spells may home, unlike weapons). Extend only ever means "lasts
  longer"; Extend on Nova is a lingering cloud (like Minecraft's lingering potion).
- **Augments go in order:** each changes the shot built from the Form, the elements and the augments before it.
  Amplify then Split gives two Bolts, both amplified; Follow then Split, split Bolts that all home; Split then Split
  splits each Bolt again. A repeat is a full step, applied again (no diminishing returns); repeats will cost more
  stamina later instead.
- **No caps** on augments or segments: a segment takes any number of augments (Splits too), and a chain any number
  of segments; stamina is the only limit.
- **Split** splits the Bolt, and each further Split splits the split ones: n Splits make 2^n Bolts, each smaller and
  dealing 10% less per Split (×0.9^n).
- **Which augments fit which Form** (the builder rejects the rest): Amplify any; Widen Beam, Nova; Pierce Bolt,
  Beam; Split Bolt; Extend Beam, Nova, Imbue, Self; Swift Bolt, Beam, Imbue.
- **Cost:** stamina from the same bar as dodging and blocking, not mana (the mana stat is gone). Form 3, element 2,
  augment 1 (placeholders). No word cap: a chain's cost grows exponentially with its number of segments, and that
  is the only limit. Dev servers will use a near-minimal cost through one scale (not built). No cooldowns.
- **Casting:** cast time 0.3 s + 0.1 s per word. Stamina is paid at release; short of it, the cast doesn't start.
  You move slower while winding up; a dodge cancels the wind-up at no cost, and so does a hit that stuns or
  staggers you (a sword hit only hurts, so the cast still goes off). A cast pressed mid-swing waits for the swing to let
  go, like a dodge. Your own spells never hurt you. A Beam is held and paid per second.
- **Aim:** Bolt and Beam aim at the locked enemy, or where the camera faces when unlocked; Follow homes onto the locked
  enemy, or the nearest when unlocked. Lock-on is close to auto-aim, so the defender's side is the skill: a Bolt aims at
  where the target is, never leads, so a step aside makes it miss; Follow turns slowly, so a late dodge shakes it; the
  Kobold (not the boar) sometimes steps aside from a Bolt winding up at it (`sidestep` in
  `server/src/core/content/enemies.ts`: a chance per cast, a reaction time, stepping `leadTime` before it leaves).
- **Hand-off:** each projectile hands off once, when it ends (a Bolt on its hit, or at its range on a miss; two
  Splits give four next segments; Pierce or a multi-hit Nova never multiply it). A later Bolt or Beam keeps the previous
  segment's travel direction; after a directionless one (Nova, Self, Imbue) it takes the caster's facing when it
  fires.
- **Objects** (clouds) last until the fight ends; allies may use each other's. Hidden caps guard the server, like
  `MAX_FIGHT_TIME`: 12 per player, 60 per fight.
- **No spells on the overworld.** Player-only spells for now; enemies and bosses use authored attacks with the same
  statuses.
- **Stats:** spellpower is renamed Intellect, and scales spell damage. D below is a spell's base damage after
  Intellect.
- **Elements** (numbers are placeholders; each element is its own damage type, so per-element resistances can apply;
  enemies have none yet). Statuses go on with a hit, and a target can hold several:

  | Element | Hit | Status |
  |---|---|---|
  | Fire | 0.8D | Burning: 0.25D a second for 4 s; a new hit refreshes it, never stacks |
  | Water | 0.5D | Wet, 6 s: no damage, sets up Conduct and Doused |
  | Earth | 1.2D + poise damage | Rooted: moves 60% slower for 2 s |
  | Air | 0.4D + about 3 m of knockback | Pushed (instant only) |
  | Lightning | 1.0D, arcing to one nearby enemy at 50% | Shocked: stacks to 3 (5 s, refreshed per stack); at 3 the target is stunned 1 s and the stacks clear |
  | Light | 0.5D on enemies | Marked, 8 s: sets up Eclipse. On yourself (Self) a shield of 1.0D for 6 s |
  | Darkness | 0.9D, and you heal 20% of it | Cursed: the target deals 15% less damage for 6 s |

- **Reactions** (on enemies only, decided by the server, each with a cooldown per target):

  | Reaction | When | What it does | Cooldown |
  |---|---|---|---|
  | Conduct | Lightning hits Wet | Lightning ×1.5 and arcs to up to 2 more enemies within 6 m at 50%; the Wet is used up | 3 s |
  | Doused | Fire hits Wet, or Water hits Burning | Burning and Wet are removed (Fire's Burning isn't applied) | 2 s |
  | Fanned | Air hits Burning | the Burning does double for the rest of its time and spreads to one enemy within 4 m | 4 s |
  | Eclipse | Darkness hits Marked | a 1.5D burst around the target; the Mark is used up and Cursed isn't applied | 5 s |

  A stage's elements are a set: all its statuses go on first, then the reactions are checked against the result
  (so Nova · Water + Lightning conducts in one stage). If one hit could trigger two, they resolve in the order
  Conduct, Doused, Fanned, Eclipse. Any other pair just applies both statuses.
- **Words** are learned per player and saved in the database. A new player knows none for now; the dev accounts
  test1-3 know every word. Chaining unlocks when a player learns a second Form. How words are learned: later.
- **The spellbook** is an item, equipped in a hand (see [inventory.md](inventory.md)); without one you can't cast or
  chant. Saved spells are written in it: 4 for now, cast with one key each (quick casting). Building and saving a
  spell happens at a campfire, by typing words into boxes that autofill from learned words (a rejected word greyed
  out with its reason), or in a fight (below). Built: outside fights the book opens from the bag screen anywhere
  (the agent's pick: no campfire needed, as the later ruling says outside fights) and a page is written at once.
- **Chanting in a fight:** the grammar view can be brought up in battle "to chant/create spells on the fly. the
  spellbook is just for quick casting". It's "a big popup at the center of the screen showing 3 squares, each one is
  what word goes in there. ie one square for bolt, one for fire, and one for augment." It's a carousel, one square at
  a time, the next appearing as you fill one: "we pick form, next one is element. we pick element, next one is
  element or augment or form. if element, same 3. etc etc". After an augment, the next square is another augment or
  a Form (elements come before augments in a segment). Picking a Form starts the next chained segment in the same
  carousel: the filled squares slide left, and a chain link or arrow marks where each segment starts.
  - Words go in either way: click a square and pick from the known words, or pick from a list. Typing works too: a
    searchable dropdown, number keys quick-select from it, Backspace undoes the last word. These keys go through the
    Actions / bindings system as their own layer (the popup's number keys don't cast saved spells).
  - The fight keeps going while it's open (no pause or slow-down), and you can't move. A hit cancels the chant only if
    it staggers you. A dodge closes the popup and keeps the squares, so reopening it carries on.
  - A chanted spell costs the same as a saved one; it's "just slower to use" (the time spent building it). No extra
    chant time beyond picking the words, then its cast time.
  - A chanted spell exists for that one cast only. Saving one into the spellbook is a spellbook + bag interaction,
    in a fight or outside one; in a fight it works like chanting (you can't move, a stagger cancels it) and takes 2 s.

## Decided by the agent (the user asked for these; changeable)

- **Numbers:** D = 10 at Intellect 10. Bolt: 20 m/s, 16 m range, 0.3 m wide, at chest height. Nova: 3 m around its
  origin (to the target's surface). Earth: 20 poise damage. Air: 12 m/s of knockback (about 3 m). Lightning's plain
  arc reaches 5 m (Conduct's 6 m), at 50% of the hit's Lightning damage. Eclipse's burst: 3 m. Moving while winding
  up: 40% of walking speed.
- **Self per element:** Fire: +20% damage dealt for 8 s (Empowered). Water: clears your harmful statuses and heals
  0.3D. Earth: 30% less damage taken and no knockback for 6 s (Warded). Air: +30% move speed and 30% cheaper dodges
  for 5 s (Hasted). Lightning: +50% stamina regeneration for 5 s (Charged). Light: a shield of 1.0D for 6 s. Darkness:
  your hits heal you 10% of their damage for 8 s (Siphoning). These count for sword hits too.
- **Imbue** imbues your own sword, for now; arena props come later.
- **No element:** a plain hit of 0.6D with no status (Imbue adds it to sword hits); Self with none does nothing.
- **Beam:** a line 10 m long and 0.35 m wide that strikes the first enemy on it as it starts and every 0.5 s, each
  tick 50% of a hit, for 1 s. As a spell's first segment it streams from the caster along their aim (the locked
  enemy, or the camera's facing) and is held while the cast key is (a page's key; a chanted Beam is a tap): held, it
  costs its own words' cost ×2 a second (no chain growth), and its 1 s runs from the release. While it lasts you
  walk at 40% and can't swing; a dodge or a stun ends it at once with no hand-off; running out of stamina ends the
  hold. A later Beam starts where the segment before it ended and keeps its direction. It hands off where it ends:
  in the enemy it stops in, or at its range or the wall.
- **Imbue:** the next 3 sword hits that land within 8 s (swings or stabs; blocked or parried ones don't count) each
  also strike with its elements at 50% of a hit. A new Imbue replaces the old one (without its hand-off). It hands
  off from the enemy the last hit landed on (onward from you through it, skipping it), or from you when it runs out.
- A share of a hit (a Beam's tick, an Imbue, a cloud, a split Bolt, Amplify) scales its damage, poise damage and
  knockback; statuses go on in full, so a Lightning Beam stacks Shocked every tick.
- **Augments,** in one ordered pass (`shotOf` in `effects.ts`). A "+%" one multiplies the shot so far, so repeats
  compound (Amplify twice ×2.25); a "+units" one adds. Amplify ×1.5 damage (Self: its heal and shield). Widen ×1.5
  radius (a Nova's, a Beam's width). Pierce: a Bolt goes through 2 more enemies before it stops (it still hands off
  once, at its end); a Beam strikes up to 3 on its line. Split: twice the Bolts, each ×0.8 radius and ×0.9 damage; each
  hands off. Split Bolts start at random spots in an upright circle round the caster, across the aim like a halo, its
  lowest point 0.3 m off the ground and its radius 0.75 m × √Bolts within 1.5-3 m; each spot is the best of 8 random
  tries (the farthest from the others), so they're well apart and bunch only when there are too many. The caster's seed
  in the fight's state places them (the server picks it). They fly in to meet 10 m ahead, each aimed at that point plus
  up to 0.5 m of random jitter, then fly on straight at that height. Extend ×2 time (a Beam's, an Imbue's hits and time,
  Self's statuses); on a Nova, the first leaves a cloud as wide as the Nova for 8 s, pulsing it every second at 40%, its
  hand-off still at the burst, and each after it doubles the cloud's time. Swift ×1.5 speed (a Bolt's flight, a Beam's
  ticks; an Imbue's swings start quicker). Delay holds the hand-off back 1 s each (on a spell's last segment it does
  nothing). Follow turns a Bolt up to 3 rad/s each toward its target, picked as it fires (the locked enemy, else the
  nearest; if it dies, the nearest); a dodge's i-frames don't make it lose the target. Split Bolts that home aim side by
  side beside it, 4 Bolt radii apart (all within 3 m), closing in only over the last 2.5 m, so they come in apart rather
  than as one clump.
- **Caps:** a player's 13th cloud ends their oldest, and so does the fight's 61st. A guard on the server's work, not
  a game rule: a fight holds at most 256 spell objects (`MAX_LIVE_SHOTS`); past it, new ones (Bolts from a Split,
  hand-offs) don't spawn. A chain too long to count costs Infinity, so it's never cast.
- A cast waits behind a buffered dodge, and goes before a buffered swing. Casting works in the air.
- Only a hit that stuns or staggers you (a boar's bite or charge, a broken guard) interrupts the wind-up; the
  Kobold's sword only hurts, so the cast goes off, as with the chant.
- A later Bolt starts where the one before it ended and ignores the enemy that one hit.
- Conduct's two arcs replace Lightning's plain one; arcs and the Eclipse burst do damage only (no statuses). Fanned
  spreads the doubled Burning, with the time it has left, to the nearest enemy within 4 m. A new Fire hit resets a
  Fanned burn to the normal rate.
- The wire has no spell caps, only the socket's 16 KB a message (over it, the socket closes): about 1,600 augments
  or 300 segments in one input, 76 augments when a frame's 16 inputs all carry a held cast.
- The chant and writing a page run in the shared fight, so the server decides them: the fight holds a chanter still,
  casts a spell that's on none of the pages only from an open chant (pages matched by their words), writes a page
  after `SAVE_IN_FIGHT_TIME` (2 s), and the server saves the fight's pages with its result. Stamina still recovers
  while chanting or writing (as standing does). A dodge out of the chant goes where the walk keys point (backwards
  with none); closing the chant mid-write stops it, and nothing is written.

## PRs

1. **A** the plan. **B** the grammar. **C** casting in the shared `Fight` (built, above).
2. **D** the spellbook's 4 saved spells, quick-cast keys 1-4, the builder and chanting in fights (built); learning
   words (not built: new players know none).
3. **E** the remaining Forms (Beam, Imbue) and augments, objects and their caps (built).
4. **F** the effects (built, in code: shaders, particles and meshes, one look per element and Form, the chant's
   circle, the Imbue glow on the sword's trail, the four reactions). Not built: statuses shown on their targets
   (Burning, Wet, Shocked stacks, ...), Self's lasting statuses on the player, sounds.

## Open

- The agent's placeholders for fits nobody decided: Delay fits every Form, Follow only Bolt.
- The chain's growth: each extra segment doubles the whole spell's cost (`SPELL.chainGrowth`, placeholder).
- The agent's reading of the grammar: a repeated element is refused (elements are a set); Lightning has no opposite.
- The agent's clouds last 8 s, doubled by each further Extend, against "Objects (clouds) last until the fight ends"
  above: a cloud that pulses for the whole fight seemed too strong; the user to decide.
- The dev cost scale.
- Repeated augments will cost more stamina (the user's plan; how much is open). For now every augment costs 1.
- With many Bolts every one hands off, so Splits then another Bolt with Splits multiply; `MAX_LIVE_SHOTS` (256) is
  the agent's pick, for the user to change.
- How words are learned.
- Statuses on players (from enemies' authored attacks), and their HUD.
