export type ExportFormat = "gif" | "mp4";

export interface ExportOptions {
  format: ExportFormat;
  height: number; // capped at 1080
}

export interface ExportProgress {
  frame: number;
  totalFrames: number;
}

export async function exportAnimation(
  _canvas: HTMLCanvasElement,
  _options: ExportOptions,
  _onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  throw new Error("exportAnimation not yet implemented");
}
