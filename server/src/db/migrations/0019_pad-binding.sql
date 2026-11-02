ALTER TABLE "players" ADD COLUMN "pad" text DEFAULT 'kingdom' NOT NULL;--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "level";