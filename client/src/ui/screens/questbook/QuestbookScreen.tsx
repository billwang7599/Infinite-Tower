import type { Bag, QuestHalf, QuestView } from "@infinite-tower/shared";
import type { Actions } from "../../../core/actions.js";
import { useAction } from "../../components/useAction.js";
import type { QuestbookState, YouState } from "../../state.js";
import type { Store } from "../../store.js";
import { useStore } from "../../useStore.js";
import { tallyText } from "./tally.js";

interface QuestbookProps {
  questbook: Store<QuestbookState>;
  you: Store<YouState>;
  input: Actions;
  toggle: () => void;
  close: () => void;
}

const HALVES: readonly { half: QuestHalf; title: string }[] = [
  { half: "main", title: "Main quest" },
  { half: "side", title: "Side quests" },
];

export function QuestbookScreen({ questbook, you, input, toggle, close }: QuestbookProps) {
  const open = useStore(questbook, (s) => s.open);
  const quests = useStore(questbook, (s) => s.quests);
  const bag = useStore(you, (s) => s.gear.bag);
  useAction(input, ["questbook", "closeQuestbook"], (action, repeat) => {
    if (repeat) return;
    if (action === "questbook") toggle();
    else close();
  });
  if (!open) return null;
  return (
    <div
      id="questbook" role="dialog" aria-modal="true" aria-labelledby="questbook-title"
      className="fixed inset-0 flex items-center justify-center bg-black/55 font-ui text-white select-none"
    >
      <section
        className={
          "flex max-h-[min(760px,92vh)] w-[min(900px,94vw)] flex-col rounded-sm border border-white/15 bg-night/95 "
          + "shadow-[0_20px_60px_#000c]"
        }
      >
        <header className="flex items-center justify-between px-7 pt-6 pb-2">
          <h2 id="questbook-title" className="font-title text-3xl tracking-[0.08em] text-victory">Questbook</h2>
          <button
            type="button" aria-label="Close" onClick={close}
            className={
              "flex size-8 cursor-pointer items-center justify-center rounded-full text-lg text-white/60 "
              + "transition-colors hover:bg-white/10 hover:text-white"
            }
          >
            ✕
          </button>
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-8 overflow-y-auto px-7 pb-7">
          {HALVES.map(({ half, title }) => (
            <section key={half} id={`questbook-${half}`} className="mt-4 flex flex-col gap-4">
              <h3 className="border-b border-white/10 pb-1 text-lg font-semibold">{title}</h3>
              {quests.filter((q) => q.half === half).map((quest) => <Quest key={quest.id} quest={quest} bag={bag} />)}
              {!quests.some((q) => q.half === half) && <p className="text-sm text-white/45">Nothing yet.</p>}
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

function Quest({ quest, bag }: { quest: QuestView; bag: Bag }) {
  const { step } = quest;
  return (
    <article className="flex flex-col gap-1.5" data-quest={quest.id}>
      <h4 className={`font-title text-lg tracking-wide ${step ? "text-victory" : "text-white/55"}`}>
        {quest.title}
        {!step && <span className="ml-2 font-ui text-xs tracking-normal text-white/45">Done</span>}
      </h4>
      {step && (
        <div className="flex flex-col gap-0.5">
          <p className="text-[15px]">
            {step.text}
            {step.tally && <span className="ml-2 text-white/60">{tallyText(step.tally, bag)}</span>}
          </p>
          <p className="text-sm text-white/55 italic">{step.hint}</p>
        </div>
      )}
      {quest.lore.map((entry) => (
        <div key={entry.title} className="mt-1 border-l-2 border-victory/30 pl-3">
          <div className="text-sm font-semibold text-white/80">{entry.title}</div>
          <p className="text-sm/snug text-white/65">{entry.text}</p>
        </div>
      ))}
    </article>
  );
}
