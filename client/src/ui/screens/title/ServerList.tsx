import type { GameServer } from "@infinite-tower/shared";
import { keepFocus } from "../../components/noFocus.js";

interface ServerListProps {
  servers: GameServer[];
  picked: string | null;
  disabled: boolean;
  pick(socket: string): void;
}

export function ServerList({ servers, picked, disabled, pick }: ServerListProps) {
  return (
    <ul id="title-servers" aria-label="Servers" className="flex w-72 flex-col gap-1">
      {servers.map((server) => {
        const chosen = server.socket === picked;
        const full = server.players >= server.maxPlayers;
        return (
          <li key={server.socket}>
            <button
              type="button" aria-pressed={chosen} disabled={disabled} onMouseDown={keepFocus}
              onClick={() => pick(server.socket)}
              className={
                "flex w-full cursor-pointer items-center justify-between border px-3 py-1.5 text-sm transition-colors "
                + "disabled:cursor-default "
                + (chosen
                  ? "border-victory/70 bg-black/40 text-white"
                  : "border-white/15 text-white/60 hover:text-white")
              }
            >
              <span>{server.name}</span>
              <span className={full ? "text-error" : "text-white/50"}>
                {full ? "Full" : `${server.players} / ${server.maxPlayers}`}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
