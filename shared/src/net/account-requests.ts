/**
 * Request bodies of the account API (accounts.ts), checked by the server. Kept apart from accounts.ts so the
 * client never imports Zod: import these from "@infinite-tower/shared/net/account-requests".
 */
import { z } from "zod";
import { PASSWORD_RULES, USERNAME_RULES, type Credentials } from "./accounts.js";

const USERNAME_HELP = `Usernames are ${USERNAME_RULES.min}-${USERNAME_RULES.max} letters, digits, _ or -.`;

export const RegisterRequest = z.object({
  username: z.string().trim()
    .min(USERNAME_RULES.min, USERNAME_HELP)
    .max(USERNAME_RULES.max, USERNAME_HELP)
    .regex(new RegExp(USERNAME_RULES.pattern), USERNAME_HELP),
  password: z.string()
    .min(PASSWORD_RULES.min, `Passwords need at least ${PASSWORD_RULES.min} characters.`)
    .max(PASSWORD_RULES.max, `Passwords can be at most ${PASSWORD_RULES.max} characters.`),
}) satisfies z.ZodType<Credentials>;

/** No length rules beyond sanity: accounts made under older rules (or the dev seed) still log in. */
export const LoginRequest = z.object({
  username: z.string().trim().min(1, "Enter your username.").max(64),
  password: z.string().min(1, "Enter your password.").max(PASSWORD_RULES.max),
}) satisfies z.ZodType<Credentials>;
