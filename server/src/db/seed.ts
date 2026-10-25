/**
 * Dev data, so there's something to log in as: `npm run db:seed` (`npm run dev` and `npm run db:reset` run it).
 * Safe to run again: it only adds what's missing. Brings the schema up to date first, like the server does.
 */
import { Accounts } from "../core/accounts/accounts.js";
import { DEV } from "../env.js";
import { PgAccountStore } from "./account-store.js";
import { connectDb, errorText } from "./db.js";

/**
 * Three dev accounts, so two tabs or two players can be tried at once. Each one's password is its username.
 * Sign-up would refuse these passwords (it wants 8+ characters); they're created here, not through /api/register.
 */
const TEST_ACCOUNTS = ["test1", "test2", "test3"];

if (!DEV) {
  console.error("[seed] refusing to seed a production database");
  process.exit(1);
}

const db = await connectDb().catch((err: unknown) => {
  console.error(`[db] ${errorText(err)}`);
  process.exit(1);
});
try {
  const accounts = new Accounts(new PgAccountStore(db));
  for (const name of TEST_ACCOUNTS) {
    const created = await accounts.create(name, name);
    console.log(created ? `[seed] added account ${name} / ${name}` : `[seed] account ${name} already exists`);
  }
} finally {
  await db.$client.end();
}
