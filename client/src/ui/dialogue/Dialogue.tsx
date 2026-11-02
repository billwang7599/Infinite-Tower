import type { DialogueOffer } from "@infinite-tower/shared";
import type { Actions } from "../../core/actions.js";
import type { KeyBindings } from "../../settings/bindings.js";
import { LookPicture } from "../components/LookPicture.js";
import { NO_FOCUS } from "../components/noFocus.js";
import { BUTTON } from "../components/styles.js";
import { useAction } from "../components/useAction.js";
import { describeItems } from "../notifications/battleResult.js";
import type { DialogueState } from "../state.js";
import type { Store } from "../store.js";
import { useStore } from "../useStore.js";
import { withKeys } from "./keys.js";

const OFFER_BUTTON: Record<DialogueOffer["kind"], string> = {
  quest: "Accept", deliver: "Hand over", shop: "Trade", train: "Begin",
};

interface DialogueProps {
  dialogue: Store<DialogueState>;
  input: Actions;
  bindings: KeyBindings;
  next: () => void;
  take: (offer: DialogueOffer) => void;
  close: () => void;
}

export function Dialogue({ dialogue, input, bindings, next, take, close }: DialogueProps) {
  const open = useStore(dialogue, (s) => s.open);
  const name = useStore(dialogue, (s) => s.name);
  const look = useStore(dialogue, (s) => s.look);
  const keys = useStore(bindings, (s) => s);
  const text = withKeys(useStore(dialogue, (s) => s.lines[s.line] ?? ""), keys);
  const offer = useStore(dialogue, (s) => (s.line === s.lines.length - 1 ? s.offer : null));
  useAction(input, ["nextLine", "closeDialogue"], (action, repeat) => {
    if (repeat) return;
    if (action === "nextLine") next();
    else close();
  });
  if (!open) return null;
  return (
    <div
      id="dialogue"
      className={
        "pointer-events-auto absolute bottom-5 left-1/2 flex w-[min(36rem,50%)] -translate-x-1/2 flex-col gap-3 "
        + "rounded-sm border border-victory/40 bg-night p-4 font-ui text-white shadow-[0_12px_40px_#000a]"
      }
    >
      <button
        type="button" aria-label={`${name} says`} {...NO_FOCUS} onClick={next}
        className="flex min-h-24 cursor-pointer items-start gap-4 text-left"
      >
        {look && <LookPicture look={look} view="portrait" className="size-24 shrink-0 rounded-sm bg-black/40" />}
        <div className="flex flex-col gap-1.5">
          <div id="dialogue-name" className="font-title text-lg tracking-[0.08em] text-victory">{name}</div>
          <p id="dialogue-line" className="text-base/snug">{text}</p>
        </div>
      </button>
      {offer && (
        <div id="dialogue-offer" className="flex items-center justify-end gap-3 border-t border-white/10 pt-3">
          <span className="mr-auto text-sm text-white/75">
            {offer.kind === "quest"
              ? <><span className="font-semibold text-victory">{offer.title}</span>: {offer.step}</>
              : offer.kind === "shop" ? <span className="font-semibold text-victory">{offer.name}</span>
              : offer.kind === "train" ? <>Spar with <span className="font-semibold text-victory">{offer.foe}</span></>
              : `Hand over ${describeItems({ [offer.item]: offer.count })}?`}
          </span>
          <button type="button" id="dialogue-take" {...NO_FOCUS} className={BUTTON.primary} onClick={() => take(offer)}>
            {OFFER_BUTTON[offer.kind]}
          </button>
          <button type="button" id="dialogue-decline" {...NO_FOCUS} className={BUTTON.plain} onClick={close}>
            Not now
          </button>
        </div>
      )}
    </div>
  );
}
