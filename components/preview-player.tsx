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

  return <div ref={containerRef} className="absolute inset-0" />;
}
