"use client";

import { useEffect, useRef } from "react";
import lottie, { type AnimationItem } from "lottie-web";
import type { LottieFile } from "@/lib/lottie/types";

export function PreviewPlayer({
  file,
  onReady,
}: {
  file: LottieFile;
  onReady?: (anim: AnimationItem | null) => void;
}) {
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
    onReady?.(animRef.current);

    return () => {
      animRef.current?.destroy();
      onReady?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onReady is a stable setter passed by the parent
  }, [file]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
