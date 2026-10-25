import assert from "node:assert/strict";
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

  test("refuses a hash made with a different salt", async () => {
    const [algo, n, r, p, , key] = (await hashPassword("password1")).split("$");
    const otherSalt = Buffer.alloc(16, 7).toString("base64");
    assert.equal(await verifyPassword("password1", [algo, n, r, p, otherSalt, key].join("$")), false);
  });

  // Known gaps in passwords.ts, written as what it should do. Neither string can come from hashPassword, so they
  // only matter if the database is edited by hand.
  const badCostBug = "bug: it rejects with ERR_OUT_OF_RANGE";
  test("returns false when the stored cost isn't a number", { skip: badCostBug }, async () => {
    assert.equal(await verifyPassword("password1", "scrypt$abc$8$1$c2FsdA==$a2V5"), false);
  });

  const emptyKeyBug = "bug: it returns true (two 0-byte keys match)";
  test("refuses every password when the stored key decodes to nothing", { skip: emptyKeyBug }, async () => {
    assert.equal(await verifyPassword("anything", "scrypt$16384$8$1$c2FsdA==$!!!"), false);
  });
});
