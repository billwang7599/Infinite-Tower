CREATE TABLE "players" (
	"id" text PRIMARY KEY NOT NULL,
	"hp" double precision NOT NULL,
	"stamina" double precision NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
