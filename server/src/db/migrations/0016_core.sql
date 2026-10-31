ALTER TABLE "players" ADD COLUMN "core_steps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "core_fill" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "stat_points" jsonb DEFAULT '{}'::jsonb NOT NULL;