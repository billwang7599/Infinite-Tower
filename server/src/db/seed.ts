/** Dev accounts to log in as (`npm run db:seed`). Only adds what's missing; migrates first, like the server. */
import { Accounts } from "../core/accounts/accounts.js";
import { DEV } from "../env.js";
import { PgAccountStore } from "./account-store.js";
import { connectDb, errorText } from "./db.js";

/** Each one's password is its username, which sign-up would refuse (too short). */
const TEST_ACCOUNTS = ["test1", "test2", "test3", "user"];

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
