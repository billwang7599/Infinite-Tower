import { renderCharacters, currentLook } from "./characters.js";
import { el } from "./dom.js";
import { mountEditor } from "./editor/editor.js";

const TAB = "padding:6px 14px;border:0;border-bottom:2px solid transparent;background:none;color:#9a9cb0;" +
  "cursor:pointer;font:14px system-ui,sans-serif";
const tabs = el("nav", "display:flex;gap:4px;padding:12px 24px 0;border-bottom:1px solid #26283a");
const root = el("div", "max-width:1100px;margin:0 auto;padding:24px;display:flex;flex-direction:column;gap:28px");
const editorRoot = el("div", "padding:16px 24px");
editorRoot.id = "editor";
document.body.append(tabs, root, editorRoot);

const PAGES = { characters: "Characters", editor: "Pixel editor" } as const;
type Page = keyof typeof PAGES;
let editorMounted = false;

function show(page: Page): void {
  root.style.display = page === "characters" ? "flex" : "none";
  editorRoot.style.display = page === "editor" ? "block" : "none";
  if (page === "editor" && !editorMounted) {
    mountEditor(editorRoot, currentLook);
    editorMounted = true;
  }
  for (const [i, tab] of [...tabs.children].entries()) {
    const on = Object.keys(PAGES)[i] === page;
    (tab as HTMLElement).style.color = on ? "#e6e6f0" : "#9a9cb0";
    (tab as HTMLElement).style.borderBottomColor = on ? "#c9a24a" : "transparent";
  }
  history.replaceState(null, "", page === "editor" ? "#editor" : "#");
}

for (const [page, label] of Object.entries(PAGES) as [Page, string][]) {
  const tab = el("button", TAB, label);
  tab.onclick = () => show(page);
  tabs.append(tab);
}

renderCharacters(root);
show(location.hash === "#editor" ? "editor" : "characters");
