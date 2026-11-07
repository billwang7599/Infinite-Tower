import { useEffect, useRef, useState, type ReactNode } from "react";
import { CloseButton } from "../components/CloseButton.js";
import { PANEL_HEAD, PANEL_TITLE } from "../components/styles.js";
import { fitPanel, useStageSize, type Size } from "./layout.js";

interface FrameProps {
  id: string;
  title: string;
  titleId?: string;
  close: () => void;
  /** In pixels; left out, the content's own width. */
  width?: number;
  shownWidth?: (px: number) => void;
  children: ReactNode;
}

export function PanelFrame({ id, title, titleId, close, width, shownWidth, children }: FrameProps) {
  const frame = useRef<HTMLElement>(null);
  const view = useStageSize();
  const [size, setSize] = useState<Size | null>(null);
  useEffect(() => {
    const el = frame.current!;
    // offsetWidth / offsetHeight are the size before the scale, so shrinking doesn't feed back into the fit.
    const observer = new ResizeObserver(() => setSize({ width: el.offsetWidth, height: el.offsetHeight }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const fit = size && fitPanel(size, view);
  useEffect(() => {
    if (fit && size) shownWidth?.(size.width * fit.scale);
  }, [fit?.scale, size?.width]);

  return (
    <section
      ref={frame} id={id} aria-label={title} data-scale={fit?.scale ?? 1}
      style={{
        width, top: fit?.top, right: fit?.right, transform: fit ? `scale(${fit.scale})` : undefined,
        visibility: fit ? undefined : "hidden",
      }}
      className="absolute w-max origin-top-right cut-14 engraved px-6 py-5 font-normal"
    >
      <header className={`mb-3 ${PANEL_HEAD}`}>
        <h2 id={titleId} className={PANEL_TITLE}>{title}</h2>
        <CloseButton close={close} />
      </header>
      {children}
    </section>
  );
}
