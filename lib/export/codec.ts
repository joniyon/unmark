const H264_CANDIDATES = [
  "avc1.640034",
  "avc1.640033",
  "avc1.640032",
  "avc1.64002a",
  "avc1.640028",
  "avc1.4d0032",
  "avc1.42003e",
];

export async function pickH264Config(
  width: number,
  height: number,
  fps: number,
  bitrate: number
): Promise<VideoEncoderConfig | null> {
  if (typeof VideoEncoder === "undefined") return null;

  for (const codec of H264_CANDIDATES) {
    try {
      const config: VideoEncoderConfig = {
        codec,
        width,
        height,
        framerate: fps,
        bitrate,
        avc: { format: "avc" },
        latencyMode: "quality",
      };
      const result = await VideoEncoder.isConfigSupported(config);
      if (result.supported) return result.config ?? config;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

export async function mp4ExportAvailable(): Promise<boolean> {
  if (typeof VideoEncoder === "undefined") return false;
  return (await pickH264Config(1280, 720, 30, 4_000_000)) !== null;
}
