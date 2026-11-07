# Skills

Status: **mostly built**. The user's design, condensed (their own doc isn't in the repo). A skill is a chain of words
cast in fights. Built: the grammar (`shared/src/skills/skill.ts`), every Form, element, modifier and reaction, the
words each player knows, chanting, the skillbook's pages and quick-cast, any fighter's skills (`Skilled`), the Goblin
Warlock that casts, and the effects' looks. The numbers are in `SKILL_EFFECTS` (`shared/src/skills/effects.ts`); the
formulas in FORMULAS.md, "Skills"; the words for talking about skills in AGENTS.md.

## Decided by the user

- **Grammar.** A skill is one or more segments, each a Form, then elements, then modifiers. Each segment fires when
  the one before completes. A skill is data, not parsed text. Nothing about skills is magic-only: they make magic,
  enhance yourself or anything else (they were called spells).
- **Forms**: Bolt (a projectile), Beam (a held stream), Nova (a burst round its origin), Imbue (carried on your next
  hits), Self (you only, for now). Summon is out for now.
- **Elements** are a set: Fire, Water, Earth, Air, Lightning, Light, Darkness, each its own damage type with a status
  (Burning, Wet, Rooted, Pushed, Shocked, Marked, Cursed). Opposites (Fire and Water, Earth and Air, Light and
  Darkness) can't share a segment, but may be in different ones.
- **Reactions** on whoever a skill hits, players in duels too, each with a cooldown per target: Conduct (Lightning on
  Wet), Doused (Fire on Wet, Water on Burning), Fanned (Air on Burning), Eclipse (Darkness on Marked).
- **Modifiers** change their whole segment, in order, each applied to the shot built so far: Amplify, Widen, Pierce,
  Split, Extend (only ever "lasts longer"; on a Nova a lingering cloud, like Minecraft's lingering potion), Swift,
  Delay, Follow (homing: skills may home, weapons don't). A repeat is a full step, no diminishing returns; repeats
  will cost more stamina later. Which fit which Form: Amplify any; Widen Beam and Nova; Pierce Bolt and Beam; Split
  Bolt; Extend Beam, Nova, Imbue and Self; Swift Bolt, Beam and Imbue.
- **Split** splits a Bolt, and each further Split splits the split ones again (2ⁿ Bolts, each smaller and weaker);
  they start round you and fly in to meet a point ahead, so they don't spawn in a line.
- **No caps** on modifiers or segments, in the rules, the builder or the wire: stamina is the only limit (plus guards
  on the server's work). Cost grows exponentially with the segments. No mana, no cooldowns.
- **Casting** takes a release time by word count; stamina is paid at release. You move slower while winding up; a
  dodge cancels it, and so does a hit that staggers you. Your own skills never hurt you. A Beam is held and paid as it
  runs.
- **Skill damage** scales with skillpower (it may become soul power later, for the lore).
- **Lock-on stays, so skills are balanced on the defender's side**: a Bolt flies at where the target is, never where
  it's going; Follow turns slowly enough for a late dodge; the Kobold sometimes steps aside from a Bolt winding up at
  it. The wind-up, the slower walk and the cost keep skills from being spammed. Skills ignore dodge i-frames, hurt
  invulnerability and blocks, for now.
- **Aim**: skills aim as the bow does (one aim): at the locked target, or at the crosshair unlocked. Follow homes onto
  the locked enemy, or unlocked the one nearest the aim's line.
- **Fights only.** Anyone may chant, with no book, and quick-cast: players, enemies, other players. Others' chant words
  show in a small popup in front of them while they chant; your own is the big popup. Interrupts are the same for
  every chanter. One cast at a time per fighter for now (maybe two later).
- **Chanting** opens a big popup in the middle: a carousel of squares filled one word at a time (a Form, then
  elements, modifiers or a Form; a Form starts the next segment, the filled squares sliding left). Words are clicked,
  searched (Tab), or picked in two steps: 1 Form, 2 Element, 3 Modifier, then that kind's words by number. Its keys are
  a layer of their own, so 1-4 don't cast there. The fight goes on and you can't move; only a stagger cancels it; a
  dodge closes it and keeps the squares. A chanted skill costs the same as a saved one and is for that cast only.
- **The skillbook** is an item held in a hand. It only saves skills for quick-cast: 4 pages, keys 1-4 (rebindable).
  Writing a page in a fight is like chanting (standing still, a stagger cancels it, it takes time). Pages and words
  are saved and checked by the server, and kept on death.
- **Words** are learned per player and saved. A new player knows none; how words are learned is open.

## Decided by the agent (changeable)

- Every number: D, the Bolt's speed and range, the Nova's radius, element hits and statuses, reaction numbers,
  release time, the modifiers' strengths, the Beam's length, ticks and cost, Imbue's hits, word costs and the chain's
  growth.
- Self per element: Empowered (Fire), cleansing heal (Water), Warded (Earth), Hasted (Air), Charged (Lightning), a
  Light shield, Siphoning (Darkness). Fused Self buffs for some pairs (the user asked for "buff skills with a timer"):
  Frenzy, Renewal, Bulwark, Bloodrage.
- One status system for statuses, buffs and debuffs: a renewed status keeps the longer time and gains a stack to its
  cap; a status may be permanent, which is how inscriptions and blessings plug in.
- Imbue imbues your own sword. A plain hit with no element. A share of a hit scales its damage, poise and knockback;
  statuses go on in full.
- The hand-off: each projectile hands off once, where it ends; a later Bolt or Beam keeps the direction before it.
- Clouds last 8 s (doubled by each further Extend) and are capped per player and per fight; a fight holds at most
  `MAX_LIVE_SHOTS` skill objects.
- The chant and writing a page run in the shared fight, so the server decides them; a skill on no page is cast only
  from an open chant. Outside fights the book opens from the bag and writes a page at once, anywhere.
- A cast waits behind a buffered dodge and goes before a buffered swing; casting works in the air.

## Open

- How words are learned, and the dev cost scale.
- How much repeated modifiers cost more.
- The agent's placeholders nobody decided: which modifiers fit which Form beyond the user's list (Delay fits every
  Form, Follow only Bolt), the chain's growth, a repeated element refused, Lightning with no opposite.
- Clouds: the user said they last until the fight ends; the agent's 8 s is for the user to decide.
- Whether a cast should block the next until its last effect ends (only the build and wind-up do for players now).
- Multicast; boss AI that builds chants to suit the situation; statuses from enemies' own attacks.
- Statuses shown on their targets, and skill sounds.
