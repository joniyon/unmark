"use client";

import { CheckCircle2, CircleHelp, Eraser } from "lucide-react";
import { detectWatermarkLayers } from "@/lib/lottie/detector";
import { stripLayers } from "@/lib/lottie/stripper";
import type { LottieFile } from "@/lib/lottie/types";

export function DetectionSummary({
  file,
  fileName,
  onStripped,
}: {
  file: LottieFile;
  fileName: string;
  onStripped: (stripped: LottieFile) => void;
}) {
  const matches = detectWatermarkLayers(file);
  const detected = matches.length > 0;

  return (
    <div className="glass-panel flex flex-col gap-4 rounded-2xl p-6">
      <div>
        <p className="truncate text-sm font-medium text-foreground">{fileName}</p>
        <p className="text-xs text-foreground-muted">
          {file.layers.length} layers · {(file.op / file.fr).toFixed(1)}s
        </p>
      </div>

      <div
        className={
          detected
            ? "flex items-center gap-2 rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent"
            : "flex items-center gap-2 rounded-xl bg-foreground/5 px-4 py-3 text-sm text-foreground-muted"
        }
      >
        {detected ? <CheckCircle2 size={16} /> : <CircleHelp size={16} />}
        {detected
          ? `Watermark layer detected (${matches[0].reason})`
          : "No known watermark pattern matched — select the layer manually"}
      </div>

      {detected && (
        <button
          type="button"
          onClick={() => onStripped(stripLayers(file, matches.map((m) => m.layerIndex)))}
          className="flex items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-medium text-accent-foreground"
        >
          <Eraser size={14} />
          Remove watermark
        </button>
      )}
    </div>
  );
}
