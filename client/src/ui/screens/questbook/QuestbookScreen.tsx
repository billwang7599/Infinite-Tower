import type { QuestHalf, QuestView, Stowed } from "@infinite-tower/shared";
import { Modal } from "../../components/Modal.js";
import { LABEL } from "../../components/styles.js";
import { useAction } from "../../components/useAction.js";
import { useGame } from "../../context.js";
import { useStore } from "../../useStore.js";
import { tallyText } from "./tally.js";

const HALVES: readonly { half: QuestHalf; title: string }[] = [
  { half: "main", title: "Main quest" },
  { half: "side", title: "Side quests" },
];

export function QuestbookScreen() {
  const { ui: { questbook, you, toggleQuestbook: toggle, closeQuestbook: close }, input } = useGame();
  const open = useStore(questbook, (s) => s.open);
  const quests = useStore(questbook, (s) => s.quests);
  const gear = useStore(you, (s) => s.gear);
  useAction(input, ["questbook", "closeQuestbook"], (action, repeat) => {
    if (repeat) return;
    if (action === "questbook") toggle();
    else close();
  });
  if (!open) return null;
  return (
    <Modal id="questbook" title="Questbook" width="w-[min(900px,94vw)]" close={close}>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-8 overflow-y-auto px-7 pb-7">
        {HALVES.map(({ half, title }) => (
          <section key={half} id={`questbook-${half}`} className="mt-4 flex flex-col gap-4">
            <h3 className={`${LABEL} border-b border-bone/13 pb-1.5`}>{title}</h3>
            {quests.filter((q) => q.half === half)
              .map((quest) => <Quest key={quest.id} quest={quest} carried={gear} />)}
            {!quests.some((q) => q.half === half) && <p className="text-sm text-bone/45">Nothing yet.</p>}
          </section>
        ))}
      </div>
    </Modal>
  );
}

function Quest({ quest, carried }: { quest: QuestView; carried: Stowed }) {
  const { step } = quest;
  return (
    <article className="flex flex-col gap-1.5" data-quest={quest.id}>
      <h4 className={`text-[15px] tracking-[0.16em] uppercase ${step ? "text-cinnabar" : "text-bone/55"}`}>
        {quest.title}
        {!step && <span className="ml-2 text-[11px] text-bone/45">Done</span>}
      </h4>
      {step && (
        <div className="flex flex-col gap-0.5">
          <p className="text-[15px]">
            {step.text}
            {step.tally && <span className="ml-2 text-bone/60">{tallyText(step.tally, carried)}</span>}
          </p>
          <p className="text-sm text-bone/55 italic">{step.hint}</p>
        </div>
      )}
      {quest.lore.map((entry) => (
        <div key={entry.title} className="mt-1 border-l-2 border-cinnabar/40 pl-3">
          <div className="text-sm font-semibold text-bone/80">{entry.title}</div>
          <p className="text-sm/snug text-bone/65">{entry.text}</p>
        </div>
      ))}
    </article>
  );
}
