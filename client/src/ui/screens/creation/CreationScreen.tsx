/**
 * A new player making their character, on the white the enter sequence flashes into (under the title, so the title's
 * white clears onto it). The System greets them, then the panel; Yes sends it to the server, and once it's saved the
 * System says goodbye and the white clears off the world. Nothing is saved until Yes.
 */
import { CHARACTER_NAME_RULES, DEFAULT_LOOK, type Character } from "@infinite-tower/shared";
import { useEffect, useReducer, useState } from "react";
import type { MenuAction } from "../../../settings/bindings.js";
import { LookPicture } from "../../components/LookPicture.js";
import { useAction } from "../../components/useAction.js";
import { useGame } from "../../context.js";
import { inWorld } from "../../state.js";
import { useStore } from "../../useStore.js";
import { useReducedMotion } from "../title/useSequence.js";
import { CONFIRM, CONFIRM_NO, CONFIRM_YES, farewell, GREETING, MAKE_PROMPT } from "./lines.js";
import { LookMaker } from "./LookMaker.js";
import type { Choices } from "./options.js";
import { nextScene, START, type Scene } from "./scene.js";
import { SystemWindow } from "./SystemWindow.js";
import { useTyped } from "./useTyped.js";

/** Yes / Not yet. */
const CHOICE_ACTIONS: readonly MenuAction<"creation">[] = ["menuLeft", "menuRight", "menuUp", "menuDown"];
/** The server answers a valid character at once; no answer by then means it refused it. */
const SAVE_TIMEOUT_MS = 5000;
/** The farewell goes on by itself this long after it's typed. */
const FAREWELL_HOLD_MS = 1600;
/** Out: what's on the white fades, then the white. */
const CONTENT_OUT_MS = { moving: 450, still: 150 };
const OUT_MS = { moving: 1300, still: 300 };

/** Whole multiples of 64 and 32 (gfx/look/art.ts VIEWS), so pixels stay square: bigger on taller screens. */
const PORTRAIT_SIZE = "size-[256px] [@media(min-height:820px)]:size-[320px]";
const CHIBI_SIZE = "size-[96px] [@media(min-height:820px)]:size-[128px]";
const FLOOR_LINE = "absolute inset-x-[-8%] -bottom-2 h-px bg-linear-to-r from-transparent via-gilt/50 to-transparent";

export function CreationScreen() {
  const open = useStore(useGame().ui.creation, (s) => s.open);
  return open ? <Creation /> : null;
}

function Creation() {
  const { ui, input, actions } = useGame();
  const { you, title, closeCreation: close } = ui;
  const save = (character: Character) => actions.request({ t: "character", character });
  // The title has cleared off this screen.
  const active = inWorld(useStore(ui.screen, (s) => s.mode), useStore(title, (s) => s.phase));
  const username = useStore(title, (s) => s.username);
  const saved = useStore(you, (s) => s.character);
  const still = useReducedMotion();
  const motion = still ? "still" : "moving";
  const [scene, dispatch] = useReducer(nextScene, START);
  // Usernames may have "_", names may not: "sir_boar" suggests "sir boar".
  const [name, setName] = useState(() => (username ?? "").replaceAll("_", " ").slice(0, CHARACTER_NAME_RULES.max));
  const [choices, setChoices] = useState<Choices>({ gender: "boy", look: DEFAULT_LOOK });
  const [nameError, setNameError] = useState<string | null>(null);
  const [answer, setAnswer] = useState(0);

  const { step } = scene;
  const text = lineFor(scene, name.trim());
  const typed = useTyped(text, still);
  const goOn = () => (typed.done ? dispatch({ type: "advance" }) : typed.finish());

  useEffect(() => {
    if (step === "saving" && saved) dispatch({ type: "saved" });
  }, [step, saved]);
  useEffect(() => {
    if (step !== "saving") return;
    const timer = setTimeout(() => dispatch({ type: "timedOut" }), SAVE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [step]);
  useEffect(() => {
    if (step !== "farewell" || !typed.done) return;
    const timer = setTimeout(() => dispatch({ type: "advance" }), FAREWELL_HOLD_MS);
    return () => clearTimeout(timer);
  }, [step, typed.done]);
  useEffect(() => {
    if (step !== "out") return;
    const timer = setTimeout(close, CONTENT_OUT_MS[motion] + OUT_MS[motion]);
    return () => clearTimeout(timer);
  }, [step, motion, close]);

  const begin = () => {
    const trimmed = name.trim();
    // The input's own checks count leading / trailing spaces; the server trims them.
    const { min, pattern, allowed } = CHARACTER_NAME_RULES;
    const problem = trimmed.length < min ? `Names need at least ${min} letters.`
      : !new RegExp(pattern).test(trimmed) ? `Names use ${allowed} only.`
      : null;
    setNameError(problem);
    if (problem) return;
    setAnswer(0);
    dispatch({ type: "begin" });
  };
  const respond = (yes: boolean) => {
    if (yes) save({ name: name.trim(), gender: choices.gender, look: choices.look });
    dispatch({ type: "answer", yes });
  };

  useAction(input, ["goBack", "confirm", "goOn", ...CHOICE_ACTIONS], (action, repeat) => {
    if (step === "make") return action === "goBack";
    const goesOn = (action === "confirm" || action === "goOn") && !repeat;
    if (step === "greet" || step === "farewell") {
      if (goesOn) goOn();
    } else if (step === "confirm") {
      if (action === "goBack") respond(false);
      else if (!typed.done) {
        if (goesOn) typed.finish();
      } else if (CHOICE_ACTIONS.includes(action)) setAnswer((a) => 1 - a);
      else if (goesOn) respond(answer === 0);
    }
  });

  const making = step === "make" || step === "confirm" || step === "saving";
  const greeting = step === "greet";
  const out = step === "out";
  const system = (
    <SystemWindow
      key={greeting ? "greet" : "after"} typed={typed} className={greeting ? "w-[min(620px,88vw)]" : "w-full"}
      goesOn={greeting || step === "farewell"} onClick={greeting || step === "farewell" ? goOn : undefined}
      choices={step === "confirm"
        ? { labels: [CONFIRM_YES, CONFIRM_NO], picked: answer, pick: (i) => respond(i === 0) }
        : undefined}
    />
  );
  // Out: what's on the white fades first, then the white clears off the world.
  return (
    <div
      id="creation-screen" data-step={active ? step : "waiting"}
      className={`fixed inset-0 overflow-hidden bg-white select-none ${
        out ? "animate-white-in [animation-direction:reverse]" : ""
      }`}
      style={out ? { animationDuration: `${OUT_MS[motion]}ms`, animationDelay: `${CONTENT_OUT_MS[motion]}ms` }
        : undefined}
    >
      <div className="absolute inset-0 bg-radial from-white from-40% to-[#e6e8ee]" />
      {active && greeting && <div className="absolute inset-0 flex items-center justify-center">{system}</div>}
      {active && !greeting && (
        <div
          className={`absolute inset-0 flex items-center justify-center gap-[5vw] transition-opacity ${
            out ? "opacity-0" : ""
          }`}
          style={{ transitionDuration: `${CONTENT_OUT_MS[motion]}ms` }}
        >
          <div className="flex w-[min(540px,46vw)] flex-col items-center gap-10">
            <figure className="relative flex animate-rise items-end gap-[3vw] motion-reduce:animate-none">
              <LookPicture look={choices.look} view="portrait" className={PORTRAIT_SIZE} />
              <div className="flex flex-col items-center">
                <LookPicture look={choices.look} view="chibi" className={`relative ${CHIBI_SIZE}`} />
                <span className="-mt-2 h-3 w-[70%] rounded-[50%] bg-ink/15 blur-[2px]" />
              </div>
              <span className={FLOOR_LINE} />
            </figure>
            {system}
          </div>
          {/* Stays (faded) after Yes, so the portrait doesn't jump to the middle. */}
          <LookMaker
            name={name} setName={(n) => { setName(n); setNameError(null); }} choices={choices}
            setChoices={setChoices} begin={begin} error={nameError ?? scene.error} enabled={step === "make"}
            shown={making} input={input}
          />
        </div>
      )}
    </div>
  );
}

/** What the System says at each step. */
function lineFor(scene: Scene, name: string): string {
  switch (scene.step) {
    case "greet": return GREETING[scene.line]!;
    case "make": return MAKE_PROMPT;
    case "confirm": case "saving": return CONFIRM;
    case "farewell": case "out": return farewell(name);
  }
}
