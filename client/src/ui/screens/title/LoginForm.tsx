/**
 * The title screen's login form, shown when nobody's logged in. One form for both: "Create an account" switches
 * it to sign-up, which also checks the username / password rules before asking the server.
 */
import { PASSWORD_RULES, rulesHint, USERNAME_RULES, type Credentials } from "@infinite-tower/shared";
import { useState, type FormEvent } from "react";
import type { SignInKind } from "../../state.js";

const FIELD = "w-72 rounded-sm border border-white/20 bg-black/50 px-3 py-2 text-base text-white placeholder:text-white/35 focus-visible:border-victory/70 focus-visible:outline-none disabled:opacity-50";
const LINK = "cursor-pointer text-sm text-white/60 underline-offset-4 hover:text-white hover:underline disabled:cursor-default disabled:opacity-40";

export function LoginForm({ busy, submit }: { busy: boolean; submit: (kind: SignInKind, c: Credentials) => void }) {
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
      <button
        type="submit" disabled={busy}
        className="mt-2 flex cursor-pointer items-center gap-3 py-1 font-title text-[28px] tracking-[0.12em] transition-opacity duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-victory disabled:cursor-default disabled:opacity-40"
      >
        <span className="text-sm text-victory">◆</span>
        {registering ? "Create account" : "Log in"}
      </button>
      <button type="button" disabled={busy} onClick={() => setKind(registering ? "login" : "register")} className={LINK}>
        {registering ? "Have an account? Log in" : "New here? Create an account"}
      </button>
    </form>
  );
}
