import { NO_FOCUS } from "../../components/noFocus.js";
import type { Tab } from "./panelTabs.js";

interface TabsProps<Id extends string> {
  id: string;
  tabs: readonly Tab<Id>[];
  shown: Id;
  show: (tab: Id) => void;
  small?: boolean;
}

export function Tabs<Id extends string>({ id, tabs, shown, show, small = false }: TabsProps<Id>) {
  return (
    <div
      id={id} role="tablist"
      className={`flex gap-1 border-b ${small ? "border-bone/5" : "border-bone/15"} ${small ? "mb-3" : "mb-4"}`}
    >
      {tabs.map((tab) => {
        const on = tab.id === shown;
        return (
          <button
            key={tab.id} type="button" role="tab" aria-selected={on} data-tab={tab.id} {...NO_FOCUS}
            onClick={() => show(tab.id)}
            className={
              `pointer-events-auto -mb-px cursor-pointer border-b-2 tracking-[0.24em] uppercase transition-colors ${
                small ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
              } ${on ? "border-cinnabar text-bone" : "border-transparent text-bone/55 hover:text-bone/85"}`
            }
          >
            {tab.name}
          </button>
        );
      })}
    </div>
  );
}
