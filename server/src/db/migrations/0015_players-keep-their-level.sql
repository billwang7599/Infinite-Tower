-- New characters start in the Waking Hollow; one made before levels were saved was on the Grass Field, so it stays.
UPDATE "players" SET "level" = 'grass-field' WHERE "level" IS NULL AND jsonb_typeof("character") = 'object';
