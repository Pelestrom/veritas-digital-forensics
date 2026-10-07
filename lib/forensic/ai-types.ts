/**
 * Contrat commun du moteur IA (« Analyse de contenu synthétique »).
 *
 * Texte : syntheticProbability (0..100) déclarée par le classifieur.
 * Image (ai-2.0) : la valeur du modèle n'est PAS une probabilité calibrée.
 * On produit une conclusion qualitative (`conclusion`) issue d'une analyse
 * globale puis, si nécessaire, régionale. `syntheticProbability` reste null.
 *
 * En cas d'échec : status `unavailable` ou `error`, `trustScore: null`.
 */

import type { Anomaly, EvidenceItem } from "./types";

export type AiOutcomeStatus = "completed" | "unavailable" | "error";

/** Conclusion qualitative du moteur IA image (remplace la « probabilité » non calibrée). */
export type AiImageConclusion =
  | "verified_ai"
  | "likely_ai"
  | "hybrid_ai"
  | "edited_non_generative"
  | "uncertain"
  | "no_significant_evidence";

export const AI_CONCLUSION_LABEL: Record<AiImageConclusion, string> = {
  verified_ai: "génération IA vérifiée",
  likely_ai: "génération IA probable",
  hybrid_ai: "contenu hybride probable",
  edited_non_generative: "retouche ou photomontage classique",
  uncertain: "origine incertaine",
  no_significant_evidence: "aucun indice synthétique exploitable",
};

export const AI_NO_EVIDENCE_MESSAGE =
  "Aucun indice synthétique exploitable n'a été détecté. Ce résultat ne permet pas d'exclure totalement une génération par intelligence artificielle.";

export interface AiRegionResult {
  name: string;
  classification: "synthetic" | "photographic" | "edited" | "uncertain";
  strength: "weak" | "moderate" | "strong";
  indicators: string[];
}

export interface AiImageDetails {
  contentType: string;
  confidence: "low" | "medium" | "high";
  realSubjectLikely: boolean;
  syntheticBackgroundLikely: boolean;
  compositingDetected: boolean;
  regionalPass: boolean;
  regions: AiRegionResult[];
  globalIndicators: string[];
  limitations: string[];
  cached?: boolean;
}

export interface AiOutcome {
  status: AiOutcomeStatus;
  kind: "image" | "text";
  /** 0..100 — null si indisponible ou si le moteur n'est pas calibré (image). */
  syntheticProbability: number | null;
  /** 0..100 — confiance déclarée par le détecteur. */
  serviceConfidence: number | null;
  /** Conversion documentée : trustScore = 100 - syntheticProbability. */
  trustScore: number | null;
  modelVersion: string | null;
  analyzedAt: string;
  rationale: string;
  /** Code technique sans donnée sensible (ex. HTTP_429, MISSING_KEY). */
  errorCode: string | null;
  anomalies: Anomaly[];
  evidence: EvidenceItem[];
  /** Image uniquement (moteur ai-2.0) : conclusion qualitative. */
  conclusion?: AiImageConclusion;
  details?: AiImageDetails;
}

export const AI_UNAVAILABLE_MESSAGE = "Analyse IA indisponible";
export const AI_SERVICE_ERROR_MESSAGE = "Analyse indisponible — service externe inaccessible";

/** Conversion explicite probabilité de génération → score de confiance (texte uniquement). */
export function trustFromSyntheticProbability(p: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - p)));
}

export function aiUnavailable(
  kind: AiOutcome["kind"],
  errorCode: string,
  detail: string,
): AiOutcome {
  return {
    status:
      errorCode === "MISSING_KEY" || errorCode.startsWith("HTTP_") || errorCode === "NETWORK"
        ? "unavailable"
        : "error",
    kind,
    syntheticProbability: null,
    serviceConfidence: null,
    trustScore: null,
    modelVersion: null,
    analyzedAt: new Date().toISOString(),
    rationale: `${AI_UNAVAILABLE_MESSAGE} — ${detail}`,
    errorCode,
    anomalies: [],
    evidence: [
      {
        group: "identity",
        key: kind === "image" ? "ai_image_status" : "ai_text_status",
        label: "Statut moteur IA",
        value: `${AI_UNAVAILABLE_MESSAGE} (${errorCode})`,
      },
    ],
  };
}
