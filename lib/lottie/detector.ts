import type { LottieFile, WatermarkMatch } from "./types";

interface WatermarkSignature {
  name: string;
  matchLayerName?: RegExp;
  matchAssetPath?: RegExp;
}

const KNOWN_SIGNATURES: WatermarkSignature[] = [];

export function detectWatermarkLayers(file: LottieFile): WatermarkMatch[] {
  const matches: WatermarkMatch[] = [];

  for (const layer of file.layers) {
    for (const signature of KNOWN_SIGNATURES) {
      if (signature.matchLayerName?.test(layer.nm ?? "")) {
        matches.push({
          layerIndex: layer.ind,
          confidence: "high",
          reason: `Matched known signature: ${signature.name}`,
        });
      }
    }
  }

  return matches;
}
