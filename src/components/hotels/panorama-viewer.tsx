"use client";

import { useRef, useState } from "react";
import { Maximize2, RotateCw, X } from "lucide-react";

interface PanoramaViewerProps {
  src: string;
  title?: string;
}

export function PanoramaViewer({ src, title = "Visite 360°" }: PanoramaViewerProps) {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startOffset = useRef(0);

  const begin = (clientX: number) => {
    dragging.current = true;
    startX.current = clientX;
    startOffset.current = offset;
  };

  const move = (clientX: number) => {
    if (!dragging.current) return;
    setOffset(startOffset.current + (clientX - startX.current) * 0.45);
  };

  const end = () => {
    dragging.current = false;
  };

  const style = {
    backgroundImage: `url("${src}")`,
    backgroundPositionX: `calc(50% + ${offset}px)`,
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative h-20 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-left shadow-sm"
        aria-label={`Ouvrir ${title}`}
      >
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${src}")` }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/10" />
        <span className="absolute bottom-2 left-3 text-xs font-semibold text-white">🌐 Voir la chambre en 360°</span>
        <Maximize2 className="absolute right-3 top-3 h-4 w-4 text-white" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[140] bg-black/95 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
          <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-slate-950">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="text-[11px] text-white/60">Faites glisser horizontalement pour explorer</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-white hover:bg-white/10" aria-label="Fermer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div
              className="relative flex-1 cursor-grab select-none overflow-hidden active:cursor-grabbing"
              style={style}
              onMouseDown={(e) => begin(e.clientX)}
              onMouseMove={(e) => move(e.clientX)}
              onMouseUp={end}
              onMouseLeave={end}
              onTouchStart={(e) => begin(e.touches[0].clientX)}
              onTouchMove={(e) => move(e.touches[0].clientX)}
              onTouchEnd={end}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/20 pointer-events-none" />
              <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/55 px-4 py-2 text-xs text-white backdrop-blur">
                <RotateCw className="h-4 w-4" /> Glissez pour tourner
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
