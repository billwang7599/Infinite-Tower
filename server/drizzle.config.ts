// drizzle-kit's settings, for `npm run db:generate` (it compares db/schema.ts with the last migration's snapshot;
// it doesn't connect to the database). The server applies the migrations itself when it starts (db/db.ts).
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
});
