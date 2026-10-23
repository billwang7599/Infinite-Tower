/** The field's DOM overlay: level name, fights won, and the controls hint. Only touches the DOM on change. */
export function createFieldHud(root: HTMLElement): (levelName: string, wins: number) => void {
  let last = "";
  return (levelName, wins) => {
    const html = `${levelName} &nbsp;·&nbsp; boars defeated: ${wins}`
      + `<br><small class="text-[13px] font-normal opacity-80">WASD / arrows to walk · touch a boar or walk through the tall grass to fight</small>`;
    if (html !== last) { root.innerHTML = html; last = html; }
  };
}
