import "./styles.css";
import { Grid3x3 } from "lucide";
import { renderCharacters, currentLook } from "./characters.js";
import { el, icon, showTooltips } from "./dom.js";
import { mountEditor } from "./editor/editor.js";

const header = el("header", "flex h-11 flex-none items-center gap-4 border-b border-line bg-ink-850 px-3");
const brand = el("div", "flex items-center gap-2 pr-1");
const mark = el("span", "flex size-6 items-center justify-center rounded-md bg-accent-soft text-accent");
mark.append(icon(Grid3x3, 14));
brand.append(mark, el("span", "text-title font-semibold", "Art lab"));
const tabs = el("nav", "flex rounded-md border border-line bg-ink-950 p-0.5");
const editorBar = el("div", "flex min-w-0 flex-1 items-center gap-3");
header.append(brand, tabs, editorBar);

const charactersPage = el("main", "min-h-0 flex-1 overflow-y-auto");
const root = el("div", "mx-auto flex max-w-[1100px] flex-col gap-6 p-6");
charactersPage.append(root);
const editorRoot = el("main", "flex min-h-0 flex-1 flex-col");
editorRoot.id = "editor";
const app = el("div", "flex h-full flex-col");
app.append(header, charactersPage, editorRoot);
document.body.append(app);
showTooltips();

const PAGES = { characters: "Characters", editor: "Pixel editor" } as const;
type Page = keyof typeof PAGES;
let editorMounted = false;

function show(page: Page): void {
  charactersPage.hidden = page !== "characters";
  editorRoot.hidden = editorBar.hidden = page !== "editor";
  if (page === "editor" && !editorMounted) {
    mountEditor(editorRoot, editorBar, currentLook);
    editorMounted = true;
  }
  for (const [i, tab] of [...tabs.children].entries()) {
    tab.setAttribute("aria-pressed", String(Object.keys(PAGES)[i] === page));
  }
  history.replaceState(null, "", page === "editor" ? "#editor" : "#");
}

for (const [page, label] of Object.entries(PAGES) as [Page, string][]) {
  const tab = el("button", "btn btn-ghost btn-sm px-3", label);
  tab.onclick = () => show(page);
  tabs.append(tab);
}

renderCharacters(root);
show(location.hash === "#editor" ? "editor" : "characters");
