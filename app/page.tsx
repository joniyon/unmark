"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UploadZone, type ParsedLottie } from "@/components/upload-zone";
import { PreviewPlayer } from "@/components/preview-player";
import { DetectionSummary } from "@/components/detection-summary";
import { ASPECT_PRESETS, CropOverlay, applyAspectPreset, type CropRect } from "@/components/crop-overlay";
import { ExportPanel } from "@/components/export-panel";
import type { LottieFile } from "@/lib/lottie/types";

export default function Home() {
  const [parsed, setParsed] = useState<ParsedLottie | null>(null);
  const [workingFile, setWorkingFile] = useState<LottieFile | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);

  const activeFile = workingFile ?? parsed?.file ?? null;

  const reset = () => {
    setParsed(null);
    setWorkingFile(null);
    setCrop(null);
  };

  const handleParsed = (result: ParsedLottie) => {
    setParsed(result);
    setWorkingFile(null);
    setCrop({ x: 0, y: 0, w: result.file.w, h: result.file.h });
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-8">
      <header className="flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight text-foreground">Unmarked</span>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-10 py-16">
        {!parsed || !activeFile || !crop ? (
          <>
            <div className="max-w-md text-center">
              <h1 className="text-2xl font-medium text-foreground">
                Remove the watermark from your Lottie file
              </h1>
              <p className="mt-2 text-sm text-foreground-muted">
                Upload your animation, we&apos;ll find the watermark layer, then export a clean
                GIF or MP4.
              </p>
            </div>
            <UploadZone onParsed={handleParsed} />
          </>
        ) : (
          <div className="grid w-full gap-6 lg:grid-cols-[1fr_1.2fr]">
            <div className="flex flex-col gap-6">
              <DetectionSummary
                file={activeFile}
                fileName={parsed.fileName}
                onStripped={setWorkingFile}
              />
              <ExportPanel file={activeFile} crop={crop} fileName={parsed.fileName} />
            </div>

            <div className="flex flex-col gap-4">
              <div
                className="glass-panel relative overflow-hidden rounded-2xl"
                style={{ aspectRatio: `${activeFile.w} / ${activeFile.h}` }}
              >
                <PreviewPlayer file={activeFile} />
                {workingFile && (
                  <CropOverlay
                    naturalWidth={activeFile.w}
                    naturalHeight={activeFile.h}
                    crop={crop}
                    onChange={setCrop}
                  />
                )}
              </div>

              {workingFile ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {ASPECT_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setCrop(applyAspectPreset(p.ratio, crop, activeFile.w, activeFile.h))}
                      className="glass-panel rounded-lg px-3 py-1.5 text-xs text-foreground-muted transition-colors hover:text-foreground"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-xs text-foreground-muted">
                  Remove the watermark to unlock cropping.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={reset}
              className="glass-panel col-span-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm text-foreground-muted transition-colors hover:text-foreground"
            >
              <RotateCcw size={14} />
              Start over
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
