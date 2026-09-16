"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Handle = "move" | "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

const MIN_SIZE = 24;
const SNAP_TOLERANCE_RATIO = 0.015;

export const ASPECT_PRESETS: { label: string; ratio: number | null }[] = [
  { label: "Original", ratio: null },
  { label: "1:1", ratio: 1 },
  { label: "9:16", ratio: 9 / 16 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "4:5", ratio: 4 / 5 },
];

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function snap(value: number, extent: number, tol: number): number {
  const targets = [0, extent / 3, extent / 2, (2 * extent) / 3, extent];
  for (const t of targets) {
    if (Math.abs(value - t) < tol) return t;
  }
  return value;
}

export function applyAspectPreset(
  ratio: number | null,
  crop: CropRect,
  naturalWidth: number,
  naturalHeight: number
): CropRect {
  if (ratio === null) return { x: 0, y: 0, w: naturalWidth, h: naturalHeight };

  const cx = crop.x + crop.w / 2;
  const cy = crop.y + crop.h / 2;
  let w = crop.w;
  let h = w / ratio;
  if (h > naturalHeight) {
    h = naturalHeight;
    w = h * ratio;
  }
  if (w > naturalWidth) {
    w = naturalWidth;
    h = w / ratio;
  }
  const x = clamp(cx - w / 2, 0, naturalWidth - w);
  const y = clamp(cy - h / 2, 0, naturalHeight - h);
  return { x, y, w, h };
}

const HANDLES: Handle[] = ["n", "s", "e", "w", "nw", "ne", "sw", "se"];
const CURSOR_FOR: Record<Handle, string> = {
  move: "move",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
};

export function CropOverlay({
  naturalWidth,
  naturalHeight,
  crop,
  onChange,
}: {
  naturalWidth: number;
  naturalHeight: number;
  crop: CropRect;
  onChange: (crop: CropRect) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    handle: Handle;
    startX: number;
    startY: number;
    crop0: CropRect;
    pointerId: number;
  } | null>(null);

  const toSourceScale = useCallback(() => {
    const el = containerRef.current;
    if (!el) return 1;
    return naturalWidth / el.getBoundingClientRect().width;
  }, [naturalWidth]);

  const beginDrag = useCallback(
    (e: React.PointerEvent, handle: Handle) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = { handle, startX: e.clientX, startY: e.clientY, crop0: crop, pointerId: e.pointerId };
      (e.target as Element).setPointerCapture(e.pointerId);
    },
    [crop]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;

      const scale = toSourceScale();
      const dx = (e.clientX - drag.startX) * scale;
      const dy = (e.clientY - drag.startY) * scale;
      const c0 = drag.crop0;
      const tolX = naturalWidth * SNAP_TOLERANCE_RATIO;
      const tolY = naturalHeight * SNAP_TOLERANCE_RATIO;

      let next: CropRect;

      if (drag.handle === "move") {
        let x = clamp(c0.x + dx, 0, naturalWidth - c0.w);
        let y = clamp(c0.y + dy, 0, naturalHeight - c0.h);
        x = snap(x, naturalWidth - c0.w, tolX);
        y = snap(y, naturalHeight - c0.h, tolY);
        next = { x, y, w: c0.w, h: c0.h };
      } else {
        const h = drag.handle;
        let x1 = c0.x;
        let y1 = c0.y;
        let x2 = c0.x + c0.w;
        let y2 = c0.y + c0.h;

        if (h.includes("w")) x1 = clamp(snap(c0.x + dx, naturalWidth, tolX), 0, x2 - MIN_SIZE);
        if (h.includes("e")) x2 = clamp(snap(c0.x + c0.w + dx, naturalWidth, tolX), x1 + MIN_SIZE, naturalWidth);
        if (h.includes("n")) y1 = clamp(snap(c0.y + dy, naturalHeight, tolY), 0, y2 - MIN_SIZE);
        if (h.includes("s")) y2 = clamp(snap(c0.y + c0.h + dy, naturalHeight, tolY), y1 + MIN_SIZE, naturalHeight);

        next = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
      }

      onChange(next);
    },
    [naturalWidth, naturalHeight, onChange, toSourceScale]
  );

  const endDrag = useCallback((e: React.PointerEvent) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  }, []);

  const pct = (v: number, extent: number) => `${(v / extent) * 100}%`;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 select-none"
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
    >
      <div
        onPointerDown={(e) => beginDrag(e, "move")}
        className="absolute cursor-move ring-2 ring-primary"
        style={{
          left: pct(crop.x, naturalWidth),
          top: pct(crop.y, naturalHeight),
          width: pct(crop.w, naturalWidth),
          height: pct(crop.h, naturalHeight),
          boxShadow: "0 0 0 2000px rgba(9,10,13,0.55)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute left-1/3 top-0 h-full w-px bg-white" />
          <div className="absolute left-2/3 top-0 h-full w-px bg-white" />
          <div className="absolute left-0 top-1/3 h-px w-full bg-white" />
          <div className="absolute left-0 top-2/3 h-px w-full bg-white" />
        </div>
        {HANDLES.map((h) => (
          <div
            key={h}
            onPointerDown={(e) => beginDrag(e, h)}
            className={cn(
              "absolute h-3 w-3 rounded-full border-2 border-primary bg-white",
              h.includes("n") && "-top-1.5",
              h.includes("s") && "-bottom-1.5",
              h.includes("w") && "-left-1.5",
              h.includes("e") && "-right-1.5",
              !h.includes("n") && !h.includes("s") && "top-1/2 -translate-y-1/2",
              !h.includes("e") && !h.includes("w") && "left-1/2 -translate-x-1/2"
            )}
            style={{ cursor: CURSOR_FOR[h] }}
          />
        ))}
      </div>
    </div>
  );
}
