-- Spells are skills: the spellbook item is the skillbook (in the bag or a hand), and a page's augments are modifiers.
UPDATE "players" SET
  "equipment" = replace("equipment"::text, '"spellbook"', '"skillbook"')::jsonb,
  "inventory" = replace("inventory"::text, '"spellbook"', '"skillbook"')::jsonb,
  "skillbook" = replace("skillbook"::text, '"augments":', '"modifiers":')::jsonb;
