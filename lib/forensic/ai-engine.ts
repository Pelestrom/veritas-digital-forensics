/**
 * Construction du résultat du moteur IA à partir des sorties du service
 * (image et/ou texte). C2PA n'appartient PAS à ce moteur.
 */

import {
  AI_CONCLUSION_LABEL,
  AI_SERVICE_ERROR_MESSAGE,
  type AiImageConclusion,
  type AiOutcome,
} from "./ai-types";
import type { AiBand } from "./strict-policy";

/** Score indicatif par conclusion (jamais 100 − valeur brute non calibrée). */
const CONCLUSION_SCORE: Record<AiImageConclusion, number> = {
  verified_ai: 0,
  likely_ai: 15,
  hybrid_ai: 30,
  edited_non_generative: 60,
  uncertain: 50,
  no_significant_evidence: 90,
};
const CONCLUSION_BAND: Record<AiImageConclusion, AiBand> = {
  verified_ai: "strong",
  likely_ai: "strong",
  hybrid_ai: "probable",
  edited_non_generative: "weak",
  uncertain: "uncertain",
  no_significant_evidence: "none",
};
const BAND_ORDER: AiBand[] = ["none", "weak", "uncertain", "probable", "strong"];
import {
  calculateAiConformityScore,
  calculateEngineScore,
  aiBand,
  AI_BAND_LABEL,
} from "./strict-policy";
import { attributeAi, type AiAttribution, type AttributionInput } from "./ai-registry";
import { makeEngineResult, subtest, type EngineResult, type SubtestResult } from "./engine-result";
import type { Anomaly, EvidenceItem } from "./types";

export type AiOrigin =
  | "human_authored"
  | "automated_institutional_document"
  | "generative_ai_probable"
  | "hybrid_or_edited"
  | "uncertain";

export interface AiEngineOutput {
  engine: EngineResult;
  anomalies: Anomaly[];
  evidence: EvidenceItem[];
  /** Identification prudente du générateur (jamais déduite du style visuel). */
  attribution: AiAttribution | null;
}

export function buildAiEngine(
  outcomes: AiOutcome[],
  /** Valeurs techniques (métadonnées, workflows, chunks) autorisées à nommer une IA. */
  technicalValues: AttributionInput["technicalValues"] = [],
  /** Producteur automatisé attendu (Office, ERP, FPDF, e-Justice…) détecté. */
  automatedProducer = false,
): AiEngineOutput {
  const anomalies: Anomaly[] = [];
  const evidence: EvidenceItem[] = [];
  const subtests: SubtestResult[] = [];

  if (outcomes.length === 0) {
    return {
      engine: makeEngineResult({
        engineId: "ai",
        status: "not_applicable",
        score: null,
        summary: "Aucune analyse de contenu synthétique applicable à ce format.",
        subtests: [
          subtest(
            "synthetic",
            "Contenu synthétique",
            0,
            "not_applicable",
            "Non applicable à ce format",
            null,
          ),
        ],
      }),
      anomalies,
      evidence,
      attribution: null,
    };
  }

  const scored: number[] = [];
  const probabilities: number[] = [];
  const limitations: string[] = [];
  const models: string[] = [];
  const bands: AiBand[] = [];
  const conclusions: AiImageConclusion[] = [];
  let aiDetails: AiOutcome["details"] | null = null;

  for (const o of outcomes) {
    if (o.status === "completed" && o.conclusion) {
      // Moteur image ai-2.0 : conclusion qualitative, aucune probabilité calibrée.
      const c = o.conclusion;
      const conformity = CONCLUSION_SCORE[c];
      const band = CONCLUSION_BAND[c];
      anomalies.push(...o.anomalies);
      evidence.push(...o.evidence);
      scored.push(conformity);
      bands.push(band);
      conclusions.push(c);
      aiDetails = o.details ?? null;
      if (o.modelVersion) models.push(o.modelVersion);
      subtests.push({
        ...subtest(
          `ai_${o.kind}`,
          "Génération d'image par IA",
          1 / outcomes.length,
          "completed",
          `Conclusion IA : ${AI_CONCLUSION_LABEL[c]}. ${o.rationale}`.trim(),
          conformity,
          {
            aiConclusion: c,
            serviceConfidence: o.serviceConfidence,
            engineReliability: 40,
            indicativeScore: conformity,
            band,
            detectorModel: o.modelVersion,
            analyzedAt: o.analyzedAt,
          },
        ),
        severity:
          band === "none" || band === "weak"
            ? "none"
            : band === "uncertain"
              ? "weak"
              : band === "probable"
                ? "medium"
                : "high",
        hasAnomaly: band !== "none" && band !== "weak",
        reliability: 40,
        confidence: o.serviceConfidence,
      });
      continue;
    }
    // Ne jamais signaler « contenu synthétique » sous le seuil de 30 %.
    const lowBand = typeof o.syntheticProbability === "number" && o.syntheticProbability < 30;
    anomalies.push(...(lowBand ? [] : o.anomalies));
    evidence.push(...o.evidence);
    const label =
      o.kind === "image" ? "Génération d'image par IA" : "Génération / réécriture de texte par IA";
    if (o.status === "completed" && typeof o.syntheticProbability === "number") {
      bands.push(aiBand(o.syntheticProbability));
      // Indicateur : round(100 − probabilité synthétique). Aucune grille arbitraire.
      const conformity = calculateAiConformityScore(o.syntheticProbability);
      const band = aiBand(o.syntheticProbability);
      scored.push(conformity);
      probabilities.push(o.syntheticProbability);
      if (o.modelVersion) models.push(o.modelVersion);
      const summary =
        band === "none" ? AI_BAND_LABEL.none : `${AI_BAND_LABEL[band]} ${o.rationale}`.trim();
      subtests.push({
        ...subtest(`ai_${o.kind}`, label, 1 / outcomes.length, "completed", summary, conformity, {
          syntheticProbability: o.syntheticProbability,
          serviceConfidence: o.serviceConfidence,
          engineReliability: 60,
          indicativeScore: conformity,
          band,
          detectorModel: o.modelVersion,
          analyzedAt: o.analyzedAt,
        }),
        severity:
          band === "none" || band === "weak"
            ? "none"
            : band === "uncertain"
              ? "weak"
              : band === "probable"
                ? "medium"
                : "high",
        hasAnomaly: band !== "none" && band !== "weak",
        reliability: 60,
        confidence: o.serviceConfidence,
      });
    } else {
      limitations.push(`${label} : ${o.rationale}`);
      subtests.push(
        subtest(
          `ai_${o.kind}`,
          label,
          1 / outcomes.length,
          o.status,
          AI_SERVICE_ERROR_MESSAGE,
          null,
          {
            errorCode: o.errorCode,
          },
        ),
      );
    }
  }

  const hasScore = scored.length > 0;
  // Politique stricte : minimum, jamais de moyenne.
  const score = calculateEngineScore(subtests);
  const syntheticProbability = probabilities.length
    ? Math.round(probabilities.reduce((a, b) => a + b, 0) / probabilities.length)
    : null;
  const band: AiBand | null = bands.length
    ? bands.reduce((a, b) => (BAND_ORDER.indexOf(b) > BAND_ORDER.indexOf(a) ? b : a))
    : null;
  const aiConclusion = conclusions[0] ?? null;
  const origin: AiOrigin =
    aiConclusion === "edited_non_generative" || aiConclusion === "hybrid_ai"
      ? "hybrid_or_edited"
      : band === null
        ? "uncertain"
        : band === "none" || band === "weak"
          ? automatedProducer
            ? "automated_institutional_document"
            : "human_authored"
          : band === "uncertain"
            ? "uncertain"
            : band === "probable"
              ? "hybrid_or_edited"
              : "generative_ai_probable";
  const status = hasScore
    ? "completed"
    : outcomes.every((o) => o.status === "error")
      ? "error"
      : "unavailable";

  // Identification prudente : seule une preuve technique nomme un générateur.
  const attribution = attributeAi({
    technicalValues,
    detectorPositive: band === "probable" || band === "strong",
  });

  const engine = makeEngineResult({
    engineId: "ai",
    status,
    score,
    // Les détecteurs de contenu synthétique restent probabilistes.
    confidence: hasScore ? (aiConclusion ? 40 : 60) : 0,
    coverage: Math.round((scored.length / outcomes.length) * 100),
    summary:
      hasScore && aiConclusion
        ? `Conclusion IA : ${AI_CONCLUSION_LABEL[aiConclusion]} — fiabilité du moteur : limitée.${attribution?.detected && attribution.level === "confirmed" ? ` · ${attribution.explanation}` : ""}`
        : hasScore
          ? `Probabilité synthétique : ${syntheticProbability} % — score indicatif : ${score}/100. ${band ? AI_BAND_LABEL[band] : ""}${attribution?.detected && attribution.level === "confirmed" ? ` · ${attribution.explanation}` : ""}`
          : AI_SERVICE_ERROR_MESSAGE,
    limitations: [
      ...limitations,
      ...(aiConclusion
        ? [
            "Image : l'indice brut du modèle n'est pas une probabilité calibrée ; la conclusion repose sur une analyse globale puis régionale (sujet, arrière-plan, objets, textes, raccords).",
            "« Aucun indice exploitable » ne constitue jamais une preuve d'authenticité.",
          ]
        : []),
      "Texte — interprétation : < 10 % aucun indice significatif · 10–29 % informatif · 30–59 % incertain · 60–84 % probable · ≥ 85 % indice fort.",
      "Une création automatisée (ERP, logiciel administratif, Office, FPDF…) n'est pas une génération par IA. Champs de fusion, formulaires répétitifs et erreurs d'OCR ne sont pas des preuves d'IA.",
      "Une ressemblance avec un document officiel décrit un style, jamais une authenticité institutionnelle.",
      ...(band === "probable" || band === "strong"
        ? [
            attribution?.level === "confirmed"
              ? attribution.explanation
              : "Origine générative non attribuable avec fiabilité.",
          ]
        : []),
    ],
    technicalDetails: {
      syntheticProbability,
      aiConclusion,
      aiDetails: aiDetails ? JSON.stringify(aiDetails) : null,
      detectorModels: models.join(", ") || null,
      indicativeFormula: "round(100 − probabilité synthétique)",
      band,
      origin,
      engineReliability: hasScore ? 60 : 0,
      attributionLevel: attribution?.level ?? "unknown",
      providerName: attribution?.providerName ?? null,
      toolName: attribution?.toolName ?? null,
      modelName: attribution?.modelName ?? null,
      modelVersion: attribution?.modelVersion ?? null,
    },
    subtests,
  });

  return { engine, anomalies, evidence, attribution };
}
