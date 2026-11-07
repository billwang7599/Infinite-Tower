import type { StatusIcon } from "../state.js";
import { STATUS_LOOKS } from "./statusLooks.js";

interface StatusRowProps {
  icons: readonly StatusIcon[];
  id: string;
  className?: string;
}

export function StatusRow({ icons, id, className = "" }: StatusRowProps) {
  return (
    <ol id={id} className={`flex flex-wrap gap-1.5 ${className}`}>
      {icons.map((icon) => <StatusTile key={icon.status} icon={icon} />)}
    </ol>
  );
}

function StatusTile({ icon }: { icon: StatusIcon }) {
  const look = STATUS_LOOKS[icon.status];
  const elapsed = 1 - icon.shareLeft;
  return (
    <li data-status={icon.status} aria-label={look.name} className="flex w-8 flex-col items-center">
      <div
        className={`relative size-8 cut-6 clip-cut bg-pit/85 inset-ring ${
          icon.harmful ? "inset-ring-cinnabar/60" : "inset-ring-bone/27"
        }`}
      >
        <svg viewBox="0 0 24 24" className="absolute inset-1 size-[22px]" aria-hidden="true">
          <path d={look.path} fill={look.color} fillRule="evenodd" />
        </svg>
        {elapsed > 0 && (
          <div
            className="absolute inset-0"
            style={{ background: `conic-gradient(#000000a8 0 ${elapsed}turn, transparent 0)` }}
          />
        )}
        {icon.stacks > 1 && (
          <span className="absolute right-1 bottom-0.5 text-[11px]/none font-bold">{icon.stacks}</span>
        )}
      </div>
      <span className="mt-0.5 text-[10px]/none font-semibold tabular-nums">
        {icon.secondsLeft === null ? "" : `${icon.secondsLeft}s`}
      </span>
    </li>
  );
}
