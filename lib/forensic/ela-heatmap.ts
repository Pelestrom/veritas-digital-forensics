/**
 * Heatmap ELA tuilée — segmente l'image en tuiles (par défaut 16×16),
 * calcule un score par tuile (delta moyen normalisé) et restitue à la
 * fois un aperçu PNG (data URL) coloré et la grille brute exploitable.
 *
 * Sert à localiser visuellement les zones potentiellement ajoutées /
 * retouchées (overlay, splice, Magic Edit) au lieu d'un simple score
 * global. Tourne côté navigateur (Canvas) pour rester portable Worker.
 */

export interface HeatmapTile {
  x: number;
  y: number;
  /** 0..100, plus haut = plus suspect. */
  score: number;
}

export interface HeatmapResult {
  /** Nombre de tuiles dans chaque direction. */
  cols: number;
  rows: number;
  tiles: HeatmapTile[];
  /** Tuiles "chaudes" (score > 60). */
  hotspotCount: number;
  /** Score max sur la grille. */
  maxTileScore: number;
  /** PNG coloré (overlay rouge) pour le rapport. */
  previewDataUrl: string | null;
}

const QUALITY = 0.85;
const PREVIEW_MAX = 480;

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("decode failed"));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5_000);
  }
}

export async function runElaHeatmap(file: File, gridSize = 16): Promise<HeatmapResult | null> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return null;

  const img = await loadImage(file);
  // Downscale for performance
  const maxDim = 1024;
  const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
  const W = Math.max(64, Math.round(img.width * ratio));
  const H = Math.max(64, Math.round(img.height * ratio));

  const src = document.createElement("canvas");
  src.width = W; src.height = H;
  const sctx = src.getContext("2d")!;
  sctx.drawImage(img, 0, 0, W, H);
  const srcData = sctx.getImageData(0, 0, W, H);

  const blob = await new Promise<Blob>((res, rej) =>
    src.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", QUALITY),
  );
  const url2 = URL.createObjectURL(blob);
  const img2 = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("re-decode"));
    i.src = url2;
  });
  const dst = document.createElement("canvas");
  dst.width = W; dst.height = H;
  const dctx = dst.getContext("2d")!;
  dctx.drawImage(img2, 0, 0, W, H);
  const dstData = dctx.getImageData(0, 0, W, H);
  URL.revokeObjectURL(url2);

  // Tiles
  const cols = gridSize;
  const rows = Math.max(1, Math.round((gridSize * H) / W));
  const tileW = Math.floor(W / cols);
  const tileH = Math.floor(H / rows);
  const tiles: HeatmapTile[] = [];
  const a = srcData.data;
  const b = dstData.data;

  let maxTileScore = 0;
  let hotspot = 0;

  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      let sum = 0; let count = 0;
      const x0 = tx * tileW;
      const y0 = ty * tileH;
      const x1 = Math.min(W, x0 + tileW);
      const y1 = Math.min(H, y0 + tileH);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * W + x) * 4;
          const d = (Math.abs(a[i] - b[i]) + Math.abs(a[i+1] - b[i+1]) + Math.abs(a[i+2] - b[i+2])) / 3;
          sum += d; count++;
        }
      }
      const mean = sum / Math.max(1, count);
      // Normaliser : ~0..30 channels diff → 0..100
      const score = Math.min(100, Math.round((mean / 18) * 100));
      if (score > maxTileScore) maxTileScore = score;
      if (score > 60) hotspot++;
      tiles.push({ x: tx, y: ty, score });
    }
  }

  // Render coloured overlay preview
  let previewDataUrl: string | null = null;
  try {
    const pcv = document.createElement("canvas");
    const pscale = Math.min(1, PREVIEW_MAX / Math.max(W, H));
    pcv.width = Math.round(W * pscale);
    pcv.height = Math.round(H * pscale);
    const pctx = pcv.getContext("2d")!;
    pctx.drawImage(src, 0, 0, pcv.width, pcv.height);
    const cellW = pcv.width / cols;
    const cellH = pcv.height / rows;
    for (const t of tiles) {
      if (t.score < 25) continue;
      const alpha = Math.min(0.65, t.score / 130);
      pctx.fillStyle = `rgba(220, 38, 38, ${alpha})`;
      pctx.fillRect(t.x * cellW, t.y * cellH, cellW + 0.5, cellH + 0.5);
    }
    previewDataUrl = pcv.toDataURL("image/jpeg", 0.72);
  } catch {
    previewDataUrl = null;
  }

  return { cols, rows, tiles, hotspotCount: hotspot, maxTileScore, previewDataUrl };
}
