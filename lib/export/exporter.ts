import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import type { LottieFile } from "@/lib/lottie/types";
import { createRenderSource } from "./render-source";
import { pickH264Config } from "./codec";
import { encodeGif } from "./gif-encoder";

export type ExportFormat = "mp4" | "gif";

export const MAX_EXPORT_DIMENSION = 1080;

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ExportOptions {
  format: ExportFormat;
  crop: CropRect;
  outW: number;
  outH: number;
  fps: number;
  bitrateMbps?: number;
}

export interface ExportProgress {
  frame: number;
  totalFrames: number;
  stage: string;
}

const idle = () => new Promise((r) => setTimeout(r, 0));

function buildFrameDrawer(json: LottieFile, options: ExportOptions) {
  const sourceFrames = Math.max(1, Math.round(json.op - json.ip));
  const totalOutFrames = Math.max(1, Math.round((sourceFrames / json.fr) * options.fps));

  const renderScale = Math.min(4, Math.max(1, options.outW / Math.max(1, options.crop.w)));
  const srcW = Math.round(json.w * renderScale);
  const srcH = Math.round(json.h * renderScale);
  const source = createRenderSource(json, srcW, srcH);

  const outCanvas = document.createElement("canvas");
  outCanvas.width = options.outW;
  outCanvas.height = options.outH;
  const ctx = outCanvas.getContext("2d", { willReadFrequently: options.format === "gif" });
  if (!ctx) throw new Error("Canvas 2D context is not available.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const sx = options.crop.x * renderScale;
  const sy = options.crop.y * renderScale;
  const sw = options.crop.w * renderScale;
  const sh = options.crop.h * renderScale;

  return {
    totalOutFrames,
    canvas: outCanvas,
    async drawFrame(i: number) {
      const t = i / options.fps;
      const frame = Math.min(sourceFrames - 0.001, t * json.fr);
      await source.seek(frame);
      ctx.clearRect(0, 0, options.outW, options.outH);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, options.outW, options.outH);
      ctx.drawImage(source.canvas, sx, sy, sw, sh, 0, 0, options.outW, options.outH);
    },
    dispose() {
      source.destroy();
      outCanvas.width = 1;
      outCanvas.height = 1;
    },
  };
}

async function exportMp4(
  json: LottieFile,
  options: ExportOptions,
  onProgress?: (p: ExportProgress) => void,
  isCancelled?: () => boolean
): Promise<Blob> {
  const bitrate = Math.round((options.bitrateMbps ?? 6) * 1_000_000);
  const config = await pickH264Config(options.outW, options.outH, options.fps, bitrate);
  if (!config) {
    throw new Error("This browser can't encode H.264 video. Try exporting as GIF instead.");
  }

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: options.outW, height: options.outH, frameRate: options.fps },
    fastStart: "in-memory",
  });

  let encodeError: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      try {
        muxer.addVideoChunk(chunk, meta);
      } catch (e) {
        encodeError = e;
      }
    },
    error: (e) => {
      encodeError = e;
    },
  });
  encoder.configure(config);

  const pipe = buildFrameDrawer(json, options);
  const gop = Math.max(1, Math.round(options.fps * 2));
  const usPerFrame = 1_000_000 / options.fps;
  let closed = false;

  try {
    for (let i = 0; i < pipe.totalOutFrames; i++) {
      if (isCancelled?.()) break;
      if (encodeError) throw encodeError;

      await pipe.drawFrame(i);
      const frame = new VideoFrame(pipe.canvas, {
        timestamp: Math.round(i * usPerFrame),
        duration: Math.round(usPerFrame),
      });
      encoder.encode(frame, { keyFrame: i % gop === 0 });
      frame.close();

      while (encoder.encodeQueueSize > 6 && !isCancelled?.()) await idle();
      onProgress?.({ frame: i + 1, totalFrames: pipe.totalOutFrames, stage: "Rendering" });
      await idle();
    }

    if (isCancelled?.()) {
      closed = true;
      encoder.close();
      throw new Error("Export cancelled.");
    }

    onProgress?.({ frame: pipe.totalOutFrames, totalFrames: pipe.totalOutFrames, stage: "Finishing" });
    await encoder.flush();
    closed = true;
    encoder.close();
    if (encodeError) throw encodeError;

    muxer.finalize();
    const buffer = muxer.target.buffer;
    if (!buffer || buffer.byteLength < 1024) throw new Error("The encoder produced an empty file.");
    return new Blob([buffer], { type: "video/mp4" });
  } finally {
    if (!closed) {
      try {
        encoder.close();
      } catch {
        // already closed
      }
    }
    pipe.dispose();
  }
}

async function exportGifFile(
  json: LottieFile,
  options: ExportOptions,
  onProgress?: (p: ExportProgress) => void
): Promise<Blob> {
  const pipe = buildFrameDrawer(json, options);
  const ctx = pipe.canvas.getContext("2d")!;

  try {
    return await encodeGif({
      width: options.outW,
      height: options.outH,
      frameCount: pipe.totalOutFrames,
      fps: options.fps,
      drawFrame: async (i) => {
        await pipe.drawFrame(i);
        return ctx.getImageData(0, 0, options.outW, options.outH);
      },
      onProgress: (frame, totalFrames) => onProgress?.({ frame, totalFrames, stage: "Encoding" }),
    });
  } finally {
    pipe.dispose();
  }
}

export async function exportAnimation(
  json: LottieFile,
  options: ExportOptions,
  onProgress?: (p: ExportProgress) => void,
  isCancelled?: () => boolean
): Promise<Blob> {
  const outW = Math.min(MAX_EXPORT_DIMENSION, Math.round(options.outW));
  const outH = Math.min(MAX_EXPORT_DIMENSION, Math.round(options.outH));
  const clamped = { ...options, outW, outH };

  return clamped.format === "mp4"
    ? exportMp4(json, clamped, onProgress, isCancelled)
    : exportGifFile(json, clamped, onProgress);
}
