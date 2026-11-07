/**
 * The title screen's login form, shown when nobody's logged in. One form for both: "Create an account" switches
 * it to sign-up, which also checks the username / password rules before asking the server.
 */
import { PASSWORD_RULES, rulesHint, USERNAME_RULES } from "@infinite-tower/shared";
import { useState, type FormEvent } from "react";
import { TEXT_INPUT } from "../../components/styles.js";
import type { SignInKind, UiActions } from "../../state.js";
import { MenuButton } from "./MenuButton.js";
import { LINK } from "./styles.js";

const FIELD = `${TEXT_INPUT} w-72 disabled:opacity-50`;

export function LoginForm({ busy, submit }: { busy: boolean; submit: UiActions["signIn"] }) {
  const [kind, setKind] = useState<SignInKind>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const registering = kind === "register";

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!busy) submit(kind, { username, password });
  };

  return (
    <form id="login-form" onSubmit={onSubmit} className="flex flex-col items-start gap-3">
      <input
        name="username" aria-label="Username" placeholder="Username" autoComplete="username" autoFocus required
        value={username} onChange={(e) => setUsername(e.target.value)} disabled={busy} className={FIELD}
        {...(registering && {
          minLength: USERNAME_RULES.min, maxLength: USERNAME_RULES.max, pattern: USERNAME_RULES.pattern,
          title: rulesHint(USERNAME_RULES),
        })}
      />
      <input
        name="password" type="password" aria-label="Password" placeholder="Password" required
        autoComplete={registering ? "new-password" : "current-password"}
        value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} className={FIELD}
        {...(registering && { minLength: PASSWORD_RULES.min, maxLength: PASSWORD_RULES.max })}
      />
      <MenuButton
        type="submit" disabled={busy}
        className="mt-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cinnabar"
      >
        {registering ? "Create account" : "Log in"}
      </MenuButton>
      <button
        type="button" disabled={busy} onClick={() => setKind(registering ? "login" : "register")} className={LINK}
      >
        {registering ? "Have an account? Log in" : "New here? Create an account"}
      </button>
    </form>
  );
}
