"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import clsx from "clsx";
import type { LottieFile } from "@/lib/lottie/types";
import type { CropRect } from "./crop-overlay";
import { exportAnimation, MAX_EXPORT_DIMENSION, type ExportFormat } from "@/lib/export/exporter";

const RESOLUTIONS = [
  { label: "720p", maxDim: 720 },
  { label: "1080p", maxDim: MAX_EXPORT_DIMENSION },
];

export function ExportPanel({ file, crop, fileName }: { file: LottieFile; crop: CropRect; fileName: string }) {
  const [format, setFormat] = useState<ExportFormat>("mp4");
  const [maxDim, setMaxDim] = useState(MAX_EXPORT_DIMENSION);
  const [progress, setProgress] = useState<{ frame: number; totalFrames: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [download, setDownload] = useState<{
    url: string;
    format: ExportFormat;
    outW: number;
    outH: number;
    crop: CropRect;
  } | null>(null);

  const cropRatio = crop.w / crop.h;
  const outW = cropRatio >= 1 ? maxDim : Math.round(maxDim * cropRatio);
  const outH = cropRatio >= 1 ? Math.round(maxDim / cropRatio) : maxDim;

  // A previously exported file is only valid for the exact settings that produced it -
  // otherwise the button could show e.g. "Download GIF" while linking an old MP4 blob.
  const isCurrent =
    download &&
    download.format === format &&
    download.outW === outW &&
    download.outH === outH &&
    download.crop.x === crop.x &&
    download.crop.y === crop.y &&
    download.crop.w === crop.w &&
    download.crop.h === crop.h;

  const handleExport = async () => {
    setError(null);
    if (download) URL.revokeObjectURL(download.url);
    setDownload(null);
    setProgress({ frame: 0, totalFrames: 1 });
    try {
      const blob = await exportAnimation(
        file,
        { format, crop, outW, outH, fps: Math.round(file.fr) || 30 },
        (p) => setProgress({ frame: p.frame, totalFrames: p.totalFrames })
      );
      setDownload({ url: URL.createObjectURL(blob), format, outW, outH, crop });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setProgress(null);
    }
  };

  const busy = progress !== null;
  const baseName = fileName.replace(/\.json$/i, "");

  return (
    <div className="glass-panel flex flex-col gap-4 rounded-2xl p-6">
      <div className="flex gap-2">
        {(["mp4", "gif"] as ExportFormat[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFormat(f)}
            className={clsx(
              "flex-1 rounded-xl py-2 text-sm font-medium transition-colors",
              format === f ? "bg-accent text-accent-foreground" : "bg-foreground/5 text-foreground-muted"
            )}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {RESOLUTIONS.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => setMaxDim(r.maxDim)}
            className={clsx(
              "flex-1 rounded-xl py-2 text-xs font-medium transition-colors",
              maxDim === r.maxDim ? "bg-accent/15 text-accent" : "bg-foreground/5 text-foreground-muted"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-foreground-muted">
        Output {outW}&times;{outH}
      </p>

      {error && <p className="text-sm text-danger">{error}</p>}

      {progress && (
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${(progress.frame / Math.max(1, progress.totalFrames)) * 100}%` }}
            />
          </div>
          <p className="flex items-center gap-1.5 text-xs text-foreground-muted">
            <Loader2 size={12} className="animate-spin" />
            Rendering frame {progress.frame} of {progress.totalFrames}
          </p>
        </div>
      )}

      {isCurrent ? (
        <a
          href={download.url}
          download={`${baseName}-unmarked.${format}`}
          className="flex items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-medium text-accent-foreground"
        >
          <Download size={14} />
          Download {format.toUpperCase()}
        </a>
      ) : (
        <button
          type="button"
          onClick={handleExport}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {busy ? "Exporting..." : `Export ${format.toUpperCase()}`}
        </button>
      )}
    </div>
  );
}
