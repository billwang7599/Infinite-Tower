/**
 * Dev data, so there's something to log in as: `npm run db:seed` (`npm run dev` and `npm run db:reset` run it).
 * Safe to run again: it only adds what's missing. Brings the schema up to date first, like the server does.
 */
import { Accounts } from "../auth/accounts.js";
import { DEV } from "../env.js";
import { connectDb } from "./db.js";

/** Bypasses the sign-up rules (a 4-letter password): it's created here, not through /api/register. */
const TEST_ACCOUNT = { username: "test", password: "test" };

if (!DEV) {
  console.error("[seed] refusing to seed a production database");
  process.exit(1);
}

const db = await connectDb(true).catch((err: unknown) => {
  console.error(`[db] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
try {
  const created = await new Accounts(db).create(TEST_ACCOUNT.username, TEST_ACCOUNT.password);
  console.log(created
    ? `[seed] added account ${TEST_ACCOUNT.username} / ${TEST_ACCOUNT.password}`
    : `[seed] account ${TEST_ACCOUNT.username} already exists`);
} finally {
  await db.$client.end();
}
