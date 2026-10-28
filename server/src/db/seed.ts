/** Dev accounts to log in as (`npm run db:seed`). Only adds what's missing; migrates first, like the server. */
import { WORDS } from "@infinite-tower/shared";
import { Accounts } from "../core/accounts/accounts.js";
import { giveIfMissing, newPlayer } from "../core/content/player.js";
import { DEV } from "../env.js";
import { PgAccountStore } from "./account-store.js";
import { connectDb, errorText } from "./db.js";
import { PgPlayerStore } from "./player-store.js";

/** Each one's password is its username, which sign-up would refuse (too short). */
const TEST_ACCOUNTS = ["test1", "test2", "test3"];
const TEST_SWORDS = ["longsword", "greatsword"] as const;

if (!DEV) {
  console.error("[seed] refusing to seed a production database");
  process.exit(1);
}

const db = await connectDb().catch((err: unknown) => {
  console.error(`[db] ${errorText(err)}`);
  process.exit(1);
});
try {
  const accountStore = new PgAccountStore(db);
  const accounts = new Accounts(accountStore);
  const players = new PgPlayerStore(db);
  for (const name of TEST_ACCOUNTS) {
    const created = await accounts.create(name, name);
    console.log(created ? `[seed] added account ${name} / ${name}` : `[seed] account ${name} already exists`);
    const account = created ?? await accountStore.find(name);
    if (!account) throw new Error(`account ${name} is missing`);
    const save = (await players.load(account.id)) ?? newPlayer();
    await players.save(account.id, { ...giveIfMissing(save, [...TEST_SWORDS]), knownWords: [...WORDS] });
  }
} finally {
  await db.$client.end();
}
