/**
 * Pondération dynamique — adapte les poids des moteurs selon le profil de
 * document détecté. Les poids fixes du Trust Engine V1 sont remplacés par
 * cette table contextuelle.
 */

import type { Anomaly, EngineScores } from "./types";

export type DocumentProfile =
  | "image"
  | "pdf_text"
  | "pdf_scanned"
  | "office_doc"
  | "administrative"
  | "unknown";

export const PROFILE_LABEL: Record<string, string> = {
  image: "Image",
  pdf_text: "PDF natif (texte)",
  pdf_scanned: "PDF scanné",
  office_doc: "Document Office",
  administrative: "Document administratif",
  unknown: "Type indéterminé",
  // Profils V4 (basés sur le format réel détecté par signature binaire)
  jpeg: "JPEG",
  png: "PNG",
  webp_tiff: "WebP / TIFF",
  pdf: "PDF",
  docx: "DOCX",
};

export type EngineWeights = Record<keyof EngineScores, number>;

const WEIGHTS: Record<DocumentProfile, EngineWeights> = {
  image:          { metadata: 0.25, ela: 0.40, structure: 0.10, crypto: 0.10, ai: 0.15 },
  pdf_text:       { metadata: 0.40, ela: 0.05, structure: 0.35, crypto: 0.15, ai: 0.05 },
  pdf_scanned:    { metadata: 0.20, ela: 0.30, structure: 0.25, crypto: 0.10, ai: 0.15 },
  office_doc:     { metadata: 0.45, ela: 0.05, structure: 0.40, crypto: 0.05, ai: 0.05 },
  administrative: { metadata: 0.40, ela: 0.20, structure: 0.25, crypto: 0.10, ai: 0.05 },
  unknown:        { metadata: 0.35, ela: 0.30, structure: 0.20, crypto: 0.10, ai: 0.05 },
};

export function weightsFor(profile: DocumentProfile): EngineWeights {
  return WEIGHTS[profile];
}

/**
 * Détection heuristique du profil à partir du MIME, du nom de fichier et
 * d'éventuels signaux (OCR détecté, scan…).
 */
export function detectProfile(args: {
  mimeType?: string | null;
  filename?: string | null;
  fileType?: string | null;
  anomalies?: Anomaly[];
}): DocumentProfile {
  const mime = (args.mimeType ?? "").toLowerCase();
  const name = (args.filename ?? "").toLowerCase();
  const type = (args.fileType ?? "").toLowerCase();

  if (mime.startsWith("image/") || type === "image") return "image";

  const isPdf = mime === "application/pdf" || name.endsWith(".pdf");
  if (isPdf) {
    const ocr = (args.anomalies ?? []).some((a) => a.code === "OCR_LAYER_DETECTED");
    if (ocr) return "pdf_scanned";
    // Heuristique : si on a un nom évocateur (facture, releve, diplome…) → administratif
    if (/(facture|invoice|releve|diplome|bulletin|attestation|certificat|carte|passeport)/.test(name)) {
      return "administrative";
    }
    return "pdf_text";
  }

  if (/\.(docx|doc|xlsx|xls|pptx|ppt|odt|ods)$/i.test(name) || mime.includes("officedocument") || mime.includes("opendocument")) {
    return "office_doc";
  }

  return "unknown";
}
