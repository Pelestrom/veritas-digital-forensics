/**
 * File validation rules for the forensic upload pipeline.
 * Mirrors Phase 2 of the platform spec — strict MIME + extension whitelist.
 */

export const SUPPORTED_FORMATS = {
  image: {
    label: "Image",
    extensions: ["jpg", "jpeg", "png", "tiff", "tif", "webp"],
    mimeTypes: [
      "image/jpeg",
      "image/png",
      "image/tiff",
      "image/webp",
    ],
  },
  document: {
    label: "Document",
    extensions: ["pdf", "docx"],
    mimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  },
  video: {
    label: "Vidéo",
    extensions: ["mp4", "mov"],
    mimeTypes: ["video/mp4", "video/quicktime"],
  },
} as const;

export const MAX_FILE_SIZE_MB = 100;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export type FileCategory = keyof typeof SUPPORTED_FORMATS;

export interface ValidationResult {
  ok: boolean;
  category?: FileCategory;
  error?: string;
}

export function getFileExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

export function validateFile(file: File): ValidationResult {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo > ${MAX_FILE_SIZE_MB} Mo)`,
    };
  }

  const ext = getFileExtension(file.name);
  for (const [key, def] of Object.entries(SUPPORTED_FORMATS) as Array<
    [FileCategory, (typeof SUPPORTED_FORMATS)[FileCategory]]
  >) {
    const extOk = (def.extensions as readonly string[]).includes(ext);
    const mimeOk = (def.mimeTypes as readonly string[]).includes(file.type);
    if (extOk && mimeOk) return { ok: true, category: key };
    if (extOk && !file.type) return { ok: true, category: key }; // some browsers omit MIME
    if (extOk && !mimeOk) {
      return {
        ok: false,
        error: `Incohérence extension/MIME : .${ext} déclaré comme ${file.type || "inconnu"}`,
      };
    }
  }

  return {
    ok: false,
    error: `Format non supporté (.${ext || "?"}). Formats acceptés : images, PDF, DOCX, vidéo.`,
  };
}

export const ALL_ACCEPT_ATTR = Object.values(SUPPORTED_FORMATS)
  .flatMap((d) => [
    ...d.mimeTypes,
    ...d.extensions.map((e) => `.${e}`),
  ])
  .join(",");

/** Browser-side SHA-256 hash of a File. Returns lowercase hex. */
export async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
