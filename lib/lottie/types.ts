export interface LottieAsset {
  id: string;
  w?: number;
  h?: number;
  u?: string;
  p?: string;
  e?: number;
  layers?: LottieLayer[];
}

export interface LottieLayer {
  ind: number;
  ty: number;
  nm?: string;
  parent?: number;
  refId?: string;
  [key: string]: unknown;
}

export interface LottieFile {
  v: string;
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  nm?: string;
  assets: LottieAsset[];
  layers: LottieLayer[];
  [key: string]: unknown;
}

export interface WatermarkMatch {
  layerIndex: number;
  confidence: "high" | "low";
  reason: string;
}
