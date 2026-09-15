import lottie from "lottie-web";
import type { LottieFile } from "@/lib/lottie/types";

function dedupeXmlns(markup: string): string {
  const first = markup.indexOf('xmlns="http://www.w3.org/2000/svg"');
  if (first === -1) return markup;
  const second = markup.indexOf('xmlns="http://www.w3.org/2000/svg"', first + 1);
  if (second === -1) return markup;
  return markup.slice(0, second) + markup.slice(second + 'xmlns="http://www.w3.org/2000/svg"'.length);
}

export interface RenderSource {
  canvas: HTMLCanvasElement;
  seek(frame: number): Promise<void>;
  destroy(): void;
}

/**
 * Renders via lottie-web's SVG output, rasterized per frame onto a canvas.
 * lottie-web's native canvas renderer silently drops track mattes and some
 * layer effects, which would make an export quietly wrong compared to the
 * on-screen preview - rasterizing the SVG output avoids that mismatch.
 */
export function createRenderSource(json: LottieFile, width: number, height: number): RenderSource {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:fixed;left:-99999px;top:0;opacity:0;pointer-events:none;width:${width}px;height:${height}px`;
  document.body.appendChild(host);

  const anim = lottie.loadAnimation({
    container: host,
    renderer: "svg",
    loop: false,
    autoplay: false,
    animationData: JSON.parse(JSON.stringify(json)),
    rendererSettings: { progressiveLoad: false, preserveAspectRatio: "none" },
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is not available.");

  const img = new Image();

  return {
    canvas,
    async seek(frame: number) {
      anim.goToAndStop(frame, true);
      const svg = host.querySelector("svg");
      if (!svg) throw new Error("The renderer produced no output for this frame.");
      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(height));
      svg.setAttribute("preserveAspectRatio", "none");
      if (svg.hasAttribute("xmlns")) svg.removeAttribute("xmlns");

      const markup = dedupeXmlns(new XMLSerializer().serializeToString(svg));
      const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
      try {
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () =>
            reject(new Error("A frame could not be rasterized. Check that fonts/images are embedded."));
          img.src = url;
        });
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    destroy() {
      try {
        anim.destroy();
      } catch {
        // already torn down
      }
      host.remove();
      canvas.width = 1;
      canvas.height = 1;
    },
  };
}
