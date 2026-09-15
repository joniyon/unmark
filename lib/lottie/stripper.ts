import type { LottieFile } from "./types";

export function stripLayers(file: LottieFile, layerIndexes: number[]): LottieFile {
  const toRemove = new Set(layerIndexes);
  const removedRefIds = new Set(
    file.layers.filter((l) => toRemove.has(l.ind) && l.refId).map((l) => l.refId as string)
  );

  const remainingLayers = file.layers.filter((l) => !toRemove.has(l.ind));

  const usedRefIds = new Set(remainingLayers.map((l) => l.refId).filter(Boolean));
  const remainingAssets = file.assets.filter(
    (a) => !removedRefIds.has(a.id) || usedRefIds.has(a.id)
  );

  return {
    ...file,
    layers: remainingLayers,
    assets: remainingAssets,
  };
}
