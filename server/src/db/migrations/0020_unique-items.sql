CREATE TABLE "unique_items" (
	"item" text PRIMARY KEY NOT NULL,
	"holder_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "unique_items" ADD CONSTRAINT "unique_items_holder_id_players_id_fk" FOREIGN KEY ("holder_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;