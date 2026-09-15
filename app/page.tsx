"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UploadZone, type ParsedLottie } from "@/components/upload-zone";
import { PreviewPlayer } from "@/components/preview-player";
import { DetectionSummary } from "@/components/detection-summary";

export default function Home() {
  const [parsed, setParsed] = useState<ParsedLottie | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-8">
      <header className="flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight text-foreground">Unmarked</span>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-10 py-16">
        {!parsed ? (
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
            <UploadZone onParsed={setParsed} />
          </>
        ) : (
          <div className="grid w-full gap-6 sm:grid-cols-[1fr_1.2fr]">
            <DetectionSummary file={parsed.file} fileName={parsed.fileName} />
            <PreviewPlayer file={parsed.file} />
            <button
              type="button"
              onClick={() => setParsed(null)}
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
