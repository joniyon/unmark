"use client";

import { useEffect, useRef, useState } from "react";
import type { AnimationItem } from "lottie-web";
import { MousePointerClick, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LottieLayer } from "@/lib/lottie/types";

const TYPE_LABELS: Record<number, string> = {
  0: "Precomp",
  1: "Solid",
  2: "Image",
  3: "Null",
  4: "Shape",
  5: "Text",
  6: "Audio",
};

interface RendererElement {
  data?: { ind?: number };
  layerElement?: SVGGraphicsElement;
}

function getLayerElement(anim: AnimationItem | null, ind: number): SVGGraphicsElement | null {
  if (!anim) return null;
  const elements = (anim as unknown as { renderer?: { elements?: RendererElement[] } }).renderer?.elements;
  return elements?.find((el) => el.data?.ind === ind)?.layerElement ?? null;
}

function getContainer(anim: AnimationItem | null): HTMLElement | null {
  if (!anim) return null;
  return (anim as unknown as { wrapper?: HTMLElement }).wrapper ?? null;
}

export function LayerHighlightOverlay({
  anim,
  hoveredInd,
}: {
  anim: AnimationItem | null;
  hoveredInd: number | null;
}) {
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (hoveredInd === null || !anim) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing the tracked box when there is nothing to subscribe to
      setBox(null);
      return;
    }

    const track = () => {
      const container = getContainer(anim);
      const el = getLayerElement(anim, hoveredInd);
      if (container && el) {
        const cRect = container.getBoundingClientRect();
        const eRect = el.getBoundingClientRect();
        if (cRect.width > 0 && cRect.height > 0) {
          setBox({
            left: ((eRect.left - cRect.left) / cRect.width) * 100,
            top: ((eRect.top - cRect.top) / cRect.height) * 100,
            width: (eRect.width / cRect.width) * 100,
            height: (eRect.height / cRect.height) * 100,
          });
        }
      }
      rafRef.current = requestAnimationFrame(track);
    };
    rafRef.current = requestAnimationFrame(track);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [anim, hoveredInd]);

  if (!box) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="absolute rounded-sm ring-2 ring-primary bg-primary/15 transition-[left,top,width,height] duration-75"
        style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}
      />
    </div>
  );
}

export function LayerListPanel({
  layers,
  hoveredInd,
  onHover,
  onSelect,
  onCancel,
}: {
  layers: LottieLayer[];
  hoveredInd: number | null;
  onHover: (ind: number | null) => void;
  onSelect: (ind: number) => void;
  onCancel: () => void;
}) {
  return (
    <div className="glass-panel flex flex-col gap-3 rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <MousePointerClick size={14} />
          Select the watermark layer
        </p>
        <button type="button" onClick={onCancel} aria-label="Cancel" className="text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Hover a layer to highlight it on the preview, then click to remove it.
      </p>
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {layers.map((layer) => (
          <button
            key={layer.ind}
            type="button"
            onMouseEnter={() => onHover(layer.ind)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onSelect(layer.ind)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
              hoveredInd === layer.ind ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-foreground/5"
            )}
          >
            <span>{layer.nm || `Layer ${layer.ind}`}</span>
            <span className="text-xs text-muted-foreground">{TYPE_LABELS[layer.ty] ?? `Type ${layer.ty}`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
