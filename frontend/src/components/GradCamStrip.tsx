"use client";

import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/Icon";

interface GradCamStripProps {
  frames: string[];
}

/** Horizontal strip of Grad-CAM overlays, with a click-to-enlarge lightbox. */
export function GradCamStrip({ frames }: GradCamStripProps): JSX.Element {
  const [active, setActive] = useState<number | null>(null);

  const close = useCallback(() => setActive(null), []);
  const step = useCallback(
    (delta: number) =>
      setActive((index) =>
        index === null ? null : (index + delta + frames.length) % frames.length,
      ),
    [frames.length],
  );

  useEffect(() => {
    if (active === null) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [active, close, step]);

  if (frames.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-panel/50 p-10 text-center">
        <Icon name="eye" className="mx-auto h-6 w-6 text-faint" />
        <p className="mt-3 text-sm text-muted">No Grad-CAM frames were produced for this job.</p>
      </div>
    );
  }

  const activeSrc = active === null ? null : frames[active];

  return (
    <>
      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3">
        {frames.map((src, index) => (
          <button
            key={src}
            type="button"
            onClick={() => setActive(index)}
            className="group relative w-52 shrink-0 snap-start overflow-hidden rounded-xl border border-line bg-black shadow-soft transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-lift sm:w-60"
            aria-label={`Enlarge Grad-CAM frame ${index + 1} of ${frames.length}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`Grad-CAM overlay, frame ${index + 1}`}
              className="aspect-video w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
              loading="lazy"
            />
            <span className="absolute left-2 top-2 rounded-md bg-black/65 px-1.5 py-0.5 font-mono text-[10px] text-white backdrop-blur">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <Icon name="expand" className="h-5 w-5 text-white" />
            </span>
          </button>
        ))}
      </div>

      {activeSrc && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-fade-in sm:p-8"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Grad-CAM frame viewer"
        >
          <div
            className="w-full max-w-3xl animate-scale-in"
            onClick={(event) => event.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeSrc}
              alt={`Grad-CAM overlay, frame ${(active ?? 0) + 1}, enlarged`}
              className="max-h-[75vh] w-full rounded-xl border border-white/10 object-contain"
            />

            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  disabled={frames.length < 2}
                  className="btn flex h-9 w-9 rounded-lg border border-white/15 text-white/80 hover:bg-white/10 hover:text-white"
                  aria-label="Previous frame"
                >
                  <Icon name="arrow-left" className="h-4 w-4" />
                </button>
                <span className="font-mono text-sm tabular-nums text-white/70">
                  {(active ?? 0) + 1} / {frames.length}
                </span>
                <button
                  type="button"
                  onClick={() => step(1)}
                  disabled={frames.length < 2}
                  className="btn flex h-9 w-9 rounded-lg border border-white/15 text-white/80 hover:bg-white/10 hover:text-white"
                  aria-label="Next frame"
                >
                  <Icon name="arrow-right" className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={close}
                className="btn rounded-lg border border-white/15 px-3.5 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white"
              >
                Close
                <kbd className="rounded border border-white/20 px-1.5 py-0.5 font-mono text-[10px]">
                  Esc
                </kbd>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
