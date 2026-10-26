-- Inventories were item counts ({"boar-meat": 3}); now they're bags with every item placed in a grid
-- (shared/src/items/bag.ts). Saved inventories aren't converted: every player starts with an empty 6x4 bag.
UPDATE "players" SET "inventory" = '{"cols": 6, "rows": 4, "items": []}'::jsonb;
