/**
 * Moteur IA image — ai-2.0.
 *
 * La valeur numérique d'un modèle de vision n'est pas une probabilité
 * forensic calibrée : elle n'est plus utilisée pour conclure. On produit une
 * conclusion qualitative (AiImageConclusion) en deux étapes :
 *   1. analyse globale (toujours, un seul appel) ;
 *   2. analyse régionale (≤ 5 régions) UNIQUEMENT pour affiches, compositions,
 *      montages ou résultat global incertain.
 * Résultat mis en cache par SHA-256 (même fichier → aucun nouvel appel).
 * Exécuté côté serveur ; toute indisponibilité renvoie unavailable/error.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Anomaly, EvidenceItem } from "./types";
import {
  AI_CONCLUSION_LABEL,
  AI_NO_EVIDENCE_MESSAGE,
  aiUnavailable,
  type AiImageConclusion,
  type AiImageDetails,
  type AiOutcome,
  type AiRegionResult,
} from "./ai-types";
import { callAiJson } from "./ai-call.server";

const PayloadSchema = z.object({
  imageDataUrl: z
    .string()
    .min(64)
    .max(8 * 1024 * 1024)
    .regex(/^data:image\/(jpeg|jpg|png|webp);base64,/),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .optional(),
});

const ENGINE_VERSION = "ai-image-2.0";
const GATEWAY_MODEL = "google/gemini-3.6-flash";
const GOOGLE_MODEL = "gemini-3.6-flash";

const CONCLUSIONS: AiImageConclusion[] = [
  "verified_ai",
  "likely_ai",
  "hybrid_ai",
  "edited_non_generative",
  "uncertain",
  "no_significant_evidence",
];

const VISUAL_CUES =
  "cutout transitions, artificial edges, incompatible lighting, inconsistent shadows, impossible reflections, " +
  "resolution and noise differences between areas, repetitive or over-smooth textures, anatomy (fingers, eyes, glasses, teeth, ears), " +
  "perspective, subject/background seams, melted objects, irregular geometry, repeated patterns, artificial sky/water/clouds/vegetation, " +
  "warped typography, embedded text, inter-region inconsistencies, photomontage look, partial generation or inpainting";

const GLOBAL_PROMPT =
  "You are a digital-image forensics analyst. Analyse the VISUAL CHARACTERISTICS of this image to determine whether it is photographic, " +
  "AI-generated, partially generated, composited or retouched. Do not rely on the realism of a face: a real photographic subject can be placed " +
  "on a synthetic background. Consider subject, background, objects, text and their seams separately. A professional layout or coherent text " +
  "is NOT evidence of human origin. Examine: " +
  VISUAL_CUES +
  ". Reply ONLY with compact JSON, no narrative: " +
  '{"contentType":"photograph|poster|composite|illustration|document|uncertain",' +
  '"conclusion":"likely_ai|hybrid_ai|edited_non_generative|uncertain|no_significant_evidence",' +
  '"confidence":"low|medium|high","realSubjectLikely":bool,"syntheticBackgroundLikely":bool,"compositingDetected":bool,' +
  '"regions":[{"name":str,"classification":"synthetic|photographic|edited|uncertain","strength":"weak|moderate|strong","indicators":[str]}],' +
  '"globalIndicators":[str],"limitations":[str]}. ' +
  "At most 5 regions, at most 5 short indicators each (≤ 12 words). If evidence is insufficient answer uncertain instead of inventing certainty.";

const REGIONAL_PROMPT =
  "You are a digital-image forensics analyst. This image is a composition or its global origin is uncertain. Analyse SEPARATELY, at most 5 regions: " +
  "1) main subject or face, 2) background, 3) decorative objects (sky, water, moon, plants…), 4) text and logos, 5) transitions between elements. " +
  "For each region judge only visual characteristics: " +
  VISUAL_CUES +
  ". The realism of the subject must not decide for the rest of the image. Reply ONLY with compact JSON: " +
  '{"regions":[{"name":str,"classification":"synthetic|photographic|edited|uncertain","strength":"weak|moderate|strong","indicators":[str]}],' +
  '"realSubjectLikely":bool,"syntheticBackgroundLikely":bool,"compositingDetected":bool,"limitations":[str]}. ' +
  "Short indicators only (≤ 12 words, ≤ 5 per region).";

/** Cache mémoire par SHA-256 (instance serveur). */
const CACHE = new Map<string, AiOutcome>();
const CACHE_MAX = 200;

const str = (v: unknown, max = 160) => (typeof v === "string" ? v.slice(0, max) : "");
const strList = (v: unknown, n = 5) =>
  Array.isArray(v)
    ? v
        .slice(0, n)
        .map((x) => str(x))
        .filter(Boolean)
    : [];

function parseRegions(v: unknown): AiRegionResult[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 5).map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const cls = ["synthetic", "photographic", "edited", "uncertain"].includes(
      o.classification as string,
    )
      ? (o.classification as AiRegionResult["classification"])
      : "uncertain";
    const strength = ["weak", "moderate", "strong"].includes(o.strength as string)
      ? (o.strength as AiRegionResult["strength"])
      : "weak";
    return {
      name: str(o.name, 60) || "région",
      classification: cls,
      strength,
      indicators: strList(o.indicators),
    };
  });
}

function safeJson(content: string): Record<string, unknown> | null {
  try {
    const cleaned = content.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const obj = JSON.parse(cleaned);
    return obj && typeof obj === "object" ? (obj as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const RANK: Record<AiImageConclusion, number> = {
  verified_ai: 6,
  likely_ai: 5,
  hybrid_ai: 4,
  edited_non_generative: 3,
  uncertain: 2,
  no_significant_evidence: 1,
};

/** Fusion des régions — règles explicites, sans moyenne. */
function fuseRegions(regions: AiRegionResult[], realSubject: boolean): AiImageConclusion | null {
  if (regions.length === 0) return null;
  const synth = regions.filter((r) => r.classification === "synthetic");
  const strongSynth = synth.filter((r) => r.strength === "strong");
  const solidSynth = synth.filter((r) => r.strength !== "weak");
  const photo = regions.some((r) => r.classification === "photographic");
  const edited = regions.filter((r) => r.classification === "edited" && r.strength !== "weak");
  if (solidSynth.length > 0 && (photo || realSubject)) return "hybrid_ai";
  if (strongSynth.length >= 2) return "likely_ai";
  if (solidSynth.length > 0) return "likely_ai";
  if (edited.length > 0) return "edited_non_generative";
  if (
    synth.length > 0 ||
    regions.some((r) => r.classification === "uncertain" && r.strength !== "weak")
  )
    return "uncertain";
  return "no_significant_evidence";
}

export const detectAiImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PayloadSchema.parse(input))
  .handler(async ({ data }): Promise<AiOutcome> => {
    const cacheKey = data.sha256?.toLowerCase();
    if (cacheKey && CACHE.has(cacheKey)) {
      const hit = CACHE.get(cacheKey)!;
      return { ...hit, details: hit.details ? { ...hit.details, cached: true } : hit.details };
    }

    const image = { type: "image_url" as const, image_url: { url: data.imageDataUrl } };

    // ---- Étape 1 : analyse globale
    const g = await callAiJson({
      gatewayModel: GATEWAY_MODEL,
      googleModel: GOOGLE_MODEL,
      messages: [
        { role: "system", content: GLOBAL_PROMPT },
        {
          role: "user",
          content: [{ type: "text", text: "Global forensic analysis. JSON only." }, image],
        },
      ],
    });
    if (!g.ok) return aiUnavailable("image", g.errorCode, g.detail);
    const gj = safeJson(g.content);
    if (!gj)
      return aiUnavailable("image", "PARSE_ERROR", "réponse non conforme au schéma JSON attendu");

    const contentType = str(gj.contentType, 20) || "uncertain";
    let globalConclusion = CONCLUSIONS.includes(gj.conclusion as AiImageConclusion)
      ? (gj.conclusion as AiImageConclusion)
      : "uncertain";
    // Un modèle de vision ne peut pas VÉRIFIER une provenance : seule une preuve technique le peut.
    if (globalConclusion === "verified_ai") globalConclusion = "likely_ai";
    const confidence = (
      ["low", "medium", "high"].includes(gj.confidence as string) ? gj.confidence : "low"
    ) as AiImageDetails["confidence"];
    let realSubjectLikely = Boolean(gj.realSubjectLikely);
    let syntheticBackgroundLikely = Boolean(gj.syntheticBackgroundLikely);
    let compositingDetected = Boolean(gj.compositingDetected);
    let regions = parseRegions(gj.regions);
    const globalIndicators = strList(gj.globalIndicators, 8);
    const limitations = strList(gj.limitations, 5);

    // ---- Étape 2 : analyse régionale conditionnelle
    const needsRegional =
      ["poster", "composite", "uncertain"].includes(contentType) ||
      compositingDetected ||
      globalConclusion === "uncertain" ||
      (realSubjectLikely && syntheticBackgroundLikely);
    let regionalPass = false;
    if (needsRegional) {
      const r = await callAiJson({
        gatewayModel: GATEWAY_MODEL,
        googleModel: GOOGLE_MODEL,
        messages: [
          { role: "system", content: REGIONAL_PROMPT },
          {
            role: "user",
            content: [{ type: "text", text: "Regional forensic analysis. JSON only." }, image],
          },
        ],
      });
      const rj = r.ok ? safeJson(r.content) : null;
      if (rj) {
        regionalPass = true;
        const rr = parseRegions(rj.regions);
        if (rr.length) regions = rr;
        realSubjectLikely = realSubjectLikely || Boolean(rj.realSubjectLikely);
        syntheticBackgroundLikely =
          syntheticBackgroundLikely || Boolean(rj.syntheticBackgroundLikely);
        compositingDetected = compositingDetected || Boolean(rj.compositingDetected);
        limitations.push(...strList(rj.limitations, 3));
      } else {
        limitations.push(
          "Analyse régionale indisponible — conclusion fondée sur l'analyse globale seule.",
        );
      }
    }

    // ---- Fusion
    const regional = fuseRegions(regions, realSubjectLikely);
    let conclusion: AiImageConclusion = globalConclusion;
    if (regional) {
      if (RANK[globalConclusion] >= 4 && regional === "no_significant_evidence")
        conclusion = "uncertain"; // contradiction
      else conclusion = RANK[regional] > RANK[globalConclusion] ? regional : globalConclusion;
    }
    if (
      conclusion === "likely_ai" &&
      realSubjectLikely &&
      (syntheticBackgroundLikely || compositingDetected)
    )
      conclusion = "hybrid_ai";
    if (
      conclusion === "no_significant_evidence" &&
      (syntheticBackgroundLikely || (compositingDetected && contentType !== "photograph"))
    )
      conclusion = "uncertain";

    const details: AiImageDetails = {
      contentType,
      confidence,
      realSubjectLikely,
      syntheticBackgroundLikely,
      compositingDetected,
      regionalPass,
      regions,
      globalIndicators,
      limitations: limitations.slice(0, 6),
    };

    const label = AI_CONCLUSION_LABEL[conclusion];
    const indicators = [
      ...globalIndicators,
      ...regions
        .filter((r) => r.classification !== "photographic")
        .flatMap((r) => r.indicators.map((i) => `${r.name} : ${i}`)),
    ].slice(0, 8);

    const anomalies: Anomaly[] = [];
    if (conclusion === "likely_ai" || conclusion === "hybrid_ai") {
      anomalies.push({
        code: "AI_GENERATED_LIKELY",
        label:
          conclusion === "hybrid_ai"
            ? "Contenu hybride probable : sujet photographique intégré à un environnement potentiellement synthétique"
            : "Image probablement générée par IA (indices convergents)",
        detail: indicators.length ? "Indicateurs : " + indicators.join(" · ") : undefined,
        severity: conclusion === "likely_ai" && confidence === "high" ? "critical" : "high",
        engine: "ai",
      });
    } else if (conclusion === "uncertain") {
      anomalies.push({
        code: "AI_GENERATED_SUSPECT",
        label: "Origine synthétique incertaine — arrière-plan et composition à examiner",
        detail: indicators.join(" · ") || undefined,
        severity: "medium",
        engine: "ai",
      });
    }

    const rationale =
      conclusion === "no_significant_evidence"
        ? AI_NO_EVIDENCE_MESSAGE
        : conclusion === "hybrid_ai"
          ? "Un sujet photographique semble avoir été intégré à un environnement potentiellement synthétique ou fortement composé."
          : `Conclusion IA : ${label}.`;

    const evidence: EvidenceItem[] = [
      { group: "identity", key: "ai_conclusion", label: "Conclusion IA (image)", value: label },
      { group: "identity", key: "ai_content_type", label: "Nature de l'image", value: contentType },
      {
        group: "identity",
        key: "ai_regional",
        label: "Analyse régionale",
        value: regionalPass ? `${regions.length} région(s) examinée(s)` : "non déclenchée",
      },
      {
        group: "identity",
        key: "ai_engine_reliability",
        label: "Fiabilité du moteur",
        value: "limitée (détecteur non calibré)",
      },
      { group: "identity", key: "ai_model", label: "Modèle utilisé", value: g.model },
    ];
    if (indicators.length)
      evidence.push({
        group: "identity",
        key: "ai_indicators",
        label: "Indicateurs visuels",
        value: indicators.join(", "),
      });

    const outcome: AiOutcome = {
      status: "completed",
      kind: "image",
      syntheticProbability: null,
      serviceConfidence: confidence === "high" ? 80 : confidence === "medium" ? 55 : 30,
      trustScore: null,
      modelVersion: `${ENGINE_VERSION} · ${g.model}`,
      analyzedAt: new Date().toISOString(),
      rationale,
      errorCode: null,
      anomalies,
      evidence,
      conclusion,
      details,
    };

    if (cacheKey) {
      if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value as string);
      CACHE.set(cacheKey, outcome);
    }
    return outcome;
  });
