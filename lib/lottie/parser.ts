import type { LottieFile } from "./types";

export class InvalidLottieError extends Error {}

export function parseLottieFile(raw: string): LottieFile {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new InvalidLottieError("File is not valid JSON.");
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("v" in data) ||
    !("layers" in data) ||
    !Array.isArray((data as { layers: unknown }).layers)
  ) {
    throw new InvalidLottieError("File does not match the Lottie schema.");
  }

  return data as LottieFile;
}
