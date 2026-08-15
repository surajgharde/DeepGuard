"use client";

import { useCallback, useEffect, useState } from "react";

interface GradCamStripProps {
  frames: string[];
}

/** Horizontal strip of Grad-CAM overlays, with a click-to-enlarge lightbox. */
export function GradCamStrip({ frames }: GradCamStripProps): JSX.Element {
  const [active, setActive] = useState<number | null>(null);

  const close = useCallback(() => setActive(null), []);

  useEffect(() => {
    if (active === null) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") setActive((i) => (i === null ? null : (i + 1) % frames.length));
      if (event.key === "ArrowLeft")
        setActive((i) => (i === null ? null : (i - 1 + frames.length) % frames.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, close, frames.length]);

  if (frames.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-panel2/40 p-6 text-center text-sm text-faint">
        No Grad-CAM frames were produced for this job.
      </p>
    );
  }

  const activeSrc = active === null ? null : frames[active];

  return (
    <>
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-3">
        {frames.map((src, index) => (
          <button
            key={src}
            type="button"
            onClick={() => setActive(index)}
            className="group relative w-52 shrink-0 snap-start overflow-hidden rounded-xl border border-line bg-black transition-all hover:border-accent/60 sm:w-60"
            aria-label={`Enlarge Grad-CAM frame ${index + 1}`}
          >
            <img
              src={src}
              alt={`Grad-CAM overlay, frame ${index + 1}`}
              className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              loading="lazy"
            />
            <span className="absolute left-2 top-2 rounded-md bg-canvas/80 px-1.5 py-0.5 font-mono text-[10px] text-muted">
              {String(index + 1).padStart(2, "0")}
            </span>
          </button>
        ))}
      </div>

      {activeSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/90 p-6 backdrop-blur-sm"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Grad-CAM frame viewer"
        >
          <div className="max-h-full w-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
            <img
              src={activeSrc}
              alt="Grad-CAM overlay, enlarged"
              className="w-full rounded-xl border border-line"
            />
            <div className="mt-3 flex items-center justify-between text-sm text-muted">
              <span className="font-mono">
                frame {(active ?? 0) + 1} / {frames.length}
              </span>
              <button
                type="button"
                onClick={close}
                className="rounded-lg border border-line px-3 py-1.5 transition-colors hover:border-line2 hover:text-fg"
              >
                Close (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
