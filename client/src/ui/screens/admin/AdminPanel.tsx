/** The server does each cheat (and ignores them in production); the time of day is only drawn, so it is set here. */
import { useState, type ReactNode } from "react";
import {
  COMBAT_STYLE_IDS, COMBAT_STYLES, ENEMY_IDS, ITEM_IDS, ITEMS, type Cheat, type DayChange,
} from "@infinite-tower/shared";
import type { Actions } from "../../../core/actions.js";
import type { CombatSettings } from "../../../settings/combat.js";
import type { Mode } from "../../../game/transition.js";
import { NO_FOCUS } from "../../components/noFocus.js";
import { useAction } from "../../components/useAction.js";
import type { AdminState } from "../../state.js";
import type { Store } from "../../store.js";
import { useStore } from "../../useStore.js";
import { DAY_SPEEDS, DAY_TIMES, GIVE_COUNTS } from "./admin.js";

interface AdminPanelProps {
  admin: Store<AdminState>;
  mode: Mode | null;
  input: Actions;
  cheat: (cheat: Cheat) => void;
  setDayClock: (change: DayChange) => void;
  combat: CombatSettings;
}

const CHIP =
  "cursor-pointer rounded-sm border border-white/20 px-2 py-0.5 enabled:hover:border-white/50 "
  + "enabled:hover:bg-white/10 disabled:cursor-default disabled:opacity-35";
const CHIP_ON = "cursor-pointer rounded-sm border border-victory/70 bg-victory/15 px-2 py-0.5 text-victory";

export function AdminPanel({ admin, mode, input, cheat, setDayClock, combat }: AdminPanelProps) {
  const open = useStore(admin, (s) => s.open);
  const style = useStore(combat, (s) => s.style);
  const invulnerable = useStore(admin, (s) => s.invulnerable);
  const [speed, setSpeed] = useState<number>(1);
  const [count, setCount] = useState<number>(1);

  useAction(input, ["adminPanel", "closeAdmin"], (action, repeat) => {
    if (repeat) return false;
    admin.set({ open: action === "adminPanel" && !open });
  });

  if (!open) return null;
  const inOverworld = mode === "overworld";
  return (
    <aside
      id="admin-panel"
      className={
        "fixed top-24 left-4 flex max-h-[75vh] w-72 flex-col gap-3 overflow-y-auto rounded-sm border border-white/15 "
        + "bg-night/90 p-3 font-ui text-xs text-white shadow-[0_10px_30px_#000a] select-none"
      }
    >
      <header className="flex items-center justify-between">
        <h2 className="font-title text-base tracking-[0.08em] text-victory">Admin</h2>
        <button type="button" aria-label="Close" {...NO_FOCUS} onClick={() => admin.set({ open: false })}
          className="cursor-pointer px-1 text-white/60 hover:text-white">✕</button>
      </header>
      <Section title="Time of day">
        {DAY_TIMES.map(({ label, fraction }) => (
          <button key={label} type="button" {...NO_FOCUS} className={CHIP} onClick={() => setDayClock({ fraction })}>
            {label}
          </button>
        ))}
      </Section>
      <Section title="Day speed">
        {DAY_SPEEDS.map((s) => (
          <button key={s} type="button" {...NO_FOCUS} className={s === speed ? CHIP_ON : CHIP}
            onClick={() => { setSpeed(s); setDayClock({ speed: s }); }}>
            {s}×
          </button>
        ))}
      </Section>
      <Section title="Player">
        <button type="button" id="admin-invulnerable" {...NO_FOCUS} className={invulnerable ? CHIP_ON : CHIP}
          onClick={() => cheat({ kind: "invulnerable", on: !invulnerable })}>
          Invulnerable {invulnerable ? "on" : "off"}
        </button>
        <button type="button" id="admin-heal" {...NO_FOCUS} className={CHIP} onClick={() => cheat({ kind: "heal" })}>
          Heal
        </button>
      </Section>
      <Section title="Core (overworld)">
        <button type="button" id="admin-step-down" {...NO_FOCUS} className={CHIP} disabled={!inOverworld}
          onClick={() => cheat({ kind: "coreStep", add: false })}>
          − step
        </button>
        <button type="button" id="admin-step-up" {...NO_FOCUS} className={CHIP} disabled={!inOverworld}
          onClick={() => cheat({ kind: "coreStep", add: true })}>
          + step
        </button>
      </Section>
      <Section title="Combat style (next fight)">
        {COMBAT_STYLE_IDS.map((id) => (
          <button key={id} type="button" id={`admin-style-${id}`} {...NO_FOCUS}
            className={id === style ? CHIP_ON : CHIP} onClick={() => combat.setStyle(id)}>
            {COMBAT_STYLES[id].name}
          </button>
        ))}
      </Section>
      <Section title="Fight">
        {ENEMY_IDS.map((enemy) => (
          <button key={enemy} type="button" {...NO_FOCUS} className={CHIP} disabled={!inOverworld}
            onClick={() => { admin.set({ open: false }); cheat({ kind: "encounter", enemy }); }}>
            {enemy}
          </button>
        ))}
      </Section>
      <Section title="Give (overworld)">
        {GIVE_COUNTS.map((c) => (
          <button key={c} type="button" {...NO_FOCUS} className={c === count ? CHIP_ON : CHIP}
            onClick={() => setCount(c)}>
            ×{c}
          </button>
        ))}
        <span className="basis-full" />
        {ITEM_IDS.map((item) => (
          <button key={item} type="button" {...NO_FOCUS} className={CHIP} disabled={!inOverworld}
            onClick={() => cheat({ kind: "give", item, count })}>
            {ITEMS[item].name}
          </button>
        ))}
      </Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-[11px] tracking-wider text-white/50 uppercase">{title}</h3>
      <div className="flex flex-wrap gap-1">{children}</div>
    </section>
  );
}
