import { BLESSING_FAITH, blessingsOf, GODS, type Faith } from "@infinite-tower/shared";
import { useState } from "react";
import { Bar } from "../../components/Bar.js";
import { BLESSING_TEXT, GOD_NAMES } from "../blessings.js";
import { RELATIONSHIP_TABS, type RelationshipTab } from "./panelTabs.js";
import { Tabs } from "./Tabs.js";

export function RelationshipsTab({ faith }: { faith: Faith }) {
  const [shown, show] = useState<RelationshipTab>("gods");
  return (
    <div className="flex h-full flex-col">
      <Tabs id="relationship-tabs" tabs={RELATIONSHIP_TABS} shown={shown} show={show} small />
      {shown === "gods" && <GodsTab faith={faith} />}
    </div>
  );
}

function GodsTab({ faith }: { faith: Faith }) {
  const blessed = blessingsOf(faith);
  return (
    <section id="character-faith" className="min-h-0 flex-1 overflow-y-auto pr-1 text-xs">
      <p className="mb-3 text-white/55">At {BLESSING_FAITH} faith, a god may bless you.</p>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-3">
        {GODS.map((god) => {
          const amount = faith[god] ?? 0, blessing = blessed.find((b) => b === god);
          const nameColour = blessing ? "text-victory" : amount > 0 ? "text-white/85" : "text-white/45";
          return (
            <li key={god} data-god={god} data-blessed={blessing ? "" : undefined}>
              <span className="flex items-baseline justify-between">
                <span className={`text-sm ${nameColour}`}>{GOD_NAMES[god]}</span>
                <span className="text-white/55 tabular-nums">{amount} / {BLESSING_FAITH}</span>
              </span>
              <Bar
                fraction={Math.min(1, amount / BLESSING_FAITH)} fill="from-victory to-gilt" className="mt-1 h-1.5"
              />
              {blessing && <span className="mt-1 block text-white/60">{BLESSING_TEXT[blessing]}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
