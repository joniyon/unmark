function buildPalette(
  histCount: Int32Array,
  histR: Float64Array,
  histG: Float64Array,
  histB: Float64Array,
  maxColors: number
): number[][] {
  const boxes: number[][] = [[]];
  for (let i = 0; i < 32768; i++) if (histCount[i]) boxes[0].push(i);
  if (!boxes[0].length) return [[0, 0, 0]];

  const range = (box: number[]) => {
    const mn = [255, 255, 255];
    const mx = [0, 0, 0];
    for (const b of box) {
      const c = histCount[b];
      const v = [histR[b] / c, histG[b] / c, histB[b] / c];
      for (let j = 0; j < 3; j++) {
        if (v[j] < mn[j]) mn[j] = v[j];
        if (v[j] > mx[j]) mx[j] = v[j];
      }
    }
    return [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
  };

  while (boxes.length < maxColors) {
    let bi = -1;
    let bs = 0;
    let bc = 0;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue;
      const r = range(boxes[i]);
      const s = Math.max(r[0], r[1], r[2]);
      let n = 0;
      for (const px of boxes[i]) n += histCount[px];
      const score = s * Math.log(n + 1);
      if (score > bs) {
        bs = score;
        bi = i;
        bc = r.indexOf(s);
      }
    }
    if (bi < 0) break;

    const box = boxes[bi];
    box.sort((a, b) => {
      const ca = histCount[a];
      const cb = histCount[b];
      const va = bc === 0 ? histR[a] / ca : bc === 1 ? histG[a] / ca : histB[a] / ca;
      const vb = bc === 0 ? histR[b] / cb : bc === 1 ? histG[b] / cb : histB[b] / cb;
      return va - vb;
    });
    let total = 0;
    for (const px of box) total += histCount[px];
    let acc = 0;
    let cut = 1;
    for (let k = 0; k < box.length - 1; k++) {
      acc += histCount[box[k]];
      if (acc >= total / 2) {
        cut = k + 1;
        break;
      }
    }
    boxes.splice(bi, 1, box.slice(0, cut), box.slice(cut));
  }

  return boxes.map((box) => {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (const px of box) {
      r += histR[px];
      g += histG[px];
      b += histB[px];
      n += histCount[px];
    }
    return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : [0, 0, 0];
  });
}

function nearestTable(palette: number[][]): Uint8Array {
  const table = new Uint8Array(32768);
  for (let i = 0; i < 32768; i++) {
    const r = ((i >> 10) & 31) * 8 + 4;
    const g = ((i >> 5) & 31) * 8 + 4;
    const b = (i & 31) * 8 + 4;
    let best = 0;
    let bd = Infinity;
    for (let p = 0; p < palette.length; p++) {
      const dr = r - palette[p][0];
      const dg = g - palette[p][1];
      const db = b - palette[p][2];
      const d = dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    table[i] = best;
  }
  return table;
}

class ByteWriter {
  private parts: Uint8Array[] = [];
  private buf = new Uint8Array(65536);
  private n = 0;

  u8(v: number) {
    if (this.n === this.buf.length) {
      this.parts.push(this.buf);
      this.buf = new Uint8Array(65536);
      this.n = 0;
    }
    this.buf[this.n++] = v & 255;
  }
  u16(v: number) {
    this.u8(v);
    this.u8(v >> 8);
  }
  str(s: string) {
    for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i));
  }
  done(): Uint8Array[] {
    this.parts.push(this.buf.subarray(0, this.n));
    return this.parts;
  }
}

function lzwEncode(w: ByteWriter, indices: Uint8Array, minCodeSize: number) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let next = eoiCode + 1;
  let dict = new Map<number, number>();
  let cur = 0;
  let bits = 0;
  const block: number[] = [];

  const flushBlock = () => {
    if (!block.length) return;
    w.u8(block.length);
    for (const b of block) w.u8(b);
    block.length = 0;
  };
  const emit = (code: number) => {
    cur |= code << bits;
    bits += codeSize;
    while (bits >= 8) {
      block.push(cur & 255);
      cur >>= 8;
      bits -= 8;
      if (block.length === 255) flushBlock();
    }
  };

  emit(clearCode);
  let prev = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = prev * 4096 + k;
    const found = dict.get(key);
    if (found !== undefined) {
      prev = found;
      continue;
    }
    emit(prev);
    if (next < 4096) {
      dict.set(key, next++);
      if (next - 1 === 1 << codeSize && codeSize < 12) codeSize++;
    } else {
      emit(clearCode);
      dict = new Map();
      next = eoiCode + 1;
      codeSize = minCodeSize + 1;
    }
    prev = k;
  }
  emit(prev);
  emit(eoiCode);
  if (bits > 0) {
    block.push(cur & 255);
    if (block.length === 255) flushBlock();
  }
  flushBlock();
  w.u8(0);
}

export interface GifEncoderOptions {
  width: number;
  height: number;
  frameCount: number;
  fps: number;
  drawFrame: (index: number) => Promise<ImageData>;
  onProgress?: (done: number, total: number) => void;
}

export async function encodeGif({
  width,
  height,
  frameCount,
  fps,
  drawFrame,
  onProgress,
}: GifEncoderOptions): Promise<Blob> {
  if (width * height > 4.2e6) {
    throw new Error("That frame size is too large for GIF export. Choose a smaller output size.");
  }

  const histCount = new Int32Array(32768);
  const histR = new Float64Array(32768);
  const histG = new Float64Array(32768);
  const histB = new Float64Array(32768);

  const sampleN = Math.min(frameCount, 18);
  for (let s = 0; s < sampleN; s++) {
    const i = Math.round((s * (frameCount - 1)) / Math.max(1, sampleN - 1));
    const data = (await drawFrame(i)).data;
    const step = Math.max(4, Math.floor((width * height) / 90000) * 4);
    for (let p = 0; p < data.length; p += step) {
      const bin = ((data[p] >> 3) << 10) | ((data[p + 1] >> 3) << 5) | (data[p + 2] >> 3);
      histCount[bin]++;
      histR[bin] += data[p];
      histG[bin] += data[p + 1];
      histB[bin] += data[p + 2];
    }
    onProgress?.(s, frameCount);
    await new Promise((r) => setTimeout(r, 0));
  }

  const palette = buildPalette(histCount, histR, histG, histB, 256);
  const table = nearestTable(palette);
  let bitsPerPixel = 1;
  while (1 << bitsPerPixel < palette.length && bitsPerPixel < 8) bitsPerPixel++;
  const tableSize = 1 << bitsPerPixel;

  const w = new ByteWriter();
  w.str("GIF89a");
  w.u16(width);
  w.u16(height);
  w.u8(0xf0 | (bitsPerPixel - 1));
  w.u8(0);
  w.u8(0);
  for (let i = 0; i < tableSize; i++) {
    const c = palette[i] ?? [0, 0, 0];
    w.u8(c[0]);
    w.u8(c[1]);
    w.u8(c[2]);
  }
  w.u8(0x21);
  w.u8(0xff);
  w.u8(11);
  w.str("NETSCAPE2.0");
  w.u8(3);
  w.u8(1);
  w.u16(0);
  w.u8(0);

  const delay = Math.max(2, Math.round(100 / fps));
  const indices = new Uint8Array(width * height);

  for (let i = 0; i < frameCount; i++) {
    const data = (await drawFrame(i)).data;
    for (let p = 0, q = 0; q < indices.length; p += 4, q++) {
      indices[q] = table[((data[p] >> 3) << 10) | ((data[p + 1] >> 3) << 5) | (data[p + 2] >> 3)];
    }
    w.u8(0x21);
    w.u8(0xf9);
    w.u8(4);
    w.u8(0x04);
    w.u16(delay);
    w.u8(0);
    w.u8(0);
    w.u8(0x2c);
    w.u16(0);
    w.u16(0);
    w.u16(width);
    w.u16(height);
    w.u8(0);
    const minCodeSize = Math.max(2, bitsPerPixel);
    w.u8(minCodeSize);
    lzwEncode(w, indices, minCodeSize);
    onProgress?.(i + 1, frameCount);
    await new Promise((r) => setTimeout(r, 0));
  }
  w.u8(0x3b);

  return new Blob(w.done() as BlobPart[], { type: "image/gif" });
}
