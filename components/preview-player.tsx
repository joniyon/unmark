"use client";

import { useEffect, useRef } from "react";
import lottie, { type AnimationItem } from "lottie-web";
import type { LottieFile } from "@/lib/lottie/types";

export function PreviewPlayer({ file }: { file: LottieFile }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    animRef.current = lottie.loadAnimation({
      container: containerRef.current,
      renderer: "svg",
      loop: true,
      autoplay: true,
      animationData: file,
    });

    return () => {
      animRef.current?.destroy();
    };
  }, [file]);

  return (
    <div className="glass-panel flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl p-4">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
