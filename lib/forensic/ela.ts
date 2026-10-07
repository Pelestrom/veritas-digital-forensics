/**
 * Error Level Analysis (ELA) — client-side via the browser Canvas API.
 *
 * Why client-side: Cloudflare Workers (the production runtime for server
 * functions) do not ship node-canvas or sharp, so server-side image
 * re-encoding is not portable. The browser's Canvas + toBlob('image/jpeg')
 * gives us a real JPEG round-trip at zero cost.
 *
 * Method:
 *  1. Decode the source image into an offscreen canvas.
 *  2. Re-encode at a known quality (default 0.85) → JPEG #2.
 *  3. Decode JPEG #2 and compute per-pixel |Δ| against the source.
 *  4. Aggregate: mean Δ, % of pixels above hotspot threshold, max Δ.
 *
 * Returns a numeric score (0..100, higher = closer to single-save image),
 * a hotspot ratio, and anomalies when the image looks recompressed in
 * inconsistent regions (classic splice / overlay signature).
 */

import type { Anomaly } from "./types";

export interface ElaResult {
  score: number;
  meanDelta: number;
  maxDelta: number;
  hotspotRatio: number;
  anomalies: Anomaly[];
  /** Data-URL preview (small) for the report — null if unsupported. */
  previewDataUrl: string | null;
}

const QUALITY = 0.85;
const HOTSPOT_THRESHOLD = 35; // 0..255 channel delta
const PREVIEW_MAX = 320;

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image decode failed"));
      img.src = url;
    });
  } finally {
    // Revoked after image is loaded into a canvas downstream.
    setTimeout(() => URL.revokeObjectURL(url), 5_000);
  }
}

function canvasFromImage(img: HTMLImageElement, maxDim?: number): HTMLCanvasElement {
  let { width, height } = img;
  if (maxDim && Math.max(width, height) > maxDim) {
    const r = maxDim / Math.max(width, height);
    width = Math.round(width * r);
    height = Math.round(height * r);
  }
  const cv = document.createElement("canvas");
  cv.width = width;
  cv.height = height;
  const ctx = cv.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unsupported");
  ctx.drawImage(img, 0, 0, width, height);
  return cv;
}

function canvasToBlob(cv: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    cv.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      type,
      quality,
    );
  });
}

export async function runEla(file: File): Promise<ElaResult> {
  const anomalies: Anomaly[] = [];

  // Only JPEG/PNG/WebP useful; bail gracefully otherwise.
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    return {
      score: 100,
      meanDelta: 0,
      maxDelta: 0,
      hotspotRatio: 0,
      anomalies: [],
      previewDataUrl: null,
    };
  }

  const img = await loadImage(file);
  const src = canvasFromImage(img, 1600);
  const srcCtx = src.getContext("2d")!;
  const srcData = srcCtx.getImageData(0, 0, src.width, src.height);

  // Re-encode JPEG and decode back.
  const reencoded = await canvasToBlob(src, "image/jpeg", QUALITY);
  const url2 = URL.createObjectURL(reencoded);
  const img2 = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Re-encode decode failed"));
    i.src = url2;
  });
  const dst = document.createElement("canvas");
  dst.width = src.width;
  dst.height = src.height;
  const dstCtx = dst.getContext("2d")!;
  dstCtx.drawImage(img2, 0, 0, src.width, src.height);
  const dstData = dstCtx.getImageData(0, 0, src.width, src.height);
  URL.revokeObjectURL(url2);

  // Per-pixel delta + visualisation buffer.
  const total = src.width * src.height;
  const visual = dstCtx.createImageData(src.width, src.height);
  let sum = 0;
  let max = 0;
  let hotspot = 0;
  const a = srcData.data;
  const b = dstData.data;
  const v = visual.data;
  for (let i = 0; i < a.length; i += 4) {
    const dr = Math.abs(a[i] - b[i]);
    const dg = Math.abs(a[i + 1] - b[i + 1]);
    const db = Math.abs(a[i + 2] - b[i + 2]);
    const d = (dr + dg + db) / 3;
    sum += d;
    if (d > max) max = d;
    if (d > HOTSPOT_THRESHOLD) hotspot++;
    // amplify x4 for visualisation
    const amp = Math.min(255, d * 4);
    v[i] = amp;
    v[i + 1] = amp;
    v[i + 2] = amp;
    v[i + 3] = 255;
  }
  const meanDelta = sum / total;
  const hotspotRatio = hotspot / total;

  // Heuristics
  if (hotspotRatio > 0.02) {
    anomalies.push({
      engine: "ela",
      code: "ELA_HOTSPOT",
      label: `Zones de recompression hétérogènes (${(hotspotRatio * 100).toFixed(2)} % de pixels)`,
      detail: "Une partie de l'image réagit différemment à la recompression — signature classique de splice / overlay.",
      severity: hotspotRatio > 0.08 ? "high" : "medium",
    });
  }
  if (meanDelta < 1.2 && file.type === "image/jpeg") {
    anomalies.push({
      engine: "ela",
      code: "ELA_LOW_DELTA",
      label: "Image très uniforme après recompression",
      detail: "Soit l'image n'a été sauvegardée qu'une fois (bon signe), soit elle a été lissée pour effacer des traces.",
      severity: "info",
    });
  }

  // Score: penalize hotspot ratio
  const score = Math.max(0, Math.min(100, 100 - hotspotRatio * 800));

  // Build preview thumbnail
  let previewDataUrl: string | null = null;
  try {
    const previewCanvas = document.createElement("canvas");
    const scale = Math.min(1, PREVIEW_MAX / Math.max(src.width, src.height));
    previewCanvas.width = Math.round(src.width * scale);
    previewCanvas.height = Math.round(src.height * scale);
    const pctx = previewCanvas.getContext("2d")!;
    // Draw the full-res visual buffer, then scale
    const tmp = document.createElement("canvas");
    tmp.width = src.width;
    tmp.height = src.height;
    tmp.getContext("2d")!.putImageData(visual, 0, 0);
    pctx.drawImage(tmp, 0, 0, previewCanvas.width, previewCanvas.height);
    previewDataUrl = previewCanvas.toDataURL("image/jpeg", 0.7);
  } catch {
    previewDataUrl = null;
  }

  return {
    score,
    meanDelta,
    maxDelta: max,
    hotspotRatio,
    anomalies,
    previewDataUrl,
  };
}
