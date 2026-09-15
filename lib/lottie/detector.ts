import type { LottieAsset, LottieFile, LottieLayer, LottieShapeItem, WatermarkMatch } from "./types";

interface WatermarkSignature {
  name: string;
  matchLayerName?: RegExp;
}

const KNOWN_SIGNATURES: WatermarkSignature[] = [];

const CORNER_MARGIN = 0.35;
const MIN_PATH_SHAPES = 8;
const CANDIDATE_LAYER_SCAN = 3;

function shapeStats(shapes: LottieShapeItem[] | undefined): { pathCount: number; hasDarkFill: boolean } {
  let pathCount = 0;
  let hasDarkFill = false;

  const walk = (items: LottieShapeItem[] | undefined) => {
    for (const item of items ?? []) {
      if (item.ty === "gr") {
        walk(item.it);
      } else if (item.ty === "sh") {
        pathCount++;
      } else if (item.ty === "fl") {
        const k = item.c?.k;
        if (Array.isArray(k) && k.length >= 3 && typeof k[0] === "number") {
          const [r, g, b] = k as number[];
          if (r < 0.2 && g < 0.2 && b < 0.2) hasDarkFill = true;
        }
      }
    }
  };

  walk(shapes);
  return { pathCount, hasDarkFill };
}

function resolveShapeStats(
  refId: string | undefined,
  assetsById: Map<string, LottieAsset>,
  visited: Set<string>
): { pathCount: number; hasDarkFill: boolean } {
  if (!refId || visited.has(refId)) return { pathCount: 0, hasDarkFill: false };
  visited.add(refId);

  const asset = assetsById.get(refId);
  if (!asset?.layers) return { pathCount: 0, hasDarkFill: false };

  let pathCount = 0;
  let hasDarkFill = false;

  for (const layer of asset.layers) {
    const own = shapeStats((layer as { shapes?: LottieShapeItem[] }).shapes);
    pathCount += own.pathCount;
    hasDarkFill = hasDarkFill || own.hasDarkFill;

    if (layer.refId) {
      const nested = resolveShapeStats(layer.refId, assetsById, visited);
      pathCount += nested.pathCount;
      hasDarkFill = hasDarkFill || nested.hasDarkFill;
    }
  }

  return { pathCount, hasDarkFill };
}

function staticPosition(layer: LottieLayer | undefined): [number, number] {
  const p = (layer?.ks as { p?: { k?: unknown } } | undefined)?.p?.k;
  if (Array.isArray(p) && typeof p[0] === "number") return [p[0], p[1] as number];
  return [0, 0];
}

function resolvedPosition(layer: LottieLayer, layersById: Map<number, LottieLayer>): [number, number] {
  let [x, y] = staticPosition(layer);
  let current = layer;
  const seen = new Set<number>();

  while (typeof current.parent === "number" && !seen.has(current.parent)) {
    seen.add(current.parent);
    const parent = layersById.get(current.parent);
    if (!parent) break;
    const [px, py] = staticPosition(parent);
    x += px;
    y += py;
    current = parent;
  }

  return [x, y];
}

function isNearCorner(x: number, y: number, w: number, h: number): boolean {
  if (!w || !h) return false;
  const xn = x / w;
  const yn = y / h;
  const xEdge = xn < CORNER_MARGIN || xn > 1 - CORNER_MARGIN;
  const yEdge = yn < CORNER_MARGIN || yn > 1 - CORNER_MARGIN;
  return xEdge && yEdge;
}

/**
 * Many export tools strip layer names, so name matching alone misses their
 * watermark. Free-tier badges share a structural fingerprint instead: an
 * always-on-top layer (topmost in the stack) resolving to a dark rect plus
 * a shape group built from many vector paths (text converted to outlines),
 * sitting near a canvas corner.
 */
function detectStructuralWatermark(file: LottieFile): WatermarkMatch[] {
  const assetsById = new Map(file.assets.map((a) => [a.id, a]));
  const layersById = new Map(file.layers.map((l) => [l.ind, l]));
  const matches: WatermarkMatch[] = [];

  for (const layer of file.layers.slice(0, CANDIDATE_LAYER_SCAN)) {
    if (!layer.refId) continue;

    const { pathCount, hasDarkFill } = resolveShapeStats(layer.refId, assetsById, new Set());
    if (pathCount < MIN_PATH_SHAPES || !hasDarkFill) continue;

    const [x, y] = resolvedPosition(layer, layersById);
    if (!isNearCorner(x, y, file.w, file.h)) continue;

    matches.push({
      layerIndex: layer.ind,
      confidence: "high",
      reason: `Corner badge with ${pathCount} vector paths (likely watermark text) over a dark fill`,
    });
  }

  return matches;
}

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

  if (matches.length === 0) {
    matches.push(...detectStructuralWatermark(file));
  }

  return matches;
}
