import { Fragment, type ReactNode } from "react";
import {
  DAMAGE_TYPES, HYBRID, itemDef, PLAYER, STRIKES, type Carried, type CoreState, type Faith, type Grip, type Hand,
  type Strike,
} from "@infinite-tower/shared";
import { LABEL } from "../../components/styles.js";
import { DAMAGE_NAME, damageText } from "../inventory/itemInfo.js";
import { combatNumbers, type CombatNumbers, type GuardNumbers, type HeldNumbers } from "./combatNumbers.js";

type Row = readonly [label: string, value: string];

const seconds = (time: number) => `${time.toFixed(2)} s`;
const percent = (share: number) => `${Math.round(share * 100)}%`;
const times = (factor: number) => `×${factor.toFixed(2)}`;
const amount = (n: number) => String(Math.round(n * 10) / 10);

const HAND_NAME: Record<Hand, string> = { rightHand: "Right hand", leftHand: "Left hand" };
const STRIKE_NAME: Record<Strike, string> = { light: "Light", heavy: "Heavy", stab: "Stab" };
const GUARD_NAME: Record<Grip, string> = {
  shield: "Shield", one: "One blade", two: "One blade, both hands", dual: "Two blades",
};
const CELL = "py-px pl-3 text-right tabular-nums";
const STRIKE_COLUMNS = ["Wind-up", "Live", "Recovery", "Stamina", "Poise"];

function guardRows(guard: GuardNumbers | null): Row[] {
  if (!guard) return [["Guard", "None"]];
  const block = HYBRID.block;
  return [
    ["Guard", GUARD_NAME[guard.grip]],
    ["Covers", `${Math.round(guard.arcDeg)}°`],
    ["Raised in", seconds(guard.raiseTime)],
    ["Perfect block", seconds(guard.perfectTime)],
    ["Chip taken", percent(guard.chipFraction)],
    ["Chip at a wall", percent(guard.chipFraction * block.pinnedChipFactor)],
    ["Block stamina", `damage ${times(guard.blockStaminaShare)}, heavy ×${block.heavyStaminaFactor}`],
    ["Pushback", times(guard.pushFactor)],
    ["Holding", `${amount(block.holdStaminaPerSec)} stamina/s`],
    ["Guard broken", `${seconds(block.brokenTime)} stagger`],
  ];
}

const dodgeRows = ({ dodgeStamina }: CombatNumbers): Row[] => [
  ["Stamina", dodgeStamina === null ? "Too loaded" : amount(dodgeStamina)],
  ["I-frames", `${PLAYER.dodge.iframeStart.toFixed(2)}–${seconds(PLAYER.dodge.iframeEnd)}`],
  ["Length", seconds(PLAYER.dodge.duration)],
  ["Cooldown", seconds(PLAYER.dodge.cooldown)],
];

const bodyRows = (numbers: CombatNumbers): Row[] => [
  ["Stamina regen", `${amount(numbers.staminaRegenPerSec)}/s`],
  ["Regen pause", seconds(PLAYER.staminaRegenDelay)],
  ["Knockback taken", times(numbers.knockbackTakenFactor)],
];

function Heading({ children }: { children: ReactNode }) {
  return (
    <h3 className={`mb-1 flex items-center gap-2 ${LABEL}`}>
      {children}
      <span className="h-px flex-1 bg-linear-to-r from-bone/25 to-transparent" />
    </h3>
  );
}

function Section({ title, rows }: { title: string; rows: readonly Row[] }) {
  return (
    <section data-section={title}>
      <Heading>{title}</Heading>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3">
        {rows.map(([label, value]) => (
          <Fragment key={label}>
            <dt className="text-bone/55">{label}</dt>
            <dd className="text-right text-bone tabular-nums">{value}</dd>
          </Fragment>
        ))}
      </dl>
    </section>
  );
}

function HeldWeapon({ held }: { held: HeldNumbers }) {
  const { strikes, draw } = held;
  return (
    <section data-hand={held.hand}>
      <Heading>
        {HAND_NAME[held.hand]} · {itemDef(held.item).name}{held.grip === "two" && " · both hands"}
      </Heading>
      <p className="text-bone/55">
        Strength <span className="text-bone tabular-nums">{amount(held.appliedStrength)}</span>
        {" "}(needs <span className="text-bone tabular-nums">{amount(held.minStrength)}</span>)
        {" · "}weight <span className="text-bone tabular-nums">{amount(held.weight)}</span>
        {" · "}<span className="text-bone tabular-nums">{percent(held.quicker)}</span> quicker
        {" · "}<span className="text-bone tabular-nums">{percent(held.cheaper)}</span> cheaper
        {held.parryTime !== null && (
          <>{" · "}parry window <span className="text-bone tabular-nums">{seconds(held.parryTime)}</span></>
        )}
      </p>
      {strikes && (
        <table className="mt-1 w-full">
          <thead className="text-bone/55">
            <tr>
              <th />
              {[...STRIKE_COLUMNS, ...DAMAGE_TYPES.map((type) => DAMAGE_NAME[type])].map((name) => (
                <th key={name} className={`${CELL} font-normal`}>{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STRIKES.map((strike) => {
              const s = strikes[strike];
              return (
                <tr key={strike} data-strike={strike}>
                  <td className="py-px text-bone/55">{STRIKE_NAME[strike]}</td>
                  {[
                    seconds(s.windupTime), seconds(s.liveTime), seconds(s.recoverTime), amount(s.stamina),
                    amount(s.poiseDamage), ...DAMAGE_TYPES.map((type) => (s.damage[type] > 0 ? amount(s.damage[type]) : "–")),
                  ].map((value, i) => <td key={i} className={`${CELL} text-bone`}>{value}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {draw && (
        <p className="mt-1 text-bone/55">
          Draw <span className="text-bone tabular-nums">{seconds(draw.minTime)}</span> at least,
          {" "}<span className="text-bone tabular-nums">{seconds(draw.fullTime)}</span> full
          {" · "}stamina <span className="text-bone tabular-nums">{amount(draw.stamina)}</span>
          {" · "}fully drawn <span className="text-bone tabular-nums">{damageText(draw.damage)}</span>
        </p>
      )}
    </section>
  );
}

export function AdvancedStats({ gear, core, faith }: { gear: Carried; core: CoreState; faith: Faith }) {
  const numbers = combatNumbers(gear, core, faith);
  return (
    <div id="character-advanced" className="flex min-h-0 flex-1 gap-6 overflow-y-auto pr-1 text-xs">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {numbers.held.length === 0 && <p className="text-bone/55">No weapon in hand.</p>}
        {numbers.held.map((held) => <HeldWeapon key={held.hand} held={held} />)}
        {numbers.held.some((held) => held.strikes) && (
          <p className="text-bone/45">A chain's first strike; chained swings wind up quicker.</p>
        )}
      </div>
      <div className="flex w-[230px] shrink-0 flex-col gap-3">
        <Section title="Guard" rows={guardRows(numbers.guard)} />
        <Section title="Dodge" rows={dodgeRows(numbers)} />
        <Section title="Body" rows={bodyRows(numbers)} />
      </div>
    </div>
  );
}
