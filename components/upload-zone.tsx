"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, AlertTriangle, FileWarning } from "lucide-react";
import clsx from "clsx";
import { parseLottieFile, InvalidLottieError } from "@/lib/lottie/parser";
import type { LottieFile } from "@/lib/lottie/types";

const LARGE_LAYER_THRESHOLD = 50;

type ZoneState = "idle" | "dragging" | "error";

export interface ParsedLottie {
  file: LottieFile;
  fileName: string;
}

export function UploadZone({ onParsed }: { onParsed: (result: ParsedLottie) => void }) {
  const [state, setState] = useState<ZoneState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (fileList: FileList | null) => {
      const file = fileList?.[0];
      if (!file) return;

      setError(null);
      setWarning(null);

      if (!file.name.toLowerCase().endsWith(".json")) {
        setState("error");
        setError("That's not a .json file. Export your animation as Lottie JSON first.");
        return;
      }

      const raw = await file.text();

      try {
        const parsed = parseLottieFile(raw);
        if (parsed.layers.length > LARGE_LAYER_THRESHOLD) {
          setWarning(
            `This animation has ${parsed.layers.length} layers — processing may take a little longer.`
          );
        }
        setState("idle");
        onParsed({ file: parsed, fileName: file.name });
      } catch (err) {
        setState("error");
        setError(
          err instanceof InvalidLottieError
            ? err.message
            : "Couldn't read that file. Try exporting it again."
        );
      }
    },
    [onParsed]
  );

  return (
    <div className="w-full max-w-xl">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setState("dragging");
        }}
        onDragLeave={() => setState((s) => (s === "dragging" ? "idle" : s))}
        onDrop={(e) => {
          e.preventDefault();
          setState("idle");
          void handleFile(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={clsx(
          "glass-panel flex cursor-pointer flex-col items-center gap-4 rounded-3xl px-8 py-16 text-center transition-all duration-200",
          state === "dragging" && "scale-[1.01] ring-2 ring-accent/60",
          state === "error" && "ring-1 ring-danger/50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files)}
        />

        <div
          className={clsx(
            "flex h-14 w-14 items-center justify-center rounded-full transition-colors",
            state === "error" ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent"
          )}
        >
          {state === "error" ? <AlertTriangle size={24} /> : <UploadCloud size={24} />}
        </div>

        <div className="space-y-1">
          <p className="text-base font-medium text-foreground">
            {state === "dragging" ? "Drop it here" : "Drop your Lottie file here"}
          </p>
          <p className="text-sm text-foreground-muted">
            or click to browse — .json exports only
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-3 flex items-center gap-2 text-sm text-danger">
          <FileWarning size={14} />
          {error}
        </p>
      )}

      {warning && !error && (
        <p className="mt-3 flex items-center gap-2 text-sm text-foreground-muted">
          <AlertTriangle size={14} />
          {warning}
        </p>
      )}
    </div>
  );
}
