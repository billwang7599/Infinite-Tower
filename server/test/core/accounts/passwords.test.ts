import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import { describe, test } from "node:test";
import { hashPassword, verifyPassword } from "../../../src/core/accounts/passwords.js";

describe("hashPassword", () => {
  test("stores scrypt with its cost, a salt and the key, joined by $", async () => {
    const parts = (await hashPassword("password1")).split("$");
    assert.equal(parts.length, 6);
    const [algo, n, r, p, salt, key] = parts;
    assert.deepEqual([algo, n, r, p], ["scrypt", "16384", "8", "1"]);
    assert.equal(Buffer.from(salt!, "base64").length, 16);
    assert.equal(Buffer.from(key!, "base64").length, 32);
  });

  test("gives two different strings for the same password, since each gets its own salt", async () => {
    assert.notEqual(await hashPassword("password1"), await hashPassword("password1"));
  });
});

describe("verifyPassword", () => {
  test("accepts the right password and refuses a wrong one", async () => {
    const stored = await hashPassword("correct horse");
    assert.equal(await verifyPassword("correct horse", stored), true);
    assert.equal(await verifyPassword("correct horsE", stored), false);
    assert.equal(await verifyPassword("", stored), false);
  });

  test("treats compatibility forms of a character as the same (NFKC)", async () => {
    const stored = await hashPassword("\uFB01sh-and-chips"); // "ﬁ" ligature
    assert.equal(await verifyPassword("fish-and-chips", stored), true);
  });

  test("returns false, without throwing, for strings that aren't a stored hash", async () => {
    for (const stored of ["", "nonsense", "scrypt$16384$8$1$c2FsdA==$", "bcrypt$16384$8$1$c2FsdA==$a2V5"]) {
      assert.equal(await verifyPassword("password1", stored), false, stored);
    }
  });

  test("checks a hash made with another cost by that cost, so the cost can be raised later", async () => {
    const salt = Buffer.alloc(16, 3);
    const key = scryptSync("password1", salt, 32, { N: 1024, r: 4, p: 2 });
    const stored = ["scrypt", 1024, 4, 2, salt.toString("base64"), key.toString("base64")].join("$");
    assert.equal(await verifyPassword("password1", stored), true);
    assert.equal(await verifyPassword("password2", stored), false);
  });

  test("refuses a hash made with a different salt", async () => {
    const [algo, n, r, p, , key] = (await hashPassword("password1")).split("$");
    const otherSalt = Buffer.alloc(16, 7).toString("base64");
    assert.equal(await verifyPassword("password1", [algo, n, r, p, otherSalt, key].join("$")), false);
  });

});

/**
 * A damaged stored hash (only possible if the database is edited by hand) must never let anyone in, and must not
 * crash login: it's a refusal (false), not an error. Each case changes one field of a real hash of "password1",
 * so the right password is used and only the damage can make it fail.
 */
describe("verifyPassword with a damaged stored hash", () => {
  const FIELD = { n: 1, r: 2, p: 3, salt: 4, key: 5 } as const;
  const good = hashPassword("password1");
  async function damaged(field: keyof typeof FIELD, value: string): Promise<string> {
    const parts = (await good).split("$");
    parts[FIELD[field]] = value;
    return parts.join("$");
  }
  async function refuses(stored: string): Promise<void> {
    assert.equal(await verifyPassword("password1", stored), false, stored);
  }

  test("a key that decodes to nothing refuses every password", async () => {
    await refuses(await damaged("key", "!!!"));
    assert.equal(await verifyPassword("anything", await damaged("key", "!!!")), false);
  });

  test("the undamaged hash accepts the right password (so each refusal below is the damage)", async () => {
    assert.equal(await verifyPassword("password1", await good), true);
  });

  test("a key of the wrong length refuses even the right password", async () => {
    const key = Buffer.from((await good).split("$")[FIELD.key]!, "base64");
    await refuses(await damaged("key", key.subarray(0, 16).toString("base64")));
    await refuses(await damaged("key", Buffer.concat([key, key]).toString("base64")));
  });

  test("a cost that isn't a whole number refuses", async () => {
    for (const n of ["abc", "", "16384.5", "-16384", "1e4"]) await refuses(await damaged("n", n));
    for (const r of ["x", "0", "-8"]) await refuses(await damaged("r", r));
    for (const p of ["x", "0", "-1"]) await refuses(await damaged("p", p));
  });

  test("a cost scrypt can't use refuses (N not a power of two, or too much memory)", async () => {
    await refuses(await damaged("n", "1000"));
    await refuses(await damaged("n", String(2 ** 30)));
  });

  test("an empty salt refuses", async () => {
    await refuses(await damaged("salt", ""));
  });

  test("extra fields refuse", async () => {
    await refuses(`${await good}$extra`);
  });
});
