import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PASSWORD_RULES, USERNAME_RULES } from "@infinite-tower/shared";
import { LoginRequest, RegisterRequest } from "@infinite-tower/shared/net/api-requests";

/** The sentence the form would show, or null if the body passes. */
const problem = (schema: typeof RegisterRequest | typeof LoginRequest, body: unknown) => {
  const result = schema.safeParse(body);
  return result.success ? null : result.error.issues[0]!.message;
};

describe("RegisterRequest", () => {
  const password = "x".repeat(PASSWORD_RULES.min);

  test("accepts a username within the rules, trimmed", () => {
    assert.deepEqual(RegisterRequest.parse({ username: " bill_7 ", password }), { username: "bill_7", password });
  });

  test("explains the username rules", () => {
    const sentence = "Usernames are 3-20 letters, digits, _ or -.";
    assert.equal(problem(RegisterRequest, { username: "ab", password }), sentence);
    assert.equal(problem(RegisterRequest, { username: "a".repeat(USERNAME_RULES.max + 1), password }), sentence);
    assert.equal(problem(RegisterRequest, { username: "bill wang", password }), sentence);
  });

  test("explains the password rules", () => {
    assert.equal(problem(RegisterRequest, { username: "bill", password: "short" }),
      `Passwords need at least ${PASSWORD_RULES.min} characters.`);
    assert.equal(problem(RegisterRequest, { username: "bill", password: "x".repeat(PASSWORD_RULES.max + 1) }),
      `Passwords can be at most ${PASSWORD_RULES.max} characters.`);
  });
});

describe("LoginRequest", () => {
  test("has no length rules beyond sanity, so older or seeded accounts still log in", () => {
    assert.equal(problem(LoginRequest, { username: "ab", password: "a" }), null);
  });

  test("asks for what's missing", () => {
    assert.equal(problem(LoginRequest, { username: "   ", password: "pw" }), "Enter your username.");
    assert.equal(problem(LoginRequest, { username: "bill", password: "" }), "Enter your password.");
  });
});
